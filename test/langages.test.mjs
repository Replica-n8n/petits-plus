// Les langages : posés sur un moment déjà gardé, jamais inventés après coup.
// Tests écrits avant le code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouter, retirer, comptesDuMois } from '../js/moments.js';
import { LANGAGES, estUnLangage, preciser, repartition } from '../js/langages.js';

const instant = (texte) => new Date(texte).getTime();
const FIN = instant('2026-09-20T12:00:00');
const unMoment = (quand, liste = []) => ajouter(liste, { maintenant: instant(quand), auteur: 'moi' });

test('les cinq langages portent les mêmes identifiants que dans a-deux', () => {
  assert.deepEqual(LANGAGES.map((l) => l.id),
    ['paroles', 'moments', 'cadeaux', 'services', 'toucher'],
    'sinon « services » ne veut pas dire la même chose dans les deux apps');
  assert.equal(LANGAGES.find((l) => l.id === 'paroles').nom, 'Paroles valorisantes');
  assert.equal(LANGAGES.find((l) => l.id === 'toucher').court, 'Toucher');
});

test('préciser pose le langage sur le bon moment, et rien que lui', () => {
  let liste = unMoment('2026-09-10T20:00:00');
  liste = unMoment('2026-09-11T20:00:00', liste);
  const apres = preciser(liste, liste[0].id, 'services');
  assert.equal(apres[0].langue, 'services');
  assert.equal(apres[1].langue, null);
});

test('préciser deux fois remplace, ça n\'empile pas', () => {
  const liste = unMoment('2026-09-10T20:00:00');
  const apres = preciser(preciser(liste, liste[0].id, 'services'), liste[0].id, 'paroles');
  assert.equal(apres[0].langue, 'paroles');
  assert.equal(apres.length, 1);
});

test('un langage inconnu est refusé, pas rangé en silence', () => {
  const liste = unMoment('2026-09-10T20:00:00');
  assert.throws(() => preciser(liste, liste[0].id, 'devinettes'), /langage/);
  assert.equal(estUnLangage('services'), true);
  assert.equal(estUnLangage('devinettes'), false);
});

test('préciser un identifiant absent ne change rien et ne lève pas', () => {
  const liste = unMoment('2026-09-10T20:00:00');
  const apres = preciser(liste, 'identifiant-qui-n-existe-pas', 'paroles');
  assert.deepEqual(apres, liste);
});

test('un moment sans langage reste compté dans le mois', () => {
  let liste = unMoment('2026-09-10T20:00:00');
  liste = unMoment('2026-09-11T20:00:00', liste);
  liste = preciser(liste, liste[0].id, 'toucher');
  assert.equal(comptesDuMois(liste, FIN), 2, 'un moment non précisé compte comme les autres');
});

test('la répartition compte par langage, et ignore les non précisés', () => {
  let liste = unMoment('2026-09-01T20:00:00');
  liste = unMoment('2026-09-02T20:00:00', liste);
  liste = unMoment('2026-09-03T20:00:00', liste);
  liste = preciser(liste, liste[0].id, 'services');
  liste = preciser(liste, liste[1].id, 'services');
  liste = preciser(liste, liste[2].id, 'paroles');
  liste = unMoment('2026-09-04T20:00:00', liste); // laissé sans langage

  const r = repartition(liste, { fin: FIN });
  assert.equal(r.precises, 3);
  assert.equal(r.total, 4);
  assert.deepEqual(r.parLangage.find((l) => l.id === 'services'), { id: 'services', compte: 2 });
  assert.deepEqual(r.parLangage.find((l) => l.id === 'cadeaux'), { id: 'cadeaux', compte: 0 });
});

test('un moment retiré ne compte plus dans la répartition', () => {
  let liste = unMoment('2026-09-01T20:00:00');
  liste = preciser(liste, liste[0].id, 'services');
  assert.equal(repartition(liste, { fin: FIN }).precises, 1);
  liste = retirer(liste, liste[0].id, FIN);
  assert.equal(repartition(liste, { fin: FIN }).precises, 0);
});

test('la répartition ne regarde que les douze mois montrés', () => {
  let liste = unMoment('2024-01-05T20:00:00');
  liste = preciser(liste, liste[0].id, 'cadeaux');
  liste = unMoment('2026-09-05T20:00:00', liste);
  liste = preciser(liste, liste[1].id, 'paroles');

  const r = repartition(liste, { fin: FIN });
  assert.equal(r.precises, 1, 'le moment de 2024 est hors des douze mois montrés');
  assert.equal(r.parLangage.find((l) => l.id === 'cadeaux').compte, 0);
});
