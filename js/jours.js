// Les jours : ce que l'écran de l'année regarde, et la seule chose qu'il
// permet de défaire.
import { moisAMontrer, cleDuMois } from './moments.js';

/** La clé « 2026-09-24 » d'un instant, dans le fuseau du téléphone. */
export function cleDuJour(instant) {
  const d = new Date(instant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const vivants = (liste) => liste.filter((m) => !m.supprime);

/** Combien de moments par jour. Un jour sans rien n'a pas d'entrée. */
export function comptesParJour(liste) {
  const comptes = new Map();
  for (const m of vivants(liste)) {
    const cle = cleDuJour(m.instant);
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
  return comptes;
}

/** Les moments d'un jour, dans l'ordre de la journée. */
export function momentsDuJour(liste, cle) {
  return vivants(liste)
    .filter((m) => cleDuJour(m.instant) === cle)
    .sort((a, b) => a.instant - b.instant);
}

/**
 * Seuls les moments d'aujourd'hui se retirent. Au-delà, retirer reviendrait à
 * réécrire le passé, ce que la spec refuse comme elle refuse de rattraper un
 * langage après coup.
 */
export function peutRetirer(moment, maintenant) {
  return !moment.supprime && cleDuJour(moment.instant) === cleDuJour(maintenant);
}

/**
 * Le total de la période montrée par le graphe de l'accueil, et d'aucune
 * autre : deux écrans qui parlent de périodes différentes affichent deux
 * totaux qui ne se recoupent pas.
 */
export function totalDeLaPeriode(liste, { fin, maximum = 12 }) {
  const cles = new Set(moisAMontrer(liste, { fin, maximum }).map((m) => m.cle));
  return vivants(liste).filter((m) => cles.has(cleDuMois(m.instant))).length;
}
