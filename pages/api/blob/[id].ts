import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../lib/mongo";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ message: "Missing id" });
    return;
  }

  const blob = await blobsCollection.findOne({ _id: id });

  if (!blob) {
    res.status(404).json({ message: "Blob not found" });
    return;
  }

  res.status(200).json(blob);
}
