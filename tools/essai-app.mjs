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
  verifier("le bouton tient dans l\'écran", mesures.bas <= mesures.ecran,
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
  verifier("le refus d\'écrire se voit", await souci.isVisible(),
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
    verifier("l\'app se recharge hors ligne", false, String(erreur.message).split('\n')[0].slice(0, 60));
  }
  if (rechargee) {
    verifier("l\'app s\'ouvre hors ligne", (await page.locator('#plus').count()) === 1);
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

// 10. Un premier mois d'usage ne montre AUCUNE colonne à zéro devant lui.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  const colonnes = await page.locator('#colonnes i').count();
  const visible = await page.locator('#colonnes').isVisible();
  verifier('le premier mois ne montre pas cinq colonnes vides',
    !visible || colonnes <= 1, `${colonnes} colonne(s), visible : ${visible}`);
  await contexte.close();
}

// 11. Deux mois d'usage : deux colonnes, et rien avant le premier moment.
{
  const contexte = await navigateur.newContext(PIXEL);
  await contexte.addInitScript(() => {
    const d = new Date();
    const moisDernier = new Date(d.getFullYear(), d.getMonth() - 1, 15, 20, 0);
    localStorage.setItem('pp:moments:v1', JSON.stringify([
      { id: 'a', instant: moisDernier.getTime(), auteur: 'elle', langue: null, supprime: false },
      { id: 'b', instant: Date.now(), auteur: 'moi', langue: null, supprime: false },
    ]));
  });
  const page = await contexte.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const colonnes = await page.locator('#colonnes i').count();
  verifier("deux mois d\'usage donnent deux colonnes", colonnes === 2, `${colonnes}`);
  await contexte.close();
}

// 12. La médiane : posée sur la même échelle que les barres, et absente tant
// qu'il n'y a pas deux mois finis.
{
  const contexte = await navigateur.newContext(PIXEL);
  await contexte.addInitScript(() => {
    const d = new Date();
    const moments = [];
    // Quatre mois finis à 4, 8, 10 et 20, puis le mois en cours à 1.
    [[4, 4], [3, 8], [2, 10], [1, 20], [0, 1]].forEach(([recul, combien]) => {
      for (let i = 0; i < combien; i += 1) {
        const q = new Date(d.getFullYear(), d.getMonth() - recul, 1 + i, 20, 0);
        moments.push({ id: `m-${recul}-${i}`, instant: q.getTime(), auteur: 'moi', langue: null, supprime: false });
      }
    });
    localStorage.setItem('pp:moments:v1', JSON.stringify(moments));
  });
  const page = await contexte.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(300);

  const lu = await page.locator('#mediane-valeur').innerText();
  verifier('la médiane ignore le mois en cours', lu === '9', `lue : ${lu}`);

  const place = await page.evaluate(() => {
    const zone = document.querySelector('#colonnes').getBoundingClientRect();
    const ligne = document.querySelector('#mediane').getBoundingClientRect();
    const plusHaute = [...document.querySelectorAll('#colonnes i')]
      .map((b) => b.getBoundingClientRect().height).sort((a, b) => b - a)[0];
    return { part: (zone.bottom - ligne.top) / zone.height, plusHaute, hauteurZone: zone.height };
  });
  // 9 sur un sommet de 20, c'est 45 % de la hauteur.
  verifier('la ligne est posée sur la même échelle que les barres',
    Math.abs(place.part - 0.45) < 0.02, `${(place.part * 100).toFixed(1)} %`);
  await contexte.close();
}

// 13. Un seul mois fini : pas de ligne, parce qu'une médiane de un n'existe pas.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  verifier('aucune médiane au premier mois', !(await page.locator('#mediane').isVisible()));
  await contexte.close();
}

// 14. L'appui long ouvre les cinq langages, sans jamais compter deux fois.
{
  const { contexte, page } = await ouvrir();
  const bouton = page.locator('#plus');
  const boite = await bouton.boundingBox();
  await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  verifier("l'appui long ouvre le volet", await page.locator('#volet').isVisible());
  verifier("l'appui long a gardé le moment", (await chiffre(page)) === '1');
  await page.mouse.up();
  await page.waitForTimeout(100);
  verifier('relâcher après un appui long ne compte pas un deuxième moment',
    (await chiffre(page)) === '1', `lu : ${await chiffre(page)}`);
  verifier('le volet reste ouvert après le relâchement',
    await page.locator('#volet').isVisible());

  const cibles = await page.evaluate(() => [...document.querySelectorAll('.langue')]
    .map((n) => Math.round(n.getBoundingClientRect().height)));
  verifier('les cinq langages font 48 px', cibles.length === 5 && cibles.every((h) => h >= 48),
    cibles.join(', '));

  await page.locator('.langue[data-id="services"]').click();
  verifier('le volet se ferme sur un choix', !(await page.locator('#volet').isVisible()));
  const range = await page.evaluate(() => JSON.parse(localStorage.getItem('pp:moments:v1'))[0].langue);
  verifier('le langage est rangé sur le moment', range === 'services', String(range));
  verifier('le bandeau nomme le langage choisi',
    (await page.locator('#bandeau-texte').innerText()).includes('Services'));
  await contexte.close();
}

// 15. Fermer le volet sans choisir ne perd rien, et « Annuler » marche encore.
{
  const { contexte, page } = await ouvrir();
  const boite = await page.locator('#plus').boundingBox();
  await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  verifier('Échap ferme le volet', !(await page.locator('#volet').isVisible()));
  verifier('le moment est resté gardé sans langage', (await chiffre(page)) === '1');
  const langue = await page.evaluate(() => JSON.parse(localStorage.getItem('pp:moments:v1'))[0].langue);
  verifier("il n'a aucun langage", langue === null, String(langue));

  await page.locator('#annuler').click();
  verifier('Annuler marche encore après le volet', (await chiffre(page)) === '0',
    `lu : ${await chiffre(page)}`);
  await contexte.close();
}

// 16. « préciser » dans le bandeau : c'est lui qui rend l'appui long visible.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  verifier('le bandeau propose préciser', await page.locator('#preciser').isVisible());
  await page.locator('#preciser').click();
  verifier('préciser ouvre le volet', await page.locator('#volet').isVisible());
  await page.locator('.langue[data-id="paroles"]').click();
  const langue = await page.evaluate(() => JSON.parse(localStorage.getItem('pp:moments:v1'))[0].langue);
  verifier('préciser pose le langage sur le dernier moment', langue === 'paroles', String(langue));
  await contexte.close();
}

// 17. Renoncer en glissant hors du bouton ne compte aucun moment.
{
  const { contexte, page } = await ouvrir();
  const boite = await page.locator('#plus').boundingBox();
  await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
  await page.mouse.down();
  await page.mouse.move(boite.x + boite.width / 2, boite.y - 80);
  await page.mouse.up();
  await page.waitForTimeout(100);
  verifier('glisser hors du bouton ne compte rien', (await chiffre(page)) === '0',
    `lu : ${await chiffre(page)}`);
  await contexte.close();
}

// 18. Le clavier compte exactement un moment, pas zéro et pas deux.
{
  const { contexte, page } = await ouvrir();
  await page.locator('#plus').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  verifier('la touche Entrée compte un moment', (await chiffre(page)) === '1',
    `lu : ${await chiffre(page)}`);
  await contexte.close();
}

await navigateur.close();
console.log(echecs === 0 ? '\nParcours complet : tout est vert.' : `\n${echecs} contrôle(s) en échec.`);
if (echecs > 0) process.exit(1);
