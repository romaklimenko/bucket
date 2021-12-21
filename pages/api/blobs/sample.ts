import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../lib/mongo";
import { addDays } from "../../../lib/utils";
import { BlobDocument, Level } from "../../../models/documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();

  const blobDocument = await blobsCollection.findOne({});

  if (!blobDocument) {
    res.status(404).json({ message: "Blob not found" });
    return;
  }

  const result: BlobDocument[] = [];

  // TODO: this must be configurable

  // 25 new files (level 0)
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { level: Level.New } },
      { $sample: { size: 25 } }
    ])).toArray());

  // 25 new files from directories that also have trashed files
  const dirsWithTrashedBlobDocuments = (
    await blobsCollection
      .distinct(
        'dirs',
        {
          level: { $lte: Level.Trashed },
          lastModified: { $gt: addDays(-1) } }))
      .filter(dir => dir !== '');
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { dirs: { $in: dirsWithTrashedBlobDocuments }, level: { $gte: Level.New } } },
      { $sample: { size: 25 } }
    ])).toArray());

  // 25 existing files (level 1)
  result.push(...await (await blobsCollection
    .aggregate<BlobDocument>([
      { $match: { level: Level.Approved, lastViewed: { $lt: addDays(-7) } } },
      { $sample: { size: 25 } }
    ])).toArray());

  // 25 largest new files
  result.push(...await (await blobsCollection
    .find<BlobDocument>({ level: Level.New })
    .sort({ length: -1 })
    .limit(25)).toArray());

  // 25 smallest new files
  result.push(...await (await blobsCollection
    .find<BlobDocument>({ level: Level.New })
    .sort({ length: 1 })
    .limit(25)).toArray());



  result.sort((a, b) => {
    return a.paths[0] > b.paths[0] ? -1 : 1;
  });

  res.status(200).json(result);
}
