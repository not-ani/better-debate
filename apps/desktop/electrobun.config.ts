import type { ElectrobunConfig } from "electrobun/bun";
import packageJson from "./package.json" assert { type: "json" };

const defaultReleaseBaseUrl = "https://github.com/not-ani/better-debate/releases/download/updates";

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
