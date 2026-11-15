import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the same build works at a GitHub Pages sub-path
// (account.github.io/chestnut/) and at a custom domain root.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'og.png'],
      manifest: {
        name: 'Chestnut',
        short_name: 'Chestnut',
        description: "A verse for what's on your mind.",
        theme_color: '#1b120d',
        background_color: '#1b120d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,webp,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // The page itself is fetched fresh whenever there is a connection, and the saved copy is used only
        // offline. Serving the saved copy first meant Safari could show an old page for a moment after an
        // update, and adding the app to the Home Screen then took that old page's settings with it.
        navigateFallback: null,
        // so "/chestnut/" is not answered from the saved copy before the network is tried
        directoryIndex: 'no-directory-index',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'chestnut-pages',
              networkTimeoutSeconds: 4,
              // offline and never opened online since installing: the copy saved with the app
              precacheFallback: { fallbackURL: 'index.html' },
            },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2020', cssTarget: ['chrome105', 'edge105', 'firefox110', 'safari16'], chunkSizeWarningLimit: 900 },
  server: { host: true },
  preview: { host: true },
});
