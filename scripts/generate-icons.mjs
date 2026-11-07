import sharp from "sharp";
import { readFile } from "node:fs/promises";

// Use the exact original ManiHub logo supplied by the owner.
// Put the complete artwork on Android's adaptive BACKGROUND layer so it
// fills the icon instead of shrinking into a small foreground badge.
const source = await readFile("assets/file_000000004420824681cbd3dc77302cd3.png");

await sharp(source)
  .resize(1024, 1024, { fit: "cover", position: "centre" })
  .png()
  .toFile("assets/icon-only.png");

await sharp(source)
  .resize(1024, 1024, { fit: "cover", position: "centre" })
  .png()
  .toFile("assets/icon-background.png");

// Transparent foreground: the approved full logo is already on the
// background layer, so Android's adaptive mask clips the complete artwork.
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
}).png().toFile("assets/icon-foreground.png");

await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: "#003b25" }
}).composite([
  { input: await sharp(source).resize(1800, 1800, { fit: "contain" }).png().toBuffer(), gravity: "centre" }
]).png().toFile("assets/splash.png");

console.log("Generated full-bleed ManiHub icon from the owner's original uploaded artwork.");
