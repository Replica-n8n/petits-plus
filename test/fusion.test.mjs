// La fusion de deux téléphones. Tests écrits avant le code.
//
// La propriété qui compte le plus : fusionner A dans B ou B dans A donne
// EXACTEMENT le même résultat. Sinon, deux téléphones qui s'échangent les mêmes
// moments finissent par voir deux choses différentes, en silence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouter, retirer, fusionner } from '../js/moments.js';
import { preciser } from '../js/langages.js';

const T = (h) => new Date(`2026-09-24T${h}:00`).getTime();
const trie = (liste) => [...liste].sort((a, b) => a.id.localeCompare(b.id));
const memeContenu = (a, b) => assert.deepEqual(trie(a), trie(b));

const base = ajouter([], { maintenant: T('10:00'), auteur: 'tel-a' });
const m = base[0];

test('ajouter, préciser et retirer posent modifieLe', () => {
  assert.equal(m.modifieLe, T('10:00'));
  assert.equal(preciser(base, m.id, 'paroles', T('10:05'))[0].modifieLe, T('10:05'));
  assert.equal(retirer(base, m.id, T('10:07'))[0].modifieLe, T('10:07'));
});

test('le langage le plus récent l\'emporte, dans les deux sens', () => {
  const surA = preciser(base, m.id, 'paroles', T('10:05'));
  const surB = preciser(base, m.id, 'services', T('10:09'));
  const ab = fusionner(surA, surB);
  const ba = fusionner(surB, surA);
  assert.equal(ab[0].langue, 'services');
  memeContenu(ab, ba);
});

test('la suppression l\'emporte sur un langage posé APRÈS elle', () => {
  const retireSurA = retirer(base, m.id, T('10:05'));
  const preciseSurB = preciser(base, m.id, 'toucher', T('10:30'));
  const ab = fusionner(retireSurA, preciseSurB);
  const ba = fusionner(preciseSurB, retireSurA);
  assert.equal(ab[0].supprime, true, 'un moment retiré ne revient jamais');
  memeContenu(ab, ba);
});

test('la date du retrait est la PREMIÈRE connue, dans les deux sens', () => {
  const a = retirer(base, m.id, T('10:05'));
  const b = retirer(base, m.id, T('10:20'));
  assert.equal(fusionner(a, b)[0].retireLe, T('10:05'));
  assert.equal(fusionner(b, a)[0].retireLe, T('10:05'));
});

test('un moment d\'avant la tranche 4, sans modifieLe, cède devant une version datée', () => {
  const ancien = { ...m, langue: null };
  delete ancien.modifieLe;
  const neuf = preciser(base, m.id, 'cadeaux', T('10:05'));
  assert.equal(fusionner([ancien], neuf)[0].langue, 'cadeaux');
  assert.equal(fusionner(neuf, [ancien])[0].langue, 'cadeaux');
});

test('à égalité d\'heure, le résultat ne dépend pas de l\'ordre', () => {
  const a = preciser(base, m.id, 'paroles', T('10:05'));
  const b = preciser(base, m.id, 'services', T('10:05'));
  memeContenu(fusionner(a, b), fusionner(b, a));
});

test('fusionner deux fois la même chose ne change plus rien', () => {
  const a = preciser(base, m.id, 'paroles', T('10:05'));
  const b = ajouter(retirer(base, m.id, T('10:07')), { maintenant: T('10:08'), auteur: 'tel-b' });
  const une = fusionner(a, b);
  memeContenu(fusionner(une, b), une);
  memeContenu(fusionner(une, a), une);
});

test('des moments distincts des deux téléphones se retrouvent tous', () => {
  const surA = ajouter(base, { maintenant: T('11:00'), auteur: 'tel-a' });
  const surB = ajouter(base, { maintenant: T('11:30'), auteur: 'tel-b' });
  const ab = fusionner(surA, surB);
  assert.equal(ab.length, 3);
  memeContenu(ab, fusionner(surB, surA));
});
