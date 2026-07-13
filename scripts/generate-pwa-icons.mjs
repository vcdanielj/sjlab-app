// One-off script: genera icon-192.png y icon-512.png a partir de public/icon.svg
// Ejecutar con: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'));

const sizes = [
  { size: 192, out: 'icon-192.png' },
  { size: 512, out: 'icon-512.png' },
];

for (const { size, out } of sizes) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, out));
  console.log(`Generado ${out} (${size}x${size})`);
}
