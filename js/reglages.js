// La feuille de réglages : le partage à deux, et la proposition des langages.
//
// Tout ce DOM est construit ici, pas dans index.html : Pages garde le HTML dix
// minutes, et du JS neuf doit tourner sur un HTML ancien.
import { normaliserCode } from './partage.js';

export const CLE_REGLAGES = 'pp:reglages:v1';
const DEUX_TEMPS_MS = 3000;
const NS = 'http://www.w3.org/2000/svg';

function el(balise, classe, texte) {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte !== undefined) n.textContent = texte;
  return n;
}
function bouton(classe, texte, auClic) {
  const b = el('button', classe, texte);
  b.type = 'button';
  b.addEventListener('click', auClic);
  return b;
}
// Pas de glyphe de police pour une icône : sur Android, le repli n'a que le
// dessin émoji. Un SVG en currentColor.
function coche() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const trait = document.createElementNS(NS, 'path');
  trait.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
  trait.setAttribute('stroke', 'currentColor');
  trait.setAttribute('stroke-width', '2.4');
  trait.setAttribute('stroke-linecap', 'round');
  trait.setAttribute('stroke-linejoin', 'round');
  svg.append(trait);
  return svg;
}

export function iconeReglages() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M4 7h10M18 7h2M4 17h4M12 17h8']) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    svg.append(p);
  }
  for (const [cx, cy] of [[16, 7], [10, 17]]) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', '2.4');
    c.setAttribute('stroke', 'currentColor');
    c.setAttribute('stroke-width', '2');
    svg.append(c);
  }
  return svg;
}

function depuis(instant, maintenant) {
  if (!instant) return null;
  const min = Math.floor((maintenant - instant) / 60e3);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}

/**
 * @param partage     le partage (js/partage.js)
 * @param zone        un objet à la manière de localStorage, ou null
 * @param auChangement prévenu quand un réglage ou le partage a changé
 */
export function creerReglages({ partage, zone, auChangement }) {
  const lireReglages = () => {
    try { return { proposerLangages: true, ...JSON.parse(zone?.getItem(CLE_REGLAGES) ?? '{}') }; } catch { return { proposerLangages: true }; }
  };
  let reglages = lireReglages();
  const rangerReglages = () => {
    try { zone?.setItem(CLE_REGLAGES, JSON.stringify(reglages)); } catch { /* le réglage vivra le temps de la session */ }
  };

  const volet = el('div', 'volet');
  volet.id = 'volet-reglages';
  volet.hidden = true;
  const fond = el('div', 'volet-fond');
  const corps = el('div', 'volet-corps reglages');
  corps.setAttribute('role', 'dialog');
  corps.setAttribute('aria-modal', 'true');
  corps.setAttribute('aria-label', 'Réglages');
  corps.tabIndex = -1;
  const defile = el('div', 'reglages-corps');
  const pied = el('div', 'reglages-pied');
  corps.append(defile, pied);
  volet.append(fond, corps);
  document.body.append(volet);

  let formulaireOuvert = false;
  let message = '';
  let enCours = false;
  let armeLe = 0;
  let minuterieDeuxTemps = null;

  async function agir(action) {
    if (enCours) return;
    enCours = true;
    message = '';
    rendre();
    try {
      const r = await action();
      if (r?.message) message = r.message;
    } finally {
      enCours = false;
      rendre();
      auChangement();
    }
  }

  function formulaireCode() {
    const form = el('form', 'reglages-code-form');
    const champ = el('input', 'reglages-champ');
    champ.name = 'code';
    champ.autocomplete = 'off';
    champ.setAttribute('autocapitalize', 'characters');
    champ.setAttribute('spellcheck', 'false');
    champ.maxLength = 8;
    champ.placeholder = 'Code de six caractères';
    champ.setAttribute('aria-label', 'Code de couple');
    const valider = el('button', 'reglages-principal', 'Rejoindre');
    valider.type = 'submit';
    valider.disabled = enCours;
    form.append(champ, valider);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = normaliserCode(champ.value);
      agir(async () => {
        const r = await partage.rejoindre(code);
        if (r.ok) { formulaireOuvert = false; return null; }
        const messages = {
          format: 'Six caractères, lettres et chiffres, sans O, I ni L.',
          inconnu: "Ce code n'existe pas. Vérifie-le sur l'autre téléphone.",
          'code-change': "Ce code a été changé. Demande le nouveau sur l'autre téléphone.",
          reseau: 'Pas de réseau pour le moment. Réessaie tout à l\'heure.',
        };
        return { message: messages[r.raison] ?? messages.reseau };
      });
    });
    return form;
  }

  function sectionPartage() {
    const morceaux = [el('h2', 'reglages-titre', 'Partage')];
    const e = partage.etat();
    const maintenant = Date.now();

    if (!e.appaire || e.coupe) {
      if (e.coupe === 'code-change') {
        morceaux.push(el('p', 'reglages-texte', "Le code a été changé sur l'autre téléphone. Tape le nouveau."));
      } else if (e.coupe === 'inconnu') {
        morceaux.push(el('p', 'reglages-texte', "Ce code n'existe plus. Tape-en un autre, ou crée un nouveau code."));
      } else {
        morceaux.push(el('p', 'reglages-texte', 'Pas encore partagé.'));
      }
      morceaux.push(bouton('reglages-principal', 'Créer un code de couple', () => agir(async () => {
        const r = await partage.creerCouple();
        return r.ok ? null : { message: 'Pas de réseau pour le moment. Réessaie tout à l\'heure.' };
      })));
      if (formulaireOuvert || e.coupe) {
        morceaux.push(formulaireCode());
      } else {
        morceaux.push(bouton('reglages-secondaire', "J'ai déjà un code", () => { formulaireOuvert = true; rendre(); defile.querySelector('input')?.focus(); }));
      }
    } else {
      morceaux.push(el('p', 'reglages-texte', "Code de couple, à taper une fois sur l'autre téléphone :"));
      const code = el('p', 'reglages-code', e.code);
      code.setAttribute('aria-label', `Code de couple : ${[...e.code].join(' ')}`);
      morceaux.push(code);
      const quand = depuis(e.derniereSynchro, maintenant);
      const suivi = e.enAttente > 0
        ? `${e.enAttente} moment${e.enAttente > 1 ? 's attendent' : ' attend'} le réseau`
        : quand ? `Synchronisé ${quand}` : 'Pas encore synchronisé';
      morceaux.push(el('p', 'reglages-suivi', suivi));
      // Changer le code se fait en deux appuis, sans boîte de dialogue : le
      // premier arme le bouton trois secondes. Ça ne s'annule pas, l'ancien
      // code est mort pour de bon.
      const arme = Date.now() - armeLe < DEUX_TEMPS_MS;
      morceaux.push(bouton(`reglages-secondaire${arme ? ' arme' : ''}`,
        arme ? 'Toucher encore pour changer' : 'Changer le code', () => {
          if (Date.now() - armeLe < DEUX_TEMPS_MS) {
            armeLe = 0;
            clearTimeout(minuterieDeuxTemps);
            agir(async () => {
              const r = await partage.changerCode();
              return r.ok ? { message: "Nouveau code. L'autre téléphone devra le taper." } : { message: 'Pas de réseau pour le moment. Réessaie tout à l\'heure.' };
            });
          } else {
            armeLe = Date.now();
            clearTimeout(minuterieDeuxTemps);
            minuterieDeuxTemps = setTimeout(() => { armeLe = 0; rendre(); }, DEUX_TEMPS_MS);
            rendre();
          }
        }));
    }
    const annonce = el('p', 'reglages-message', message);
    annonce.setAttribute('role', 'status');
    morceaux.push(annonce);
    return morceaux;
  }

  function sectionLangages() {
    const groupe = el('div', 'reglages-choix');
    groupe.setAttribute('role', 'radiogroup');
    groupe.setAttribute('aria-label', 'Proposer les langages');
    for (const [valeur, texte] of [[true, 'Proposer les langages'], [false, 'Ne pas les proposer']]) {
      const choix = bouton('reglages-option', '', () => {
        reglages = { ...reglages, proposerLangages: valeur };
        rangerReglages();
        rendre();
        auChangement();
      });
      choix.setAttribute('role', 'radio');
      choix.setAttribute('aria-checked', String(reglages.proposerLangages === valeur));
      const marque = el('span', 'reglages-coche');
      if (reglages.proposerLangages === valeur) marque.append(coche());
      choix.append(marque, el('span', '', texte));
      groupe.append(choix);
    }
    return [el('h2', 'reglages-titre', 'Langages'), groupe];
  }

  async function version() {
    try {
      const noms = await caches.keys();
      const v = noms.map((n) => n.match(/^petits-plus:app:v(\d+)$/)?.[1]).find(Boolean);
      return v ? `version ${v}` : '';
    } catch { return ''; }
  }

  function rendre() {
    if (volet.hidden) return;
    const focus = document.activeElement;
    const champ = defile.querySelector('input');
    const saisie = champ?.value ?? '';
    const avaitLeFocus = focus === champ;
    defile.replaceChildren(...sectionPartage(), ...sectionLangages());
    const nouveauChamp = defile.querySelector('input');
    if (nouveauChamp) {
      nouveauChamp.value = saisie;
      if (avaitLeFocus) nouveauChamp.focus();
    }
    for (const b of defile.querySelectorAll('button')) if (enCours) b.disabled = true;
  }

  const numero = el('span', 'reglages-version');
  pied.append(numero, bouton('reglages-fermer', 'Fermer', () => history.back()));

  function ouvrir() {
    if (!volet.hidden) return;
    history.pushState({ petitsPlus: 'reglages' }, '');
    volet.hidden = false;
    for (const n of document.body.children) if (n !== volet) n.inert = true;
    message = '';
    formulaireOuvert = false;
    rendre();
    version().then((v) => { numero.textContent = v; });
    (defile.querySelector('button') ?? corps).focus();
  }

  function fermer() {
    if (volet.hidden) return;
    volet.hidden = true;
    for (const n of document.body.children) n.inert = false;
  }

  // Recharger avec la feuille ouverte : l'historique croit y être encore, et le
  // premier retour ne ferait rien. On le remet d'accord avec l'écran.
  if (history.state?.petitsPlus === 'reglages') history.replaceState(null, '');

  fond.addEventListener('click', () => history.back());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !volet.hidden) history.back();
  });
  window.addEventListener('popstate', (e) => {
    if (e.state?.petitsPlus !== 'reglages') fermer();
  });

  return {
    ouvrir,
    actualiser: rendre,
    get proposerLangages() { return reglages.proposerLangages; },
  };
}
