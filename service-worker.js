const CACHE_NAME='ventas-victor-v2.4.0-bundle';
const APP_SHELL=[
 './','./index.html','./manifest.webmanifest','./supabase-config.js?v=2.4.0','./app-bundle.min.js?v=2.4.0',
 './assets/vendor/supabase.min.js','./assets/templates/Plantilla_Carga_Masiva_Ventas_Victor_V2_2.xlsx',
 './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/apple-touch-icon.png','./assets/icons/favicon-64.png','./assets/icons/favicon-32.png',
 './assets/logo-ventas-de-victor.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy))}return response}).catch(()=>caches.match('./index.html')));
  return;
 }
 // Stale-while-revalidate: respuesta instantánea desde caché + actualización en segundo plano.
 event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
  const cached=await cache.match(event.request);
  const network=fetch(event.request).then(response=>{
   if(response&&response.status===200&&response.type==='basic')cache.put(event.request,response.clone());
   return response;
  }).catch(()=>cached);
  return cached||network;
 }));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
