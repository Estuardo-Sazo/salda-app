import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Saldá · Control de deudas',
        short_name: 'Saldá',
        description: 'Registrá pagos y gastos, seguí tu plan y quedá libre de deudas.',
        id: '/',
        lang: 'es-GT',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        categories: ['finance', 'productivity'],
        background_color: '#0b1a1d',
        theme_color: '#0f2d32',
        icons: [
          { src: '/icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Mantener presionado el ícono de la app: accesos directos a lo más usado.
        shortcuts: [
          {
            name: 'Registrar pago',
            short_name: 'Pago',
            url: '/registrar/pago',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Registrar gasto',
            short_name: 'Gasto',
            url: '/registrar/gasto',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/auth/],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
