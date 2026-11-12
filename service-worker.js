/* Liberati — le gardien du seuil.
   Il garde une copie de l'app dans l'appareil pour qu'elle s'ouvre
   même sans réseau : dans le métro, en avion, quand la connexion est mauvaise.

   Il ne touche JAMAIS aux souvenirs : ceux-ci vivent dans IndexedDB,
   séparément, et ne passent pas par ici. */

const VERSION = 'liberati-v9';
const FICHIERS = [
  './',
  './index.html',
  './style.css',
  './app.js'
];

/* On met l'app de côté dès la première visite. */
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

/* On jette les anciennes versions, pour ne jamais servir du périmé. */
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* Le réseau d'abord — pour avoir la dernière version quand on est en ligne.
   Le réseau échoue ? On sert la copie gardée. L'app s'ouvre quand même. */
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;

  // On ne s'occupe que des fichiers de l'app, en lecture.
  if (requete.method !== 'GET') return;
  if (!requete.url.startsWith(self.location.origin)) return;

  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        // On rafraîchit la copie au passage.
        const copie = reponse.clone();
        caches.open(VERSION).then((cache) => cache.put(requete, copie)).catch(() => {});
        return reponse;
      })
      .catch(() => caches.match(requete).then((gardee) => {
        // Hors ligne : la copie gardée, ou la page d'accueil à défaut.
        return gardee || caches.match('./index.html');
      }))
  );
});
