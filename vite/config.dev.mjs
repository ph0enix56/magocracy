import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 8080,
        host: true
    },
    plugins: [svelte()]
});
