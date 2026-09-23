// Le modèle avant l'interface. Ces tests sont écrits avant le code, et chacun
// est prouvé en injectant le défaut qu'il doit attraper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouter, retirer, fusionner, comptesParMois, comptesDuMois } from '../js/moments.js';

const instant = (texte) => new Date(texte).getTime();

test('un moment ajouté porte tout ce que la synchronisation exigera plus tard', () => {
  const liste = ajouter([], { maintenant: instant('2026-09-22T20:10:00'), auteur: 'moi' });
  assert.equal(liste.length, 1);
  const m = liste[0];
  assert.match(m.id, /^[0-9a-f-]{16,}$/, 'un identifiant tiré au hasard');
  assert.equal(m.instant, instant('2026-09-22T20:10:00'), 'un instant absolu');
  assert.equal(m.auteur, 'moi');
  assert.equal(m.langue, null, 'aucun langage en tranche 1');
  assert.equal(m.supprime, false);
});

test('deux moments ajoutés ne partagent jamais un identifiant', () => {
  let liste = [];
  for (let i = 0; i < 200; i += 1) liste = ajouter(liste, { maintenant: 1000 + i, auteur: 'moi' });
  assert.equal(new Set(liste.map((m) => m.id)).size, 200);
});

test('retirer pose une marque et ne perd jamais la ligne', () => {
  const liste = ajouter([], { maintenant: instant('2026-09-22T20:10:00'), auteur: 'moi' });
  const apres = retirer(liste, liste[0].id, instant('2026-09-22T20:11:00'));
  assert.equal(apres.length, 1, 'la ligne reste, sinon un téléphone hors ligne la ferait revenir');
  assert.equal(apres[0].supprime, true);
  assert.equal(apres[0].retireLe, instant('2026-09-22T20:11:00'));
});

test('un moment retiré ne compte plus', () => {
  const fin = instant('2026-09-22T12:00:00');
  let liste = ajouter([], { maintenant: instant('2026-09-10T12:00:00'), auteur: 'moi' });
  liste = ajouter(liste, { maintenant: instant('2026-09-11T12:00:00'), auteur: 'elle' });
  assert.equal(comptesDuMois(liste, fin), 2);
  liste = retirer(liste, liste[0].id, fin);
  assert.equal(comptesDuMois(liste, fin), 1);
});

test('reposer deux fois le même moment ne crée pas de doublon', () => {
  const liste = ajouter([], { maintenant: instant('2026-09-22T20:10:00'), auteur: 'moi' });
  const memeMoment = { ...liste[0] };
  assert.equal(fusionner(liste, [memeMoment]).length, 1);
  assert.equal(fusionner(liste, [memeMoment, memeMoment]).length, 1);
});

test('une suppression arrivée après coup gagne sur la version qui ignorait la marque', () => {
  const liste = ajouter([], { maintenant: instant('2026-09-22T20:10:00'), auteur: 'moi' });
  const retire = { ...liste[0], supprime: true, retireLe: instant('2026-09-22T20:11:00') };
  const apres = fusionner(liste, [retire]);
  assert.equal(apres.length, 1);
  assert.equal(apres[0].supprime, true);
  // et l'ordre inverse donne le même résultat : une marque ne se perd pas
  assert.equal(fusionner([retire], [liste[0]])[0].supprime, true);
});

test('les six derniers mois passent décembre sans trou ni saut', () => {
  const fin = instant('2026-01-15T12:00:00');
  let liste = [];
  liste = ajouter(liste, { maintenant: instant('2025-12-03T10:00:00'), auteur: 'elle' });
  liste = ajouter(liste, { maintenant: instant('2025-12-24T10:00:00'), auteur: 'elle' });
  liste = ajouter(liste, { maintenant: instant('2026-01-02T10:00:00'), auteur: 'moi' });

  const mois = comptesParMois(liste, { fin, nombre: 6 });
  assert.equal(mois.length, 6);
  assert.deepEqual(mois.map((m) => m.cle), [
    '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
  ]);
  assert.deepEqual(mois.map((m) => m.compte), [0, 0, 0, 0, 2, 1]);
  assert.equal(mois.at(-1).enCours, true, 'seul le dernier mois est celui en cours');
  assert.equal(mois.slice(0, -1).some((m) => m.enCours), false);
});

test('un mois sans rien vaut zéro, il ne disparaît pas de la suite', () => {
  const mois = comptesParMois([], { fin: instant('2026-09-22T12:00:00'), nombre: 6 });
  assert.equal(mois.length, 6);
  assert.deepEqual(mois.map((m) => m.compte), [0, 0, 0, 0, 0, 0]);
});

test('un moment posé plus tard dans la journée compte pour le même mois', () => {
  const fin = instant('2026-09-30T23:59:00');
  const liste = ajouter([], { maintenant: instant('2026-09-01T00:01:00'), auteur: 'elle' });
  assert.equal(comptesDuMois(liste, fin), 1);
});
