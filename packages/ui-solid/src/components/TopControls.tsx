import { For, Show, type Accessor } from "solid-js";
import type { DesktopUpdateStatus } from "../electrobun/bridge";
import { ALL_ROOTS_KEY } from "../lib/constants";
import type { IndexProgress, RootSummary } from "../lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

type TopControlsProps = {
  searchQuery: Accessor<string>;
  searchFileNamesOnly: Accessor<boolean>;
  searchDebatifyEnabled: Accessor<boolean>;
  searchSemanticEnabled: Accessor<boolean>;
  setSearchQuery: (value: string) => void;
  setSearchInputRef: (element: HTMLInputElement) => void;
  isIndexing: Accessor<boolean>;
  addFolder: () => void;
  selectedRootPath: Accessor<string>;
  runIndexForSelection: () => Promise<void>;
  activeRootLabel: Accessor<string>;
  activeLastIndexedMs: Accessor<number>;
  isSearching: Accessor<boolean>;
  status: Accessor<string>;
  copyToast: Accessor<string>;
  roots: Accessor<RootSummary[]>;
  setSelectedRootPath: (value: string) => void;
  indexProgress: Accessor<IndexProgress | null>;
  showCapturePanel: Accessor<boolean>;
  showPreviewPanel: Accessor<boolean>;
  toggleCapturePanel: () => void;
  togglePreviewPanel: () => void;
  toggleFileNameSearchMode: () => void;
  toggleDebatifySearchMode: () => void;
  toggleSemanticSearchMode: () => void;
  updateStatus: Accessor<DesktopUpdateStatus | null>;
  isCheckingUpdates: Accessor<boolean>;
  isInstallingUpdate: Accessor<boolean>;
  checkForUpdates: () => Promise<void>;
  installUpdateNow: () => Promise<void>;
};

export default function TopControls(props: TopControlsProps) {
  const activeIndexProgress = () => {
    if (!props.isIndexing()) return null;
    return props.indexProgress();
  };

  const indexProgressPercent = () => {
    const progress = activeIndexProgress();
    if (!progress || progress.changed <= 0) return 0;
    return Math.min(100, Math.round((progress.processed / progress.changed) * 100));
  };

  const indexProgressTitle = () => {
    const progress = activeIndexProgress();
    if (!progress) return "";

    if (progress.phase === "discovering") {
      return `Scanning ${progress.discovered.toLocaleString()} .docx files`;
    }

    if (progress.phase === "indexing") {
      return `Indexing ${progress.processed.toLocaleString()} / ${progress.changed.toLocaleString()} files`;
    }

    if (progress.phase === "cleaning") {
      return "Removing stale index entries";
    }

    return "Finalizing index";
  };

  const showUpdateBanner = () => {
    const update = props.updateStatus();
    if (props.isCheckingUpdates() || props.isInstallingUpdate()) return true;
    if (!update) return false;
    if (update.error) return true;
    if (update.updateReady) return true;
    if (update.info?.updateAvailable) return true;
    return update.status === "checking-for-update";
  };

  const updateBannerTone = () => {
    const update = props.updateStatus();
    if (update?.error) {
      return "border-rose-500/20 bg-rose-500/8";
    }
    if (update?.updateReady) {
      return "border-emerald-500/20 bg-emerald-500/8";
    }
    return "border-blue-500/20 bg-blue-500/8";
  };

  const updateBannerText = () => {
    if (props.isInstallingUpdate()) {
      return "Installing downloaded update...";
    }

    if (props.isCheckingUpdates()) {
      return "Checking for updates...";
    }

    const update = props.updateStatus();
    if (!update) {
      return "Update status unavailable.";
    }

    if (update.error) {
      return `Update check failed: ${update.error}`;
    }

    if (update.updateReady) {
      return `Update ${update.info?.version ?? "available"} is downloaded and ready to install.`;
    }

    if (update.info?.updateAvailable) {
      return `Update ${update.info.version || "available"} found. Downloading in background...`;
    }

    return update.message || "Checking for updates...";
  };

  return (
    <header class="flex flex-col border-b border-neutral-800/50 bg-neutral-950/50 backdrop-blur-sm">
      <div class="flex items-center gap-3 px-4 py-2">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
          <svg class="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h1 class="text-sm font-semibold text-white">BlockVault</h1>
        
        <div class="h-4 w-px bg-neutral-700 mx-1" />
        
        <div class="flex items-center gap-2 text-xs text-neutral-500">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="truncate max-w-[200px]" title={props.activeRootLabel()}>
            {props.activeRootLabel()}
          </span>
        </div>
        
        <div class="flex-1" />
        
        <div class="flex items-center gap-1.5">
          <Button
            class={
              props.showCapturePanel()
                ? "border-blue-600 bg-blue-600/20 text-blue-300"
                : "text-neutral-400"
            }
            onClick={props.toggleCapturePanel}
            size="sm"
            title="Toggle Insert panel (I)"
            type="button"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Insert
          </Button>
          <Button
            class={
              props.showPreviewPanel()
                ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                : "text-neutral-400"
            }
            onClick={props.togglePreviewPanel}
            size="sm"
            title="Toggle Preview panel (P)"
            type="button"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </Button>
          
          <div class="h-4 w-px bg-neutral-700 mx-1" />
          
          <Button
            class={`h-6 rounded-full px-2 text-[10px] ${
              props.searchFileNamesOnly()
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400/50"
                : ""
            }`}
            onClick={props.toggleFileNameSearchMode}
            size="sm"
            variant="outline"
            title="Toggle filename-only search (F)"
            type="button"
          >
            {props.searchFileNamesOnly() ? "Filename only: on" : "Filename only: off"}
          </Button>
          <Button
            class={`h-6 rounded-full px-2 text-[10px] ${
              props.searchDebatifyEnabled()
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50"
                : ""
            }`}
            onClick={props.toggleDebatifySearchMode}
            size="sm"
            variant="outline"
            title="Toggle Debatify API tag responses (D)"
            type="button"
          >
            {props.searchDebatifyEnabled() ? "Debatify API: on" : "Debatify API: off"}
          </Button>
          <Button
            class={`h-6 rounded-full px-2 text-[10px] ${
              props.searchSemanticEnabled()
                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-indigo-400/50"
                : ""
            }`}
            onClick={props.toggleSemanticSearchMode}
            size="sm"
            variant="outline"
            title="Toggle AI semantic search"
            type="button"
          >
            {props.searchSemanticEnabled() ? "AI semantic: on" : "AI semantic: off"}
          </Button>
          <Show when={props.isSearching()}>
            <Badge class="text-[10px]" variant="info">
              Searching...
            </Badge>
          </Show>
          <span class="text-xs text-neutral-500">{props.status()}</span>
          <Show when={props.copyToast()}>
            <Badge class="text-[10px] text-emerald-400" variant="success">
              {props.copyToast()}
            </Badge>
          </Show>
        </div>
      </div>
      
      <div class="flex items-center gap-3 px-4 py-2 border-t border-neutral-800/30">
        <div class="relative flex-1 max-w-xl">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <svg class="h-3.5 w-3.5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Input
            id="app-search-input"
            class="pl-8 pr-8"
            onInput={(event) => props.setSearchQuery(event.currentTarget.value)}
            placeholder={
              props.searchFileNamesOnly()
                ? "Filename-only search (F toggles)..."
                : "Search files, headings, and content..."
            }
            ref={props.setSearchInputRef}
            value={props.searchQuery()}
          />
          <Show when={props.isSearching()}>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
              <div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            </div>
          </Show>
        </div>

        <Show when={props.roots().length > 1}>
          <Select
            onChange={(event) => props.setSelectedRootPath(event.currentTarget.value)}
            value={props.selectedRootPath()}
          >
            <option value={ALL_ROOTS_KEY}>All folders</option>
            <For each={props.roots()}>{(root) => <option value={root.path}>{root.path}</option>}</For>
          </Select>
        </Show>

        <div class="flex gap-2">
          <Button
            disabled={props.isIndexing()}
            onClick={props.addFolder}
            type="button"
            variant="secondary"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </Button>
          <Button
            disabled={!props.selectedRootPath() || props.isIndexing()}
            onClick={() => void props.runIndexForSelection()}
            type="button"
            variant="default"
          >
            <Show when={props.isIndexing()} fallback={
              <>
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reindex
              </>
            }>
              <div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </Show>
          </Button>
        </div>
      </div>

      <Show when={activeIndexProgress()}>
        <div class="border-t border-blue-500/20 bg-blue-500/5 px-4 py-2">
          <div class="flex items-center justify-between gap-4 text-xs">
            <span class="text-blue-100">{indexProgressTitle()}</span>
            <Show when={activeIndexProgress()?.phase !== "discovering" && activeIndexProgress()?.changed !== 0}>
              <span class="text-blue-200">{indexProgressPercent()}%</span>
            </Show>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <Show
              when={activeIndexProgress()?.phase !== "discovering" && activeIndexProgress()?.changed !== 0}
              fallback={<div class="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500/50 via-emerald-400/60 to-blue-500/50" />}
            >
              <div
                class="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-[width] duration-200"
                style={{ width: `${indexProgressPercent()}%` }}
              />
            </Show>
          </div>
        </div>
      </Show>

      <Show when={showUpdateBanner()}>
        <div class={`border-t px-4 py-2 ${updateBannerTone()}`}>
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-neutral-100">{updateBannerText()}</span>
            <div class="flex items-center gap-2">
              <Button
                disabled={props.isCheckingUpdates() || props.isInstallingUpdate()}
                onClick={() => void props.checkForUpdates()}
                size="sm"
                type="button"
                variant="secondary"
              >
                Check now
              </Button>
              <Show when={props.updateStatus()?.updateReady}>
                <Button
                  disabled={props.isInstallingUpdate()}
                  onClick={() => void props.installUpdateNow()}
                  size="sm"
                  type="button"
                  variant="default"
                >
                  Install update
                </Button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </header>
  );
}
