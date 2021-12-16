import { Collection, MongoClient } from 'mongodb';
import { BlobDocument } from '../models/documents';

let blobsCollection: Collection<BlobDocument>;

export const getBlobsCollection = async () => {
  if (!blobsCollection) {
    const client = await new MongoClient(process.env.MONGODB_URI!).connect();
    const db = client.db(process.env.MONGODB_DB!);
    blobsCollection = db.collection<BlobDocument>('blobs');
  }
  return blobsCollection;
};