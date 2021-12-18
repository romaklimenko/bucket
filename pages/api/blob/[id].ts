import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../lib/mongo";
import { BlobDocument } from "../../../models/documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();
  const {
    query: { id },
    method
  } = req;

  if (!id) {
    res.status(400).json({ message: "Missing id" });
  }

  switch (method) {
    case 'GET':
      const blob = await blobsCollection.findOne({ _id: id });

      if (!blob) {
        res.status(404).json({ message: "Blob not found" });
      }

      res.status(200).json(blob);
      break;
    case 'PUT':
      if (!id) {
        res.status(400).json({ message: "Missing id" });
      }
      const body: BlobDocument = req.body;
      await blobsCollection.updateOne(
        { _id: id },
        {
          $set: { level: body.level },
          $currentDate: { lastModified: true }
        });
      res.status(200).end();
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}