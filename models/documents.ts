export interface BlobDocument {
  _id: string;
  contentType: string;
  created: Date;
  paths: string[];
  lastModified: Date;
  lastViewed?: Date;
  length: number;
  level: Level,
  tags: string[],
  dirs: string[],
  bucket: string
}

export enum Level {
  Deleted = -2,
  Trashed = -1,
  New = 0,
  Approved = 1
}