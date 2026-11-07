import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = process.cwd();
const out = new URL('../www/', import.meta.url);
const outputPath = new URL(out).pathname;

await mkdir(outputPath, { recursive: true });

for (const item of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  if (!existsSync(new URL('../' + item, import.meta.url))) {
    throw new Error('Required ManiHub app file is missing: ' + item);
  }
  await cp(new URL('../' + item, import.meta.url), new URL(item, out));
}

for (const directory of ['assets', 'marketplace']) {
  if (!existsSync(new URL('../' + directory, import.meta.url))) {
    throw new Error('Required ManiHub directory is missing: ' + directory);
  }
  await cp(new URL('../' + directory, import.meta.url), new URL(directory, out), { recursive: true });
}

// Native app builds should use the local app shell rather than trying to register
// a service worker against a browser-hosted GitHub Pages path.
const rootHtml = await readFile(new URL('index.html', out), 'utf8');
const safeRootHtml = rootHtml.replace(/<script>if\("serviceWorker" in navigator\)[\s\S]*?<\/script>/, '');
await writeFile(new URL('index.html', out), safeRootHtml);

const marketplaceHtml = await readFile(new URL('marketplace/index.html', out), 'utf8');
const safeMarketplaceHtml = marketplaceHtml.replace(/<script>if\("serviceWorker" in navigator\)[\s\S]*?<\/script>/, '');
await writeFile(new URL('marketplace/index.html', out), safeMarketplaceHtml);

console.log('Prepared ManiHub shared web app in ./www for Capacitor.');
