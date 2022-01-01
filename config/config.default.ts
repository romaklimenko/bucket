import { Config } from "../lib/server-utils"

const config: Config = {
  deleteByFilenamePatterns: [
    /^\.DS_Store$/gi,
    /\.txt$/gi
  ],
  tagPatterns: []
};

export default config;