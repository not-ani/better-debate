import type { ElectrobunConfig } from "electrobun/bun";
import packageJson from "./package.json" assert { type: "json" };

const defaultReleaseBaseUrl = process.env.GITHUB_REPOSITORY
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/updates`
  : "https://github.com/OWNER/REPO/releases/download/updates";

export default {
  app: {
    name: "BlockVault",
    identifier: "sh.blackboard.blockvault",
    version: packageJson.version
  },
  build: {
    bun: { entrypoint: "src/bun/index.ts" },
    views: {},
    copy: {
      "../../packages/ui-solid/dist/": "views/blockvault/",
      "../../packages/core/resources/": "resources/",
      ".electrobun/native/": "native/"
    }
  },
  release: {
    baseUrl: process.env.ELECTROBUN_RELEASE_BASE_URL ?? defaultReleaseBaseUrl,
  },
} satisfies ElectrobunConfig;
