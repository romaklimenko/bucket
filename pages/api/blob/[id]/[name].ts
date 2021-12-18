import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../../lib/mongo";
import { Storage } from '@google-cloud/storage';
import { contentType } from "./../../../../lib/utils";
import path from "path";

const gcs_storage = new Storage();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();

  const id: string = req.query.id as string;
  const name: string = req.query.name as string;

  if (!id) {
    res.status(400).json({ message: "Missing id" });
    return;
  }

  if (!name) {
    res.status(400).json({ message: "Missing name" });
    return;
  }

  res.setHeader('Content-Type', contentType(path.extname(name)));

  const blobDocument = await blobsCollection.findOne({ _id: id });

  if (!blobDocument) {
    res.status(404).json({ message: "Blob not found" });
    return;
  }

  const bucket = gcs_storage.bucket(blobDocument.bucket);

  bucket.file(id).createReadStream()
    .on('error', (error: any) => {
      console.error(error)
      res.status(500);
    })
    .pipe(res);

  blobsCollection.updateOne({ _id: id },
    {
      $set: {},
      $currentDate: { lastViewed: true }
    });
}
