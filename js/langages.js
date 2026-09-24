// Les cinq langages de l'amour, tels qu'ils servent ici : on ENREGISTRE ce que
// la personne dit, on ne le déduit d'aucun questionnaire.
//
// ⚠️ Les identifiants et les mots sont repris tels quels de `a-deux`
// (js/coeur.js). Deux apps qui nomment « services » différemment ne pourront
// jamais se parler, et c'est exactement le genre de divergence qui coûte cher
// plus tard.
import { moisAMontrer, cleDuMois } from './moments.js';

export const LANGAGES = [
  { id: 'paroles', nom: 'Paroles valorisantes', court: 'Paroles' },
  { id: 'moments', nom: 'Moments de qualité', court: 'Moments' },
  { id: 'cadeaux', nom: 'Cadeaux', court: 'Cadeaux' },
  { id: 'services', nom: 'Services rendus', court: 'Services' },
  { id: 'toucher', nom: 'Toucher physique', court: 'Toucher' },
];

const IDS = new Set(LANGAGES.map((l) => l.id));

export const estUnLangage = (langue) => IDS.has(langue);

/**
 * Pose un langage sur un moment déjà gardé. Remplace s'il y en avait un, ne
 * touche à rien si l'identifiant est inconnu, et refuse un langage inventé
 * plutôt que de le ranger en silence.
 */
export function preciser(liste, id, langue, maintenant = Date.now()) {
  if (!estUnLangage(langue)) {
    throw new Error(`langage inconnu : ${langue}`);
  }
  // modifieLe : deux téléphones qui précisent le même moment doivent savoir
  // lequel garder, et c'est le plus récent.
  return liste.map((m) => (m.id === id ? { ...m, langue, modifieLe: maintenant } : m));
}

/**
 * La répartition sur les mois montrés. Rend aussi combien de moments sont
 * précisés et combien il y en a en tout : c'est ce rapport qui dira si la
 * répartition a de quoi parler, ou si elle mentirait.
 */
export function repartition(liste, { fin, maximum = 12 }) {
  const mois = moisAMontrer(liste, { fin, maximum });
  const clesMontrees = new Set(mois.map((m) => m.cle));

  const dedans = liste.filter((m) => !m.supprime && clesMontrees.has(cleDuMois(m.instant)));
  const comptes = new Map(LANGAGES.map((l) => [l.id, 0]));
  let precises = 0;
  for (const m of dedans) {
    if (!estUnLangage(m.langue)) continue;
    comptes.set(m.langue, comptes.get(m.langue) + 1);
    precises += 1;
  }

  return {
    total: dedans.length,
    precises,
    parLangage: LANGAGES.map((l) => ({ id: l.id, compte: comptes.get(l.id) })),
  };
}
