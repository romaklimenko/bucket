import { BlobDocument, Level } from '../models/documents';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv'; dotenv.config();
import { MongoClient } from 'mongodb';
import { Storage } from '@google-cloud/storage';
import deleteEmpty from 'delete-empty';
import { loadConfig } from '../lib/server-utils';
import { addDays, contentType } from '../lib/utils';
import readdirp from 'readdirp';
import bytes from 'bytes';

const config = loadConfig();

const uploadDir = path.resolve(process.env.UPLOAD_DIR!);

async function main() {
  const gcs_storage = new Storage();
  const bucket = gcs_storage.bucket(process.env.BUCKET_STANDARD!);

  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const db = client.db(process.env.MONGODB_DB!);
  const blobsCollection = db.collection<BlobDocument>('blobs');

  const deleteThresholdPeriodInDays = 7;
  const uploadThreshold = parseInt(process.env.UPLOAD_THRESHOLD!, 10);

  const newDayStartsAtHours = 22;

  const largeFileSize = bytes('1MB');

  const createdLastPeriod = await blobsCollection.countDocuments({
    created: {
      $gte: new Date().getHours() < newDayStartsAtHours ? new Date(new Date().setHours(newDayStartsAtHours - 24, 0, 0, 0)) : new Date(new Date().setHours(newDayStartsAtHours, 0, 0, 0))
    },
    level: { $gte: Level.Trashed },
    length: { $lte: largeFileSize }
  });

  let remainingUploads = uploadThreshold - createdLastPeriod;

  console.warn(
    'You created', createdLastPeriod, 'blobs today.',
    remainingUploads, 'uploads are allowed today.');

  console.info('Upload directory:', uploadDir);

  await blobsCollection.deleteMany({
    level: Level.Deleted,
    lastModified: { $lt: addDays(deleteThresholdPeriodInDays * -1) }
  });

  let warnedAboutRemainingUploads = false;

  let lastDir = '';

  const files = [];

  for await (const entry of readdirp(uploadDir)) {
    files.push(entry.fullPath);
  }

  files.sort((a, b) => a.toLowerCase() > b.toLowerCase() ? 1 : -1);

  let filesLeft = files.length;

  const forcedRegexPattern = !!process.env.FORCED_REGEX_PATTERN! ? new RegExp(process.env.FORCED_REGEX_PATTERN!, 'gi') : null;

  for await (const file of files) {
    filesLeft--;

    if (deleteIfIgnored(file)) {
      continue;
    }

    const blobDocument = buildBlobDocument(file);

    if (!blobDocument || blobDocument.length === 0) {
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

      if (remainingUploads <= 0) {
        if (!warnedAboutRemainingUploads) {
          console.info('Remaining allowed uploads:', remainingUploads, `(${filesLeft} files left)`);
          console.error(`You have already created ${uploadThreshold} blobs in the last 24 hours.`);
          warnedAboutRemainingUploads = true;
        }

        const filesInDir = (await fs.promises.readdir(path.parse(file).dir, { withFileTypes: true }))
          .filter(dirent => dirent.isFile())
          .length;

        if (blobDocument.length < largeFileSize && filesInDir > 5 && (!forcedRegexPattern || !blobDocument.dirs[0].match(forcedRegexPattern))) {
          // console.log(blobDocument.paths[0], 'doesn\'t match', process.env.FORCED_REGEX_PATTERN);
          continue;
        }
      } else {
        if (blobDocument.length <= largeFileSize) {
          remainingUploads--;
        }
        console.info(`Remaining uploads: ${remainingUploads}`, `(${filesLeft} files left)`);
      }

      await bucket.upload(file, {
        destination: blobDocument._id,
        metadata: {
          contentType: blobDocument.contentType,
        }
      });

      await blobsCollection.insertOne(blobDocument);
    }

    fs.unlinkSync(file);

    if (blobDocument.dirs[0] !== lastDir) {
      lastDir = blobDocument.dirs[0];
      try {
        await deleteEmpty(uploadDir);
        console.log('Deleted empty directories.');
      } catch (error) {
        console.error(error);
      }
    }

    console.info('blob', { ...blobDocument, length: bytes(blobDocument.length) });
  }

  await client.close();

  await deleteEmpty(uploadDir);
}

main().catch(console.error);

///////////////////////////////////////////////////////////////////////////////

function buildBlobDocument(file: string): BlobDocument | null {
  const filePath = path.parse(file);
  const fileContentType = contentType(filePath.ext);

  if (fileContentType === 'application/octet-stream') {
    return null;
  }

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
    dirs: [filePath.dir.replace(uploadDir, '')],
    bucket: process.env.BUCKET_STANDARD!
  };
}

function deleteIfIgnored(file: string): boolean {
  for (const deleteByFilenamePattern of config.deleteByFilenamePatterns) {
    const filePath = path.parse(file);
    if (filePath.base.match(deleteByFilenamePattern)) {
      console.warn(`\x1b[31mDELETE\x1b[0m "${file.replace(uploadDir, '')}" because it matches "${deleteByFilenamePattern}"`);
      fs.unlinkSync(file);
      return true;
    }
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
