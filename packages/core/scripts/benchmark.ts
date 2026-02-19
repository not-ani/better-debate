import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadCore } from "../ffi/index";

type BenchmarkLatencyStats = {
  runs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  meanMs: number;
};

type BenchmarkTaskResult = {
  enabled: boolean;
  error?: string;
  totalHits: number;
  latency: BenchmarkLatencyStats;
};

type BenchmarkReport = {
  rootPath: string;
  indexFull: {
    elapsedMs: number;
    scanned: number;
    updated: number;
    skipped: number;
    removed: number;
  };
  indexIncremental: {
    elapsedMs: number;
    scanned: number;
    updated: number;
    skipped: number;
    removed: number;
  };
  queries: string[];
  search: {
    queryCount: number;
    iterations: number;
    limit: number;
    lexicalRaw: BenchmarkTaskResult;
    lexicalCached: BenchmarkTaskResult;
    hybrid: BenchmarkTaskResult;
    semantic: BenchmarkTaskResult;
  };
  preview: {
    snapshotMs: number;
    filePreview: BenchmarkTaskResult;
    headingPreviewHtml: BenchmarkTaskResult;
  };
  elapsedMs: number;
};

const parseBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  throw new Error(`Expected boolean value but received '${value}'`);
};

const parseInteger = (name: string, value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected integer for ${name}, got '${value}'`);
  }
  return parsed;
};

const args = Bun.argv.slice(2);

let rootPath = resolve(process.cwd());
let iterations: number | undefined;
let limit: number | undefined;
let previewSamples: number | undefined;
let includeSemantic = false;
let printJson = false;
const queries: string[] = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === "--path") {
    const next = args[index + 1];
    if (!next) throw new Error("Missing value for --path");
    rootPath = resolve(next);
    index += 1;
    continue;
  }

  if (arg === "--iterations") {
    const next = args[index + 1];
    if (!next) throw new Error("Missing value for --iterations");
    iterations = parseInteger("--iterations", next);
    index += 1;
    continue;
  }

  if (arg === "--limit") {
    const next = args[index + 1];
    if (!next) throw new Error("Missing value for --limit");
    limit = parseInteger("--limit", next);
    index += 1;
    continue;
  }

  if (arg === "--preview-samples") {
    const next = args[index + 1];
    if (!next) throw new Error("Missing value for --preview-samples");
    previewSamples = parseInteger("--preview-samples", next);
    index += 1;
    continue;
  }

  if (arg === "--query") {
    const next = args[index + 1];
    if (!next) throw new Error("Missing value for --query");
    queries.push(next);
    index += 1;
    continue;
  }

  if (arg === "--semantic") {
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      includeSemantic = parseBoolean(next);
      index += 1;
    } else {
      includeSemantic = true;
    }
    continue;
  }

  if (arg === "--json") {
    printJson = true;
    continue;
  }

  throw new Error(`Unknown argument: ${arg}`);
}

const appDataDir = join(process.cwd(), ".tmp-benchmark-data");
mkdirSync(appDataDir, { recursive: true });

const resourceDirCandidate = resolve(import.meta.dir, "..", "resources");
const resourceDir =
  existsSync(join(resourceDirCandidate, "model.onnx")) &&
  existsSync(join(resourceDirCandidate, "tokenizer.json"))
    ? resourceDirCandidate
    : undefined;

const core = loadCore({ appDataDir, resourceDir });

const report = core.invoke<BenchmarkReport>("benchmark_root_performance", {
  path: rootPath,
  queries: queries.length > 0 ? queries : undefined,
  iterations,
  limit,
  includeSemantic,
  previewSamples,
});

console.log(`Benchmark root: ${report.rootPath}`);
console.log(
  `Index full: ${report.indexFull.elapsedMs}ms (scanned ${report.indexFull.scanned}, updated ${report.indexFull.updated})`,
);
console.log(
  `Index incremental: ${report.indexIncremental.elapsedMs}ms (skipped ${report.indexIncremental.skipped}, updated ${report.indexIncremental.updated})`,
);
console.log(
  `Lexical raw p95: ${report.search.lexicalRaw.latency.p95Ms.toFixed(2)}ms across ${report.search.lexicalRaw.latency.runs} runs`,
);
console.log(
  `Lexical cached p95: ${report.search.lexicalCached.latency.p95Ms.toFixed(2)}ms across ${report.search.lexicalCached.latency.runs} runs`,
);
if (report.search.semantic.enabled) {
  console.log(
    `Semantic p95: ${report.search.semantic.latency.p95Ms.toFixed(2)}ms across ${report.search.semantic.latency.runs} runs`,
  );
}

if (printJson) {
  console.log(JSON.stringify(report, null, 2));
}
