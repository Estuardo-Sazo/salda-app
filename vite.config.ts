import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** URL pública del sitio (canonical, Open Graph, sitemap). En Vercel se puede cambiar con la variable SITE_URL. */
const SITE_URL = (process.env.SITE_URL ?? 'https://salda-app.vercel.app').replace(/\/$/, '')

/** SEO: reemplaza __SITE_URL__ en index.html y genera robots.txt y sitemap.xml. */
function seo(): Plugin {
  return {
    name: 'salda-seo',
    transformIndexHtml(html, ctx) {
      html = html.replaceAll('__SITE_URL__', SITE_URL)
      // Precarga la fuente latina de Geist: sin esto el texto se pinta con otra fuente y salta al llegar Geist.
      const font = Object.keys(ctx.bundle ?? {}).find((f) => /geist-latin-wght-normal-.*\.woff2$/.test(f))
      if (!font) return html
      return html.replace(
        '</title>',
        `</title>\n    <link rel="preload" href="/${font}" as="font" type="font/woff2" crossorigin />`,
      )
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /inicio\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n  <url><loc>${SITE_URL}/terminos</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n  <url><loc>${SITE_URL}/privacidad</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n</urlset>\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Saldá · Control de deudas',
        short_name: 'Saldá',
        description: 'Registrá pagos y gastos, seguí tu plan y quedá libre de deudas.',
        id: '/',
        lang: 'es',
        dir: 'ltr',
        start_url: '/inicio',
        scope: '/',
        display: 'standalone',
        categories: ['finance', 'productivity'],
        background_color: '#12322A',
        theme_color: '#12322A',
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
        // `/` se pide a la red: es la página pública prerenderizada.
        navigateFallbackDenylist: [/^\/auth/, /^\/$/, /^\/(terminos|privacidad)\/?$/, /^\/(robots\.txt|sitemap\.xml)$/],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
