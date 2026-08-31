// astro.config.mjs
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  site: 'https://Nigh.github.io',
  base: '/calcuko',
  integrations: [
    svelte(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Calcuko - 多行变量公式计算器',
        short_name: 'Calcuko',
        description: '支持多行变量定义与实时联动计算的 PWA 计算器',
        theme_color: '#120f14',
        background_color: '#120f14',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        navigateFallback: '/calcuko/index.html',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}'],
      },
      devOptions: {
        enabled: true,
        navigateFallbackAllowlist: [/^\/calcuko\/$/],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
