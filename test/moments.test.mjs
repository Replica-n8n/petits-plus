// Le modèle avant l'interface. Ces tests sont écrits avant le code, et chacun
// est prouvé en injectant le défaut qu'il doit attraper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouter, retirer, fusionner, comptesParMois, comptesDuMois, moisAMontrer, mediane } from '../js/moments.js';

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

test('le graphe ne commence jamais avant le premier moment gardé', () => {
  const fin = instant('2026-09-15T12:00:00');
  let liste = ajouter([], { maintenant: instant('2026-08-20T10:00:00'), auteur: 'elle' });
  liste = ajouter(liste, { maintenant: instant('2026-09-02T10:00:00'), auteur: 'moi' });

  const mois = moisAMontrer(liste, { fin, maximum: 6 });
  assert.deepEqual(mois.map((m) => m.cle), ['2026-08', '2026-09'],
    'deux mois d\'usage, deux colonnes : pas quatre colonnes à zéro devant');
  assert.deepEqual(mois.map((m) => m.compte), [1, 1]);
});

test('passé six mois d\'usage, on en montre six, pas plus', () => {
  const fin = instant('2026-09-15T12:00:00');
  let liste = ajouter([], { maintenant: instant('2025-01-05T10:00:00'), auteur: 'elle' });
  liste = ajouter(liste, { maintenant: instant('2026-09-02T10:00:00'), auteur: 'moi' });

  const mois = moisAMontrer(liste, { fin, maximum: 6 });
  assert.equal(mois.length, 6);
  assert.equal(mois.at(-1).cle, '2026-09');
  assert.equal(mois.at(0).cle, '2026-04');
});

test('un mois creux au MILIEU de l\'usage reste visible à zéro', () => {
  const fin = instant('2026-09-15T12:00:00');
  let liste = ajouter([], { maintenant: instant('2026-07-20T10:00:00'), auteur: 'elle' });
  liste = ajouter(liste, { maintenant: instant('2026-09-02T10:00:00'), auteur: 'moi' });

  const mois = moisAMontrer(liste, { fin, maximum: 6 });
  assert.deepEqual(mois.map((m) => m.cle), ['2026-07', '2026-08', '2026-09'],
    'août est vide mais il s\'est écoulé : le trou fait partie de l\'histoire');
  assert.deepEqual(mois.map((m) => m.compte), [1, 0, 1]);
});

test('sans aucun moment, il n\'y a rien à montrer', () => {
  assert.deepEqual(moisAMontrer([], { fin: instant('2026-09-15T12:00:00'), maximum: 6 }), []);
});

test('les moments retirés ne rallongent pas le graphe', () => {
  const fin = instant('2026-09-15T12:00:00');
  let liste = ajouter([], { maintenant: instant('2026-04-20T10:00:00'), auteur: 'elle' });
  const vieux = liste[0].id;
  liste = ajouter(liste, { maintenant: instant('2026-09-02T10:00:00'), auteur: 'moi' });
  liste = retirer(liste, vieux, fin);

  const mois = moisAMontrer(liste, { fin, maximum: 6 });
  assert.deepEqual(mois.map((m) => m.cle), ['2026-09'],
    'le seul moment d\'avril a été retiré : avril n\'a plus à être montré');
});

test('la médiane ignore le mois en cours, qui n\'est pas fini', () => {
  const mois = [
    { cle: '2026-06', compte: 10, enCours: false },
    { cle: '2026-07', compte: 8, enCours: false },
    { cle: '2026-08', compte: 12, enCours: false },
    { cle: '2026-09', compte: 1, enCours: true },
  ];
  // Sans cette règle, le 1er du mois ferait plonger la ligne chaque mois.
  assert.equal(mediane(mois), 10);
});

test('la médiane sur un nombre pair de mois prend le milieu des deux', () => {
  const mois = [
    { compte: 4, enCours: false }, { compte: 8, enCours: false },
    { compte: 10, enCours: false }, { compte: 20, enCours: false },
    { compte: 0, enCours: true },
  ];
  assert.equal(mediane(mois), 9);
});

test('un mois exceptionnel ne déplace pas la médiane', () => {
  const ordinaires = [
    { compte: 8, enCours: false }, { compte: 9, enCours: false },
    { compte: 10, enCours: false },
  ];
  assert.equal(mediane(ordinaires), 9);
  assert.equal(mediane([...ordinaires, { compte: 60, enCours: false }]), 9.5,
    'la moyenne serait passée de 9 à 21,75');
});

test('il n\'y a pas de médiane tant qu\'il n\'y a pas deux mois finis', () => {
  assert.equal(mediane([{ compte: 5, enCours: true }]), null);
  assert.equal(mediane([{ compte: 5, enCours: false }, { compte: 3, enCours: true }]), null);
  assert.equal(mediane([]), null);
});
