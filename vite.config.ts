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
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: { target: 'es2020', cssTarget: ['chrome105', 'edge105', 'firefox110', 'safari16'], chunkSizeWarningLimit: 900 },
  server: { host: true },
  preview: { host: true },
});
