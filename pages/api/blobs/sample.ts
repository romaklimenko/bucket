import { NextApiRequest, NextApiResponse } from "next";
import { getBlobsCollection } from "../../../lib/mongo";
import { addDays, randomHex } from "../../../lib/utils";
import { BlobDocument, Level } from "../../../models/documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blobsCollection = await getBlobsCollection();

  const blobDocument = await blobsCollection.findOne({});

  if (!blobDocument) {
    res.status(404).json({ message: "Blob not found" });
    return;
  }

  const result: BlobDocument[] = [];

  const prefixLength = 2;

  // TODO: this must be configurable

  // load all new blobs by a regex pattern
  if (process.env.FORCED_REGEX_PATTERN) {
    result.push(
      ...await blobsCollection
        .find<BlobDocument>({ dirs: new RegExp(process.env.FORCED_REGEX_PATTERN, 'gi'), level: Level.New })
        // .limit(1000)
        .toArray());
  }

  console.log(`Found ${result.length} blobs`);

  if (result.length === 0) {
    // 100 new files (level 0)
    result.push(...await blobsCollection
      .aggregate<BlobDocument>([
        { $match: { level: Level.New, _id: new RegExp(`^${randomHex(prefixLength)}`) } },
        { $sample: { size: 100 } }
      ]).toArray());

    // 25 new files from directories that also have trashed files
    const dirsWithTrashedBlobDocuments = (
      await blobsCollection
        .distinct(
          'dirs',
          {
            level: { $lte: Level.Trashed }
          }))
      .filter(dir => dir !== '');
    result.push(...await blobsCollection
      .aggregate<BlobDocument>([
        {
          $match: {
            dirs: { $in: dirsWithTrashedBlobDocuments },
            level: { $gte: Level.New }
          }
        },
        { $sample: { size: 25 } }
      ]).toArray());

    // 25 existing files (level 1)
    result.push(...await blobsCollection
      .aggregate<BlobDocument>([
        {
          $match: {
            level: Level.Approved,
            lastViewed: { $lt: addDays(-7) },
            _id: new RegExp(`^${randomHex(prefixLength)}`) }
        },
        { $sample: { size: 25 } }
      ]).toArray());

    // 25 largest new files
    result.push(...await blobsCollection
      .find<BlobDocument>({ level: Level.New })
      .sort({ length: -1 })
      .limit(25).toArray());

    // 25 smallest new files
    result.push(...await blobsCollection
      .find<BlobDocument>({ level: Level.New })
      .sort({ length: 1 })
      .limit(25).toArray());
  }

  result.sort((a, b) => a.paths[0] > b.paths.sort()[0] ? -1 : 1);

  res.status(200).json(result);
}
