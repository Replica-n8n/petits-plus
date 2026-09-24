// Le partage, sans réseau réel : un faux serveur en mémoire qui applique la
// MÊME règle de fusion que le vrai. Le vrai serveur, lui, est éprouvé à part par
// tools/essai-serveur.mjs, en local puis en production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ajouter, retirer, fusionnerUn } from '../js/moments.js';
import { preciser } from '../js/langages.js';
import { creerPartage, doublonRecent, normaliserCode, CLE_PARTAGE } from '../js/partage.js';

function fauxServeur() {
  const couples = new Map();
  let prochain = 0;
  const etat = { enPanne: false, reponse500: false, retenir: null };
  const repondre = (status, corps) => ({ status, ok: status >= 200 && status < 300, json: async () => corps });
  async function appeler(url, { body }) {
    if (etat.enPanne) throw new TypeError('réseau absent');
    if (etat.reponse500) return repondre(500, {});
    if (etat.retenir) await etat.retenir;
    const corps = JSON.parse(body);
    const chemin = new URL(url).pathname;
    if (chemin === '/couples') {
      const code = `ABCDE${'23456789'[prochain++ % 8]}`;
      couples.set(code, { moments: new Map(), seq: 0, coupe: false });
      return repondre(200, { code });
    }
    const [, , code, action] = chemin.split('/');
    const c = couples.get(code);
    if (!c) return repondre(404, { erreur: 'inconnu' });
    if (c.coupe) return repondre(410, { erreur: 'coupe' });
    if (action === 'couper') {
      c.coupe = true;
      return repondre(200, { moments: [...c.moments.values()].map((x) => x.m) });
    }
    for (const m of corps.moments) {
      const connu = c.moments.get(m.id);
      const fusion = connu ? fusionnerUn(connu.m, m) : m;
      if (connu && JSON.stringify(fusion) === JSON.stringify(connu.m)) continue;
      c.seq += 1;
      c.moments.set(m.id, { m: fusion, seq: c.seq });
    }
    const rendus = [...c.moments.values()].filter((x) => x.seq > corps.depuis).sort((a, b) => a.seq - b.seq);
    return repondre(200, { moments: rendus.map((x) => x.m), curseur: c.seq, encore: false });
  }
  return { appeler, couples, etat };
}

function telephone(serveur, { refuseEcriture = false } = {}) {
  const zone = new Map();
  const stockage = { getItem: (k) => zone.get(k) ?? null, setItem: (k, v) => zone.set(k, v) };
  let moments = [];
  const tel = {
    zone: stockage,
    get moments() { return moments; },
    set moments(m) { moments = m; },
    refuseEcriture,
  };
  tel.partage = creerPartage({
    zone: stockage, serveur: 'https://serveur', appeler: serveur.appeler,
    lireMoments: () => moments,
    ecrireMoments: (liste) => { if (tel.refuseEcriture) throw new Error('refusé'); moments = liste; },
  });
  tel.appuyer = (quand = Date.now()) => {
    moments = ajouter(moments, { maintenant: quand, auteur: tel.partage.appareil });
    tel.partage.noter(moments.at(-1).id);
    return moments.at(-1).id;
  };
  return tel;
}

const vivants = (tel) => tel.moments.filter((m) => !m.supprime).length;

test('un code tapé est remis au propre', () => {
  assert.equal(normaliserCode(' abc de2 '), 'ABCDE2');
  assert.equal(normaliserCode('abc-de2'), 'ABCDE2');
});

test('deux téléphones appairés voient le même compte', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const b = telephone(s);
  a.appuyer(); a.appuyer();
  const { code } = await a.partage.creerCouple();
  b.appuyer();
  assert.equal((await b.partage.rejoindre(code.toLowerCase())).ok, true);
  await a.partage.synchroniser();
  assert.equal(vivants(a), 3);
  assert.equal(vivants(b), 3);
});

test('les moments d\'avant l\'appairage reçoivent l\'appareil de leur téléphone', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  a.moments = ajouter([], { maintenant: Date.now(), auteur: 'moi' });
  await a.partage.creerCouple();
  assert.equal(a.moments[0].auteur, a.partage.appareil);
});

test('un appui hors ligne part au retour du réseau, même après un rechargement', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const b = telephone(s);
  const { code } = await a.partage.creerCouple();
  await b.partage.rejoindre(code);
  s.etat.enPanne = true;
  a.appuyer();
  const r = await a.partage.synchroniser();
  assert.equal(r.passager, true, 'hors ligne, c\'est passager');
  assert.equal(a.partage.etat().enAttente, 1);
  assert.equal(a.partage.etat().coupe, null, 'le réseau absent ne coupe pas le partage');

  // L'app est tuée, puis rouverte : la file est relue depuis le rangement.
  const ranges = a.moments;
  const rouvert = creerPartage({
    zone: a.zone, serveur: 'https://serveur', appeler: s.appeler,
    lireMoments: () => ranges, ecrireMoments: () => {},
  });
  assert.equal(rouvert.etat().enAttente, 1, 'la file survit au rechargement');
  s.etat.enPanne = false;
  await rouvert.synchroniser();
  await b.partage.synchroniser();
  assert.equal(vivants(b), 1);
});

test('une erreur 500 est passagère, elle ne coupe pas le partage', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  await a.partage.creerCouple();
  s.etat.reponse500 = true;
  a.appuyer();
  const r = await a.partage.synchroniser();
  assert.equal(r.passager, true);
  assert.equal(a.partage.etat().coupe, null);
});

test('un moment modifié PENDANT un envoi reste dans la file', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const b = telephone(s);
  const { code } = await a.partage.creerCouple();
  await b.partage.rejoindre(code);
  const id = a.appuyer();

  let relacher;
  s.etat.retenir = new Promise((r) => { relacher = r; });
  const envoi = a.partage.synchroniser();
  // Pendant que l'envoi est en route, on précise le même moment.
  a.moments = preciser(a.moments, id, 'services', Date.now() + 1000);
  a.partage.noter(id);
  s.etat.retenir = null;
  relacher();
  await envoi;
  // La synchro ne s'arrête pas tant que la file n'est pas vide : la version
  // modifiée pendant l'envoi repart dans le même passage.
  assert.equal(a.partage.etat().enAttente, 0, 'tout est parti');
  await b.partage.synchroniser();
  assert.equal(b.moments.find((m) => m.id === id).langue, 'services',
    'la version modifiée pendant l\'envoi est bien arrivée');
});

test('un retrait et un langage arrivent à l\'autre téléphone', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const b = telephone(s);
  const { code } = await a.partage.creerCouple();
  await b.partage.rejoindre(code);
  const x = a.appuyer();
  const y = a.appuyer();
  await a.partage.synchroniser();
  await b.partage.synchroniser();
  b.moments = retirer(b.moments, x, Date.now());
  b.moments = preciser(b.moments, y, 'toucher', Date.now());
  b.partage.noter([x, y]);
  await b.partage.synchroniser();
  await a.partage.synchroniser();
  assert.equal(a.moments.find((m) => m.id === x).supprime, true);
  assert.equal(a.moments.find((m) => m.id === y).langue, 'toucher');
});

test('un code inconnu ne change rien ici', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const r = await a.partage.rejoindre('ZZZZZZ');
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'inconnu');
  assert.equal(a.partage.etat().appaire, false, 'un essai raté ne doit pas appairer');
});

test('un code mal formé est refusé sans rien envoyer', async () => {
  const s = fauxServeur();
  let appels = 0;
  const espion = async (...args) => { appels += 1; return s.appeler(...args); };
  const a = creerPartage({ zone: null, serveur: 'x', appeler: espion, lireMoments: () => [], ecrireMoments: () => {} });
  assert.equal((await a.rejoindre('O0O0O0')).raison, 'format');
  assert.equal(appels, 0);
});

test('changer le code coupe l\'autre téléphone sans rien perdre', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const b = telephone(s);
  const { code } = await a.partage.creerCouple();
  await b.partage.rejoindre(code);
  // B envoie un moment JUSTE avant que A change le code.
  b.appuyer();
  await b.partage.synchroniser();
  const { code: nouveau } = await a.partage.changerCode();
  assert.notEqual(nouveau, code);
  assert.equal(vivants(a), 1, 'le moment de B est rapatrié par la coupure');

  b.appuyer();
  const r = await b.partage.synchroniser();
  assert.equal(r.coupe, 'code-change');
  assert.equal(b.partage.etat().coupe, 'code-change');
  await b.partage.rejoindre(nouveau);
  await a.partage.synchroniser();
  assert.equal(vivants(a), 2, 'le moment noté pendant la coupure arrive avec le nouveau code');
});

test('si le rangement refuse, le curseur n\'avance pas et on recevra de nouveau', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  const b = telephone(s);
  const { code } = await a.partage.creerCouple();
  await b.partage.rejoindre(code);
  a.appuyer();
  await a.partage.synchroniser();
  b.refuseEcriture = true;
  await assert.rejects(() => b.partage.synchroniser());
  b.refuseEcriture = false;
  await b.partage.synchroniser();
  assert.equal(vivants(b), 1);
});

test('le doublon : un moment de l\'autre téléphone dans la demi-heure', () => {
  const t = Date.now();
  const autre = { id: 'x', instant: t - 4 * 60e3, auteur: 'tel-b', supprime: false };
  const loin = { id: 'y', instant: t - 45 * 60e3, auteur: 'tel-b', supprime: false };
  const mien = { id: 'z', instant: t, auteur: 'tel-a', supprime: false };
  const trouve = doublonRecent([loin, autre, mien], mien, { appareil: 'tel-a' });
  assert.equal(trouve.moment.id, 'x');
  assert.equal(Math.round(trouve.ecart / 60e3), 4);
  assert.equal(doublonRecent([mien, { ...mien, id: 'w' }], mien, { appareil: 'tel-a' }), null,
    'mes propres appuis ne sont pas des doublons');
  assert.equal(doublonRecent([{ ...autre, supprime: true }, mien], mien, { appareil: 'tel-a' }), null);
});

test('l\'état du partage est rangé à part, sous sa propre clé', async () => {
  const s = fauxServeur();
  const a = telephone(s);
  await a.partage.creerCouple();
  const range = JSON.parse(a.zone.getItem(CLE_PARTAGE));
  assert.match(range.code, /^[A-Z2-9]{6}$/);
  assert.equal(range.appareil, a.partage.appareil);
});
