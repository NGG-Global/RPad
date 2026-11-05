# Architecture notes and decisions

## Runtime

- **WebR 0.6.0 pinned, self-hosted.** `scripts/copy-webr.mjs` copies `node_modules/webr/dist` into
  `public/webr` so the exact tested engine ships with the app and can be cached by the service
  worker. `WebR` is constructed with `baseUrl = <origin>/webr/`.
- **Channel selection.** `crossOriginIsolated === true` → `SharedArrayBuffer` channel (interrupt
  supported). Otherwise `PostMessage` (interrupt unsupported, `browser()`/nested REPLs unsupported).
  The channel is shown in Settings → About and `RuntimeInfo.canInterrupt` drives the Stop button hint.
- **Execution.** `Shelter.captureR(code, { withAutoprint: true, captureStreams, captureConditions,
  captureGraphics: false, throwJsException: false })`. Streams arrive as strings; conditions as R
  objects which are converted with `conditionMessage()` / `deparse(conditionCall())` in R and then
  formatted like the R console. The shelter is purged after every call (no leaked R objects).
- **Graphics.** `options(device = function() webr::canvas(width, height))` is set once. After each
  run a trivial round trip to the worker guarantees message ordering, then `webR.flush()` yields
  `canvasNewPage` / `canvasImage` messages. Each `canvasImage` is a layer (the device clears its
  OffscreenCanvas on `transferToImageBitmap`), so layers are composed on a per-page OffscreenCanvas,
  then encoded to PNG blobs stored in IndexedDB. Drawing added to the previous page (e.g.
  `abline()` after `plot()`) updates the last plot instead of creating a fragment.
  `captureGraphics` of `captureR` was not used because it fails with an empty error in webR 0.6.0 on
  the SharedArrayBuffer channel (reproduced in Chromium 1.63 Playwright build).
- **Interactive session.** `interactive: true` is mandatory. With `interactive: false` an interrupt
  (or any condition that unwinds to top level) makes R halt, after which every request hangs.
- **Lazy filesystem serving.** The `.data.gz` chunks are inflated by WebR; a server that adds
  `Content-Encoding: gzip` breaks the first lazy load (fonts, Cairo) with an empty error. Vite's
  dev/preview servers are patched; a startup self-check reports misconfigured hosts.
- **Queue.** `ExecutionQueue` serialises every R interaction; UI never calls WebR directly.
- **Packages.** `detectPackages()` scans code for `library()`, `require()`, `pkg::`. Missing ones are
  installed first via `webr::install()` inside a `captureR` so download messages become progress text.
  `webr::shim_install()` is enabled so `install.packages()` in user code also works.
- **View() bridge.** The prelude attaches an environment named `rpad` to the search path containing a
  `View`/`view` function that records the request; the workspace reads pending views after each run.
  Objects passed by name open the live global object; expressions are stored as read-only views.
- **Files.** Each project has a working directory `/home/web_user/projects/<slug>`. After every run
  the directory is listed from R and changed files are persisted to IndexedDB (and restored on next
  open), so `write.csv()` / `read.csv()` round-trip across reloads. Image files are added to the
  gallery.
- **Snapshots.** `save(list = ls(globalenv()), file)` → bytes read from the VFS → IndexedDB blob.
  Restore writes the file back and `load()`s it into the global environment. Scripts are never
  re-executed automatically.

## UI

- React + zustand store; panels subscribe to slices only. Executions are memoised components;
  outputs above 40 lines are collapsed; stored output is capped at 200k characters per execution.
- Landscape (≥ 900 px wide and wider than tall): editor/console vertical split inside a horizontal
  split with the side panel (Environment / Files / Plots); dividers are pointer-draggable. Optional
  course reference column. Data viewer overlays the main area.
- Portrait: bottom tabs Editor / Console / Data / Plots; the data viewer replaces the Data tab.
- `interactive-widget=resizes-content` in the viewport meta plus `visualViewport` resize handling keep
  the editor cursor visible when the Android keyboard opens.
- Hebrew is the default; `dir="rtl"` on `<html>`; every code/console surface uses `.ltr-code`.
