# RPad — project conventions

RPad is a tablet-first R workspace for the Tel Aviv University introductory R course (psychology).
Real R runs in the browser through WebR (WebAssembly). Nothing is simulated.

## Commands

```bash
npm install            # also copies the pinned WebR distribution into public/webr
npm run dev            # Vite dev server with COOP/COEP headers (http://localhost:5173)
npm run build          # typecheck + production build into dist/
npm run preview        # serve dist/ with production headers (http://localhost:4173)
npm run test:unit      # vitest, pure TypeScript units (jsdom)
npm run test:r         # vitest, Node integration tests against the real WebR engine
npm run test:e2e       # Playwright, full browser chain against `vite preview` (runs the build first)
```

`npm run test:e2e` expects `dist/` to be current: run `npm run build` first.

## Architecture (src/)

- `runtime/webr-service.ts` — the only module that talks to WebR. One persistent session;
  `run()` uses `Shelter.captureR()` with `withAutoprint` for console semantics and converts
  R conditions to console-style text. Internal helper calls go through `helper()` → `toJs()`.
- `runtime/r-prelude.ts` — R code evaluated once at start. Helpers live in an environment attached
  as `"rpad"` (never in the global environment): environment summary, data-frame paging/sorting/
  filtering, file listing, `View()` bridge, complete-expression detection via `parse()`.
- `runtime/execution-queue.ts` — strict FIFO. Every R call (user code, env refresh, df paging,
  file sync, snapshots) is enqueued so requests never overlap.
- `runtime/workspace.ts` — orchestration: projects, scripts (debounced autosave), executions,
  package pre-install with progress, plots, working-directory sync, snapshots. Components call this.
- `persistence/db.ts` — IndexedDB (idb) stores: projects, scripts, files, plots, snapshots,
  executions, settings. Limits are in `LIMITS`.
- `store/app-store.ts` — zustand UI/session state. `i18n/` — Hebrew default, English.
- `components/` — React UI. `editor/setup.ts` — CodeMirror 6 with the legacy R stream mode.
- `gemini/format.ts` — clipboard text formats. Output is always copied verbatim.
- `course/reference.ts` — function reference with confirmed course unit mappings only.

## Critical constraints

- WebR is pinned (`webr@0.6.0`, R 4.6.0) and self-hosted from `public/webr` (copied by
  `scripts/copy-webr.mjs`). Do not switch to the CDN `latest` build. Binary packages come from
  `https://repo.r-wasm.org` (contrib/4.6). Packages built for other R minor versions are incompatible.
- The page must be cross-origin isolated (COOP `same-origin`, COEP `require-corp`) for the
  SharedArrayBuffer channel; that is what makes `interrupt()` work. `public/_headers` (Cloudflare
  Pages) and the Vite server/preview config set these. Without them WebR falls back to PostMessage
  (no interrupt) — the app still works and reports the channel in Settings.
- Plots: `captureGraphics` of `captureR()` fails in webR 0.6.0 on the SharedArrayBuffer channel
  (empty error). RPad therefore sets `options(device = webr::canvas(...))` and composes the
  `canvas` messages from `webR.flush()` after each run. Images are incremental layers (the device
  clears its buffer on every transfer) and must be drawn on top of each other per page — see
  `collectPlots()`. Always pass `captureGraphics: false` to internal `evalR*` calls.
- WebR must run with `interactive: true`: a top-level error or interrupt halts a non-interactive
  R session (the worker then hangs). `captureR()` makes evaluations non-interactive itself.
- `*.data.gz` virtual-filesystem chunks must be served without `Content-Encoding` (WebR inflates
  them). `vite.config.ts` strips the header in dev/preview; `verifyVfsServing()` checks at startup.
- Never replace unavailable R functions with JavaScript. If something is unsupported, say so.
- Never re-execute scripts to rebuild the environment after reload; restore explicit snapshots
  (`save()`/`load()` through the virtual filesystem) instead.
- All displayed data comes from R (`df_page` helper); the viewer never holds a full copy of large
  data frames. Pages of 200 rows are fetched on demand.
- Code and console text are LTR inside the RTL Hebrew UI (`.ltr-code`).
- No accounts, analytics, tracking, or external data collection.

## Testing policy

Prefer tests against the real engine (`tests/integration`, `tests/e2e`) over mocks. Course fixtures in
`tests/fixtures/week{1,2,3}.R` mirror the published assignments and are shared by both suites.
