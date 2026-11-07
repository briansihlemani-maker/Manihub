import sharp from "sharp";
import { readFile } from "node:fs/promises";

const source = await readFile("assets/manihub-app-icon.svg");
await sharp(source).resize(1024, 1024, { fit: "contain" }).png().toFile("assets/icon-only.png");
await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: "#003b25" }
}).composite([
  { input: await sharp(source).resize(1200, 1200, { fit: "contain" }).png().toBuffer(), gravity: "centre" }
]).png().toFile("assets/splash.png");
console.log("Generated ManiHub native icon and splash source images.");
