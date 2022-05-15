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

  const archiveResult = await blobsCollection.updateMany(
    { level: Level.New, created: { $lt: addDays(-7) } },
    { $set: { level: Level.Approved } });

  console.log('\x1b[32mNEW -> APPROVED\x1b[0m:', archiveResult.modifiedCount);

  const trashedBlobs = await blobsCollection
    .find({ level: Level.Trashed })
    .sort({ created: 1 })
    .toArray();

  let remainingDeleteCount = trashedBlobs.length;
  
  console.log('\x1b[33mTRASH\x1b[0m:', remainingDeleteCount, '\n');

  const deleteBlob = async (blobDocument: BlobDocument) => {
    console.log(`\x1b[31mDELETE\x1b[0m #${remainingDeleteCount--} ${blobDocument._id}`, blobDocument.paths);
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

  const approvedBlobs = await blobsCollection
    .find({ level: Level.Approved, bucket: process.env.BUCKET_STANDARD! })
    .sort({ created: 1 })
    .toArray();

  let remainingApproveCount = approvedBlobs.length;

  const archiveBlob = async (blobDocument: BlobDocument) => {
    console.log(`\x1b[32mARCHIVE\x1b[0m #${remainingApproveCount--} ${blobDocument._id}`, blobDocument.paths);
    try {
      await standardBucket
        .file(blobDocument._id)
        .copy(archiveBucket.file(blobDocument._id));
      await standardBucket
        .file(blobDocument._id)
        .delete();
    }
    catch (error: any) {
      if (error.code === 404) {
        console.log(`Nothing to delete: blob ${blobDocument._id} not found.`);
      } else {
        throw error;
      }
    }
    await blobsCollection.updateOne(
      { _id: blobDocument._id },
      { $set: { bucket: process.env.BUCKET_ARCHIVE!, level: Level.Approved } });
  }

  for (const blobDocument of approvedBlobs) {
    promises.push(archiveBlob(blobDocument));
    if (promises.length >= threadsCount) {
      await Promise.all(promises);
      promises = [];
    }
  }

  await Promise.all(promises);

  const nextBlobDocument = await blobsCollection
    .find({ level: Level.New })
    .sort({ created: 1 })
    .limit(1)
    .next();

  console.log('\x1b[31mDELETED\x1b[0m:', trashedBlobs.length);
  console.log('\x1b[32mARCHIVED\x1b[0m:', approvedBlobs.length);
  console.log('NEW:', await blobsCollection.countDocuments({ level: Level.New }));

  console.info('\x1b[33mNEXT\x1b[0m', nextBlobDocument?.paths, nextBlobDocument?.created?.toString());

  await client.close();
}

main().catch(console.error);
