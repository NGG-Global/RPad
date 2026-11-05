import { defineConfig, type Plugin, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// COOP/COEP make the page cross-origin isolated so that WebR can use the
// SharedArrayBuffer channel (which supports interrupting R code).
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/**
 * WebR's lazy virtual filesystem ships as `*.data.gz` files that WebR inflates
 * itself. Static servers must deliver them as opaque gzip files, NOT with
 * `Content-Encoding: gzip` (the browser would inflate them first and WebR's
 * inflate then fails). Vite's static server (sirv) adds that header for `.gz`
 * files, so strip it for the self-hosted WebR tree in dev and preview.
 */
function webrGzipPassthrough(): Plugin {
  const patch = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/webr/') && req.url.includes('.gz')) {
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name: string, value: number | string | readonly string[]) => {
          if (name.toLowerCase() === 'content-encoding') return res;
          return setHeader(name, value);
        };
        res.setHeader('Content-Type', 'application/gzip');
      }
      next();
    });
  };
  return { name: 'rpad-webr-gzip-passthrough', configureServer: patch, configurePreviewServer: patch };
}

export default defineConfig({
  plugins: [
    webrGzipPassthrough(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // The WebR distribution is large (~47 MB). It is not precached; the custom
      // service worker (src/sw.ts) caches it at runtime on first use.
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'RPad — R Workspace',
        short_name: 'RPad',
        description: 'Tablet-first R programming workspace powered by WebR',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f7f8',
        theme_color: '#1f4e79',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['webr/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { headers: isolationHeaders, port: 5173 },
  preview: { headers: isolationHeaders, port: 4173 },
  optimizeDeps: { exclude: ['webr'] },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: ['codemirror', '@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/commands', '@codemirror/search', '@codemirror/autocomplete', '@codemirror/legacy-modes/mode/r'],
        },
      },
    },
  },
});
