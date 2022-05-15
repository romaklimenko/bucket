import { Level } from "../models/documents";

export function contentType(ext: string) {

  switch (ext.toLowerCase()) {
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
  }
  return 'application/octet-stream';
};

export function size(length: number) {
  if (length < 1024) {
    return `${length} B`;
  } else if (length < 1024 * 1024) {
    return `${(length / 1024).toFixed(2)} KB`;
  } else if (length < 1024 * 1024 * 1024) {
    return `${(length / 1024 / 1024).toFixed(2)} MB`;
  } else {
    return `${(length / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
}

export function level(level?: Level) {
  switch (level) {
    case Level.Deleted:
      return 'Deleted';
    case Level.Trashed:
      return 'Trashed';
    case Level.New:
      return 'New';
    case Level.Approved:
      return 'Approved';
    default:
      return 'Unknown';
  }
}

export function levelBadgeClass(level?: Level) {
  switch (level) {
    case Level.Deleted:
      return 'badge bg-danger';
    case Level.Trashed:
      return 'badge bg-warning text-dark';
    case Level.New:
      return 'badge bg-secondary';
    case Level.Approved:
      return 'badge bg-success';
    default:
      return 'badge bg-danger';
  }
}

export function addDays(days: number) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result;
}

export function randomHex(length: number) {
  const result = [...Array(length)]
    .map(() => Math.floor(Math.random() * 16)
    .toString(16))
    .join('');
  // console.log('prefix', result);
  return result;
}
