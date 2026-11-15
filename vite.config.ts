import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'SafiGroom OS',
                short_name: 'SafiGroom',
                description: 'SafiGroom salon operations and management',
                theme_color: '#111827',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: './',
                scope: './',
                icons: [
                    { src: './app-icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: './favicon.png', sizes: '512x512', type: 'image/png' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{css,html,ico,png,svg,webp,woff2,js}'],
                navigateFallbackDenylist: [/^\/api\//],
            },
        }),
    ],
    base: './',
    server: {
        proxy: {
            '/api': 'http://localhost:8787',
        },
    },
    build: {
        rollupOptions: {
            maxParallelFileOps: 128,
        },
    },
});
