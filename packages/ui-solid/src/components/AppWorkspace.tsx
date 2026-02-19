import type { Accessor, Setter } from "solid-js";
import CaptureTargetPanel from "./CaptureTargetPanel";
import SidePreviewPane from "./SidePreviewPane";
import TopControls from "./TopControls";
import TreeView from "./TreeView";
import type { DesktopUpdateStatus } from "../electrobun/bridge";
import type {
  CaptureTarget,
  CaptureTargetPreview,
  FileHeading,
  IndexProgress,
  RootSummary,
  SearchHit,
  SidePreview,
  TreeRow,
} from "../lib/types";

type VirtualWindow = {
  start: number;
  end: number;
  topSpacerPx: number;
  bottomSpacerPx: number;
};

type AppWorkspaceProps = {
  activeLastIndexedMs: Accessor<number>;
  activeRootLabel: Accessor<string>;
  addFolder: () => Promise<void>;
  copyToast: Accessor<string>;
  isIndexing: Accessor<boolean>;
  isSearching: Accessor<boolean>;
  roots: Accessor<RootSummary[]>;
  runIndexForSelection: () => Promise<void>;
  searchQuery: Accessor<string>;
  searchFileNamesOnly: Accessor<boolean>;
  searchDebatifyEnabled: Accessor<boolean>;
  searchSemanticEnabled: Accessor<boolean>;
  selectedRootPath: Accessor<string>;
  indexProgress: Accessor<IndexProgress | null>;
  setSearchInputRef: (element: HTMLInputElement) => void;
  setSearchQuery: (value: string) => void;
  setSelectedRootPath: (value: string) => void;
  toggleFileNameSearchMode: () => void;
  toggleDebatifySearchMode: () => void;
  toggleSemanticSearchMode: () => void;
  updateStatus: Accessor<DesktopUpdateStatus | null>;
  isCheckingUpdates: Accessor<boolean>;
  isInstallingUpdate: Accessor<boolean>;
  checkForUpdates: () => Promise<void>;
  installUpdateNow: () => Promise<void>;
  status: Accessor<string>;
  showCapturePanel: Accessor<boolean>;
  showPreviewPanel: Accessor<boolean>;
  toggleCapturePanel: () => void;
  togglePreviewPanel: () => void;
  leftRailWidthPx: Accessor<number>;
  startLeftRailResize: (event: MouseEvent) => void;
  addCaptureHeading: (headingLevel: 1 | 2 | 3 | 4, headingName: string) => Promise<boolean>;
  captureRootPath: Accessor<string>;
  captureTargetH1ToH4: Accessor<FileHeading[]>;
  captureTargetPreview: Accessor<CaptureTargetPreview | null>;
  captureTargets: Accessor<CaptureTarget[]>;
  createCaptureTarget: () => Promise<void>;
  deleteCaptureHeading: (headingOrder: number) => Promise<void>;
  isAllRootsSelected: Accessor<boolean>;
  isLoadingCapturePreview: Accessor<boolean>;
  isLoadingCaptureTargets: Accessor<boolean>;
  moveCaptureHeading: (sourceHeadingOrder: number, targetHeadingOrder: number) => Promise<void>;
  selectCaptureTargetFromFilesystem: () => Promise<void>;
  selectedCaptureHeadingOrder: Accessor<number | null>;
  selectedCaptureTarget: Accessor<string>;
  selectedCaptureTargetMeta: Accessor<CaptureTarget | null>;
  setSelectedCaptureHeadingOrder: Setter<number | null>;
  setSelectedCaptureTarget: (value: string, persist?: boolean) => void;
  activateRow: (row: TreeRow, fromKeyboard?: boolean) => Promise<void>;
  applyPreviewFromRow: (row: TreeRow) => void;
  collapsedHeadings: Accessor<Set<string>>;
  expandedFiles: Accessor<Set<number>>;
  expandedFolders: Accessor<Set<string>>;
  focusedNodeKey: Accessor<string>;
  isLoadingSnapshot: Accessor<boolean>;
  onTreeKeyDown: (event: KeyboardEvent) => void;
  onTreeScroll: (scrollTop: number) => void;
  openSearchResult: (result: SearchHit) => Promise<void>;
  searchMode: Accessor<boolean>;
  setFocusedNodeKey: (key: string) => void;
  setTreeRef: (element: HTMLDivElement) => void;
  treeRowsLength: Accessor<number>;
  virtualWindow: Accessor<VirtualWindow>;
  visibleTreeRows: Accessor<TreeRow[]>;
  startPreviewPanelResize: (event: MouseEvent) => void;
  sidePreview: Accessor<SidePreview | null>;
  previewPanelWidthPx: Accessor<number>;
};

export default function AppWorkspace(props: AppWorkspaceProps) {
  return (
    <div class="h-screen overflow-hidden bg-[#0a0a0a]">
      <div class="flex h-full w-full flex-col">
        <TopControls
          activeLastIndexedMs={props.activeLastIndexedMs}
          activeRootLabel={props.activeRootLabel}
          addFolder={props.addFolder}
          copyToast={props.copyToast}
          indexProgress={props.indexProgress}
          isIndexing={props.isIndexing}
          isSearching={props.isSearching}
          roots={props.roots}
          runIndexForSelection={props.runIndexForSelection}
          searchDebatifyEnabled={props.searchDebatifyEnabled}
          searchFileNamesOnly={props.searchFileNamesOnly}
          searchQuery={props.searchQuery}
          searchSemanticEnabled={props.searchSemanticEnabled}
          selectedRootPath={props.selectedRootPath}
          setSearchInputRef={props.setSearchInputRef}
          setSearchQuery={props.setSearchQuery}
          setSelectedRootPath={props.setSelectedRootPath}
          showCapturePanel={props.showCapturePanel}
          showPreviewPanel={props.showPreviewPanel}
          status={props.status}
          toggleCapturePanel={props.toggleCapturePanel}
          toggleDebatifySearchMode={props.toggleDebatifySearchMode}
          toggleFileNameSearchMode={props.toggleFileNameSearchMode}
          togglePreviewPanel={props.togglePreviewPanel}
          toggleSemanticSearchMode={props.toggleSemanticSearchMode}
          updateStatus={props.updateStatus}
          isCheckingUpdates={props.isCheckingUpdates}
          isInstallingUpdate={props.isInstallingUpdate}
          checkForUpdates={props.checkForUpdates}
          installUpdateNow={props.installUpdateNow}
        />

        <div class="flex min-h-0 flex-1">
          <div
            class="workspace-split h-full min-h-0 min-w-0 flex-1"
            style={{ "--left-rail-width": props.showCapturePanel() ? `${props.leftRailWidthPx()}px` : "0px" }}
          >
            {props.showCapturePanel() && (
              <aside class="flex h-full min-h-0 flex-col border-r border-neutral-800/50 bg-neutral-950/30">
                <CaptureTargetPanel
                  addCaptureHeading={props.addCaptureHeading}
                  captureRootPath={props.captureRootPath}
                  captureTargetH1ToH4={props.captureTargetH1ToH4}
                  captureTargetPreview={props.captureTargetPreview}
                  captureTargets={props.captureTargets}
                  createCaptureTarget={props.createCaptureTarget}
                  deleteCaptureHeading={props.deleteCaptureHeading}
                  isAllRootsSelected={props.isAllRootsSelected}
                  isLoadingCapturePreview={props.isLoadingCapturePreview}
                  isLoadingCaptureTargets={props.isLoadingCaptureTargets}
                  moveCaptureHeading={props.moveCaptureHeading}
                  selectCaptureTargetFromFilesystem={props.selectCaptureTargetFromFilesystem}
                  selectedCaptureHeadingOrder={props.selectedCaptureHeadingOrder}
                  selectedCaptureTarget={props.selectedCaptureTarget}
                  selectedCaptureTargetMeta={props.selectedCaptureTargetMeta}
                  setSelectedCaptureHeadingOrder={props.setSelectedCaptureHeadingOrder}
                  setSelectedCaptureTarget={props.setSelectedCaptureTarget}
                />
              </aside>
            )}

            {props.showCapturePanel() && (
              <button
                aria-label="Resize insert preview panel"
                class="panel-resize-handle hidden lg:flex"
                onMouseDown={props.startLeftRailResize}
                title="Drag to resize"
                type="button"
              />
            )}

            <div class="h-full min-h-0 min-w-0 flex-1 bg-neutral-950/20">
              <TreeView
                activateRow={props.activateRow}
                applyPreviewFromRow={props.applyPreviewFromRow}
                collapsedHeadings={props.collapsedHeadings}
                expandedFiles={props.expandedFiles}
                expandedFolders={props.expandedFolders}
                focusedNodeKey={props.focusedNodeKey}
                isLoadingSnapshot={props.isLoadingSnapshot}
                isSearching={props.isSearching}
                onTreeKeyDown={props.onTreeKeyDown}
                onTreeScroll={props.onTreeScroll}
                openSearchResult={props.openSearchResult}
                searchMode={props.searchMode}
                selectedRootPath={props.selectedRootPath}
                setFocusedNodeKey={props.setFocusedNodeKey}
                setTreeRef={props.setTreeRef}
                treeRowsLength={props.treeRowsLength}
                virtualWindow={props.virtualWindow}
                visibleTreeRows={props.visibleTreeRows}
              />
            </div>
          </div>

          {props.showPreviewPanel() && (
            <>
              <button
                aria-label="Resize preview panel"
                class="panel-resize-handle flex"
                onMouseDown={props.startPreviewPanelResize}
                title="Drag to resize preview"
                type="button"
              />
              <SidePreviewPane sidePreview={props.sidePreview} width={props.previewPanelWidthPx} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
