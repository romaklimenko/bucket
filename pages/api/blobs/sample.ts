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

  // 50 new files (level 0)
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { level: 0 } },
      { $sample: { size: 50 } }
    ])).toArray());

  // 25 new files from directories that also have trashed files
  const dirsWithTrashedBlobDocuments = (await blobsCollection.distinct('dirs', { level: { $lte: -1 } }))
    .filter(x => x !== '');
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { dirs: { $in: dirsWithTrashedBlobDocuments }, level: { $gte: 0 } } },
      { $sample: { size: 25 } }
    ])).toArray());

  // 25 existing files (level 1)
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { level: 1, lastViewed: { $lt: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000) } } },
      { $sample: { size: 25 } }
    ])).toArray());

  // 25 largest new files
  result.push(...await (await blobsCollection
    .find<BlobDocument>({ level: 0 })
    .sort({ length: -1 })
    .limit(25)).toArray());

  // 25 smallest new files
  result.push(...await (await blobsCollection
    .find<BlobDocument>({ level: 0 })
    .sort({ length: 1 })
    .limit(25)).toArray());



  result.sort((a, b) => {
    return a.paths[0] > b.paths[0] ? -1 : 1;
  });

  res.status(200).json(result);
}
