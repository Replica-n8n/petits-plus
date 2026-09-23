// Le stockage doit dire la vérité : une écriture refusée se voit, un contenu
// abîmé ne fait pas disparaître l'app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { creerStockage, ErreurStockage } from '../js/stockage.js';

// Une zone de rangement à la manière de localStorage, que l'on peut casser.
function zoneFausse({ refuseEcriture = false, contenu = null } = {}) {
  const donnees = new Map(contenu ? Object.entries(contenu) : []);
  return {
    getItem: (cle) => (donnees.has(cle) ? donnees.get(cle) : null),
    setItem: (cle, valeur) => {
      if (refuseEcriture) {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
      donnees.set(cle, valeur);
    },
    removeItem: (cle) => donnees.delete(cle),
  };
}

test('ce qui est écrit se relit tel quel', () => {
  const s = creerStockage(zoneFausse());
  s.ecrireMoments([{ id: 'a', instant: 10, auteur: 'moi', langue: null, supprime: false }]);
  assert.deepEqual(s.lireMoments(), [
    { id: 'a', instant: 10, auteur: 'moi', langue: null, supprime: false },
  ]);
});

test('une zone vide rend une liste vide, pas une erreur', () => {
  assert.deepEqual(creerStockage(zoneFausse()).lireMoments(), []);
});

test('une écriture refusée LÈVE, elle ne fait pas semblant', () => {
  const s = creerStockage(zoneFausse({ refuseEcriture: true }));
  assert.throws(
    () => s.ecrireMoments([{ id: 'a', instant: 10, auteur: 'moi', langue: null, supprime: false }]),
    ErreurStockage,
    'sans ça, l\'app annonce un moment gardé qui n\'existe pas',
  );
});

test('un contenu abîmé ne fait pas planter l\'app et se signale', () => {
  const s = creerStockage(zoneFausse({ contenu: { 'pp:moments:v1': '{ pas du json' } }));
  const abimes = [];
  s.surContenuAbime((raison) => abimes.push(raison));
  assert.deepEqual(s.lireMoments(), []);
  assert.equal(abimes.length, 1);
});

test('un contenu qui n\'est pas une liste est traité comme abîmé', () => {
  const s = creerStockage(zoneFausse({ contenu: { 'pp:moments:v1': '{"moments":3}' } }));
  assert.deepEqual(s.lireMoments(), []);
});

test('une zone absente, comme dans un navigateur qui bloque tout, ne casse rien à la lecture', () => {
  const s = creerStockage(null);
  assert.deepEqual(s.lireMoments(), []);
  assert.throws(() => s.ecrireMoments([]), ErreurStockage);
});
