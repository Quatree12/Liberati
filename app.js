/* Liberati — prototype des gestes.
   Les souvenirs ajoutés depuis l'app restent DANS CET APPAREIL (IndexedDB).
   Aucun fichier ne part sur le réseau : le code est public, les souvenirs
   de chacun ne le sont pas. */

const donnees = {
  boites: [
    {
      id: 'ma-boite',
      nom: 'Ma boîte',
      matiere: 'encore vide',
      souvenirs: []
    }
  ]
};

/* ---------- Le garde-manger : IndexedDB, dans l'appareil ---------- */

const BASE = 'liberati';
const MAGASIN = 'souvenirs';

function ouvrirBase() {
  return new Promise((resoudre, rejeter) => {
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MAGASIN)) {
        db.createObjectStore(MAGASIN, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error);
  });
}

async function lireTout() {
  const db = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(MAGASIN, 'readonly');
    const req = tx.objectStore(MAGASIN).getAll();
    req.onsuccess = () => resoudre(req.result || []);
    req.onerror = () => rejeter(req.error);
  });
}

async function ecrire(souvenir) {
  const db = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).put(souvenir);
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
  });
}

async function effacer(id) {
  const db = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).delete(id);
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
  });
}

/* Transforme un fichier choisi en contenu lisible, gardé dans l'appareil.
   Une vidéo ne donne que son audio — jamais ses images. */
async function lireFichier(fichier) {
  const type = fichier.type || '';
  if (type.startsWith('image/')) {
    const dataUrl = await lireDataUrl(fichier);
    return { type: 'photo', src: dataUrl };
  }
  if (type.startsWith('audio/')) {
    const dataUrl = await lireDataUrl(fichier);
    return { type: 'vocal', src: dataUrl, duree: await dureeAudio(dataUrl) };
  }
  if (type.startsWith('video/')) {
    const audio = await extraireAudio(fichier);
    return { type: 'vocal', src: audio.src, duree: audio.duree };
  }
  throw new Error('type inconnu');
}

function lireDataUrl(fichier) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(lecteur.result);
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

function dureeAudio(src) {
  return new Promise((resoudre) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resoudre(isFinite(a.duration) ? a.duration * 1000 : 8000);
    a.onerror = () => resoudre(8000);
    a.src = src;
  });
}

/* Extrait la piste sonore d'une vidéo, sans conserver l'image.
   On lit le flux dans un AudioContext et on le réenregistre en WAV. */
async function extraireAudio(fichier) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const brut = await ctx.decodeAudioData(await fichier.arrayBuffer());
  const pistes = brut.numberOfChannels;
  const longueur = brut.length;
  const taux = brut.sampleRate;
  const memoire = ctx.createBuffer(1, longueur, taux);
  const cible = memoire.getChannelData(0);

  // On réunit les pistes en un seul canal.
  for (let p = 0; p < pistes; p += 1) {
    const source = brut.getChannelData(p);
    for (let i = 0; i < longueur; i += 1) cible[i] += source[i] / pistes;
  }

  return { src: versWav(memoire), duree: brut.duration * 1000 };
}

function versWav(memoire) {
  const donnees = memoire.getChannelData(0);
  const taux = memoire.sampleRate;
  const tampon = new ArrayBuffer(44 + donnees.length * 2);
  const vue = new DataView(tampon);

  const texte = (pos, mot) => {
    for (let i = 0; i < mot.length; i += 1) vue.setUint8(pos + i, mot.charCodeAt(i));
  };

  texte(0, 'RIFF');
  vue.setUint32(4, 36 + donnees.length * 2, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  vue.setUint32(16, 16, true);
  vue.setUint16(20, 1, true);
  vue.setUint16(22, 1, true);
  vue.setUint32(24, taux, true);
  vue.setUint32(28, taux * 2, true);
  vue.setUint16(32, 2, true);
  vue.setUint16(34, 16, true);
  texte(36, 'data');
  vue.setUint32(40, donnees.length * 2, true);

  let pos = 44;
  for (let i = 0; i < donnees.length; i += 1) {
    vue.setInt16(pos, Math.max(-1, Math.min(1, donnees[i])) * 0x7fff, true);
    pos += 2;
  }

  // On relit le WAV depuis un blob local : rien ne quitte l'appareil.
  return URL.createObjectURL(new Blob([tampon], { type: 'audio/wav' }));
}

const $ = (sel) => document.querySelector(sel);
const ecrans = {
  seuil: $('#seuil'),
  table: $('#table'),
  boite: $('#boite'),
  reglages: $('#reglages-ecran')
};

function montrer(nom) {
  Object.values(ecrans).forEach((e) => e.classList.remove('actif'));
  ecrans[nom].classList.add('actif');
}

/* ---------- Écran 1 : le seuil ---------- */

$('#entrer').addEventListener('click', () => {
  montrer('table');
});

/* ---------- Écran 2 : la table ---------- */

function dessinerTable() {
  const zone = $('#boites');
  zone.innerHTML = '';
  donnees.boites.forEach((b) => {
    const el = document.createElement('button');
    el.className = 'boite';
    el.innerHTML =
      '<span class="boite-nom"></span>' +
      '<span class="boite-matiere"></span>';
    el.querySelector('.boite-nom').textContent = b.nom;
    el.querySelector('.boite-matiere').textContent = b.matiere;
    el.addEventListener('click', () => ouvrirBoite(b));
    zone.appendChild(el);
  });
}

let boiteCourante = null;

function ouvrirBoite(b) {
  boiteCourante = b;
  $('#nom-boite').textContent = b.nom;
  dessinerSouvenirs(b);
  montrer('boite');
}

$('#retour').addEventListener('click', () => montrer('table'));

/* ---------- Écran 3 : la boîte, fermée ----------
   Rien ne s'étale. On voit la boîte, et des pastilles qui attendent
   d'être touchées. Un souvenir ne s'ouvre que si la main le demande. */

function dessinerSouvenirs(b) {
  const zone = $('#souvenirs');
  zone.innerHTML = '';

  if (!b.souvenirs.length) {
    const vide = document.createElement('p');
    vide.className = 'vide';
    vide.textContent = 'Rien encore. Touche « empreinte » en bas pour déposer une photo, une voix, ou des mots.';
    zone.appendChild(vide);
    return;
  }

  b.souvenirs.forEach((s) => {
    zone.appendChild(pastille(s));
  });
}

/* La pastille : un objet fermé, avec sa matière. On la touche, elle s'ouvre. */
function pastille(s) {
  const el = document.createElement('button');
  el.className = 'pastille p-' + s.type;
  el.type = 'button';
  el.setAttribute('aria-label', 'Ouvrir ce souvenir');

  const marque = document.createElement('span');
  marque.className = 'pastille-marque';
  el.appendChild(marque);

  const mot = document.createElement('span');
  mot.className = 'pastille-mot';
  mot.textContent = s.type === 'photo' ? 'une photo'
    : s.type === 'vocal' ? 'une voix'
    : 'des mots';
  el.appendChild(mot);

  el.addEventListener('click', () => ouvrirSouvenir(s));
  return el;
}

/* Le souvenir ouvert : plein écran, un seul à la fois. */
let souvenirOuvert = null;

function ouvrirSouvenir(s) {
  const vue = $('#ouvert');
  const corps = $('#ouvert-corps');
  corps.innerHTML = '';
  souvenirOuvert = s;

  if (s.type === 'photo')  corps.appendChild(cartePhoto(s));
  if (s.type === 'vocal')  corps.appendChild(carteVocal(s));
  if (s.type === 'phrase') corps.appendChild(cartePhrase(s));

  $('#ouvert-date').textContent = s.date ? 'ce jour-là, le ' + s.date : '';
  vue.hidden = false;
}

function fermerSouvenir() {
  const vue = $('#ouvert');
  const son = vue.querySelector('audio');
  if (son) son.pause();
  vue.hidden = true;
  $('#ouvert-corps').innerHTML = '';
  souvenirOuvert = null;
}

$('#fermer').addEventListener('click', fermerSouvenir);
$('#ouvert').addEventListener('click', (e) => {
  // Toucher le vide referme — comme une boîte qu'on rabat.
  if (e.target.id === 'ouvert') fermerSouvenir();
});

/* Le retrait : un vrai bouton, à l'intérieur, quand le souvenir est ouvert. */
$('#retirer').addEventListener('click', async () => {
  if (!souvenirOuvert) return;
  const s = souvenirOuvert;

  $('#retirer').disabled = true;
  await effacer(s.id);

  const b = donnees.boites[0];
  b.souvenirs = b.souvenirs.filter((x) => x.id !== s.id);
  b.matiere = b.souvenirs.length
    ? b.souvenirs.length + (b.souvenirs.length === 1 ? ' souvenir' : ' souvenirs')
    : 'encore vide';

  fermerSouvenir();
  $('#retirer').disabled = false;
  dessinerSouvenirs(b);
  dessinerTable();
});

/* Geste 1 — la caresse : la photo s'éveille tant que le doigt reste. */
function cartePhoto(s) {
  const el = document.createElement('div');
  el.className = 'photo';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'une photo');

  if (s.src) {
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
  }

  const suivre = (e) => {
    const r = el.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    el.style.setProperty('--x', ((p.clientX - r.left) / r.width) * 100 + '%');
    el.style.setProperty('--y', ((p.clientY - r.top) / r.height) * 100 + '%');
  };

  el.addEventListener('pointerdown', (e) => { e.preventDefault(); suivre(e); el.classList.add('eveillee'); });
  el.addEventListener('pointermove', (e) => { if (el.classList.contains('eveillee')) suivre(e); });
  const repos = () => el.classList.remove('eveillee');
  window.addEventListener('pointerup', repos);
  el.addEventListener('pointercancel', repos);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}

/* Geste 2 — la pression : ça parle tant qu'on presse, et ça s'arrête net. */
function carteVocal(s) {
  const el = document.createElement('div');
  el.className = 'vocal';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', 'une voix');

  const piste = document.createElement('span');
  piste.className = 'piste';
  const onde = document.createElement('span');
  onde.className = 'onde';
  piste.appendChild(onde);
  el.appendChild(piste);

  // Le son, s'il existe : c'est la voix qui parle, pas une imitation.
  let son = null;
  if (s.src) {
    son = new Audio(s.src);
    son.preload = 'auto';
  }

  const duree = s.duree || 6000;
  let dureeReelle = duree;
  let debut = 0;
  let position = 0;      // on reprend exactement là où on s'est arrêté
  let cadre = null;
  let enCours = false;
  let verrouille = false;
  let minuteur = null;

  if (son) {
    son.addEventListener('loadedmetadata', () => {
      if (isFinite(son.duration)) dureeReelle = son.duration * 1000;
    });
  }

  function tic() {
    const ecoule = position + (performance.now() - debut);
    onde.style.transform = 'scaleX(' + Math.min(1, ecoule / dureeReelle) + ')';
    cadre = requestAnimationFrame(tic);
  }

  function jouer() {
    if (enCours) return;
    enCours = true;
    debut = performance.now();
    tic();
    if (son) {
      son.currentTime = Math.min(position / 1000, son.duration || 0);
      son.play().catch(() => {});
    }
  }

  function arreter() {
    if (!enCours) return;
    position = Math.min(dureeReelle, position + (performance.now() - debut));
    enCours = false;
    cancelAnimationFrame(cadre);
    // On met la voix en pause exactement là où on lâche — pas au début.
    if (son) son.pause();
    if (position >= dureeReelle) {
      position = 0;
      onde.style.transform = 'scaleX(0)';
    }
  }

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Une capsule verrouillée se relâche d'un simple appui.
    if (verrouille) {
      verrouille = false;
      el.classList.remove('verrouille');
      arreter();
      return;
    }
    el.setPointerCapture?.(e.pointerId);
    jouer();
    // Pression longue : la voix continue pendant qu'on fait autre chose.
    minuteur = setTimeout(() => { verrouille = true; el.classList.add('verrouille'); }, 700);
  });

  window.addEventListener('pointerup', () => {
    clearTimeout(minuteur);
    if (verrouille) return;   // verrouillée : elle continue toute seule
    arreter();
    el.classList.remove('verrouille');
  });
  el.addEventListener('pointercancel', () => {
    clearTimeout(minuteur);
    if (!verrouille) { arreter(); el.classList.remove('verrouille'); }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); jouer(); }
  });
  el.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') arreter();
  });

  return el;
}

/* Geste 3 — la révélation : les mots arrivent au rythme de la main. */
function cartePhrase(s) {
  const el = document.createElement('div');
  el.className = 'phrase';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');

  const mots = s.texte.split(' ');
  const spans = mots.map((m, i) => {
    const sp = document.createElement('span');
    sp.className = 'mot';
    sp.textContent = m + (i < mots.length - 1 ? ' ' : '');
    el.appendChild(sp);
    return sp;
  });

  let revele = 0;
  let minuteur = null;

  function revelerSuivant() {
    if (revele >= spans.length) return;
    spans[revele].classList.add('lu');
    revele += 1;
    minuteur = setTimeout(revelerSuivant, 320);
  }

  function commencer() {
    if (minuteur) return;
    revelerSuivant();
  }

  el.addEventListener('pointerdown', (e) => { e.preventDefault(); commencer(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); commencer(); }
  });

  return el;
}

/* ---------- Le reçu du dépôt par lien ---------- */

function montrerRecu() {
  const r = $('#recu');
  r.classList.add('visible');
  setTimeout(() => r.classList.remove('visible'), 2000);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'r') montrerRecu();
  if (e.key === 'Escape') fermerSouvenir();
});

/* ---------- Le bouton d'ajout et le tiroir ---------- */

const tiroir = $('#tiroir');
let typeChoisi = null;

$('#ajouter').addEventListener('click', () => {
  tiroir.hidden = false;
  $('#note').textContent = '';
});

$('#annuler').addEventListener('click', () => {
  tiroir.hidden = true;
  reinitialiserTiroir();
});

function reinitialiserTiroir() {
  typeChoisi = null;
  document.querySelectorAll('.type').forEach((t) => t.classList.remove('choisi'));
  document.querySelectorAll('.champ').forEach((c) => { c.hidden = true; });
  $('#fichier-photo').value = '';
  $('#fichier-vocal').value = '';
  $('#fichier-video').value = '';
  $('#texte-phrase').value = '';
  $('#dater').checked = false;
  $('#date-souvenir').hidden = true;
  $('#date-souvenir').value = '';
  $('#garder').disabled = false;
}

document.querySelectorAll('.type').forEach((bouton) => {
  bouton.addEventListener('click', () => {
    typeChoisi = bouton.dataset.type;
    document.querySelectorAll('.type').forEach((t) => t.classList.remove('choisi'));
    bouton.classList.add('choisi');
    document.querySelectorAll('.champ').forEach((c) => { c.hidden = true; });
    const champ = $('#champ-' + typeChoisi);
    if (champ) champ.hidden = false;
  });
});

$('#dater').addEventListener('change', (e) => {
  $('#date-souvenir').hidden = !e.target.checked;
});

$('#garder').addEventListener('click', async () => {
  const note = $('#note');
  if (!typeChoisi) { note.textContent = 'Choisis d’abord : une photo, une voix, ou des mots.'; return; }

  $('#garder').disabled = true;
  note.textContent = 'Un instant…';

  try {
    let souvenir = null;

    if (typeChoisi === 'photo') {
      const f = $('#fichier-photo').files[0];
      if (!f) throw new Error('photo');
      souvenir = await lireFichier(f);

    } else if (typeChoisi === 'vocal') {
      const f = $('#fichier-vocal').files[0];
      const v = $('#fichier-video').files[0];
      if (!f && !v) throw new Error('son');
      souvenir = await lireFichier(f || v);

    } else {
      const texte = $('#texte-phrase').value.trim();
      if (!texte) throw new Error('texte');
      souvenir = { type: 'phrase', texte };
    }

    souvenir.id = 's-' + Date.now();
    souvenir.cree = new Date().toISOString();
    souvenir.date = $('#dater').checked && $('#date-souvenir').value
      ? $('#date-souvenir').value
      : null;

    await ecrire(souvenir);
    const b = donnees.boites[0];
    b.souvenirs.push(souvenir);
    b.matiere = b.souvenirs.length + (b.souvenirs.length === 1 ? ' souvenir' : ' souvenirs');

    tiroir.hidden = true;
    reinitialiserTiroir();
    dessinerSouvenirs(b);
    dessinerTable();
    montrerRecu();

  } catch (err) {
    const messages = {
      photo: 'Il manque la photo.',
      son: 'Il manque le son — un fichier audio, ou une vidéo dont on garde la voix.',
      texte: 'Il manque les mots.'
    };
    note.textContent = messages[err.message] || 'Ça n’a pas marché. Réessaie.';
    $('#garder').disabled = false;
  }
});

/* ---------- Les réglages : exporter, importer ---------- */

$('#reglages').addEventListener('click', () => {
  $('#etat-export').textContent = '';
  $('#etat-import').textContent = '';
  montrer('reglages');
});

$('#retour-reglages').addEventListener('click', () => montrer('table'));

/* L'export : tout ce qui est dans l'appareil, dans un seul fichier.
   On passe par un Blob — aucune donnée ne part sur le réseau. */
$('#exporter').addEventListener('click', async () => {
  const etat = $('#etat-export');
  etat.textContent = 'Un instant…';

  try {
    const souvenirs = await lireTout();

    if (!souvenirs.length) {
      etat.textContent = 'Rien à exporter encore — la boîte est vide.';
      return;
    }

    const paquet = {
      application: 'liberati',
      version: 1,
      exporte: new Date().toISOString(),
      boites: [{ id: 'ma-boite', nom: 'Ma boîte' }],
      souvenirs
    };

    const contenu = JSON.stringify(paquet);
    const blob = new Blob([contenu], { type: 'application/json' });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = 'liberati-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    setTimeout(() => URL.revokeObjectURL(lien.href), 4000);

    etat.textContent = souvenirs.length + (souvenirs.length === 1
      ? ' souvenir exporté.'
      : ' souvenirs exportés.');

  } catch (e) {
    etat.textContent = 'L’export n’a pas marché. Réessaie.';
  }
});

/* L'import : on ajoute ce qui manque, on n'écrase jamais ce qui existe. */
$('#fichier-import').addEventListener('change', async (e) => {
  const etat = $('#etat-import');
  const fichier = e.target.files[0];
  if (!fichier) return;

  etat.textContent = 'Un instant…';

  try {
    const lu = JSON.parse(await fichier.text());
    const arrives = Array.isArray(lu) ? lu : (lu.souvenirs || []);

    if (!arrives.length) {
      etat.textContent = 'Ce fichier ne contient aucun souvenir.';
      return;
    }

    let ajoutes = 0;
    const dejaLa = new Set(donnees.boites[0].souvenirs.map((s) => s.id));

    for (const s of arrives) {
      if (!s || !s.type) continue;
      const id = s.id || ('s-' + Date.now() + '-' + ajoutes);
      if (dejaLa.has(id)) continue;   // jamais de doublon
      s.id = id;
      await ecrire(s);
      donnees.boites[0].souvenirs.push(s);
      dejaLa.add(id);
      ajoutes += 1;
    }

    donnees.boites[0].matiere = donnees.boites[0].souvenirs.length + ' souvenir'
      + (donnees.boites[0].souvenirs.length === 1 ? '' : 's');

    etat.textContent = ajoutes
      ? ajoutes + (ajoutes === 1 ? ' souvenir ajouté.' : ' souvenirs ajoutés.')
      : 'Tout était déjà là.';

    dessinerTable();

  } catch (err) {
    etat.textContent = 'Ce fichier n’a pas pu être lu.';
  } finally {
    e.target.value = '';
  }
});

/* ---------- Démarrage ---------- */

async function demarrer() {
  try {
    const souvenirs = await lireTout();
    souvenirs.sort((a, b) => (a.cree < b.cree ? -1 : 1));
    donnees.boites[0].souvenirs = souvenirs;
    donnees.boites[0].matiere = souvenirs.length
      ? souvenirs.length + (souvenirs.length === 1 ? ' souvenir' : ' souvenirs')
      : 'encore vide';
  } catch (e) {
    // Pas de base : on démarre vide, l'app fonctionne quand même.
  }

  dessinerTable();
  montrer('seuil');
}

demarrer();
