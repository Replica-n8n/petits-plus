// Le modèle de Petits plus : une liste de moments, et rien d'autre.
//
// Chaque moment porte dès maintenant ce que la synchronisation à deux exigera
// en tranche 4, même si rien ne s'en sert encore : un identifiant tiré par le
// téléphone, un instant absolu, l'auteur de l'appui, et une suppression qui est
// une MARQUE. Sans ça, tout ce qui aura été gardé avant l'appairage serait
// impossible à réconcilier.

// crypto.randomUUID n'existe QUE dans un contexte sécurisé. Ouvrir le serveur
// local depuis le téléphone par l'adresse du PC n'en est pas un, et chaque
// appui lèverait sans rien dire. On se rabat sur des octets au hasard, qui eux
// restent disponibles, et en dernier recours sur l'horloge.
const identifiant = () => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const octets = c.getRandomValues(new Uint8Array(16));
    return [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`;
};

/** Ajoute un moment et rend une nouvelle liste. */
export function ajouter(liste, { maintenant, auteur, langue = null }) {
  return [
    ...liste,
    { id: identifiant(), instant: maintenant, auteur, langue, supprime: false },
  ];
}

/** Marque un moment comme retiré. La ligne reste, sinon elle reviendrait. */
export function retirer(liste, id, maintenant) {
  return liste.map((m) => (m.id === id ? { ...m, supprime: true, retireLe: maintenant } : m));
}

/**
 * Range des moments venus d'ailleurs dans la liste, sans jamais créer de
 * doublon : l'identifiant vient du téléphone qui a appuyé. Une suppression
 * l'emporte, dans les deux sens, parce qu'une marque ne doit pas se perdre.
 */
export function fusionner(liste, entrants) {
  const parId = new Map(liste.map((m) => [m.id, m]));
  for (const entrant of entrants) {
    const connu = parId.get(entrant.id);
    if (!connu) {
      parId.set(entrant.id, entrant);
      continue;
    }
    const supprime = connu.supprime || entrant.supprime;
    parId.set(entrant.id, {
      ...connu,
      ...entrant,
      supprime,
      retireLe: connu.retireLe ?? entrant.retireLe,
    });
  }
  return [...parId.values()];
}

/** La clé « 2026-09 » d'un instant, dans le fuseau du téléphone. */
export function cleDuMois(instant) {
  const d = new Date(instant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const vivants = (liste) => liste.filter((m) => !m.supprime);

/** Combien de moments dans le mois auquel appartient cet instant. */
export function comptesDuMois(liste, instant) {
  const cle = cleDuMois(instant);
  return vivants(liste).filter((m) => cleDuMois(m.instant) === cle).length;
}

/**
 * Les `nombre` derniers mois jusqu'à `fin`, le plus ancien en premier. Un mois
 * sans rien vaut zéro et reste dans la suite : c'est ce qui fait que le graphe
 * ne saute pas et que décembre passe à janvier sans trou.
 */
export function comptesParMois(liste, { fin, nombre = 6 }) {
  const comptes = new Map();
  for (const m of vivants(liste)) {
    const cle = cleDuMois(m.instant);
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }

  const dernier = new Date(fin);
  const mois = [];
  for (let recul = nombre - 1; recul >= 0; recul -= 1) {
    const d = new Date(dernier.getFullYear(), dernier.getMonth() - recul, 1);
    const cle = cleDuMois(d.getTime());
    mois.push({
      cle,
      annee: d.getFullYear(),
      mois: d.getMonth(),
      compte: comptes.get(cle) ?? 0,
      enCours: recul === 0,
    });
  }
  return mois;
}
