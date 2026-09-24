// Service worker de Petits plus.
// Une SEULE constante à bouger à chaque livraison : tout le reste en découle.
const VERSION = 7;

const CACHE = `petits-plus:app:v${VERSION}`;
const PREFIXE = 'petits-plus:app:';

// Chaque fichier est demandé avec ?v= dès l'installation : sans ça, un service
// worker installé juste après une mise en ligne range l'ANCIEN fichier servi par
// le cache de GitHub Pages, et l'app reste vieille pour de bon.
//
// Le tampon n'existe QUE dans ce fichier. La page, elle, demande des adresses
// nues, et le cache les retrouve par ignoreSearch. Écrire « ?v=1 » à la main
// dans index.html reviendrait à avoir deux versions à tenir d'accord, ce qui
// finit toujours par donner du nouveau HTML avec de l'ancien JS.
// tools/audit.mjs refuse tout ?v= écrit ailleurs qu'ici.
const FICHIERS = [
  './',
  'index.html',
  'css/couleurs.css',
  'css/app.css',
  'js/app.js',
  'js/moments.js',
  'js/stockage.js',
  'js/langages.js',
  'js/jours.js',
  'js/annee.js',
  'polices/archivo-latin.woff2',
  'manifest.webmanifest',
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-maskable-512.png',
].map((chemin) => `${chemin}${chemin.includes('?') ? '&' : '?'}v=${VERSION}`);

self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FICHIERS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    // Toutes les apps partagent la même origine : ne supprimer QUE les siennes.
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((nom) => nom.startsWith(PREFIXE) && nom !== CACHE)
        .map((nom) => caches.delete(nom)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  // La navigation passe par le réseau sans cache intermédiaire, parce que
  // GitHub Pages garde le HTML dix minutes. Hors ligne, on sert la page rangée.
  if (requete.mode === 'navigate') {
    evenement.respondWith((async () => {
      try {
        return await fetch(requete.url, { cache: 'no-cache' });
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(`index.html?v=${VERSION}`))
          ?? (await cache.match('index.html', { ignoreSearch: true }));
      }
    })());
    return;
  }

  evenement.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Repli en ignoreSearch : la page demande « fichier?v=1 », le cache peut
    // n'avoir que « fichier », et l'inverse.
    const range = (await cache.match(requete)) ?? (await cache.match(requete, { ignoreSearch: true }));
    if (range) return range;

    const reponse = await fetch(requete);
    // Copier AVANT tout then : une réponse déjà lue ne se range plus, en silence.
    if (reponse.ok && new URL(requete.url).origin === self.location.origin) {
      cache.put(requete, reponse.clone());
    }
    return reponse;
  })());
});
