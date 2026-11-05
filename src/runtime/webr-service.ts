import { WebR, ChannelType, type RObject, type Shelter } from 'webr';

/** Structural type for the result of RObject.toJs() (not exported by the webr package entry). */
export type RJs =
  | { type: 'null' }
  | { type: 'string'; value: string }
  | { type: 'list' | 'pairlist' | 'environment'; names: (string | null)[] | null; values: unknown[] }
  | { type: 'logical' | 'integer' | 'double' | 'complex' | 'character' | 'raw'; names: (string | null)[] | null; values: unknown[] };
import { R_PRELUDE } from './r-prelude';
import { formatCondition } from './output';
import type { OutputChunk, RuntimeInfo, REnvObject, DataFrameMeta, DataFramePage, DataFrameQuery, VfsFile } from '@/types';

export interface InitProgress {
  phase: 'download' | 'start' | 'prelude' | 'ready';
  loaded?: number;
  total?: number;
}

export interface RunOptions {
  /** Capture plots via the webr canvas device (requires OffscreenCanvas). */
  captureGraphics?: boolean;
  plotWidth?: number;
  plotHeight?: number;
  /** Auto-print visible values like the R console. Default true. */
  autoprint?: boolean;
}

export interface PlotPage {
  bitmap: ImageBitmap;
  /** False when the drawing extended the previous page (e.g. points() after plot()). */
  isNew: boolean;
}

export interface RunResult {
  output: OutputChunk[];
  images: PlotPage[];
  /** True if an R error condition occurred. */
  errored: boolean;
  /** Pending View() requests (e.g. "global:df" or "view:title"). */
  views: string[];
}

export type DfRef = { kind: 'global' | 'view'; name: string };

const HOME = '/home/web_user';
/** Options for internal evaluations: never start a capture graphics device. */
const QUIET = { captureGraphics: false as const };

function rString(s: string): string {
  return JSON.stringify(s);
}

/** Pull a named element from a RJs list conversion. */
function listGet(js: RJs, name: string): unknown[] {
  if (js.type !== 'list' || !js.names) return [];
  const i = js.names.indexOf(name);
  if (i === -1) return [];
  const v = js.values[i] as RJs;
  if (v && typeof v === 'object' && 'values' in v) return (v as { values: unknown[] }).values;
  return [];
}

/**
 * Thin, typed wrapper around a single persistent WebR session. It is not
 * responsible for serialisation of calls; the ExecutionQueue is.
 */
export class WebRService {
  private webR: WebR | null = null;
  private shelter: Shelter | null = null;
  private helperEnvCode = 'as.environment("rpad")';
  plotSize = { width: 672, height: 448 };
  private pageCanvas: OffscreenCanvas | null = null;
  private hadPage = false;
  info: RuntimeInfo = { webrVersion: '', rVersion: '', channel: 'unknown', crossOriginIsolated: false, canInterrupt: false };
  baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? (typeof location !== 'undefined' ? `${location.origin}/webr/` : '');
  }

  get isReady(): boolean {
    return this.webR !== null;
  }

  get raw(): WebR {
    if (!this.webR) throw new Error('R runtime is not initialised');
    return this.webR;
  }

  async init(onProgress?: (p: InitProgress) => void): Promise<RuntimeInfo> {
    if (this.webR) return this.info;
    const isolated = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : typeof SharedArrayBuffer !== 'undefined';
    if (typeof fetch !== 'undefined' && this.baseUrl.startsWith('http')) {
      await this.verifyVfsServing();
      await this.prefetchWasm(onProgress);
    }
    onProgress?.({ phase: 'start' });
    const webR = new WebR({
      baseUrl: this.baseUrl,
      homedir: HOME,
      // Interactive mode is required: a top-level error or interrupt halts a
      // non-interactive R session. captureR() switches R to non-interactive
      // for the duration of each evaluation and restores it afterwards.
      interactive: true,
      channelType: isolated ? ChannelType.SharedArrayBuffer : ChannelType.PostMessage,
    });
    await webR.init();
    this.webR = webR;
    this.shelter = await new webR.Shelter();
    onProgress?.({ phase: 'prelude' });
    await webR.evalRVoid(R_PRELUDE, { captureGraphics: false });
    await this.configureGraphics();
    await webR.flush();
    this.info = {
      webrVersion: webR.version,
      rVersion: webR.versionR,
      channel: isolated ? 'SharedArrayBuffer' : 'PostMessage',
      crossOriginIsolated: isolated,
      canInterrupt: isolated,
    };
    onProgress?.({ phase: 'ready' });
    return this.info;
  }

  /**
   * Verify that the host serves WebR's lazy filesystem archives as opaque gzip
   * files. If a server adds `Content-Encoding: gzip` the browser inflates them
   * and WebR's own inflate fails with an empty error the first time a lazily
   * loaded file (fonts, Cairo graphics, help pages) is touched.
   */
  private async verifyVfsServing(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}vfs/usr/lib/R/library/utils/misc.js.metadata`, { cache: 'no-store' });
      if (!res.ok) return; // layout differs; let WebR report its own errors
      const meta = (await res.json()) as { gzip?: boolean };
      if (!meta.gzip) return;
      const gz = await fetch(`${this.baseUrl}vfs/usr/lib/R/library/utils/misc.data.gz`);
      const bytes = new Uint8Array(await gz.arrayBuffer());
      if (bytes.length >= 2 && !(bytes[0] === 0x1f && bytes[1] === 0x8b)) {
        throw new Error('The server inflates WebR\'s .data.gz files (Content-Encoding: gzip). Serve /webr/**/*.gz as opaque files without Content-Encoding.');
      }
    } catch (e) {
      if ((e as Error).message?.startsWith('The server inflates')) throw e;
      // Network hiccups here are not fatal; WebR init will surface real problems.
    }
  }

  private async prefetchWasm(onProgress?: (p: InitProgress) => void) {
    try {
      const res = await fetch(`${this.baseUrl}R.wasm`);
      if (!res.ok || !res.body) return;
      const total = Number(res.headers.get('content-length') ?? 0);
      const reader = res.body.getReader();
      let loaded = 0;
      onProgress?.({ phase: 'download', loaded, total });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value?.byteLength ?? 0;
        onProgress?.({ phase: 'download', loaded, total });
      }
    } catch {
      // Non-fatal: WebR will fetch the binary itself.
    }
  }

  interrupt(): void {
    this.webR?.interrupt();
  }

  /** Terminate the worker. A new init() is required afterwards. */
  close(): void {
    try {
      this.webR?.close();
    } finally {
      this.webR = null;
      this.shelter = null;
    }
  }

  /**
   * Configure the default graphics device. Plots are drawn on the webr canvas
   * device; the resulting ImageBitmaps are collected from the output queue after
   * each evaluation (see run()). Note: webR 0.6.0's captureGraphics option fails
   * on the SharedArrayBuffer channel, so the standard device path is used instead.
   */
  async configureGraphics(width = 672, height = 448): Promise<void> {
    if (typeof OffscreenCanvas === 'undefined') return;
    this.plotSize = { width, height };
    this.pageCanvas = null;
    this.hadPage = false;
    await this.raw.evalRVoid(
      `local({ if (!is.null(grDevices::dev.list())) grDevices::graphics.off() }); options(device = function(...) webr::canvas(width = ${width}, height = ${height}, bg = "white", pointsize = 12))`,
      { captureGraphics: false },
    );
    await this.raw.flush();
  }

  /**
   * Drain the output queue and compose plot pages. The canvas device sends one
   * ImageBitmap per drawing step and clears its buffer on every transfer, so the
   * images are layers that must be drawn on top of each other (this mirrors the
   * webR Console example: canvasNewPage resets, canvasImage draws). The page
   * canvas is kept between runs so later additions (points(), abline()) update
   * the previous plot instead of producing a fragment.
   */
  private async collectPlots(): Promise<PlotPage[]> {
    // Canvas messages are posted by the worker while R draws; a round trip to the
    // worker guarantees that every message posted before it has been received
    // (postMessage ordering), so the flush below sees all layers.
    await this.raw.evalRVoid('invisible(NULL)', QUIET);
    const msgs = await this.raw.flush();
    const pages: PlotPage[] = [];
    let dirty = false;
    let isNew = false;
    const finishPage = async () => {
      if (this.pageCanvas && dirty) {
        pages.push({ bitmap: await createImageBitmap(this.pageCanvas), isNew });
      }
      dirty = false;
    };
    for (const m of msgs) {
      if (m.type !== 'canvas') continue;
      const data = m.data as { event: string; image?: ImageBitmap };
      if (data.event === 'canvasNewPage') {
        await finishPage();
        this.pageCanvas = null;
        isNew = true;
      } else if (data.event === 'canvasImage' && data.image) {
        const img = data.image;
        if (!this.pageCanvas) {
          this.pageCanvas = new OffscreenCanvas(img.width, img.height);
          const ctx = this.pageCanvas.getContext('2d');
          ctx?.save();
          if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, img.width, img.height);
          }
          if (!isNew) isNew = pages.length === 0 && !this.hadPage; // first ever page counts as new
        }
        this.pageCanvas.getContext('2d')?.drawImage(img, 0, 0);
        img.close?.();
        dirty = true;
        this.hadPage = true;
      }
    }
    await finishPage();
    return pages;
  }

  /** Evaluate user code with R console semantics (auto-print, conditions, plots). */
  async run(code: string, opts: RunOptions = {}): Promise<RunResult> {
    const webR = this.raw;
    const shelter = this.shelter!;
    const output: OutputChunk[] = [];
    let errored = false;
    let images: PlotPage[] = [];
    try {
      const cap = await shelter.captureR(code, {
        withAutoprint: opts.autoprint !== false,
        captureStreams: true,
        captureConditions: true,
        captureGraphics: false,
        throwJsException: false,
      });
      for (const item of cap.output) {
        if (item.type === 'stdout' || item.type === 'stderr') {
          output.push({ kind: item.type, text: String(item.data) });
        } else if (item.type === 'error' || item.type === 'warning' || item.type === 'message') {
          const cond = item.data as RObject;
          let message = '';
          let call = '';
          try {
            const parts = await webR.evalRRaw(
              'c(conditionMessage(x), paste(deparse(conditionCall(x)), collapse = " "))',
              'string[]',
              { env: { x: cond }, ...QUIET },
            );
            message = parts[0] ?? '';
            call = parts[1] ?? '';
            // Conditions raised directly at top level carry webr's own evaluation
            // frame as their call; the R console does not show those.
            if (/^(eval|withCallingHandlers|doTryCatch|tryCatch|withVisible)\(/.test(call)) call = '';
          } catch {
            try {
              message = await (await cond.get('message')).toString();
            } catch {
              message = '<condition>';
            }
          }
          if (item.type === 'error') errored = true;
          output.push({ kind: item.type, text: formatCondition(item.type, message, call) });
        }
      }
    } catch (e) {
      errored = true;
      const msg = (e as Error)?.message || String(e);
      if (/non-local transfer of control/i.test(msg)) {
        // Raised when the user interrupts a running evaluation.
        output.push({ kind: 'error', text: 'Execution interrupted' });
      } else {
        console.error('R evaluation failed', e);
        output.push({ kind: 'error', text: `Error: ${msg}` });
      }
    } finally {
      try {
        await shelter.purge();
      } catch {
        /* ignore */
      }
    }
    if (opts.captureGraphics !== false && typeof OffscreenCanvas !== 'undefined') {
      try {
        images = await this.collectPlots();
      } catch (e) {
        console.warn('plot collection failed', e);
      }
    } else {
      try {
        await webR.flush();
      } catch {
        /* ignore */
      }
    }
    let views: string[] = [];
    try {
      views = await webR.evalRRaw(`${this.helperEnvCode}$take_views()`, 'string[]', QUIET);
    } catch {
      views = [];
    }
    return { output, images, errored, views };
  }

  /** Evaluate internal R code quietly and return a JS conversion of the result. */
  async helper(name: string, args: string[] = []): Promise<RJs> {
    const webR = this.raw;
    const code = `${this.helperEnvCode}$${name}(${args.join(', ')})`;
    const obj = await webR.evalR(code, { captureStreams: false, captureConditions: false, captureGraphics: false });
    try {
      return (await obj.toJs()) as RJs;
    } finally {
      await webR.destroy(obj);
    }
  }

  async evalString(code: string): Promise<string> {
    return this.raw.evalRString(code, QUIET);
  }

  async evalStrings(code: string): Promise<string[]> {
    return this.raw.evalRRaw(code, 'string[]', QUIET);
  }

  async evalNumber(code: string): Promise<number> {
    return this.raw.evalRNumber(code, QUIET);
  }

  async evalVoid(code: string): Promise<void> {
    await this.raw.evalRVoid(code, { captureGraphics: false });
  }

  async getEnvironment(): Promise<REnvObject[]> {
    const js = await this.helper('env_summary');
    const names = listGet(js, 'name') as string[];
    const classes = listGet(js, 'class') as string[];
    const types = listGet(js, 'type') as string[];
    const dims = listGet(js, 'dims') as string[];
    const nrow = listGet(js, 'nrow') as (number | null)[];
    const ncol = listGet(js, 'ncol') as (number | null)[];
    const len = listGet(js, 'length') as (number | null)[];
    const preview = listGet(js, 'preview') as string[];
    const isDf = listGet(js, 'is_df') as boolean[];
    const isFn = listGet(js, 'is_fn') as boolean[];
    return names.map((name, i) => ({
      name,
      className: classes[i],
      typeName: types[i],
      dims: dims[i],
      nrow: nrow[i] ?? undefined,
      ncol: ncol[i] ?? undefined,
      length: len[i] ?? undefined,
      preview: preview[i],
      isDataFrame: !!isDf[i],
      isFunction: !!isFn[i],
    }));
  }

  async getDataFrameMeta(ref: DfRef): Promise<DataFrameMeta> {
    const js = await this.helper('df_meta', [rString(ref.kind), rString(ref.name)]);
    const names = listGet(js, 'names') as string[];
    const classes = listGet(js, 'classes') as string[];
    const levelsList = listGet(js, 'levels') as RJs[];
    return {
      name: ref.name,
      nrow: (listGet(js, 'nrow')[0] as number) ?? 0,
      ncol: (listGet(js, 'ncol')[0] as number) ?? 0,
      columns: names.map((name, i) => {
        const lv = levelsList[i];
        const levels = lv && 'values' in lv ? ((lv as { values: string[] }).values ?? []) : [];
        return { name, className: classes[i], levels: levels.length ? levels : undefined };
      }),
    };
  }

  async getDataFramePage(ref: DfRef, q: DataFrameQuery): Promise<DataFramePage> {
    const js = await this.helper('df_page', [
      rString(ref.kind),
      rString(ref.name),
      String(q.offset),
      String(q.limit),
      rString(q.sortColumn ?? ''),
      q.sortDesc ? 'TRUE' : 'FALSE',
      rString(q.filterText ?? ''),
    ]);
    const cellsJs = listGet(js, 'cells') as RJs[];
    const cells = cellsJs.map((c) => ((c && 'values' in c ? (c as { values: (string | null)[] }).values : []) ?? []));
    return {
      rowIndex: listGet(js, 'row_index') as number[],
      rowNames: listGet(js, 'row_names') as string[],
      cells,
      filteredRows: (listGet(js, 'filtered')[0] as number) ?? 0,
    };
  }

  async getColumnSummary(ref: DfRef, column: string): Promise<string> {
    return this.evalString(`${this.helperEnvCode}$df_column_summary(${rString(ref.kind)}, ${rString(ref.name)}, ${rString(column)})`);
  }

  async listFiles(dir?: string): Promise<VfsFile[]> {
    const js = await this.helper('list_files', dir ? [rString(dir)] : []);
    const names = listGet(js, 'name') as string[];
    const sizes = listGet(js, 'size') as number[];
    const mtimes = listGet(js, 'mtime') as number[];
    const isdir = listGet(js, 'isdir') as boolean[];
    const base = dir ?? (await this.getwd());
    return names.map((name, i) => ({ name, path: `${base}/${name}`, size: sizes[i] ?? 0, mtime: (mtimes[i] ?? 0) * 1000, isDir: !!isdir[i] }));
  }

  async getwd(): Promise<string> {
    return this.evalString('getwd()');
  }

  async setwd(dir: string): Promise<void> {
    await this.evalVoid(`dir.create(${rString(dir)}, recursive = TRUE, showWarnings = FALSE); setwd(${rString(dir)})`);
  }

  async readFile(path: string): Promise<Uint8Array> {
    return this.raw.FS.readFile(path);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await this.raw.FS.writeFile(path, data);
  }

  async deleteFile(path: string): Promise<void> {
    await this.raw.FS.unlink(path);
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const info = await this.raw.FS.analyzePath(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  /** Save the global environment with R's native serialisation. */
  async saveWorkspace(path: string): Promise<string[]> {
    return this.evalStrings(`${this.helperEnvCode}$save_workspace(${rString(path)})`);
  }

  async loadWorkspace(path: string): Promise<string[]> {
    return this.evalStrings(`load(${rString(path)}, envir = globalenv())`);
  }

  async isPackageInstalled(pkg: string): Promise<boolean> {
    return this.raw.evalRBoolean(`${this.helperEnvCode}$ensure_pkg(${rString(pkg)})`, QUIET);
  }

  /** Install a package from the WebR binary repository, streaming progress lines. */
  async installPackage(pkg: string, onLine?: (line: string) => void): Promise<{ ok: boolean; message: string }> {
    const shelter = this.shelter!;
    try {
      const cap = await shelter.captureR(`webr::install(${rString(pkg)})`, {
        withAutoprint: false,
        captureGraphics: false,
        throwJsException: false,
      });
      let errorText = '';
      for (const item of cap.output) {
        if (item.type === 'stdout' || item.type === 'stderr') {
          const line = String(item.data);
          onLine?.(line);
        } else if (item.type === 'error') {
          try {
            errorText = await (await (item.data as RObject).get('message')).toString();
          } catch {
            errorText = 'installation error';
          }
        } else if (item.type === 'message' || item.type === 'warning') {
          try {
            onLine?.(await (await (item.data as RObject).get('message')).toString());
          } catch {
            /* ignore */
          }
        }
      }
      const ok = await this.isPackageInstalled(pkg);
      return { ok, message: ok ? '' : errorText || `Package '${pkg}' is not available for WebR.` };
    } finally {
      await shelter.purge();
    }
  }

  /** How many lines starting at the given line form the first complete expression. */
  async completeExpressionLength(lines: string[]): Promise<number> {
    const vec = `c(${lines.map(rString).join(', ')})`;
    return this.evalNumber(`${this.helperEnvCode}$complete_expr(${vec})`);
  }
}
