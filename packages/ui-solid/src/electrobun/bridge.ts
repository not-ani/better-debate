import { Electroview } from "electrobun/view";
import type { RootSummary } from "../lib/types";

type EventPayload<T> = {
  event: string;
  payload: T;
};

type Listener<T> = (event: EventPayload<T>) => void;

const listeners = new Map<string, Set<Listener<unknown>>>();
const MAX_RPC_REQUEST_TIME_MS = 15 * 60 * 1000;

const emit = (event: string, payload: unknown) => {
  const handlers = listeners.get(event);
  if (!handlers) {
    return;
  }
  const wrapped = { event, payload };
  for (const handler of handlers) {
    handler(wrapped);
  }
};

const rpc = Electroview.defineRPC({
  maxRequestTime: MAX_RPC_REQUEST_TIME_MS,
  handlers: {
    requests: {},
    messages: {
      indexProgress: (payload: unknown) => {
        emit("index-progress", payload);
      },
      updateStatus: (payload: unknown) => {
        emit("update-status", payload);
      },
    },
  },
});

const electroview = new Electroview({ rpc });

void electroview;

export type OpenDialogFilter = {
  name?: string;
  extensions?: string[];
};

export type OpenDialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  defaultPath?: string;
  title?: string;
  filters?: OpenDialogFilter[];
};

type AddRootFromDialogResult = {
  canonicalPath: string | null;
  rootsAfter: RootSummary[];
};

export type DesktopUpdateStatus = {
  status: string;
  message: string;
  info: {
    version: string;
    hash: string;
    updateAvailable: boolean;
    updateReady: boolean;
    error: string;
  } | null;
  error: string | null;
  updateReady: boolean;
  lastCheckedAtMs: number | null;
};

export const invokeCore = <T>(
  command: string,
  args?: Record<string, unknown>,
) => rpc.request.invokeCore({ command, args: args ?? {} }) as Promise<T>;

const normalizeDialogResult = (raw: unknown): string | string[] | null => {
  if (raw == null) {
    return null;
  }

  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof raw === "object") {
    const values = Object.values(raw as Record<string, unknown>).filter(
      (entry): entry is string => typeof entry === "string",
    );

    if (values.length === 0) {
      return null;
    }

    return values;
  }

  return null;
};

export const openDialog = async (options: OpenDialogOptions = {}) => {
  const raw = (await rpc.request.openDialog(options)) as unknown;
  return normalizeDialogResult(raw);
};

const isRootSummary = (value: unknown): value is RootSummary => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.path === "string";
};

const normalizeRoots = (value: unknown): RootSummary[] => {
  if (Array.isArray(value)) {
    return value.filter(isRootSummary);
  }
  return [];
};

export const addRootFromDialog = async (): Promise<AddRootFromDialogResult> => {
  const raw = (await rpc.request.addRootFromDialog({})) as unknown;

  if (raw == null) {
    return {
      canonicalPath: null,
      rootsAfter: [],
    };
  }

  if (typeof raw === "string") {
    return {
      canonicalPath: raw,
      rootsAfter: [],
    };
  }

  if (typeof raw === "object") {
    const candidate = raw as Record<string, unknown>;
    const canonicalPath =
      typeof candidate.canonicalPath === "string" && candidate.canonicalPath.trim().length > 0
        ? candidate.canonicalPath
        : null;

    return {
      canonicalPath,
      rootsAfter: normalizeRoots(candidate.rootsAfter),
    };
  }

  return {
    canonicalPath: null,
    rootsAfter: [],
  };
};

export const openPath = (path: string) =>
  rpc.request.openPath({ path }) as Promise<boolean>;

export const checkForUpdates = () =>
  rpc.request.checkForUpdates({}) as Promise<DesktopUpdateStatus>;

export const installUpdateNow = () =>
  rpc.request.installUpdateNow({}) as Promise<{ applied: boolean }>;

export const getUpdateStatus = () =>
  rpc.request.getUpdateStatus({}) as Promise<DesktopUpdateStatus>;

export const listenEvent = async <T>(
  event: string,
  handler: Listener<T>,
) => {
  const existing = listeners.get(event);
  if (existing) {
    existing.add(handler as Listener<unknown>);
  } else {
    listeners.set(event, new Set([handler as Listener<unknown>]));
  }

  return () => {
    const bucket = listeners.get(event);
    if (!bucket) {
      return;
    }
    bucket.delete(handler as Listener<unknown>);
    if (bucket.size === 0) {
      listeners.delete(event);
    }
  };
};
