export default function contentType(ext: string) {

  switch (ext) {
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.mp4':
    case '.gifv':
      return 'video/mp4';
  }
  return 'application/octet-stream';
};