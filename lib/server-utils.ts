import fs from 'fs';
import { Collection } from 'mongodb';
import path from 'path';
import { BlobDocument, Level } from "../models/documents";

export interface Config {
  readonly deleteByFilenamePatterns: RegExp[];
  readonly tagPatterns: { pattern: RegExp, tags: string[] }[];
}

export function loadConfig(): Config {
  if (!fs.existsSync(path.join(__dirname, '../config/config.local.ts'))) {
    console.warn('Loading a default config from', path.join(__dirname, '../config/config.default.ts'));
    return {
      deleteByFilenamePatterns: [
        /^\.DS_Store$/gi,
        /\.txt$/gi
      ],
      tagPatterns: []
    };
  }
  console.info('Loading a local config from', path.join(__dirname, '../config/config.local.ts'));
  return require('../config/config.local').default;
};