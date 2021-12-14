export interface Blob {
  _id: string; // TODO: ObjectId
  contentType: string;
  created: Date;
  extension: string;
  fileName: string;
  lastModified: Date;
  lastViewed: Date;
  length: number;
  level: Level,
  tags: string[],
  paths: string[],
  bucket: string
}

export enum Level {
  Deleted = -2,
  Trashed = -1,
  New = 0,
  Approved = 1
}