import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../../lib/mongo";
import { BlobDocument } from "../../../../models/documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();
  const {
    query: { id },
    method
  } = req;

  if (!id) {
    res.status(400).json({ message: "Missing id" });
  }

  if (method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }

  const blobDocument = await blobsCollection.findOne({ _id: id });

  if (!blobDocument) {
    res.status(404).json({ message: "Blob not found" });
  }

  const result = await blobsCollection.updateMany(
    {
      dirs: { $in: blobDocument?.dirs.filter(x => x !== '') },
      level: { $gte: 0, $lt: 1 }
    },
    {
      $set: { level: -1 },
      $currentDate: { lastModified: true }
    });

  res.status(200).json({ modifiedCount: result.modifiedCount});
}