import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Simple SVG icon: gradient bg + 💪 emoji centered
function svg(size, padding = 0) {
  const inner = size - padding * 2
  const fontSize = inner * 0.55
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)" />
  <text x="50%" y="55%" font-size="${fontSize}" dominant-baseline="middle" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">💪</text>
</svg>`
}

// Maskable icon: same but with safe zone (no rounded corners, content within inner 80%)
function svgMaskable(size) {
  const fontSize = size * 0.4
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)" />
  <text x="50%" y="55%" font-size="${fontSize}" dominant-baseline="middle" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">💪</text>
</svg>`
}

async function generate() {
  await sharp(Buffer.from(svg(192))).png().toFile(join(publicDir, 'icon-192.png'))
  await sharp(Buffer.from(svg(512))).png().toFile(join(publicDir, 'icon-512.png'))
  await sharp(Buffer.from(svgMaskable(512))).png().toFile(join(publicDir, 'icon-maskable.png'))
  // Apple touch icon (iOS uses this for home screen)
  await sharp(Buffer.from(svg(180))).png().toFile(join(publicDir, 'apple-touch-icon.png'))
  console.log('Icons generated:', ['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png'])
}

generate().catch(e => { console.error(e); process.exit(1) })
