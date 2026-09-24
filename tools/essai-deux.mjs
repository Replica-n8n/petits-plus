// Deux téléphones, deux navigateurs indépendants, un seul couple.
// Local (serveur de l'app + wrangler dev) : node tools/essai-deux.mjs
// Contre le VRAI Worker, depuis l'app en production :
//   BASE=https://replica-n8n.github.io/petits-plus node tools/essai-deux.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:8105';
const PIXEL = { ...devices['Pixel 9'], viewport: { width: 360, height: 732 } };

let echecs = 0;
const verifier = (nom, va, details = '') => {
  if (!va) echecs += 1;
  console.log(`${va ? 'ok   ' : 'ÉCHEC'} ${nom}${details ? `  ${details}` : ''}`);
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const navigateur = await chromium.launch();
async function telephone(nom) {
  const contexte = await navigateur.newContext(PIXEL);
  const page = await contexte.newPage();
  const soucis = [];
  page.on('pageerror', (e) => soucis.push(`${nom} : ${e.message}`));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { nom, contexte, page, soucis };
}
const chiffre = (t) => t.page.locator('#chiffre').innerText();
// Le retour sur l'app déclenche une synchro, comme sur le vrai téléphone.
async function revenirSurLApp(t) {
  await t.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}
async function attendreQue(t, condition, delai = 8000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    if (await condition()) return true;
    await revenirSurLApp(t);
    await attendre(400);
  }
  return false;
}
async function ouvrirReglages(t) {
  await t.page.locator('.ouvrir-reglages').click();
  await t.page.waitForTimeout(200);
}
async function fermerReglages(t) {
  await t.page.locator('.reglages-fermer').click();
  await t.page.waitForTimeout(200);
}
const appuyer = async (t) => { await t.page.click('#plus'); await t.page.waitForTimeout(100); };

const a = await telephone('A');
const b = await telephone('B');

// 1. A crée le code, B le tape, mal écrit exprès.
await ouvrirReglages(a);
await a.page.getByRole('button', { name: 'Créer un code de couple' }).click();
await a.page.waitForSelector('.reglages-code', { timeout: 10000 });
const code = await a.page.locator('.reglages-code').innerText();
verifier('A obtient un code de couple', /^[A-Z2-9]{6}$/.test(code), code);
await fermerReglages(a);

await ouvrirReglages(b);
await b.page.getByRole('button', { name: "J'ai déjà un code" }).click();
await b.page.locator('.reglages-champ').fill(` ${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()} `);
await b.page.getByRole('button', { name: 'Rejoindre' }).click();
const appaire = await b.page.waitForSelector('.reglages-code', { timeout: 10000 }).then(() => true).catch(() => false);
verifier('B rejoint avec le code tapé en minuscules et avec des espaces', appaire);
verifier('B affiche le même code', (await b.page.locator('.reglages-code').innerText()) === code);
await fermerReglages(b);

// 2. Un appui sur A arrive sur B.
await appuyer(a);
verifier('A compte son appui', (await chiffre(a)) === '1');
verifier("l'appui de A arrive sur B", await attendreQue(b, async () => (await chiffre(b)) === '1'),
  `B lit ${await chiffre(b)}`);

// 3. Hors ligne : A appuie, rien ne se perd, tout part au retour du réseau.
await a.contexte.setOffline(true);
await appuyer(a);
await attendre(1500);
verifier('hors ligne, A compte quand même', (await chiffre(a)) === '2');
verifier("hors ligne, rien n'est coupé", !(await a.page.locator('.alerte-partage').isVisible()));
await a.contexte.setOffline(false);
await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
verifier("l'appui fait hors ligne arrive sur B au retour du réseau",
  await attendreQue(b, async () => (await chiffre(b)) === '2'), `B lit ${await chiffre(b)}`);

// 4. Annuler sur A retire aussi sur B.
await appuyer(a);
await a.page.locator('#annuler').click();
await attendre(1200);
await revenirSurLApp(a);
await attendre(800);
verifier('A annule son troisième appui', (await chiffre(a)) === '2');
verifier('B ne garde pas un appui annulé sur A',
  await attendreQue(b, async () => (await chiffre(b)) === '2'), `B lit ${await chiffre(b)}`);

// 5. Un langage précisé sur B arrive sur A.
await appuyer(b);
await b.page.locator('#preciser').click();
await b.page.locator('.langue[data-id="services"]').click();
const surA = await attendreQue(a, async () => a.page.evaluate(() =>
  JSON.parse(localStorage.getItem('pp:moments:v1')).some((m) => m.langue === 'services')));
verifier('le langage précisé sur B arrive sur A', surA);

// 6. Le même compliment noté sur les deux téléphones.
await attendreQue(a, async () => (await chiffre(a)) === '3');
await appuyer(a);
const texte = await a.page.locator('#bandeau-texte').innerText();
verifier("A voit que l'autre téléphone a déjà noté", texte.startsWith("Déjà noté sur l'autre téléphone"), texte);
const libelle = await a.page.locator('#annuler').innerText();
verifier('et peut dire que c\'est le même', libelle === "C'est le même", libelle);
await a.page.locator('#annuler').click();
verifier("« C'est le même » retire l'appui de A", (await chiffre(a)) === '3', `A lit ${await chiffre(a)}`);

// 7. Changer le code coupe B, qui le voit, et revient avec le nouveau.
await ouvrirReglages(a);
await a.page.getByRole('button', { name: 'Changer le code' }).click();
await a.page.getByRole('button', { name: 'Toucher encore pour changer' }).click();
await a.page.waitForFunction((ancien) => {
  const n = document.querySelector('.reglages-code');
  return n && n.textContent !== ancien;
}, code, { timeout: 10000 });
const nouveau = await a.page.locator('.reglages-code').innerText();
verifier('A obtient un nouveau code', nouveau !== code && /^[A-Z2-9]{6}$/.test(nouveau), nouveau);
await fermerReglages(a);

const coupe = await attendreQue(b, async () => b.page.locator('.alerte-partage').isVisible());
verifier("B voit que le partage est coupé", coupe);
await b.page.locator('.alerte-partage').click();
await b.page.waitForTimeout(200);
await b.page.locator('.reglages-champ').fill(nouveau);
await b.page.getByRole('button', { name: 'Rejoindre' }).click();
await b.page.waitForSelector('.reglages-code', { timeout: 10000 });
await fermerReglages(b);
verifier("l'alerte disparaît une fois le nouveau code tapé", !(await b.page.locator('.alerte-partage').isVisible()));
await appuyer(b);
verifier('les deux téléphones se retrouvent sur le nouveau code',
  await attendreQue(a, async () => (await chiffre(a)) === (await chiffre(b))), `A ${await chiffre(a)}, B ${await chiffre(b)}`);

// 8. L'appairage survit au rechargement.
await a.page.reload({ waitUntil: 'load' });
await ouvrirReglages(a);
verifier("l'appairage survit au rechargement", (await a.page.locator('.reglages-code').innerText()) === nouveau);

// 9. Langages éteints : l'appui long redevient un appui, et préciser disparaît.
await a.page.getByRole('radio', { name: 'Ne pas les proposer' }).click();
await fermerReglages(a);
const avant = Number(await chiffre(a));
const boite = await a.page.locator('#plus').boundingBox();
await a.page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
await a.page.mouse.down();
await a.page.waitForTimeout(700);
verifier("langages éteints : l'appui long n'ouvre pas le volet", !(await a.page.locator('#volet').isVisible()));
await a.page.mouse.up();
await a.page.waitForTimeout(150);
verifier("et il compte comme un appui", Number(await chiffre(a)) === avant + 1);
verifier('préciser a disparu du bandeau', !(await a.page.locator('#preciser').isVisible()));

const soucis = [...a.soucis, ...b.soucis];
verifier('aucune erreur sur les deux téléphones', soucis.length === 0, soucis.join(' | '));

await navigateur.close();
console.log(echecs === 0 ? '\nDeux téléphones : tout est vert.' : `\n${echecs} contrôle(s) en échec.`);
if (echecs > 0) process.exit(1);
