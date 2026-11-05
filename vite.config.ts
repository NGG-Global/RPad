import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// COOP/COEP make the page cross-origin isolated so that WebR can use the
// SharedArrayBuffer channel (which supports interrupting R code).
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // The WebR distribution is large (~47 MB). It is not precached; it is cached
      // at runtime on first use so later launches work without network.
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['webr/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/webr\//],
        runtimeCaching: [
          {
            // Self-hosted WebR binaries and lazy virtual filesystem chunks.
            urlPattern: ({ url }) => url.pathname.startsWith('/webr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'rpad-webr-runtime',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Binary R packages downloaded from the WebR package repository.
            urlPattern: ({ url }) => url.hostname === 'repo.r-wasm.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'rpad-r-packages',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
