import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsRoot = path.resolve(__dirname, "../backend/api/assets");

const TARGETS = [
  { dir: path.join(assetsRoot, "icons"), size: 96, density: 144 },
  { dir: path.join(assetsRoot, "images"), size: 256, density: 200 },
];

async function convertSvgToPng(svgPath, size, density) {
  const pngPath = svgPath.replace(/\.svg$/i, ".png");
  const buffer = await sharp(svgPath, { density })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(pngPath, buffer);
}

async function walk(dir, size, density, labelRoot) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      await walk(full, size, density, labelRoot);
      continue;
    }
    if (!name.name.toLowerCase().endsWith(".svg")) continue;
    await convertSvgToPng(full, size, density);
    console.log("PNG:", path.relative(labelRoot, full).replace(/\.svg$/i, ".png"));
  }
}

for (const target of TARGETS) {
  if (!fs.existsSync(target.dir)) continue;
  console.log(`→ ${path.relative(assetsRoot, target.dir)} (${target.size}px)`);
  await walk(target.dir, target.size, target.density, target.dir);
}

console.log("Terminé.");
