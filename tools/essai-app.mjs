// Le parcours complet de la tranche 1, sur un vrai navigateur.
// Lancer avec le serveur local en marche : node tools/essai-app.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:8105';
const PIXEL = { ...devices['Pixel 9'], viewport: { width: 360, height: 732 } };

const navigateur = await chromium.launch();
let echecs = 0;

const verifier = (nom, condition, details = '') => {
  if (!condition) echecs += 1;
  console.log(`${condition ? 'ok   ' : 'ÉCHEC'} ${nom}${details ? `  ${details}` : ''}`);
};

// Deux défauts à injecter, pour prouver que ce parcours attrape vraiment
// quelque chose : un service worker qui ne s'installe pas, et un rangement qui
// fait semblant d'écrire. Aucun des deux ne se voit à l'écran sur le moment.
const SANS_SW = process.argv.includes('--essai-sans-sw');
const RANGEMENT_MENTEUR = process.argv.includes('--essai-rangement-menteur');

async function ouvrir(options = {}) {
  const contexte = await navigateur.newContext({ ...PIXEL, ...options });
  if (SANS_SW) {
    await contexte.addInitScript(() => {
      Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined });
    });
  }
  if (RANGEMENT_MENTEUR) {
    await contexte.addInitScript(() => {
      const vraiSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { void vraiSetItem; };
    });
  }
  const page = await contexte.newPage();
  const soucis = [];
  page.on('console', (m) => { if (m.type() === 'error') soucis.push(m.text()); });
  page.on('pageerror', (e) => soucis.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { contexte, page, soucis };
}

const chiffre = (page) => page.locator('#chiffre').innerText();

// 1. L'app s'ouvre sans une seule erreur, et part de zéro.
{
  const { contexte, page, soucis } = await ouvrir();
  verifier('aucune erreur au chargement', soucis.length === 0, soucis.join(' | '));
  verifier('le compte part de zéro', (await chiffre(page)) === '0');
  const mesures = await page.evaluate(() => ({
    defile: document.documentElement.scrollHeight > window.innerHeight + 1,
    bas: Math.round(document.querySelector('.plus').getBoundingClientRect().bottom),
    hauteurBouton: Math.round(document.querySelector('.plus').getBoundingClientRect().height),
    ecran: window.innerHeight,
  }));
  verifier('la page ne défile pas', !mesures.defile);
  verifier('le bouton tient dans l\'écran', mesures.bas <= mesures.ecran,
    `${mesures.bas} / ${mesures.ecran}`);
  verifier('le bouton fait au moins 64 px', mesures.hauteurBouton >= 64,
    `${mesures.hauteurBouton} px`);
  await contexte.close();
}

// 2. Un appui compte, deux appuis rapprochés comptent deux, jamais trois.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  verifier('un appui compte un moment', (await chiffre(page)) === '1');
  verifier('le bandeau apparaît', await page.locator('#bandeau').isVisible());

  await page.click('#plus');
  await page.waitForTimeout(100);
  await page.click('#plus');
  verifier('deux appuis rapprochés comptent deux', (await chiffre(page)) === '3',
    `lu : ${await chiffre(page)}`);
  await contexte.close();
}

// 3. Annuler retire le dernier moment, et seulement lui.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  await page.click('#plus');
  await page.click('#annuler');
  verifier('annuler retire le dernier appui', (await chiffre(page)) === '1');
  verifier('le bandeau se referme', !(await page.locator('#bandeau').isVisible()));
  await contexte.close();
}

// 4. Le bandeau s'efface tout seul et n'annule plus rien après.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  await page.waitForTimeout(6300);
  verifier('le bandeau part tout seul', !(await page.locator('#bandeau').isVisible()));
  verifier('le compte est resté', (await chiffre(page)) === '1');
  await contexte.close();
}

// 5. Le compte survit au rechargement.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  await page.click('#plus');
  await page.reload({ waitUntil: 'load' });
  verifier('le compte survit au rechargement', (await chiffre(page)) === '2');
  await contexte.close();
}

// 6. Animations réduites : l'état change quand même, tout de suite.
{
  const { contexte, page } = await ouvrir({ reducedMotion: 'reduce' });
  await page.click('#plus');
  verifier('le compte change sans animation', (await chiffre(page)) === '1');
  await contexte.close();
}

// 7. Données de site bloquées : l'app le DIT, et n'affiche pas un compte faux.
{
  const contexte = await navigateur.newContext(PIXEL);
  await contexte.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('refusé', 'SecurityError'); },
    });
  });
  const page = await contexte.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.click('#plus');
  const souci = page.locator('#souci');
  verifier('le refus d\'écrire se voit', await souci.isVisible(),
    (await souci.innerText()).slice(0, 60));
  verifier('le compte ne ment pas', (await chiffre(page)) === '0',
    `lu : ${await chiffre(page)}`);
  await contexte.close();
}

// 8. Hors ligne, l'app se relance depuis le cache du service worker.
{
  const { contexte, page } = await ouvrir();
  if (!SANS_SW) await page.evaluate(() => navigator.serviceWorker.ready);
  await page.click('#plus');
  await contexte.setOffline(true);
  // Sans service worker, le rechargement hors ligne lève. C'est un échec du
  // parcours, pas une panne de l'outil : on le dit proprement au lieu de
  // laisser une trace de pile.
  let rechargee = true;
  try {
    await page.reload({ waitUntil: 'load' });
  } catch (erreur) {
    rechargee = false;
    verifier('l\'app se recharge hors ligne', false, String(erreur.message).split('\n')[0].slice(0, 60));
  }
  if (rechargee) {
    verifier('l\'app s\'ouvre hors ligne', (await page.locator('#plus').count()) === 1);
    verifier('le compte est là hors ligne', (await chiffre(page)) === '1');
    const police = await page.evaluate(() => document.fonts.check('800 104px "Archivo"'));
    verifier('la police est servie hors ligne', police);
  }
  await contexte.setOffline(false);
  await contexte.close();
}

// 9. L'app reste ouverte pendant que le mois change : les étiquettes doivent
// suivre les valeurs. Sans ça, les comptes d'octobre s'affichent sous « sept ».
{
  const contexte = await navigateur.newContext(PIXEL);
  const page = await contexte.newPage();
  await page.clock.install({ time: new Date('2026-09-30T23:59:30') });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.click('#plus');
  const avant = (await page.locator('#noms').innerText()).replace(/\s+/g, ' ').trim();
  await page.clock.fastForward('01:00');
  await page.click('#plus');
  const apres = (await page.locator('#noms').innerText()).replace(/\s+/g, ' ').trim();
  verifier('les étiquettes suivent le changement de mois', avant !== apres,
    `${avant}  puis  ${apres}`);
  verifier('le dernier mois affiché est le mois en cours',
    apres.endsWith('oct'), apres);
  await contexte.close();
}

await navigateur.close();
console.log(echecs === 0 ? '\nParcours complet : tout est vert.' : `\n${echecs} contrôle(s) en échec.`);
if (echecs > 0) process.exit(1);
