// L'écran de l'année : les jours, et ce qu'on a le droit d'y retirer.
// Tests écrits avant le code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouter, retirer } from '../js/moments.js';
import { cleDuJour, comptesParJour, momentsDuJour, peutRetirer, totalDeLaPeriode } from '../js/jours.js';

const instant = (texte) => new Date(texte).getTime();
const MAINTENANT = instant('2026-09-24T21:00:00');
const garde = (quand, liste = []) => ajouter(liste, { maintenant: instant(quand), auteur: 'moi' });

test('minuit sépare deux jours, dans le fuseau du téléphone', () => {
  assert.equal(cleDuJour(instant('2026-09-23T23:59:00')), '2026-09-23');
  assert.equal(cleDuJour(instant('2026-09-24T00:01:00')), '2026-09-24');
});

test('les comptes par jour additionnent les moments du même jour', () => {
  let liste = garde('2026-09-24T08:00:00');
  liste = garde('2026-09-24T20:00:00', liste);
  liste = garde('2026-09-22T12:00:00', liste);
  const jours = comptesParJour(liste);
  assert.equal(jours.get('2026-09-24'), 2);
  assert.equal(jours.get('2026-09-22'), 1);
  assert.equal(jours.get('2026-09-23'), undefined, 'un jour sans rien n\'a pas d\'entrée');
});

test('un moment retiré ne compte pas dans son jour', () => {
  let liste = garde('2026-09-24T08:00:00');
  liste = garde('2026-09-24T20:00:00', liste);
  liste = retirer(liste, liste[0].id, MAINTENANT);
  assert.equal(comptesParJour(liste).get('2026-09-24'), 1);
});

test('les moments d\'un jour sont rendus dans l\'ordre de la journée, sans les retirés', () => {
  let liste = garde('2026-09-24T20:00:00');
  liste = garde('2026-09-24T08:00:00', liste);
  liste = garde('2026-09-24T12:00:00', liste);
  liste = retirer(liste, liste[2].id, MAINTENANT);
  const jour = momentsDuJour(liste, '2026-09-24');
  assert.deepEqual(jour.map((m) => new Date(m.instant).getHours()), [8, 20]);
});

test('on ne retire que les moments d\'aujourd\'hui', () => {
  const aujourdhui = garde('2026-09-24T08:00:00')[0];
  const hier = garde('2026-09-23T23:30:00')[0];
  assert.equal(peutRetirer(aujourdhui, MAINTENANT), true);
  assert.equal(peutRetirer(hier, MAINTENANT), false,
    'au-delà du jour même, retirer reviendrait à réécrire le passé');
});

test('un moment déjà retiré ne se retire pas une seconde fois', () => {
  let liste = garde('2026-09-24T08:00:00');
  liste = retirer(liste, liste[0].id, MAINTENANT);
  assert.equal(peutRetirer(liste[0], MAINTENANT), false);
});

test('le total de la période est celui des mois du graphe, pas un autre', () => {
  let liste = garde('2024-02-10T12:00:00'); // hors des douze mois
  liste = garde('2026-01-10T12:00:00', liste);
  liste = garde('2026-09-10T12:00:00', liste);
  liste = garde('2026-09-11T12:00:00', liste);
  assert.equal(totalDeLaPeriode(liste, { fin: MAINTENANT, maximum: 12 }), 3,
    'le moment de 2024 est hors de la période montrée par le graphe');
});
