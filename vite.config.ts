import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/cet4-web/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '拾词 · CET-4 Vocabulary',
        short_name: '拾词',
        lang: 'zh-CN',
        description: '把每一个模糊的词，变成清晰的记忆。本地优先的四级词汇学习工具。',
        theme_color: '#254f40',
        background_color: '#f6f7f2',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [192, 512].map((size) => ({
          src: `icons/icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'any',
        })),
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,zip,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
