// L'écran de l'année : regarder posément ce que l'accueil montre en trois
// secondes. Trois niveaux : l'année en douze lignes, un mois en calendrier,
// un jour dans un volet.
//
// Tout ce DOM est construit ici et pas dans index.html : GitHub Pages garde le
// HTML dix minutes, et du JS neuf doit pouvoir tourner sur un HTML ancien.
import { moisAMontrer } from './moments.js';
import { LANGAGES, repartition } from './langages.js';
import { cleDuJour, comptesParJour, momentsDuJour, peutRetirer, totalDeLaPeriode } from './jours.js';

const MAXIMUM = 12;
const NOMS_COURTS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const NOMS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_COURTS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const NOM_DU_LANGAGE = new Map(LANGAGES.map((l) => [l.id, l.nom]));

const intensite = (n) => (n >= 3 ? 3 : n);
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function el(balise, classe, texte) {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte !== undefined) n.textContent = texte;
  return n;
}

/**
 * @param lire      rend la liste des moments à jour
 * @param retirer   retire POUR DE BON un moment (écrit et rend l'accueil)
 * @param bandeau   montre le bandeau commun, avec son annulation
 */
export function creerEcranAnnee({ lire, retirer, bandeau }) {
  const racine = el('section', 'annee');
  racine.id = 'ecran-annee';
  racine.hidden = true;
  const corps = el('div', 'annee-corps');
  racine.append(corps);

  const voletJour = el('div', 'volet');
  voletJour.id = 'volet-jour';
  voletJour.hidden = true;
  const fondJour = el('div', 'volet-fond');
  const corpsJour = el('div', 'volet-corps');
  corpsJour.setAttribute('role', 'dialog');
  corpsJour.setAttribute('aria-modal', 'true');
  // Un jour passé n'a aucun bouton : le volet lui-même doit pouvoir prendre le
  // focus, sinon il resterait sur le jour touché, rendu inerte derrière.
  corpsJour.tabIndex = -1;
  voletJour.append(fondJour, corpsJour);

  document.body.append(racine, voletJour);

  let vue = null; // { niveau: 'annee' } ou { niveau: 'mois', cle }
  let jourOuvert = null;

  // « L'année › » et « ‹ Accueil » sont au MÊME endroit, en haut à gauche. Un
  // double appui ouvrait l'écran, et le second appui tombait sur le retour qui
  // venait d'apparaître sous le doigt : on ressortait aussitôt.
  // On ignore donc, un court instant après un changement d'écran, les appuis
  // tombés AU MÊME ENDROIT que celui qui l'a provoqué. Un appui voulu ailleurs
  // sur l'écran passe, lui, sans attendre.
  const CALME_MS = 350;
  const RAYON_PX = 40;
  let dernierAppui = null;
  let zoneCalme = null;
  document.addEventListener('click', (e) => {
    const t = performance.now();
    if (zoneCalme && t < zoneCalme.jusqua
      && Math.hypot(e.clientX - zoneCalme.x, e.clientY - zoneCalme.y) < RAYON_PX) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    dernierAppui = { x: e.clientX, y: e.clientY, t };
  }, true);
  const calmer = () => {
    const t = performance.now();
    // Seul un appui tout récent a pu provoquer ce changement d'écran : un
    // retour système d'Android, lui, ne laisse aucune zone à protéger.
    zoneCalme = dernierAppui && t - dernierAppui.t < 500
      ? { x: dernierAppui.x, y: dernierAppui.y, jusqua: t + CALME_MS }
      : null;
  };

  // Retirer se fait en deux temps. Le moment disparaît de l'écran tout de
  // suite, mais n'est retiré POUR DE BON qu'à la fin de la fenêtre d'annulation.
  // Ainsi « Annuler » n'a jamais à ressusciter une marque de suppression, qui
  // aurait pu partir vers l'autre téléphone entre-temps.
  let enAttente = null;
  const liste = () => lire().filter((m) => m.id !== enAttente?.id);

  function confirmerRetrait() {
    if (!enAttente) return;
    const { id, minuterie } = enAttente;
    clearTimeout(minuterie);
    enAttente = null;
    retirer(id);
  }

  function demanderRetrait(id) {
    confirmerRetrait(); // un retrait précédent encore en attente part d'abord
    enAttente = { id, minuterie: setTimeout(() => { confirmerRetrait(); rendre(); }, 6000) };
    rendre();
    bandeau('Retiré', {
      annulation: () => {
        if (!enAttente || enAttente.id !== id) return;
        clearTimeout(enAttente.minuterie);
        enAttente = null;
        rendre();
      },
    });
  }

  // L'app quittée pendant la fenêtre : le geste voulu était de retirer.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') confirmerRetrait();
  });

  function enTete(texteRetour, auRetour) {
    const retour = el('button', 'retour', `‹ ${texteRetour}`);
    retour.type = 'button';
    retour.addEventListener('click', auRetour);
    return retour;
  }

  function rendreAnnee() {
    const moments = liste();
    const maintenant = Date.now();
    const mois = moisAMontrer(moments, { fin: maintenant, maximum: MAXIMUM });
    const total = totalDeLaPeriode(moments, { fin: maintenant, maximum: MAXIMUM });

    const morceaux = [enTete('Accueil', () => history.back())];

    if (mois.length === 0) {
      morceaux.push(el('p', 'annee-vide', 'Aucun moment gardé pour l\'instant.'));
      corps.replaceChildren(...morceaux);
      return;
    }

    const premier = mois[0];
    const dernier = mois.at(-1);
    const periode = mois.length === 1
      ? `${NOMS_LONGS[dernier.mois]} ${dernier.annee}`
      : `de ${NOMS_LONGS[premier.mois]} ${premier.annee} à ${NOMS_LONGS[dernier.mois]} ${dernier.annee}`;
    morceaux.push(el('div', 'annee-periode', periode));

    const bloc = el('div', 'annee-total');
    bloc.append(el('span', 'annee-nombre', String(total)), el('span', 'annee-unite', total > 1 ? 'moments' : 'moment'));
    morceaux.push(bloc);

    // La répartition n'apparaît que quand elle a de quoi dire : au moins la
    // moitié des moments précisés, et au minimum dix. Sinon elle décrirait
    // surtout les jours où on a pensé à préciser.
    const r = repartition(moments, { fin: maintenant, maximum: MAXIMUM });
    if (r.precises >= 10 && r.precises * 2 >= r.total) {
      morceaux.push(el('h2', 'annee-titre', 'Par langage'));
      const grille = el('div', 'annee-rep');
      const tries = [...r.parLangage].sort((a, b) => b.compte - a.compte);
      const sommet = Math.max(1, tries[0].compte);
      tries.forEach((l, i) => {
        const part = el('span', `annee-part${i === 0 ? ' premier' : ''}`);
        part.style.width = `${(l.compte / sommet) * 100}%`;
        const piste = el('span', 'annee-piste');
        piste.append(part);
        grille.append(el('span', 'annee-langue', NOM_DU_LANGAGE.get(l.id)), piste, el('span', 'annee-n', String(l.compte)));
      });
      morceaux.push(grille);
    }

    morceaux.push(el('h2', 'annee-titre', 'Jour par jour'));
    const parJour = comptesParJour(moments);
    const lignes = el('div', 'annee-lignes');
    for (const m of mois) {
      const ligne = el('button', 'annee-ligne');
      ligne.type = 'button';
      ligne.setAttribute('aria-label', `${NOMS_LONGS[m.mois]} ${m.annee}, ${pluriel(m.compte, 'moment')}`);
      ligne.append(el('span', 'annee-mois', NOMS_COURTS[m.mois]));
      const points = el('span', 'annee-points');
      const jours = new Date(m.annee, m.mois + 1, 0).getDate();
      for (let j = 1; j <= 31; j += 1) {
        const date = new Date(m.annee, m.mois, j);
        const hors = j > jours || date.getTime() > maintenant;
        const n = hors ? 0 : (parJour.get(cleDuJour(date.getTime())) ?? 0);
        points.append(el('i', hors ? 'hors' : `i${intensite(n)}`));
      }
      ligne.append(points);
      ligne.addEventListener('click', () => aller({ niveau: 'mois', cle: m.cle }));
      lignes.append(ligne);
    }
    morceaux.push(lignes);
    corps.replaceChildren(...morceaux);
  }

  function rendreMois(cle) {
    const moments = liste();
    const maintenant = Date.now();
    const mois = moisAMontrer(moments, { fin: maintenant, maximum: MAXIMUM });
    const rang = mois.findIndex((m) => m.cle === cle);
    if (rang === -1) { aller({ niveau: 'annee' }, { remplacer: true }); return; }
    const m = mois[rang];

    const nav = el('div', 'annee-nav');
    const precedent = el('button', 'annee-fleche', '‹');
    precedent.type = 'button';
    precedent.setAttribute('aria-label', 'Mois précédent');
    const suivant = el('button', 'annee-fleche', '›');
    suivant.type = 'button';
    suivant.setAttribute('aria-label', 'Mois suivant');
    // Une flèche qui ne mène nulle part disparaît, mais garde sa place : le
    // nom du mois ne saute pas d'un côté à l'autre en changeant de mois.
    precedent.style.visibility = rang > 0 ? 'visible' : 'hidden';
    suivant.style.visibility = rang < mois.length - 1 ? 'visible' : 'hidden';
    precedent.addEventListener('click', () => aller({ niveau: 'mois', cle: mois[rang - 1].cle }, { remplacer: true }));
    suivant.addEventListener('click', () => aller({ niveau: 'mois', cle: mois[rang + 1].cle }, { remplacer: true }));
    nav.append(precedent, el('span', 'annee-nom-mois', `${NOMS_LONGS[m.mois]} ${m.annee}`), suivant);

    const semaine = el('div', 'annee-semaine');
    JOURS_COURTS.forEach((j) => semaine.append(el('span', '', j)));

    const calendrier = el('div', 'annee-calendrier');
    const decalage = (new Date(m.annee, m.mois, 1).getDay() + 6) % 7;
    for (let v = 0; v < decalage; v += 1) calendrier.append(el('span'));
    const parJour = comptesParJour(moments);
    const jours = new Date(m.annee, m.mois + 1, 0).getDate();
    const aujourdhui = cleDuJour(maintenant);
    for (let j = 1; j <= jours; j += 1) {
      const date = new Date(m.annee, m.mois, j);
      const cleJour = cleDuJour(date.getTime());
      const n = date.getTime() > maintenant && cleJour !== aujourdhui ? 0 : (parJour.get(cleJour) ?? 0);
      // Un jour vide n'est pas un bouton : rien à y voir, donc rien à promettre.
      const cellule = el(n > 0 ? 'button' : 'span', `annee-jour i${intensite(n)}`, String(j));
      if (cleJour === aujourdhui) cellule.classList.add('aujourdhui');
      // Un jour à venir n'est pas un jour vide : il n'a pas encore eu lieu.
      if (date.getTime() > maintenant && cleJour !== aujourdhui) cellule.classList.add('a-venir');
      if (n > 0) {
        cellule.type = 'button';
        cellule.setAttribute('aria-label', `${j} ${NOMS_LONGS[m.mois]}, ${pluriel(n, 'moment')}`);
        cellule.addEventListener('click', () => ouvrirJour(cleJour));
      }
      calendrier.append(cellule);
    }

    corps.replaceChildren(enTete('L\'année', () => history.back()), nav, semaine, calendrier);
  }

  function rendreJour() {
    if (!jourOuvert) return;
    const moments = momentsDuJour(liste(), jourOuvert);
    if (moments.length === 0) { fermerJour(); return; }
    const [a, mo, j] = jourOuvert.split('-').map(Number);
    const titre = el('h2', 'jour-titre', DATE_LONGUE.format(new Date(a, mo - 1, j)));
    corpsJour.setAttribute('aria-label', titre.textContent);
    const lignes = el('ul', 'jour-liste');
    const maintenant = Date.now();
    for (const m of moments) {
      const ligne = el('li', 'jour-ligne');
      const langue = m.langue ? NOM_DU_LANGAGE.get(m.langue) : 'sans langage';
      ligne.append(el('span', 'jour-heure', HEURE.format(new Date(m.instant))), el('span', 'jour-langue', langue));
      if (peutRetirer(m, maintenant)) {
        const bouton = el('button', 'jour-retirer', 'Retirer');
        bouton.type = 'button';
        bouton.addEventListener('click', () => demanderRetrait(m.id));
        ligne.append(bouton);
      }
      lignes.append(ligne);
    }
    corpsJour.replaceChildren(titre, lignes);
  }

  function ouvrirJour(cle) {
    if (!voletJour.hidden) return; // même raison : pas de double entrée d'historique
    jourOuvert = cle;
    history.pushState({ petitsPlus: 'jour', cle }, '');
    voletJour.hidden = false;
    racine.inert = true;
    document.body.classList.add('jour-ouvert');
    calmer();
    rendreJour();
    (corpsJour.querySelector('button') ?? corpsJour).focus();
  }

  function fermerJour() {
    if (voletJour.hidden) return;
    voletJour.hidden = true;
    racine.inert = false;
    document.body.classList.remove('jour-ouvert');
    jourOuvert = null;
  }

  fondJour.addEventListener('click', () => history.back());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !voletJour.hidden) history.back();
  });

  function rendre() {
    if (!vue) return;
    if (vue.niveau === 'annee') rendreAnnee();
    if (vue.niveau === 'mois') rendreMois(vue.cle);
    rendreJour();
  }

  /** Change d'écran, et le note dans l'historique pour le retour d'Android. */
  function aller(cible, { remplacer = false } = {}) {
    // Un double appui sur le téléphone ne doit pas empiler deux fois le même
    // écran : le retour d'Android demanderait alors deux appuis pour revenir.
    if (!remplacer && vue && vue.niveau === cible.niveau && vue.cle === cible.cle) return;
    vue = cible;
    const etat = { petitsPlus: cible.niveau, cle: cible.cle };
    if (remplacer) history.replaceState(etat, '');
    else history.pushState(etat, '');
    afficher();
  }

  function afficher() {
    calmer();
    document.body.classList.toggle('sur-annee', Boolean(vue));
    racine.hidden = !vue;
    rendre();
    window.scrollTo(0, 0);
    corps.querySelector('.retour')?.focus();
  }

  // Le retour système d'Android passe par ici : sans ça, il fermerait l'app.
  window.addEventListener('popstate', (e) => {
    const etat = e.state?.petitsPlus;
    if (etat !== 'jour') fermerJour();
    if (etat === 'annee' || etat === 'mois') vue = { niveau: etat, cle: e.state.cle };
    else if (etat !== 'jour') vue = null;
    afficher();
  });

  // Recharger la page sur l'écran de l'année : l'historique s'en souvient, donc
  // l'écran doit s'en souvenir aussi. Sinon on voit l'accueil pendant que
  // l'historique croit être sur l'année, et le premier retour ne fait rien.
  {
    const etat = history.state?.petitsPlus;
    if (etat === 'annee' || etat === 'mois') {
      vue = { niveau: etat, cle: history.state.cle };
      afficher();
    } else if (etat === 'jour') {
      vue = { niveau: 'mois', cle: history.state.cle.slice(0, 7) };
      history.replaceState({ petitsPlus: 'mois', cle: vue.cle }, '');
      afficher();
    }
  }

  return {
    ouvrir: () => aller({ niveau: 'annee' }),
    /** L'accueil vient de changer : si l'écran est ouvert, il suit. */
    actualiser: rendre,
  };
}
