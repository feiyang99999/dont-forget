/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const base = process.env.BASE_PATH || (command === 'build' ? './' : '/');
  return {
    base,
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/*.png', 'sample-policy.png'],
        manifest: {
          id: './',
          name: '别忘了',
          short_name: '别忘了',
          description: '证件、还款和家里琐事的提醒。数据只留在这台设备上。',
          lang: 'zh-CN',
          dir: 'ltr',
          display: 'standalone',
          start_url: './',
          scope: './',
          background_color: '#efe7d6',
          theme_color: '#1e3f3a',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,ico,woff2}'],
          globIgnores: ['**/ocr/**'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'ocr-assets',
                expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
