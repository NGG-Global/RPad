import { create } from 'zustand';
import type { Lang } from '@/i18n';
import type { ExecutionRecord, PlotRecord, Project, Script, REnvObject, VfsFile, RuntimeStatus, RuntimeInfo, PackageProgress, WorkspaceSnapshot } from '@/types';
import type { InitProgress } from '@/runtime/webr-service';
import type { DfRef } from '@/runtime/webr-service';

export type Theme = 'light' | 'dark' | 'system';
export type PortraitTab = 'editor' | 'console' | 'data' | 'plots';
export type SidePanel = 'environment' | 'files' | 'plots';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error' | 'warning';
  text: string;
  timeout?: number;
}

export interface ConfirmRequest {
  id: number;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface AppState {
  // settings
  lang: Lang;
  theme: Theme;
  fontSize: number;
  symbolBar: boolean;
  showReference: boolean;
  firstRunDone: boolean;

  // runtime
  runtimeStatus: RuntimeStatus;
  runtimeProgress: InitProgress | null;
  runtimeInfo: RuntimeInfo | null;
  runtimeError: string | null;
  packageProgress: PackageProgress | null;
  queueLength: number;
  runningExecutionId: string | null;

  // project
  projects: Project[];
  project: Project | null;
  scripts: Script[];
  activeScriptId: string | null;
  scriptDirty: Record<string, boolean>;
  snapshots: WorkspaceSnapshot[];
  pendingSnapshotRestore: WorkspaceSnapshot | null;

  // session data
  executions: ExecutionRecord[];
  plots: PlotRecord[];
  env: REnvObject[];
  files: VfsFile[];
  workdir: string;

  // ui
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  dataViewer: DfRef | null;
  portraitTab: PortraitTab;
  sidePanel: SidePanel;
  activePlotId: string | null;
  selectedExecutionIds: string[];
  consoleHistory: string[];
  layout: { editorFraction: number; sideFraction: number };

  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
  toast: (kind: Toast['kind'], text: string, timeout?: number) => void;
  dismissToast: (id: number) => void;
  askConfirm: (req: Omit<ConfirmRequest, 'id' | 'resolve'>) => Promise<boolean>;
  updateExecution: (id: string, patch: Partial<ExecutionRecord> | ((e: ExecutionRecord) => Partial<ExecutionRecord>)) => void;
}

let toastSeq = 0;
let confirmSeq = 0;

export const useAppStore = create<AppState>((set, get) => ({
  lang: 'he',
  theme: 'system',
  fontSize: 14,
  symbolBar: true,
  showReference: false,
  firstRunDone: false,

  runtimeStatus: 'idle',
  runtimeProgress: null,
  runtimeInfo: null,
  runtimeError: null,
  packageProgress: null,
  queueLength: 0,
  runningExecutionId: null,

  projects: [],
  project: null,
  scripts: [],
  activeScriptId: null,
  scriptDirty: {},
  snapshots: [],
  pendingSnapshotRestore: null,

  executions: [],
  plots: [],
  env: [],
  files: [],
  workdir: '',

  toasts: [],
  confirm: null,
  dataViewer: null,
  portraitTab: 'editor',
  sidePanel: 'environment',
  activePlotId: null,
  selectedExecutionIds: [],
  consoleHistory: [],
  layout: { editorFraction: 0.58, sideFraction: 0.3 },

  set: (partial) => set(partial as never),
  toast: (kind, text, timeout = 3500) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text, timeout }] }));
    if (timeout > 0) setTimeout(() => get().dismissToast(id), timeout);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  askConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      const id = ++confirmSeq;
      set({ confirm: { ...req, id, resolve: (ok) => { set({ confirm: null }); resolve(ok); } } });
    }),
  updateExecution: (id, patch) =>
    set((s) => ({
      executions: s.executions.map((e) => (e.id === id ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e)),
    })),
}));

export function useT() {
  const lang = useAppStore((s) => s.lang);
  return lang;
}
