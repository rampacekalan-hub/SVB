import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DomovPlus — správa bytového domu',
        short_name: 'DomovPlus',
        description:
          'Hlasovania, faktúry, poruchy a schôdze bytového domu na jednom mieste. Bezpečné, self-hosted.',
        lang: 'sk',
        theme_color: '#0f766e',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // /api volania NIKDY necacheuj — vždy chceme čerstvé dáta (auth, hlasy)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'style' || request.destination === 'script',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'assets' },
          },
        ],
      },
      devOptions: {
        // Dev SW spôsoboval stale cache pri rýchlom HMR — vypnuté.
        // V produkcii je PWA + SW plne aktívne (generateSW).
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    // Port 5174 (nie default 5173) — nový origin, browseri tam nemajú
    // zapamätané žiadne legacy service workery z predchádzajúcich dev sessions.
    port: 5174,
    strictPort: true,
    // Dev server posiela no-cache hlavičky, aby si Safari/Chrome
    // nezačali znova cachovať HTML pri rýchlych HMR zmenách.
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
});
