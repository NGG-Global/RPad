# RPad — a tablet-first R workspace

RPad is a browser-based R programming environment built for an Android tablet. It runs **real R**
(R 4.6.0 through [WebR](https://docs.r-wasm.org/webr/latest/) / WebAssembly) entirely on the device,
needs no server, account or subscription, and is designed around the Tel Aviv University introductory
R course for psychology students and its Gemini-tutor workflow.

- Script editor (CodeMirror 6, R highlighting, multiple tabs, search, undo) with *run line/expression*,
  *run selection*, *run all*, keyboard shortcuts and a touch symbol bar (`<-`, `|>`, `$`, `[`, …).
- A console that behaves like R: auto-print, warnings and errors formatted as R prints them,
  command history, collapsible long output, per-execution copy actions.
- Environment panel (objects, class, dimensions, preview) and a spreadsheet-like data viewer with
  virtualised rows, sorting and filtering done **inside R**, factor labels, distinct `NA`, row copy
  and CSV export. `View(df)` in code opens the viewer.
- Plot gallery for base graphics and ggplot2 (history, full screen with pinch zoom, PNG download,
  copy image), plus files produced by `ggsave()` / `png()`.
- Working directory per project in the WebR virtual file system: `write.csv()`, `read.csv()`,
  `save()`, `load()`, `dir()` work as in R; files are persisted and downloadable; CSV import from the
  Android file picker with separator/encoding detection (UTF-8 and Windows-1255 Hebrew).
- `dplyr` and `ggplot2` (and other WebAssembly builds on repo.r-wasm.org) install automatically the
  first time a script references them, with visible progress.
- **Copy for Gemini**: copy code, output, code + output, or a formatted context message with the
  real output, warnings, errors and relevant objects; copy a selected range or the whole transcript
  (size-limited); export transcript; *Open Gemini* shortcut.
- Projects with multiple scripts, autosave, export/import, and explicit **environment snapshots**
  (`save.image`-style) restored on request after reload.
- Hebrew UI by default (English available); R code and output stay left-to-right. Light and dark.
- Installable PWA. Landscape: resizable editor / console / side panels. Portrait: bottom tabs.

## Requirements

- Node.js 20+ for development.
- A modern browser with `OffscreenCanvas` and WebAssembly (Android Chrome, desktop Chrome/Edge,
  Firefox 105+). Safari has not been tested.

## Development

```bash
npm install          # installs dependencies and copies the pinned WebR build into public/webr
npm run dev          # http://localhost:5173 (headers for cross-origin isolation are set by Vite)
npm run build        # type-check and build to dist/
npm run preview      # serve dist/ with production headers at http://localhost:4173
```

### Tests

```bash
npm run test:unit    # pure TypeScript units (clipboard formats, CSV helpers, queue, course content)
npm run test:r       # Node integration tests that start the real WebR engine (needs network for
                     # the dplyr/ggplot2 install test; ~30 s)
npm run build && npm run test:e2e   # Playwright: full chain in Chromium, landscape and portrait,
                     # using the real course assignments (tests/fixtures/week{1,2,3}.R)
```

The end-to-end suite verifies: editor → WebR → environment → console → data viewer → plots →
export → Gemini clipboard, plus persistence across reload, snapshot restore, CSV import with Hebrew,
interrupt, and the `View()` bridge.

## Deployment (static hosting over HTTPS)

Set `BASE_PATH=/sub/path/` at build time when the site is not served from the domain root (the Pages
workflow does this). The build in `dist/` is a static site (about 48 MB, most of it the R WebAssembly runtime and its
lazily loaded library files). WebR needs the page to be **cross-origin isolated** to use the
`SharedArrayBuffer` channel, which is what allows stopping running R code:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers RPad still runs (WebR falls back to the PostMessage channel) but *Stop* cannot
interrupt R; the active channel is shown in Settings → About.

### Cloudflare Pages (free)

1. Push the repository to GitHub.
2. In Cloudflare Pages, create a project from the repository with:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION = 20`
3. `public/_headers` is copied into `dist/` and sets COOP/COEP, long-lived caching for `/webr/*`
   and `no-cache` for the service worker. Nothing else is required.
4. Open the deployed URL on the tablet in Chrome, wait for the R engine (≈20 MB download, then
   cached), and use *Install app* (or the in-app install banner) to add RPad to the home screen.

### GitHub Pages (free, no computer needed)

`.github/workflows/pages.yml` builds the site on every push to `main` and publishes it to
`https://<owner>.github.io/<repository>/`. The first run enables Pages automatically; if it fails,
open the repository Settings → Pages and set *Source* to *GitHub Actions*, then re-run the workflow.

GitHub Pages cannot send custom headers. RPad's service worker therefore adds the COOP/COEP headers
itself to every response it serves, and the app reloads once on the first visit so the page becomes
cross-origin isolated (same technique as the widely used `coi-serviceworker`). After that first
reload the SharedArrayBuffer channel and the Stop button work exactly as on Cloudflare or Netlify.
Verified locally with Playwright against a static server that sends no headers.

Any other static host works too if it can send the two headers (Netlify reads the same `_headers`
file; drag-and-drop the `dist` folder onto Netlify Drop for a one-off deployment).

### Offline behaviour

The service worker precaches the app shell and caches the WebR runtime files and downloaded R
packages on first use (`CacheFirst`). After the engine has started once online, RPad also warms the
lazily loaded runtime files it needs for graphics (fonts, Cairo, filesystem indexes) in the
background. Verified behaviour: after one online session that used dplyr and the png device, the app
starts and runs R, dplyr and plotting with the network switched off. Packages you have never
installed and R help pages still need network.

## Data and privacy

Everything stays in the browser: scripts, files, plots and snapshots are stored in IndexedDB on the
device. There is no backend, no analytics and no telemetry. Browsers may evict site data under
storage pressure, so export important projects (Projects → Export) or download your CSV/R files.

## Troubleshooting

**The R engine does not start / stuck at "Loading the R engine"**
- First start downloads `R.wasm` (18 MB) and other files from the same origin. Check the network and
  that `/webr/R.wasm` is served with `Content-Type: application/wasm`.
- Open Settings → About: if the channel is `PostMessage` the server is not sending COOP/COEP headers.
- Very old browsers lack `OffscreenCanvas`; plots then fail. Update Chrome.
- If the tab reloads or the engine dies mid-run, the browser likely ran out of memory. Keep datasets
  modest, avoid huge console output, and use *Restart R* in Settings. Scripts are never lost; the R
  objects are, unless a snapshot was saved.

**A package fails to install**
- Only packages compiled for WebR (listed on <https://repo.r-wasm.org>) can be installed.
  `dplyr`, `ggplot2`, `tidyr`, `readr`, `stringr`, `forcats`, `purrr`, `tibble` are available.
  Packages requiring system libraries or network at runtime are not.
- The error message from R is shown unchanged in the console. Retry once if the download was
  interrupted; the service worker caches successful downloads.
- `library(tidyverse)` is heavy; load the individual packages instead.

**`could not find function "summarise"` (or `filter`, `ggplot`, ...) although the package is installed**
- Installing a package and loading it are different steps in R. Run `library(dplyr)` (or
  `library(ggplot2)`) before using its functions, in every session: after a reload or *Restart R* the
  packages must be loaded again, even when a snapshot restored your objects. RPad shows a hint with a
  one-tap `library(...)` button under such errors, and *Settings → Install package* runs
  `library(...)` for you.

**Plots do not appear**
- Base graphics and printed ggplot objects are drawn on the canvas device and shown in Plots.
  A ggplot object assigned to a variable (`p <- ggplot(...)`) is only drawn when printed (`p`).
- `ggsave("file.png")` writes to the project folder; the file appears under Files and in the gallery.

**View(df) / data viewer**
- `View()` is bridged to the RPad viewer. Expressions such as `View(head(df))` open a read-only
  snapshot named after the expression. Editing cells is not supported; edit through R code.

**Stop does nothing**
- Interrupting requires the SharedArrayBuffer channel (cross-origin isolated page). On the
  PostMessage fallback a long computation cannot be interrupted; use *Restart R*.
- Interrupted code prints `Execution interrupted`; the session and all objects are kept.

**"The server inflates WebR's .data.gz files"**
- WebR's lazily loaded library files are shipped as `*.data.gz` and inflated by WebR itself. The
  host must serve them as opaque files (`Content-Type: application/gzip`, no `Content-Encoding`).
  Some static servers add `Content-Encoding: gzip` to any `.gz` file, which makes the first use of
  fonts or the Cairo graphics device fail. RPad checks this at startup and shows this message.
  The Vite dev/preview servers are patched in `vite.config.ts`; Cloudflare Pages serves `.gz`
  files unchanged.

**Known limitations**
- Console output is shown when an execution finishes, not streamed while it runs.
- `install.packages()` works through WebR's shim but only for WebAssembly builds.
- Direct cell editing in the data viewer is intentionally not implemented, so every state of the
  workspace remains reproducible from code.
