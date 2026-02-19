import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  type UpdateStatusEntry,
  Updater,
  Utils,
} from "electrobun/bun";
import { loadCore } from "../../../../packages/core/ffi/index";

type DialogFilter = {
  extensions?: string[];
};

type OpenDialogRequest = {
  directory?: boolean;
  multiple?: boolean;
  defaultPath?: string;
  filters?: DialogFilter[];
};

type InvokeCoreRequest = {
  command: string;
  args?: Record<string, unknown>;
};

type RootSummary = {
  path: string;
  fileCount: number;
  headingCount: number;
  addedAtMs: number;
  lastIndexedMs: number;
};

type UpdateCheckSource = "startup" | "interval" | "manual" | "rpc";

type UpdateState = {
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

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

function normalizeDialogPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  let normalized = trimmed;

  if (normalized.startsWith("\"") && normalized.endsWith("\"")) {
    normalized = normalized.slice(1, -1);
  }

  if (normalized.startsWith("file://")) {
    try {
      normalized = decodeURIComponent(normalized.replace("file://", ""));
    } catch {
      normalized = normalized.replace("file://", "");
    }
  }

  if (normalized.includes("%")) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Keep original when not valid encoded path.
    }
  }

  return normalized.trim();
}

function ensureDirectoryPath(value: string) {
  if (!value) {
    return "";
  }

  try {
    const stats = statSync(value);
    if (stats.isDirectory()) {
      return value;
    }
    return dirname(value);
  } catch {
    return value;
  }
}

function resolveResourceDir() {
  const candidates = [
    join(process.cwd(), "resources"),
    join(process.cwd(), "..", "resources"),
    join(process.cwd(), "..", "Resources", "app", "resources"),
    new URL("../../../../packages/core/resources/", import.meta.url).pathname,
  ];

  for (const candidate of candidates) {
    if (
      existsSync(join(candidate, "model.onnx")) &&
      existsSync(join(candidate, "tokenizer.json"))
    ) {
      return candidate;
    }
  }

  return "";
}

const updateState: UpdateState = {
  status: "idle",
  message: "",
  info: null,
  error: null,
  updateReady: false,
  lastCheckedAtMs: null,
};

let isCheckingForUpdates = false;

const normalizeUpdateError = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "Unknown update error";
};

let rpc: ReturnType<typeof BrowserView.defineRPC>;

const sendUpdateStatus = (entry?: UpdateStatusEntry) => {
  if (!rpc) {
    return;
  }

  rpc.send.updateStatus({
    ...updateState,
    entry: entry ?? null,
  });
};

Updater.onStatusChange((entry) => {
  updateState.status = entry.status;
  updateState.message = entry.message;
  sendUpdateStatus(entry);
});

const checkForUpdates = async (source: UpdateCheckSource): Promise<UpdateState> => {
  if (isCheckingForUpdates) {
    return { ...updateState };
  }

  isCheckingForUpdates = true;
  updateState.status = "checking-for-update";
  updateState.message = "Checking for updates";
  updateState.error = null;
  sendUpdateStatus();

  try {
    let info = await Updater.checkForUpdate();

    if (info.updateAvailable && !info.updateReady && !info.error) {
      await Updater.downloadUpdate();
      info = Updater.updateInfo();
    }

    updateState.info = info;
    updateState.lastCheckedAtMs = Date.now();
    updateState.updateReady = !!info.updateReady;

    if (info.error) {
      updateState.status = "error";
      updateState.message = "Update check failed";
      updateState.error = info.error;
    } else if (info.updateReady) {
      updateState.status = "update-downloaded";
      updateState.message = "Update ready to install";
      updateState.error = null;

      if (source !== "interval") {
        Utils.showNotification({
          title: "BlockVault update ready",
          body: "Choose Install Downloaded Update from the app menu.",
        });
      }
    } else if (info.updateAvailable) {
      updateState.status = "update-available";
      updateState.message = "Update available";
      updateState.error = null;
    } else {
      updateState.status = "update-not-available";
      updateState.message = "No updates available";
      updateState.error = null;

      if (source === "manual" || source === "rpc") {
        Utils.showNotification({
          title: "BlockVault is up to date",
          body: "No updates are available right now.",
        });
      }
    }
  } catch (error) {
    updateState.status = "error";
    updateState.message = "Update check failed";
    updateState.error = normalizeUpdateError(error);
  } finally {
    isCheckingForUpdates = false;
    sendUpdateStatus();
  }

  return { ...updateState };
};

const installDownloadedUpdate = async () => {
  const latestInfo = Updater.updateInfo();

  if (!latestInfo?.updateReady && !updateState.updateReady) {
    await checkForUpdates("manual");
  }

  if (!Updater.updateInfo()?.updateReady && !updateState.updateReady) {
    await Utils.showMessageBox({
      type: "info",
      title: "No downloaded update",
      message: "No downloaded update is ready yet.",
      detail: "Run Check for Updates again in a few minutes.",
      buttons: ["OK"],
    });
    return { applied: false };
  }

  const result = await Utils.showMessageBox({
    type: "question",
    title: "Install update",
    message: "Restart BlockVault to install the downloaded update?",
    buttons: ["Install and Restart", "Later"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response !== 0) {
    return { applied: false };
  }

  updateState.status = "applying-update";
  updateState.message = "Applying downloaded update";
  sendUpdateStatus();
  void Updater.applyUpdate();
  return { applied: true };
};

const core = loadCore({
  appDataDir: join(Utils.paths.userData, "blockvault"),
  resourceDir: resolveResourceDir(),
  onEvent: (eventName, payload) => {
    if (eventName === "index-progress" && rpc) {
      rpc.send.indexProgress(payload);
    }
  },
});

rpc = BrowserView.defineRPC({
  handlers: {
    requests: {
      invokeCore: ({ command, args }: InvokeCoreRequest) => {
        try {
          const result = core.invoke(command, args);
          return result;
        } catch (error) {
          console.error(`[core] error ${command}`, error);
          throw error;
        }
      },
      addRootFromDialog: async () => {
        const startingFolder = Utils.paths.home;
        const allowedFileTypes = "*";

        const selected = await Utils.openFileDialog({
          startingFolder,
          allowedFileTypes,
          canChooseFiles: true,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });

        const first = selected
          .map((entry) => normalizeDialogPath(entry))
          .map((entry) => (entry && !isAbsolute(entry) ? resolve(startingFolder, entry) : entry))
          .map((entry) => ensureDirectoryPath(entry))
          .find(Boolean);

        if (!first) {
          return {
            canonicalPath: null,
            rootsAfter: core.invoke<RootSummary[]>("list_roots"),
          };
        }

        const canonicalPath = core.invoke<string>("add_root", { path: first });
        const rootsAfter = core.invoke<RootSummary[]>("list_roots");

        return {
          canonicalPath,
          rootsAfter,
        };
      },
      openPath: ({ path }: { path: string }) => Utils.openPath(path),
      openDialog: async (request: OpenDialogRequest = {}) => {
        const extensions = (request.filters ?? [])
          .flatMap((filter) => filter.extensions ?? [])
          .map((extension) => extension.replace(/^\./, ""))
          .filter((extension) => extension.length > 0);

        const startingFolder = request.defaultPath || Utils.paths.home;
        const allowedFileTypes = extensions.length > 0 ? extensions.join(",") : "*";

        const selectPaths = async (canChooseFiles: boolean, canChooseDirectory: boolean) => {
          const selected = await Utils.openFileDialog({
            startingFolder,
            allowedFileTypes,
            canChooseFiles,
            canChooseDirectory,
            allowsMultipleSelection: !!request.multiple,
          });

          const paths = selected
            .map((entry) => normalizeDialogPath(entry))
            .map((entry) => (entry && !isAbsolute(entry) ? resolve(startingFolder, entry) : entry))
            .map((entry) => (request.directory ? ensureDirectoryPath(entry) : entry))
            .filter(Boolean);

          return paths;
        };

        const canChooseFiles = request.directory ? true : !request.directory;
        const canChooseDirectory = request.directory ? true : !!request.directory;
        const paths = await selectPaths(canChooseFiles, canChooseDirectory);

        if (paths.length === 0) {
          return null;
        }

        if (request.multiple) {
          return paths;
        }

        return paths[0] ?? null;
      },
      checkForUpdates: async () => checkForUpdates("rpc"),
      installUpdateNow: async () => installDownloadedUpdate(),
      getUpdateStatus: () => ({ ...updateState }),
    },
  },
});

ApplicationMenu.setApplicationMenu([
  {
    label: "BlockVault",
    submenu: [
      { label: "Check for Updates", action: "check-for-updates" },
      {
        label: "Install Downloaded Update",
        action: "install-downloaded-update",
      },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
]);

ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
  const action =
    (event as { data?: { action?: string } })?.data?.action ?? "";

  if (action === "check-for-updates") {
    void checkForUpdates("manual");
    return;
  }

  if (action === "install-downloaded-update") {
    void installDownloadedUpdate();
  }
});

new BrowserWindow({
  title: "BlockVault",
  url: "views://blockvault/index.html",
  rpc,
  frame: {
    width: 1440,
    height: 960,
    x: 100,
    y: 100,
  },
});

void (async () => {
  try {
    const localInfo = await Updater.getLocallocalInfo();
    if (localInfo.channel === "dev") {
      return;
    }

    await checkForUpdates("startup");
    setInterval(() => {
      void checkForUpdates("interval");
    }, UPDATE_CHECK_INTERVAL_MS);
  } catch (error) {
    updateState.status = "error";
    updateState.message = "Unable to initialize updater";
    updateState.error = normalizeUpdateError(error);
    sendUpdateStatus();
  }
})();
