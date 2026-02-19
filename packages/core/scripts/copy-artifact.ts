import { mkdirSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../../..");
const outDir = join(root, "apps/desktop/.electrobun/native");
const mode = process.argv.includes("--debug") ? "debug" : "release";

let filename = "";
switch (process.platform) {
  case "darwin":
    filename = "libcore.dylib";
    break;
  case "win32":
    filename = "core.dll";
    break;
  default:
    filename = "libcore.so";
}

const src = join(import.meta.dir, `../target/${mode}/${filename}`);
if (!existsSync(src)) {
  console.error(`Native artifact not found for ${mode}:`, src);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
cpSync(src, join(outDir, filename));
console.log(`Copied ${mode} native artifact to`, outDir);
