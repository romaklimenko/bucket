import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../lib/mongo";
import { BlobDocument } from "../../../models/documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();

  const blobDocument = await blobsCollection.findOne({});

  if (!blobDocument) {
    res.status(404).json({ message: "Blob not found" });
    return;
  }

  const result: BlobDocument[] = [];

  // TODO: this must be configurable

  // 100 new files (level 0)
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { level: 0 } },
      { $sample: { size: 100 } }
    ])).toArray());

  // 50 existing files (level 1)
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { level: 1 } },
      { $sample: { size: 50 } }
    ])).toArray());
  // 50 largest new files
  result.push(...await (await blobsCollection
    .find<BlobDocument>({ level: 0 })
    .sort({ length: -1 })
    .limit(50)).toArray());
  // 50 smallest new files
  result.push(...await (await blobsCollection
    .find<BlobDocument>({ level: 0 })
    .sort({ length: 1 })
    .limit(50)).toArray());

  result.sort((a, b) => {
    return a.paths[0] > b.paths[0] ? -1 : 1;
  });

  res.status(200).json(result);
}
