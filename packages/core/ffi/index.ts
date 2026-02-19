import { CString, JSCallback, dlopen, type Pointer } from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "node:path";

type CoreEventHandler = (eventName: string, payload: unknown) => void;

type Symbols = {
  core_configure: (appDataDir: Uint8Array, resourceDir: Uint8Array) => number;
  core_set_event_callback: (callback: Pointer) => void;
  core_invoke_json: (request: Uint8Array) => Pointer;
  core_free_str: (ptr: Pointer) => void;
};

type LoadCoreOptions = {
  customPath?: string;
  appDataDir: string;
  resourceDir?: string;
  onEvent?: CoreEventHandler;
};

type InvokeResponse = {
  ok: boolean;
  value?: unknown;
  error?: string;
};

function libFilename() {
  switch (process.platform) {
    case "darwin":
      return "libcore.dylib";
    case "win32":
      return "core.dll";
    default:
      return "libcore.so";
  }
}

function resolveLibraryPath(customPath?: string) {
  const filename = customPath ?? libFilename();
  const candidates = [
    filename,
    join(process.cwd(), ".electrobun", "native", filename),
    join(process.cwd(), "..", "resources", "native", filename),
    join(process.cwd(), "..", "Resources", "app", "native", filename),
    new URL(`../target/debug/${filename}`, import.meta.url).pathname,
    new URL(`../target/release/${filename}`, import.meta.url).pathname,
    new URL(`../../../apps/desktop/.electrobun/native/${filename}`, import.meta.url).pathname
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function parseResponse(raw: string): InvokeResponse {
  try {
    return JSON.parse(raw) as InvokeResponse;
  } catch {
    return {
      ok: false,
      error: `Invalid response JSON from core: ${raw.slice(0, 200)}`
    };
  }
}

function toCStringBuffer(value: string) {
  return Buffer.from(`${value}\0`, "utf8");
}

export function loadCore(options: LoadCoreOptions) {
  const symbolDefinition = {
    core_configure: { args: ["ptr", "ptr"], returns: "i32" },
    core_set_event_callback: { args: ["function"], returns: "void" },
    core_invoke_json: { args: ["ptr"], returns: "ptr" },
    core_free_str: { args: ["ptr"], returns: "void" }
  } as const;

  const libraryPath = resolveLibraryPath(options.customPath);
  const { symbols } = dlopen(libraryPath, symbolDefinition) as { symbols: Symbols };

  const callback = new JSCallback(
    (eventNamePtr, payloadPtr) => {
      if (!options.onEvent) {
        return;
      }

      try {
        const eventName = new CString(eventNamePtr as Pointer).toString();
        const payloadRaw = new CString(payloadPtr as Pointer).toString();
        const payload = payloadRaw ? JSON.parse(payloadRaw) : null;
        options.onEvent(eventName, payload);
      } catch (error) {
        console.error("Failed to process core event callback", error);
      }
    },
    {
      args: ["ptr", "ptr"],
      returns: "void",
      threadsafe: true
    }
  );

  symbols.core_set_event_callback(callback as unknown as Pointer);

  const configured = symbols.core_configure(
    toCStringBuffer(options.appDataDir),
    toCStringBuffer(options.resourceDir ?? "")
  );
  if (configured !== 1) {
    throw new Error(`Failed to configure Rust core at ${libraryPath}`);
  }

  function invoke<T>(command: string, args?: Record<string, unknown>): T {
    const request = JSON.stringify({ command, args: args ?? {} });
    const responsePtr = symbols.core_invoke_json(toCStringBuffer(request));
    if (!responsePtr) {
      throw new Error(`No response pointer returned by Rust core for ${command}`);
    }

    const raw = new CString(responsePtr).toString();
    symbols.core_free_str(responsePtr);

    const parsed = parseResponse(raw);
    if (!parsed.ok) {
      throw new Error(parsed.error ?? `Unknown core error while invoking ${command}`);
    }

    return parsed.value as T;
  }

  return {
    invoke,
    callback
  };
}
