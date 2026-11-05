/** Shared TypeScript types for RPad. */

export type OutputKind = 'stdout' | 'stderr' | 'message' | 'warning' | 'error';

export interface OutputChunk {
  kind: OutputKind;
  text: string;
}

export type ExecutionSource = 'script' | 'console' | 'system';
export type ExecutionStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface PlotRecord {
  id: string;
  executionId: string;
  projectId: string;
  createdAt: number;
  width: number;
  height: number;
  /** PNG encoded image. */
  blob: Blob;
  /** Object URL for display, created lazily. */
  url?: string;
  /** Code excerpt that produced the plot. */
  code: string;
  /** Source: 'canvas' when captured from the webr canvas device, 'file' when read from the VFS (ggsave/png). */
  source: 'canvas' | 'file';
  fileName?: string;
}

export interface ExecutionRecord {
  id: string;
  projectId: string;
  source: ExecutionSource;
  code: string;
  startedAt: number;
  finishedAt?: number;
  status: ExecutionStatus;
  output: OutputChunk[];
  plotIds: string[];
  /** Files in the working directory created or modified by this execution. */
  changedFiles: string[];
  /** Whether output has been truncated for display. */
  truncated?: boolean;
}

export interface REnvObject {
  name: string;
  /** R class(es), joined by '/'. */
  className: string;
  /** typeof() in R. */
  typeName: string;
  /** Human readable dimensions, e.g. "100 × 6" or "length 10". */
  dims: string;
  nrow?: number;
  ncol?: number;
  length?: number;
  /** One line preview produced by R. */
  preview: string;
  isDataFrame: boolean;
  isFunction: boolean;
}

export interface DataFrameColumn {
  name: string;
  /** R class of the column (e.g. "numeric", "factor", "character"). */
  className: string;
  levels?: string[];
}

export interface DataFrameMeta {
  name: string;
  nrow: number;
  ncol: number;
  columns: DataFrameColumn[];
}

export interface DataFramePage {
  /** 1-based row indices (original row numbers in R). */
  rowIndex: number[];
  /** Row names if they differ from indices. */
  rowNames: string[];
  /** cells[colIndex][rowInPage] formatted as text; NA is represented by null. */
  cells: (string | null)[][];
  /** Number of rows after filtering (before paging). */
  filteredRows: number;
}

export interface DataFrameQuery {
  name: string;
  offset: number;
  limit: number;
  sortColumn?: string;
  sortDesc?: boolean;
  filterText?: string;
}

export interface VfsFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
  isDir: boolean;
}

export type PackageStatus = 'checking' | 'downloading' | 'installed' | 'unavailable' | 'failed';

export interface PackageProgress {
  name: string;
  status: PackageStatus;
  detail?: string;
}

export type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'busy' | 'error' | 'installing';

export interface RuntimeInfo {
  webrVersion: string;
  rVersion: string;
  channel: 'SharedArrayBuffer' | 'PostMessage' | 'unknown';
  crossOriginIsolated: boolean;
  canInterrupt: boolean;
}

export interface Project {
  id: string;
  name: string;
  /** Working directory inside the WebR virtual filesystem. */
  workdir: string;
  createdAt: number;
  updatedAt: number;
  activeScriptId?: string;
}

export interface Script {
  id: string;
  projectId: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  order: number;
}

export interface StoredFile {
  /** key: `${projectId}:${name}` */
  key: string;
  projectId: string;
  name: string;
  blob: Blob;
  size: number;
  mtime: number;
}

export interface WorkspaceSnapshot {
  id: string;
  projectId: string;
  createdAt: number;
  /** RData produced by save.image(). */
  blob: Blob;
  size: number;
  objectNames: string[];
  label?: string;
}

export interface StoredPlot extends Omit<PlotRecord, 'url'> {}

export interface ProjectExport {
  version: 1;
  exportedAt: number;
  project: Project;
  scripts: Script[];
  files: { name: string; mtime: number; base64: string }[];
  snapshot?: { createdAt: number; objectNames: string[]; base64: string };
}
