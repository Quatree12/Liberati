/* Liberati — prototype des gestes.
   Les données ci-dessous sont INVENTÉES. Aucun souvenir réel ne doit
   entrer dans ce dépôt : le code est public, les souvenirs ne le sont pas. */

const donnees = {
  boites: [
    {
      id: 'demo-1',
      nom: 'Ma boîte (démonstration)',
      matiere: 'bois clair',
      souvenirs: [
        { type: 'photo',  legende: 'Photo de démonstration' },
        { type: 'vocal',  legende: 'Vocal de démonstration', duree: 9000 },
        { type: 'phrase', texte: 'Une phrase de démonstration, mot après mot, au rythme de la main.' }
      ]
    }
  ]
};

const $ = (sel) => document.querySelector(sel);
const ecrans = { seuil: $('#seuil'), table: $('#table'), boite: $('#boite') };

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

/* ---------- Écran 3 : les souvenirs ---------- */

function dessinerSouvenirs(b) {
  const zone = $('#souvenirs');
  zone.innerHTML = '';
  b.souvenirs.forEach((s) => {
    if (s.type === 'photo')  zone.appendChild(cartePhoto(s));
    if (s.type === 'vocal')  zone.appendChild(carteVocal(s));
    if (s.type === 'phrase') zone.appendChild(cartePhrase(s));
  });
}

/* Geste 1 — la caresse : la photo s'éveille tant que le doigt reste. */
function cartePhoto(s) {
  const el = document.createElement('div');
  el.className = 'photo';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', s.legende);

  const suivre = (e) => {
    const r = el.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    el.style.setProperty('--x', ((p.clientX - r.left) / r.width) * 100 + '%');
    el.style.setProperty('--y', ((p.clientY - r.top) / r.height) * 100 + '%');
  };

  el.addEventListener('pointerdown', (e) => { suivre(e); el.classList.add('eveillee'); });
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
  el.setAttribute('aria-label', s.legende);

  const onde = document.createElement('span');
  onde.className = 'onde';
  el.appendChild(onde);

  const duree = s.duree || 6000;
  let debut = 0;
  let position = 0;      // on reprend exactement là où on s'est arrêté
  let cadre = null;
  let enCours = false;
  let verrouille = false;

  function tic() {
    const ecoule = position + (performance.now() - debut);
    onde.style.transform = 'scaleX(' + Math.min(1, ecoule / duree) + ')';
    cadre = requestAnimationFrame(tic);
  }

  function jouer() {
    if (enCours) return;
    enCours = true;
    debut = performance.now();
    tic();
    // Le son viendra ici. Le prototype ne fait que la forme.
  }

  function arreter() {
    if (!enCours) return;
    position = Math.min(duree, position + (performance.now() - debut));
    enCours = false;
    cancelAnimationFrame(cadre);
    if (position >= duree) { position = 0; onde.style.transform = 'scaleX(0)'; }
  }

  // On écoute sur la fenêtre, pas seulement sur la capsule : un doigt qui
  // glisse hors de la pastille doit quand même arrêter la voix.
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

  let minuteur = null;

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
  el.setAttribute('aria-label', s.texte);

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

/* Un dépôt simulé, pour voir la forme du reçu.
   Plus tard, c'est le partage système qui déclenchera ceci. */
document.addEventListener('keydown', (e) => {
  if (e.key === 'r') montrerRecu();
});

/* ---------- Démarrage ---------- */

dessinerTable();
montrer('seuil');

/* Une ligne dans la console, pour se souvenir de la règle. */
console.log('Liberati — prototype. Données de démonstration uniquement.');
