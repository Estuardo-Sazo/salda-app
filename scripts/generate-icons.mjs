// Genera los PNG de la PWA a partir de public/icons/*.svg → `npm run icons`
import sharp from 'sharp'

const dir = new URL('../public/icons/', import.meta.url).pathname
const jobs = [
  ['icon.svg', 'pwa-64x64.png', 64],
  ['icon.svg', 'pwa-192x192.png', 192],
  ['icon.svg', 'pwa-512x512.png', 512],
  ['maskable.svg', 'maskable-512x512.png', 512],
  ['maskable.svg', 'apple-touch-icon-180x180.png', 180],
]

for (const [src, out, size] of jobs) {
  await sharp(dir + src, { density: 384 }).resize(size, size).png().toFile(dir + out)
  console.log(`✓ ${out}`)
}
