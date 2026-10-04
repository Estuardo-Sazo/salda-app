// Prerenderiza la página pública (`/`) a HTML estático dentro de dist/index.html → corre en `npm run build`.
// Así Google y las vistas previas de enlaces ven el contenido sin ejecutar JavaScript.
import { readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const SITE_URL = (process.env.SITE_URL ?? 'https://salda-app.vercel.app').replace(/\/$/, '')
const file = new URL('../dist/index.html', import.meta.url)

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const { LandingPage } = await vite.ssrLoadModule('/src/features/landing/landing-page.tsx')
  const { FAQ } = await vite.ssrLoadModule('/src/features/landing/content.ts')

  const body = renderToStaticMarkup(createElement(LandingPage))
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Saldá',
      url: `${SITE_URL}/`,
      description:
        'Control de deudas en quetzales: pagos, intereses, intracuotas y un plan con fecha para quedar libre de deudas.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, Android, iOS',
      inLanguage: 'es-GT',
      image: `${SITE_URL}/og-image.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((q) => ({
        '@type': 'Question',
        name: q.pregunta,
        acceptedAnswer: { '@type': 'Answer', text: q.respuesta },
      })),
    },
  ]
  // `<` escapado para que el JSON nunca cierre la etiqueta <script>.
  const ld = `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`

  let html = await readFile(file, 'utf8')
  if (!html.includes('<!--landing-->')) throw new Error('dist/index.html no tiene el marcador <!--landing-->')

  // La página pública funciona solo con HTML: en `/` no se descarga la app (salvo al volver de un enlace
  // mágico con #access_token). En el resto de rutas se carga igual que antes, con sus modulepreload.
  const entry = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)
  if (!entry) throw new Error('No se encontró el script principal en dist/index.html')
  const preloads = [...html.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">\n?\s*/g)]
  for (const p of preloads) html = html.replace(p[0], '')
  const loader = `<script type="module">
      if (location.pathname !== '/' || location.hash) {
        for (const href of ${JSON.stringify(preloads.map((p) => p[1]))}) {
          const l = document.createElement('link')
          l.rel = 'modulepreload'
          l.crossOrigin = ''
          l.href = href
          document.head.appendChild(l)
        }
        import('${entry[1]}')
      }
    </script>`
  html = html.replace(entry[0], loader)
  html = html
    .replace('<!--landing-->', `<div class="landing-static">${body}</div>`)
    .replace('</head>', `    ${ld}\n  </head>`)
  await writeFile(file, html)
  console.log(`✓ página pública prerenderizada (${(body.length / 1024).toFixed(1)} kB) · ${SITE_URL}`)
} finally {
  await vite.close()
}
