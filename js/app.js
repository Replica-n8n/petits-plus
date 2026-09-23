// Petits plus, tranche 1 : le geste. Un appui compte, et rien ne se perd.
import { ajouter, retirer, comptesParMois, comptesDuMois } from './moments.js';
import { stockageDuNavigateur, ErreurStockage } from './stockage.js';

const MOIS_MONTRES = 6;
const BANDEAU_MS = 6000;
const NOMS_COURTS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const NOMS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const el = (id) => document.getElementById(id);
const vue = {
  moisNom: el('mois-nom'), chiffre: el('chiffre'), lecture: el('lecture'),
  colonnes: el('colonnes'), valeurs: el('valeurs'), noms: el('noms'),
  souci: el('souci'), plus: el('plus'),
  bandeau: el('bandeau'), bandeauTexte: el('bandeau-texte'), annuler: el('annuler'),
  installer: el('installer'),
};

const stockage = stockageDuNavigateur();
let moments = [];
let dernierId = null;
let minuterieBandeau = null;

stockage.surContenuAbime((raison) => {
  direSouci(`Les moments rangés sur cet appareil sont illisibles (${raison}). ` +
    'Les nouveaux appuis seront gardés normalement.');
});

function direSouci(texte) {
  vue.souci.textContent = texte;
  vue.souci.hidden = false;
}

function effacerSouci() {
  vue.souci.hidden = true;
  vue.souci.textContent = '';
}

/** Construit les six colonnes une seule fois : ensuite on anime ce qui existe. */
function poserColonnes(mois) {
  vue.colonnes.replaceChildren(...mois.map(() => document.createElement('i')));
  vue.valeurs.replaceChildren(...mois.map(() => document.createElement('span')));
  vue.noms.replaceChildren(...mois.map(() => document.createElement('span')));
}

function rendre({ anime = false } = {}) {
  const maintenant = Date.now();
  const mois = comptesParMois(moments, { fin: maintenant, nombre: MOIS_MONTRES });
  if (vue.colonnes.children.length !== mois.length) poserColonnes(mois);

  const sommet = Math.max(1, ...mois.map((m) => m.compte));
  mois.forEach((m, i) => {
    // On anime la barre qui EXISTE DÉJÀ : un élément recréé naît à son état
    // final et sa transition ne joue jamais.
    const barre = vue.colonnes.children[i];
    barre.style.height = `${Math.round((m.compte / sommet) * 100)}%`;
    barre.classList.toggle('en-cours', m.enCours);

    const valeur = vue.valeurs.children[i];
    valeur.textContent = String(m.compte);
    valeur.classList.toggle('en-cours', m.enCours);

    // Le nom se réécrit à CHAQUE rendu : sinon, une app restée ouverte pendant
    // le passage à un nouveau mois garde les six étiquettes de la veille et
    // affiche les comptes d'octobre sous « sept ».
    vue.noms.children[i].textContent = NOMS_COURTS[m.mois];
  });

  const duMois = comptesDuMois(moments, maintenant);
  const nomDuMois = NOMS_LONGS[new Date(maintenant).getMonth()];
  vue.moisNom.textContent = nomDuMois;
  vue.chiffre.textContent = String(duMois);
  // Le graphe est invisible aux lecteurs d'écran : les six mois doivent donc
  // exister en toutes lettres, sinon la réponse à « est-ce que j'en reçois
  // plus » leur est purement inaccessible.
  const suite = mois.map((m) => `${NOMS_LONGS[m.mois]} ${m.compte}`).join(', ');
  vue.lecture.textContent = (duMois === 0
    ? `Aucun moment gardé en ${nomDuMois}.`
    : `${duMois} moment${duMois > 1 ? 's' : ''} gardé${duMois > 1 ? 's' : ''} en ${nomDuMois}.`)
    + ` Six derniers mois : ${suite}.`;

  if (anime) fairRouler(vue.chiffre);
}

function fairRouler(element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  element.animate(
    [{ transform: 'translateY(.28em)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 200, easing: 'cubic-bezier(.25,1,.5,1)' },
  );
}

function montrerBandeau(texte) {
  clearTimeout(minuterieBandeau);
  vue.bandeauTexte.textContent = texte;
  vue.bandeau.hidden = false;
  minuterieBandeau = setTimeout(cacherBandeau, BANDEAU_MS);
}

function cacherBandeau() {
  clearTimeout(minuterieBandeau);
  vue.bandeau.hidden = true;
  dernierId = null;
}

/** Écrit, et ne ment jamais : si le rangement refuse, l'appui est repris. */
function garder(nouveaux) {
  try {
    stockage.ecrireMoments(nouveaux);
    moments = nouveaux;
    effacerSouci();
    return true;
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    direSouci('Ce navigateur refuse de garder les données de ce site, ' +
      'donc rien n\'a été enregistré. Autorise les données de site pour Petits plus.');
    return false;
  }
}

function appuyer() {
  const avant = moments;
  const apres = ajouter(avant, { maintenant: Date.now(), auteur: 'moi' });
  if (!garder(apres)) return;

  dernierId = apres.at(-1).id;
  rendre({ anime: true });
  navigator.vibrate?.(12);
  montrerBandeau('Gardé');
}

function annuler() {
  if (!dernierId) return;
  const apres = retirer(moments, dernierId, Date.now());
  if (!garder(apres)) return;
  cacherBandeau();
  rendre({ anime: true });
}

vue.plus.addEventListener('click', appuyer);
vue.annuler.addEventListener('click', annuler);

// Installation : un bouton n'apparaît que si le navigateur le propose vraiment.
let invite = null;
window.addEventListener('beforeinstallprompt', (evenement) => {
  evenement.preventDefault();
  invite = evenement;
  vue.installer.hidden = false;
});
vue.installer.addEventListener('click', async () => {
  if (!invite) return;
  vue.installer.hidden = true;
  await invite.prompt();
  invite = null;
});

moments = stockage.lireMoments();
rendre();

// Tester la valeur, pas la présence de la clé : un navigateur peut exposer la
// propriété sans rien derrière, et « in » suffirait à faire planter le
// chargement complet de l'app pour un service worker.
if (navigator.serviceWorker) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
