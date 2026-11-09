const CACHE='manihub-v1-shell';
const ROOT=new URL('./',self.registration.scope).pathname;
const APP_SHELL=[ROOT,ROOT+'index.html',ROOT+'manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(APP_SHELL);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('manihub-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||/\/auth\/|\/rest\/|\/realtime\/|\/functions\//.test(url.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match(ROOT+'index.html')));
  }
});