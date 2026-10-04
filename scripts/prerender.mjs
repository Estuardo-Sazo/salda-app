// Prerenderiza las páginas públicas (/, /terminos, /privacidad) a HTML estático → corre en `npm run build`.
// Google y las vistas previas de enlaces ven el contenido sin ejecutar JavaScript, y en esas páginas
// tampoco se descarga la app (salvo al volver de un enlace mágico con #access_token).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const SITE_URL = (process.env.SITE_URL ?? 'https://salda-app.vercel.app').replace(/\/$/, '')
const dist = new URL('../dist/', import.meta.url)

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

try {
  const { LandingPage } = await vite.ssrLoadModule('/src/features/landing/landing-page.tsx')
  const { FAQ } = await vite.ssrLoadModule('/src/features/landing/content.ts')
  const { TermsPage, PrivacyPage } = await vite.ssrLoadModule('/src/features/legal/legal-pages.tsx')

  let template = await readFile(new URL('index.html', dist), 'utf8')
  if (!template.includes('<!--landing-->')) throw new Error('dist/index.html no tiene el marcador <!--landing-->')

  // En las páginas públicas no se carga la app; en el resto, igual que antes, con sus modulepreload.
  const entry = template.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)
  if (!entry) throw new Error('No se encontró el script principal en dist/index.html')
  const preloads = [...template.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">\n?\s*/g)]
  for (const p of preloads) template = template.replace(p[0], '')
  const loader = `<script type="module">
      const path = location.pathname.replace(/\\/$/, '') || '/'
      const pagina = document.querySelector('meta[name="salda-page"]')?.content
      if (path !== pagina || location.hash) {
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
  template = template.replace(entry[0], loader)

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Saldá',
      url: `${SITE_URL}/`,
      description:
        'Control de deudas personales: pagos, intereses, compras en cuotas y un plan con fecha para quedar libre de deudas.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, Android, iOS',
      inLanguage: 'es',
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

  const pages = [
    { path: '/', out: 'index.html', component: LandingPage, jsonLd },
    {
      path: '/terminos',
      out: 'terminos/index.html',
      component: TermsPage,
      title: 'Términos de uso · Saldá',
      description:
        'Condiciones de uso de Saldá: qué es el servicio, tu cuenta, tus datos y el alcance de sus cálculos.',
    },
    {
      path: '/privacidad',
      out: 'privacidad/index.html',
      component: PrivacyPage,
      title: 'Política de privacidad · Saldá',
      description: 'Qué datos guarda Saldá, para qué, dónde se alojan y cómo exportarlos o borrarlos.',
    },
  ]

  for (const page of pages) {
    const body = renderToStaticMarkup(createElement(page.component))
    const url = `${SITE_URL}${page.path === '/' ? '/' : page.path}`
    let html = template
      .replace('<!--landing-->', `<div class="public-static">${body}</div>`)
      .replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta name="salda-page" content="${page.path}" />`,
      )
    html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
    if (page.title) {
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`)
        .replace(
          /<meta property="og:title" content="[^"]*" \/>/,
          `<meta property="og:title" content="${escapeAttr(page.title)}" />`,
        )
        .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeAttr(page.description)}$2`)
        .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${escapeAttr(page.description)}$2`)
    }
    if (page.jsonLd) {
      // `<` escapado para que el JSON nunca cierre la etiqueta <script>.
      const ld = `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`
      html = html.replace('</head>', `    ${ld}\n  </head>`)
    }
    const out = new URL(page.out, dist)
    await mkdir(new URL('.', out), { recursive: true })
    await writeFile(out, html)
    console.log(`✓ ${page.path} prerenderizada (${(body.length / 1024).toFixed(1)} kB)`)
  }
  console.log(`  URL pública: ${SITE_URL}`)
} finally {
  await vite.close()
}
