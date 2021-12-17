import { BlobDocument } from "../models/documents";

export async function sample(): Promise<BlobDocument[]> {
  const response = await fetch('/api/blobs/sample');
  const json = await response.json() as BlobDocument[];
  return json;
}