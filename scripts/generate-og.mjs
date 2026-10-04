// Imagen para compartir el enlace (Open Graph, 1200×630) → `npm run og`
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#12322A"/>
  <g transform="translate(96 150) scale(0.62)">
    <circle cx="228" cy="228" r="120" fill="none" stroke="#E8B53A" stroke-width="48"/>
    <path d="M270 272C363 280 424 371 440 440Z" fill="#3DBE7A"/>
    <path d="M270 272C293 351 379 416 440 440Z" fill="#23946A"/>
    <path d="M404 334L380 356M434 386L414 402M340 396L358 380" stroke="#12322A" stroke-width="7" stroke-linecap="round"/>
    <circle cx="270" cy="272" r="20" fill="#C4452D"/>
  </g>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#F2EDE3">
    <text x="440" y="250" font-size="96" font-weight="700" letter-spacing="-3">Saldá</text>
    <text x="440" y="330" font-size="46" font-weight="500" letter-spacing="-1">Controlá tus deudas en quetzales</text>
    <text x="440" y="392" font-size="46" font-weight="500" letter-spacing="-1" fill-opacity="0.72">mes a mes, hasta llegar a Q0.</text>
  </g>
  <path d="M440 432H700M440 450H700" stroke="#E8B53A" stroke-width="7" stroke-linecap="round"/>
</svg>`

await sharp(Buffer.from(svg))
  .png()
  .toFile(new URL('../public/og-image.png', import.meta.url).pathname)
console.log('✓ og-image.png')
