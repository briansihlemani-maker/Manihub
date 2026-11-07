import sharp from "sharp";
import { readFile } from "node:fs/promises";

// Use the exact original logo uploaded by the ManiHub owner.
// Do not redraw, recolour, or substitute this artwork.
const source = await readFile("assets/file_000000004420824681cbd3dc77302cd3.png");

// Keep the full original square artwork visible in the launcher icon.
await sharp(source)
  .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("assets/icon-only.png");

// Use the same approved artwork for the native splash screen.
await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: "#003b25" }
}).composite([
  { input: await sharp(source).resize(1800, 1800, { fit: "contain" }).png().toBuffer(), gravity: "centre" }
]).png().toFile("assets/splash.png");

console.log("Generated ManiHub native icon and splash from the owner's original logo.");
