import { BlobDocument, Level } from '../models/documents';
import dotenv from 'dotenv'; dotenv.config();
import { MongoClient } from 'mongodb';
import { Storage } from '@google-cloud/storage';
import { addDays } from '../lib/utils';

async function main() {
  const gcs_storage = new Storage();
  const standardBucket = gcs_storage.bucket(process.env.BUCKET_STANDARD!);
  const archiveBucket = gcs_storage.bucket(process.env.BUCKET_ARCHIVE!);

  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const db = client.db(process.env.MONGODB_DB!);
  const blobsCollection = db.collection<BlobDocument>('blobs');

  await blobsCollection.updateMany(
    { level: Level.New, created: { $lt: addDays(-7) } },
    { $set: { level: Level.Approved } });

  const trashedBlobs = await blobsCollection.find({ level: Level.Trashed }).toArray();

  const deleteBlob = async (blobDocument: BlobDocument) => {
    console.log(`\x1b[31mDELETE\x1b[0m ${blobDocument._id}`, blobDocument.paths);
    try {
      if (blobDocument.bucket === process.env.BUCKET_STANDARD) {
        await standardBucket.file(blobDocument._id).delete();
      } else if (blobDocument.bucket === process.env.BUCKET_ARCHIVE) {
        await archiveBucket.file(blobDocument._id).delete();
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`File ${blobDocument._id} not found.`);
      } else {
        throw error;
      }
    }
    await blobsCollection.updateOne({ _id: blobDocument._id }, { $set: { level: Level.Deleted } });
  }

  const threadsCount = 32;

  let promises = [];

  for (const blobDocument of trashedBlobs) {
    promises.push(deleteBlob(blobDocument));
    if (promises.length >= threadsCount) {
      await Promise.all(promises);
      promises = [];
    }
  }

  const archiveBlob = async (blobDocument: BlobDocument) => {
    console.log(`\x1b[33mARCHIVE\x1b[0m ${blobDocument._id}`, blobDocument.paths);
    await standardBucket
      .file(blobDocument._id)
      .copy(archiveBucket.file(blobDocument._id));
    await standardBucket
      .file(blobDocument._id)
      .delete();
    await blobsCollection.updateOne(
      { _id: blobDocument._id },
      { $set: { bucket: process.env.BUCKET_ARCHIVE!, level: Level.Approved } });
  }

  const approvedBlobs = await blobsCollection.find({ level: Level.Approved, bucket: process.env.BUCKET_STANDARD! }).toArray();
  for (const blobDocument of approvedBlobs) {
    promises.push(archiveBlob(blobDocument));
    if (promises.length >= threadsCount) {
      await Promise.all(promises);
      promises = [];
    }
  }

  await Promise.all(promises);

  await client.close();
}

main().catch(console.error);
