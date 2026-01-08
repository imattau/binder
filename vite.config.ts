import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
        sveltekit(),
       SvelteKitPWA({
           registerType: 'autoUpdate',
           workbox: {
                maximumFileSizeToCacheInBytes: 5242880, // 5 MiB
                globDirectory: 'build',
                globPatterns: [
                    'client/**/*.{js,css,ico,png,svg,webp,webmanifest}',
                    'prerendered/**/*.{html,json}'
                ],
                globIgnores: [
                    'server/**',
                    'server/sw.js',
                    'server/workbox-*.js'
                ]
            },
            manifest: {
                name: 'Binder',
                short_name: 'Binder',
                start_url: '/',
                display: 'standalone',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                icons: [
                    {
                        src: 'icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    }
                ]
            }
        })
    ]
});
