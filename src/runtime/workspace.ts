/**
 * Workspace controller: the single place that coordinates the R runtime, the
 * execution queue, persistence and the UI store. React components call
 * methods here; they never talk to WebR directly.
 */
import { WebRService, type DfRef, type InitProgress } from './webr-service';
import { ExecutionQueue } from './execution-queue';
import { detectPackages } from './packages';
import { coalesce, truncateOutput } from './output';
import { imageBitmapToPng, IMAGE_EXTENSIONS, mimeForFile } from './plots';
import { repo, newId, LIMITS } from '@/persistence/db';
import { useAppStore } from '@/store/app-store';
import { translate } from '@/i18n';
import { courseTemplate } from '@/course/template';
import type { ExecutionRecord, ExecutionSource, PlotRecord, Project, Script, VfsFile, StoredFile, WorkspaceSnapshot, ProjectExport } from '@/types';
import { blobToBase64, base64ToBytes } from '@/utils/download';

const PROJECTS_ROOT = '/home/web_user/projects';
const SNAPSHOT_FILE = '.rpad_snapshot.RData';

function slugify(name: string, id: string): string {
  const s = name.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return s.length >= 2 ? s.slice(0, 40) : `project_${id.slice(-8)}`;
}

function t(key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) {
  return translate(useAppStore.getState().lang, key, vars);
}

export class Workspace {
  readonly r: WebRService;
  readonly queue = new ExecutionQueue();
  private initPromise: Promise<void> | null = null;
  private saveTimers = new Map<string, number>();
  private fileSnapshot = new Map<string, { size: number; mtime: number }>();

  constructor(baseUrl?: string) {
    this.r = new WebRService(baseUrl);
    this.queue.subscribe(() => {
      useAppStore.setState({ queueLength: this.queue.pending + (this.queue.current ? 1 : 0) });
    });
  }

  // ---------- boot ----------

  async boot(): Promise<void> {
    const s = useAppStore.getState();
    const [lang, theme, fontSize, symbolBar, showReference, firstRunDone, lastProjectId, layout] = await Promise.all([
      repo.getSetting('lang', s.lang),
      repo.getSetting('theme', s.theme),
      repo.getSetting('fontSize', s.fontSize),
      repo.getSetting('symbolBar', s.symbolBar),
      repo.getSetting('showReference', s.showReference),
      repo.getSetting('firstRunDone', false),
      repo.getSetting<string | null>('lastProjectId', null),
      repo.getSetting('layout', s.layout),
    ]);
    useAppStore.setState({ lang, theme, fontSize, symbolBar, showReference, firstRunDone, layout });
    let projects = await repo.listProjects();
    if (projects.length === 0) {
      const p = await this.createProject(t('defaultProjectName'), { template: true, select: false });
      projects = [p];
    }
    useAppStore.setState({ projects });
    const target = projects.find((p) => p.id === lastProjectId) ?? projects[0];
    await this.openProject(target.id);
    if (firstRunDone) void this.startRuntime();
  }

  async setSetting<K extends 'lang' | 'theme' | 'fontSize' | 'symbolBar' | 'showReference' | 'layout'>(key: K, value: ReturnType<typeof useAppStore.getState>[K]) {
    useAppStore.setState({ [key]: value } as never);
    await repo.setSetting(key, value);
  }

  async startRuntime(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      useAppStore.setState({ runtimeStatus: 'loading', runtimeError: null, runtimeProgress: null });
      try {
        await waitForServiceWorker(4000);
        const info = await this.r.init((p: InitProgress) => useAppStore.setState({ runtimeProgress: p }));
        void warmRuntimeCache(this.r.baseUrl);
        useAppStore.setState({ runtimeStatus: 'ready', runtimeInfo: info, firstRunDone: true });
        await repo.setSetting('firstRunDone', true);
        const project = useAppStore.getState().project;
        if (project) await this.attachProjectToRuntime(project);
      } catch (e) {
        useAppStore.setState({ runtimeStatus: 'error', runtimeError: (e as Error).message ?? String(e) });
        this.initPromise = null;
      }
    })();
    return this.initPromise;
  }

  async restartRuntime(): Promise<void> {
    this.queue.cancelAllPending();
    this.r.close();
    this.initPromise = null;
    this.fileSnapshot.clear();
    useAppStore.setState({ env: [], runtimeStatus: 'idle', runtimeInfo: null });
    await this.startRuntime();
  }

  interrupt(): void {
    this.r.interrupt();
  }

  get ready(): boolean {
    return this.r.isReady && useAppStore.getState().runtimeStatus !== 'loading';
  }

  // ---------- projects ----------

  async createProject(name: string, opts: { template?: boolean; select?: boolean } = {}): Promise<Project> {
    const id = newId('p');
    const now = Date.now();
    const project: Project = { id, name: name.trim() || t('untitledProject'), workdir: `${PROJECTS_ROOT}/${slugify(name, id)}`, createdAt: now, updatedAt: now };
    await repo.putProject(project);
    const script: Script = { id: newId('s'), projectId: id, name: t('defaultScriptName'), content: opts.template ? courseTemplate({ week: 1 }) : '', createdAt: now, updatedAt: now, order: 0 };
    await repo.putScript(script);
    project.activeScriptId = script.id;
    await repo.putProject(project);
    useAppStore.setState((s) => ({ projects: [project, ...s.projects] }));
    if (opts.select !== false) await this.openProject(id);
    return project;
  }

  async openProject(id: string): Promise<void> {
    const project = await repo.getProject(id);
    if (!project) return;
    await this.flushScriptSaves();
    const [scripts, executions, storedPlots, snapshots] = await Promise.all([
      repo.listScripts(id),
      repo.listExecutions(id),
      repo.listPlots(id),
      repo.listSnapshots(id),
    ]);
    for (const p of useAppStore.getState().plots) if (p.url) URL.revokeObjectURL(p.url);
    const plots: PlotRecord[] = storedPlots.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
    useAppStore.setState({
      project,
      scripts,
      activeScriptId: scripts.find((s) => s.id === project.activeScriptId)?.id ?? scripts[0]?.id ?? null,
      executions,
      plots,
      snapshots,
      activePlotId: plots[plots.length - 1]?.id ?? null,
      env: [],
      files: [],
      workdir: project.workdir,
      dataViewer: null,
      selectedExecutionIds: [],
      pendingSnapshotRestore: null,
      scriptDirty: {},
    });
    await repo.setSetting('lastProjectId', id);
    if (this.r.isReady) await this.attachProjectToRuntime(project);
  }

  /** Point R's working directory at the project and restore persisted files. */
  private attachProjectToRuntime(project: Project): Promise<void> {
    return this.queue.enqueue('attach-project', async () => {
      await this.r.setwd(project.workdir);
      const stored = await repo.listFiles(project.id);
      let restored = 0;
      for (const f of stored) {
        const path = `${project.workdir}/${f.name}`;
        if (!(await this.r.fileExists(path))) {
          await this.r.writeFile(path, new Uint8Array(await f.blob.arrayBuffer()));
          restored++;
        }
      }
      await this.refreshFiles();
      this.fileSnapshot = new Map(useAppStore.getState().files.map((f) => [f.name, { size: f.size, mtime: f.mtime }]));
      await this.refreshEnvironment();
      const env = useAppStore.getState().env;
      const snapshots = useAppStore.getState().snapshots;
      if (env.length === 0 && snapshots.length > 0) useAppStore.setState({ pendingSnapshotRestore: snapshots[0] });
      if (restored > 0) useAppStore.getState().toast('info', t('sessionRestoredFiles', { n: restored }));
    });
  }

  async renameProject(id: string, name: string): Promise<void> {
    const p = await repo.getProject(id);
    if (!p) return;
    p.name = name.trim() || p.name;
    p.updatedAt = Date.now();
    await repo.putProject(p);
    useAppStore.setState((s) => ({ projects: s.projects.map((x) => (x.id === id ? p : x)), project: s.project?.id === id ? p : s.project }));
  }

  async deleteProject(id: string): Promise<void> {
    await repo.deleteProject(id);
    const remaining = (await repo.listProjects()).filter((p) => p.id !== id);
    useAppStore.setState({ projects: remaining });
    if (useAppStore.getState().project?.id === id) {
      if (remaining.length === 0) await this.createProject(t('defaultProjectName'), { template: true });
      else await this.openProject(remaining[0].id);
    }
  }

  async exportProject(): Promise<Blob> {
    await this.flushScriptSaves();
    const s = useAppStore.getState();
    if (!s.project) throw new Error('no project');
    const files = await repo.listFiles(s.project.id);
    const snap = s.snapshots[0];
    const data: ProjectExport = {
      version: 1,
      exportedAt: Date.now(),
      project: s.project,
      scripts: await repo.listScripts(s.project.id),
      files: await Promise.all(files.map(async (f) => ({ name: f.name, mtime: f.mtime, base64: await blobToBase64(f.blob) }))),
      snapshot: snap ? { createdAt: snap.createdAt, objectNames: snap.objectNames, base64: await blobToBase64(snap.blob) } : undefined,
    };
    return new Blob([JSON.stringify(data)], { type: 'application/json' });
  }

  async importProject(file: File): Promise<void> {
    const data = JSON.parse(await file.text()) as ProjectExport;
    if (data.version !== 1 || !data.project) throw new Error('invalid project file');
    const id = newId('p');
    const now = Date.now();
    const project: Project = { ...data.project, id, workdir: `${PROJECTS_ROOT}/${slugify(data.project.name, id)}`, createdAt: now, updatedAt: now };
    const scripts = data.scripts.map((sc, i) => ({ ...sc, id: newId('s'), projectId: id, order: i }));
    project.activeScriptId = scripts[0]?.id;
    await repo.putProject(project);
    for (const sc of scripts) await repo.putScript(sc);
    for (const f of data.files) {
      const bytes = base64ToBytes(f.base64);
      await repo.putFile({ key: `${id}:${f.name}`, projectId: id, name: f.name, blob: new Blob([bytes]), size: bytes.length, mtime: f.mtime });
    }
    if (data.snapshot) {
      const bytes = base64ToBytes(data.snapshot.base64);
      await repo.putSnapshot({ id: newId('snap'), projectId: id, createdAt: data.snapshot.createdAt, blob: new Blob([bytes]), size: bytes.length, objectNames: data.snapshot.objectNames });
    }
    useAppStore.setState((s) => ({ projects: [project, ...s.projects] }));
    await this.openProject(id);
  }

  // ---------- scripts ----------

  async createScript(name?: string, content = ''): Promise<Script> {
    const s = useAppStore.getState();
    if (!s.project) throw new Error('no project');
    const now = Date.now();
    const n = s.scripts.length + 1;
    const script: Script = { id: newId('s'), projectId: s.project.id, name: name?.trim() || `script${n}`, content, createdAt: now, updatedAt: now, order: n };
    await repo.putScript(script);
    useAppStore.setState({ scripts: [...s.scripts, script], activeScriptId: script.id });
    await this.setActiveScript(script.id);
    return script;
  }

  async setActiveScript(id: string): Promise<void> {
    const s = useAppStore.getState();
    if (!s.project) return;
    useAppStore.setState({ activeScriptId: id });
    const p = { ...s.project, activeScriptId: id };
    await repo.putProject(p);
    useAppStore.setState({ project: p });
  }

  /** Debounced autosave of script text. */
  updateScriptContent(id: string, content: string): void {
    useAppStore.setState((s) => ({
      scripts: s.scripts.map((sc) => (sc.id === id ? { ...sc, content } : sc)),
      scriptDirty: { ...s.scriptDirty, [id]: true },
    }));
    const existing = this.saveTimers.get(id);
    if (existing) clearTimeout(existing);
    this.saveTimers.set(id, window.setTimeout(() => void this.saveScript(id), 600));
  }

  async saveScript(id: string): Promise<void> {
    const timer = this.saveTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(id);
    }
    const sc = useAppStore.getState().scripts.find((x) => x.id === id);
    if (!sc) return;
    await repo.putScript({ ...sc, updatedAt: Date.now() });
    useAppStore.setState((s) => ({ scriptDirty: { ...s.scriptDirty, [id]: false } }));
  }

  async flushScriptSaves(): Promise<void> {
    for (const id of [...this.saveTimers.keys()]) await this.saveScript(id);
  }

  async renameScript(id: string, name: string): Promise<void> {
    const sc = useAppStore.getState().scripts.find((x) => x.id === id);
    if (!sc) return;
    const renamed = { ...sc, name: name.trim() || sc.name, updatedAt: Date.now() };
    await repo.putScript(renamed);
    useAppStore.setState((s) => ({ scripts: s.scripts.map((x) => (x.id === id ? renamed : x)) }));
  }

  async deleteScript(id: string): Promise<void> {
    await repo.deleteScript(id);
    const s = useAppStore.getState();
    const scripts = s.scripts.filter((x) => x.id !== id);
    useAppStore.setState({ scripts });
    if (scripts.length === 0) await this.createScript();
    else if (s.activeScriptId === id) await this.setActiveScript(scripts[0].id);
  }

  // ---------- execution ----------

  /** Queue user code for execution. Returns the execution id immediately. */
  runCode(code: string, source: ExecutionSource = 'script'): string {
    const s = useAppStore.getState();
    const projectId = s.project?.id ?? '';
    const exec: ExecutionRecord = { id: newId('e'), projectId, source, code, startedAt: Date.now(), status: 'queued', output: [], plotIds: [], changedFiles: [] };
    useAppStore.setState({ executions: [...s.executions, exec] });
    if (source === 'console' && code.trim()) {
      useAppStore.setState((st) => ({ consoleHistory: [...st.consoleHistory.filter((h) => h !== code).slice(-199), code] }));
    }
    const task = this.queue.enqueue(`run:${exec.id}`, () => this.executeNow(exec));
    task.catch((e: Error) => {
      if (e.message === 'cancelled') {
        useAppStore.getState().updateExecution(exec.id, { status: 'cancelled', finishedAt: Date.now() });
      }
    });
    return exec.id;
  }

  private async executeNow(exec: ExecutionRecord): Promise<void> {
    const store = useAppStore.getState();
    if (!this.r.isReady) {
      await this.startRuntime();
      if (!this.r.isReady) {
        store.updateExecution(exec.id, { status: 'error', finishedAt: Date.now(), output: [{ kind: 'error', text: 'R runtime is not available.' }] });
        return;
      }
    }
    useAppStore.setState({ runningExecutionId: exec.id, runtimeStatus: 'busy' });
    store.updateExecution(exec.id, { status: 'running', startedAt: Date.now() });
    try {
      // 1. Make sure referenced packages are installed, with visible progress.
      const pkgs = detectPackages(exec.code);
      for (const pkg of pkgs) {
        const ok = await this.ensurePackage(pkg);
        if (!ok.ok) {
          store.updateExecution(exec.id, (e) => ({ output: [...e.output, { kind: 'error', text: ok.message }] }));
        }
      }
      useAppStore.setState({ runtimeStatus: 'busy' });

      // 2. Run the code in the persistent session.
      const result = await this.r.run(exec.code);
      const { chunks, truncated } = truncateOutput(coalesce(result.output));

      // 3. Collect plots captured by the canvas device.
      const plotIds: string[] = [];
      for (const page of result.images) {
        const img = page.bitmap;
        try {
          const blob = await imageBitmapToPng(img);
          const last = useAppStore.getState().plots.at(-1);
          if (!page.isNew && last && last.source === 'canvas') {
            await this.updatePlot(last.id, blob, exec.code);
            if (!plotIds.includes(last.id)) plotIds.push(last.id);
          } else {
            const plot = await this.addPlot({ executionId: exec.id, blob, width: img.width, height: img.height, code: exec.code, source: 'canvas' });
            plotIds.push(plot.id);
          }
        } catch (e) {
          console.warn('plot conversion failed', e);
        } finally {
          img.close?.();
        }
      }

      // 4. Detect files written to the working directory (write.csv, ggsave, save...).
      const changedFiles = await this.syncChangedFiles();
      for (const name of changedFiles) {
        if (IMAGE_EXTENSIONS.test(name)) {
          const f = await repo.getFile(exec.projectId, name);
          if (f) {
            const dims = await imageDimensions(f.blob).catch(() => ({ width: 0, height: 0 }));
            const plot = await this.addPlot({ executionId: exec.id, blob: f.blob, width: dims.width, height: dims.height, code: exec.code, source: 'file', fileName: name });
            plotIds.push(plot.id);
          }
        }
      }

      store.updateExecution(exec.id, {
        status: result.errored ? 'error' : 'done',
        finishedAt: Date.now(),
        output: chunks,
        plotIds,
        changedFiles,
        truncated,
      });

      // 5. Refresh the environment panel and handle View() requests.
      await this.refreshEnvironment();
      for (const v of result.views) {
        const [kind, ...rest] = v.split(':');
        const name = rest.join(':');
        useAppStore.setState({ dataViewer: { kind: kind === 'view' ? 'view' : 'global', name } });
      }
      if (plotIds.length > 0) useAppStore.setState({ activePlotId: plotIds[plotIds.length - 1] });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      store.updateExecution(exec.id, (ex) => ({ status: 'error', finishedAt: Date.now(), output: [...ex.output, { kind: 'error', text: `Error: ${msg}` }] }));
      if (/memory|out of bounds|unreachable/i.test(msg)) useAppStore.getState().toast('error', t('memoryWarning'), 8000);
    } finally {
      useAppStore.setState({ runningExecutionId: null, runtimeStatus: this.r.isReady ? 'ready' : 'error', packageProgress: null });
      const final = useAppStore.getState().executions.find((x) => x.id === exec.id);
      if (final) {
        await repo.putExecution(final);
        await repo.trimExecutions(final.projectId);
      }
    }
  }

  private async ensurePackage(pkg: string): Promise<{ ok: boolean; message: string }> {
    useAppStore.setState({ packageProgress: { name: pkg, status: 'checking' } });
    if (await this.r.isPackageInstalled(pkg)) {
      useAppStore.setState({ packageProgress: { name: pkg, status: 'installed' } });
      return { ok: true, message: '' };
    }
    useAppStore.setState({ runtimeStatus: 'installing', packageProgress: { name: pkg, status: 'downloading', detail: '' } });
    const res = await this.r.installPackage(pkg, (line) => {
      const detail = line.replace(/\s+/g, ' ').trim();
      if (detail) useAppStore.setState({ packageProgress: { name: pkg, status: 'downloading', detail } });
    });
    if (res.ok) {
      useAppStore.setState({ packageProgress: { name: pkg, status: 'installed' } });
      useAppStore.getState().toast('success', t('packageInstalled', { name: pkg }));
      return res;
    }
    const unavailable = /not available|Package .* not found|unknown package|cannot open URL|404/i.test(res.message) || !res.message;
    const message = unavailable ? t('packageUnavailable', { name: pkg }) : t('packageFailed', { name: pkg, detail: res.message });
    useAppStore.setState({ packageProgress: { name: pkg, status: unavailable ? 'unavailable' : 'failed', detail: message } });
    useAppStore.getState().toast('error', message, 8000);
    return { ok: false, message };
  }

  installPackage(pkg: string): Promise<{ ok: boolean; message: string }> {
    return this.queue.enqueue(`install:${pkg}`, () => this.ensurePackage(pkg));
  }

  /** Determine how many lines from `startLine` form a complete expression (uses R's parser). */
  completeExpressionLength(lines: string[]): Promise<number> {
    if (!this.r.isReady) return Promise.resolve(1);
    return this.queue.enqueue('parse', () => this.r.completeExpressionLength(lines), { front: true }).catch(() => 1);
  }

  async refreshEnvironment(): Promise<void> {
    if (!this.r.isReady) return;
    try {
      const env = await this.r.getEnvironment();
      useAppStore.setState({ env });
    } catch (e) {
      console.warn('environment refresh failed', e);
    }
  }

  refreshEnvironmentQueued(): Promise<void> {
    return this.queue.enqueue('env', () => this.refreshEnvironment());
  }

  // ---------- plots ----------

  private async addPlot(p: { executionId: string; blob: Blob; width: number; height: number; code: string; source: 'canvas' | 'file'; fileName?: string }): Promise<PlotRecord> {
    const s = useAppStore.getState();
    const plot: PlotRecord = { id: newId('plot'), projectId: s.project?.id ?? '', createdAt: Date.now(), ...p };
    await repo.putPlot({ ...plot });
    plot.url = URL.createObjectURL(plot.blob);
    useAppStore.setState((st) => {
      const plots = [...st.plots, plot];
      while (plots.length > LIMITS.maxPlotsPerProject) {
        const old = plots.shift();
        if (old?.url) URL.revokeObjectURL(old.url);
      }
      return { plots };
    });
    return plot;
  }

  /** Replace the image of an existing plot (drawing added to an open page). */
  private async updatePlot(id: string, blob: Blob, code: string): Promise<void> {
    const s = useAppStore.getState();
    const existing = s.plots.find((p) => p.id === id);
    if (!existing) return;
    if (existing.url) URL.revokeObjectURL(existing.url);
    const updated: PlotRecord = { ...existing, blob, code: `${existing.code}\n${code}`, url: URL.createObjectURL(blob) };
    const { url: _url, ...stored } = updated;
    await repo.putPlot(stored);
    useAppStore.setState((st) => ({ plots: st.plots.map((p) => (p.id === id ? updated : p)) }));
  }

  async deletePlot(id: string): Promise<void> {
    await repo.deletePlot(id);
    useAppStore.setState((s) => {
      const p = s.plots.find((x) => x.id === id);
      if (p?.url) URL.revokeObjectURL(p.url);
      const plots = s.plots.filter((x) => x.id !== id);
      return { plots, activePlotId: s.activePlotId === id ? plots[plots.length - 1]?.id ?? null : s.activePlotId };
    });
  }

  async clearPlots(): Promise<void> {
    const s = useAppStore.getState();
    if (s.project) await repo.clearPlots(s.project.id);
    for (const p of s.plots) if (p.url) URL.revokeObjectURL(p.url);
    useAppStore.setState({ plots: [], activePlotId: null });
  }

  // ---------- files ----------

  async refreshFiles(): Promise<VfsFile[]> {
    if (!this.r.isReady) return [];
    const files = (await this.r.listFiles()).filter((f) => !f.name.startsWith('.'));
    useAppStore.setState({ files });
    return files;
  }

  /** Compare the working directory with the last snapshot and persist new or modified files. */
  private async syncChangedFiles(): Promise<string[]> {
    const project = useAppStore.getState().project;
    if (!project) return [];
    const files = await this.refreshFiles();
    const changed: string[] = [];
    const next = new Map<string, { size: number; mtime: number }>();
    for (const f of files) {
      if (f.isDir) continue;
      next.set(f.name, { size: f.size, mtime: f.mtime });
      const prev = this.fileSnapshot.get(f.name);
      if (!prev || prev.size !== f.size || prev.mtime !== f.mtime) {
        changed.push(f.name);
        if (f.size <= LIMITS.maxFileBytes) {
          const bytes = await this.r.readFile(f.path);
          await repo.putFile({ key: `${project.id}:${f.name}`, projectId: project.id, name: f.name, blob: new Blob([bytes], { type: mimeForFile(f.name) }), size: f.size, mtime: f.mtime });
        }
      }
    }
    for (const name of this.fileSnapshot.keys()) {
      if (!next.has(name)) await repo.deleteFile(project.id, name);
    }
    this.fileSnapshot = next;
    return changed;
  }

  uploadFile(name: string, bytes: Uint8Array): Promise<void> {
    return this.queue.enqueue(`upload:${name}`, async () => {
      const project = useAppStore.getState().project;
      if (!project) return;
      await this.r.writeFile(`${project.workdir}/${name}`, bytes);
      await this.syncChangedFiles();
    });
  }

  readFileBlob(name: string): Promise<Blob> {
    return this.queue.enqueue(`read:${name}`, async () => {
      const project = useAppStore.getState().project;
      if (!project) throw new Error('no project');
      const bytes = await this.r.readFile(`${project.workdir}/${name}`);
      return new Blob([bytes], { type: mimeForFile(name) });
    });
  }

  deleteFile(name: string): Promise<void> {
    return this.queue.enqueue(`delete:${name}`, async () => {
      const project = useAppStore.getState().project;
      if (!project) return;
      await this.r.deleteFile(`${project.workdir}/${name}`);
      await repo.deleteFile(project.id, name);
      this.fileSnapshot.delete(name);
      await this.refreshFiles();
    });
  }

  /** Export a data frame from R as CSV (via write.csv in a temporary file). */
  exportDataFrameCsv(ref: DfRef): Promise<Blob> {
    return this.queue.enqueue(`csv:${ref.name}`, async () => {
      const tmp = `/tmp/rpad_export_${Date.now()}.csv`;
      const target = ref.kind === 'view' ? `as.environment("rpad")$views[[${JSON.stringify(ref.name)}]]` : ref.name;
      await this.r.evalVoid(`write.csv(${target}, ${JSON.stringify(tmp)}, row.names = FALSE, fileEncoding = "UTF-8")`);
      const bytes = await this.r.readFile(tmp);
      await this.r.deleteFile(tmp);
      return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), bytes], { type: 'text/csv;charset=utf-8' });
    });
  }

  // ---------- data frame paging ----------

  getDataFrameMeta(ref: DfRef) {
    return this.queue.enqueue(`meta:${ref.name}`, () => this.r.getDataFrameMeta(ref));
  }

  getDataFramePage(ref: DfRef, q: Parameters<WebRService['getDataFramePage']>[1]) {
    return this.queue.enqueue(`page:${ref.name}`, () => this.r.getDataFramePage(ref, q));
  }

  getColumnSummary(ref: DfRef, col: string) {
    return this.queue.enqueue(`summary:${ref.name}`, () => this.r.getColumnSummary(ref, col));
  }

  // ---------- snapshots ----------

  saveSnapshot(label?: string): Promise<WorkspaceSnapshot> {
    return this.queue.enqueue('snapshot-save', async () => {
      const project = useAppStore.getState().project;
      if (!project) throw new Error('no project');
      const path = `${project.workdir}/${SNAPSHOT_FILE}`;
      const names = await this.r.saveWorkspace(path);
      const bytes = await this.r.readFile(path);
      await this.r.deleteFile(path);
      const snap: WorkspaceSnapshot = { id: newId('snap'), projectId: project.id, createdAt: Date.now(), blob: new Blob([bytes]), size: bytes.length, objectNames: names, label };
      await repo.putSnapshot(snap);
      const snapshots = await repo.listSnapshots(project.id);
      useAppStore.setState({ snapshots });
      useAppStore.getState().toast('success', t('snapshotSaved', { n: names.length }));
      return snap;
    });
  }

  restoreSnapshot(snap: WorkspaceSnapshot): Promise<void> {
    return this.queue.enqueue('snapshot-restore', async () => {
      const project = useAppStore.getState().project;
      if (!project) return;
      const path = `${project.workdir}/${SNAPSHOT_FILE}`;
      await this.r.writeFile(path, new Uint8Array(await snap.blob.arrayBuffer()));
      const names = await this.r.loadWorkspace(path);
      await this.r.deleteFile(path);
      await this.refreshEnvironment();
      useAppStore.setState({ pendingSnapshotRestore: null });
      useAppStore.getState().toast('success', t('snapshotRestored', { n: names.length }));
    });
  }

  async deleteSnapshot(id: string): Promise<void> {
    await repo.deleteSnapshot(id);
    const project = useAppStore.getState().project;
    if (project) useAppStore.setState({ snapshots: await repo.listSnapshots(project.id) });
  }

  // ---------- console ----------

  async clearConsole(): Promise<void> {
    const project = useAppStore.getState().project;
    if (project) await repo.clearExecutions(project.id);
    useAppStore.setState({ executions: [], selectedExecutionIds: [] });
  }

  /** Persist the file snapshot of a stored file to the VFS (used after uploads from the import dialog). */
  async importStoredFile(file: StoredFile): Promise<void> {
    await this.uploadFile(file.name, new Uint8Array(await file.blob.arrayBuffer()));
  }
}

/** Give the service worker a moment to take control so the engine download is cached on first run. */
async function waitForServiceWorker(timeoutMs: number): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || navigator.serviceWorker.controller) return;
  await Promise.race([
    navigator.serviceWorker.ready.then(() => new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) return resolve();
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      setTimeout(resolve, 1500);
    })),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Fetch the lazily loaded runtime files (indexes, fonts, graphics support) in
 * the background so a later offline start does not stall on the first plot.
 * Requests go through the service worker's CacheFirst route for /webr/.
 */
async function warmRuntimeCache(baseUrl: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.onLine || !navigator.serviceWorker?.controller) return;
  try {
    const res = await fetch(`${baseUrl}warm-list.json`);
    if (!res.ok) return;
    const files = (await res.json()) as string[];
    for (const rel of files) {
      try {
        await fetch(`${baseUrl}${rel}`, { priority: 'low' } as RequestInit);
      } catch {
        return; // went offline; stop quietly
      }
    }
  } catch {
    /* ignore */
  }
}

async function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  }
  return { width: 0, height: 0 };
}

export const workspace = new Workspace();
(globalThis as { __rpad?: Workspace }).__rpad = workspace;
