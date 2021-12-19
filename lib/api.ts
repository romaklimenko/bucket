import { BlobDocument } from "../models/documents";

export async function sample(): Promise<BlobDocument[]> {
  const response = await fetch('/api/blobs/sample');
  const json = await response.json() as BlobDocument[];
  return json;
}

export async function put(blobDocument: BlobDocument): Promise<number> {
  const response = await fetch(`/api/blob/${blobDocument._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(blobDocument)
  });
  return response.status;
}

export async function get(id: string): Promise<BlobDocument> {
  const response = await fetch(`/api/blob/${id}`);
  const json = await response.json() as BlobDocument;
  return json;
}

export async function trash(id: string): Promise<number> {
  const response = await fetch(`/api/blobs/trash/${id}`, {
    method: 'DELETE'
  });
  return (await response.json()).modifiedCount;
}