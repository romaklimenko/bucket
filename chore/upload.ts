import {BlobDocument, Level} from '../models/documents';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv'; dotenv.config();
import { MongoClient } from 'mongodb';
import { Storage } from '@google-cloud/storage';
import deleteEmpty from 'delete-empty';

const uploadDir = path.resolve(process.env.UPLOAD_DIR!);

async function main() {
  const gcs_storage = new Storage();
  const bucket = gcs_storage.bucket(process.env.BUCKET_STANDARD!);

  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const db = client.db(process.env.MONGODB_DB!);
  const blobsCollection = db.collection<BlobDocument>('blobs');

  console.info(`Uploading files from ${uploadDir}`);
  
  for (const file of readdir(uploadDir)) {
    if (deleteIfIgnored(file)) {
      continue;
    }
  
    const filePath = path.parse(file);
    console.info('filePath', filePath);
  
    const blobDocument = buildBlobDocument(file);

    if (blobDocument.contentType === 'application/octet-stream') {
      continue;
    }
  
    const existingBlobDocument = await blobsCollection.findOne({ _id: blobDocument._id });
    if (existingBlobDocument) {
      console.info('Blob already exists in database.');
      
      if (existingBlobDocument.length !== blobDocument.length) {
        throw new Error(`Collision! Blob ${blobDocument._id} has different size!`);
      }
      
      await blobsCollection.updateOne({ _id: blobDocument._id }, { $addToSet: { paths: blobDocument.paths[0], dirs: blobDocument.dirs[0] } });
    } else {
      console.info('Blob does not exist in database.');
      await bucket.upload(file, {
        destination: blobDocument._id,
        metadata: {
          contentType: blobDocument.contentType,
        }
      });

      await blobsCollection.insertOne(blobDocument);
      fs.unlinkSync(file);
      try {
        await deleteEmpty(filePath.dir);
      } catch (error) {
        console.error(error);
      }
    }
  
    console.info('blob', blobDocument);
  }

  console.info('Upload complete.');

  await client.close();

  await deleteEmpty(uploadDir);
}

main().catch(console.error);

///////////////////////////////////////////////////////////////////////////////

function buildBlobDocument(file: string): BlobDocument {
  const filePath = path.parse(file);
  const now = new Date();

  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');

  return {
    _id: hash,
    contentType: contentType(filePath.ext.toLowerCase()),
    created: now,
    paths: [file.replace(uploadDir, '')],
    lastModified: now,
    length: fs.statSync(file).size,
    level: Level.New,
    tags: [],
    dirs: [ filePath.dir.replace(uploadDir, '') ],
    bucket: process.env.BUCKET_STANDARD!
  };
}

function deleteIfIgnored(file: string): boolean {
  const filePath = path.parse(file);
  if (filePath.base === '.DS_Store') {
    console.warn(`Deleting ${file}`);
    fs.unlinkSync(file);
    return true;
  }
  return false;
}

function readdir(dir: string): string[] {
  const result = [];
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      result.push(...readdir(filePath));
    } else {
      result.push(filePath);
    }
  }
  return result;
}

function contentType(ext: string): string {
  switch (ext) {
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.mp4':
    case '.gifv':
      return 'video/mp4';
  }
  return 'application/octet-stream';
}
