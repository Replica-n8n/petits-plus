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

// 19. Le VRAI chemin tactile : sur le téléphone, un appui ne passe pas par la
// souris. Un tap doit compter un moment, pas zéro et pas deux.
{
  const { contexte, page } = await ouvrir();
  const boite = await page.locator('#plus').boundingBox();
  await page.touchscreen.tap(boite.x + boite.width / 2, boite.y + boite.height / 2);
  await page.waitForTimeout(150);
  verifier('un tap au doigt compte exactement un moment', (await chiffre(page)) === '1',
    `lu : ${await chiffre(page)}`);
  await contexte.close();
}

// 20. Le volet ouvert rend le reste de la page inatteignable : sinon la
// tabulation atteint le bouton + derrière lui et compte un moment de plus.
{
  const { contexte, page } = await ouvrir();
  await page.click('#plus');
  await page.locator('#preciser').click();
  const inerte = await page.evaluate(() => document.querySelector('.plus').closest('body') &&
    [...document.body.children].filter((n) => n.id !== 'volet').every((n) => n.inert));
  verifier('le fond est inerte pendant le volet', inerte === true);
  await page.keyboard.press('Escape');
  const rendu = await page.evaluate(() =>
    [...document.body.children].every((n) => !n.inert));
  verifier('le fond redevient atteignable après le volet', rendu === true);
  verifier('préciser reste offert après une fermeture sans choix',
    await page.locator('#preciser').isVisible());
  await contexte.close();
}


// ÉCRAN DE L'ANNÉE. Des moments posés à des dates connues, pour que chaque
// contrôle sache exactement ce qu'il doit trouver.
async function ouvrirAvec(moments) {
  const contexte = await navigateur.newContext(PIXEL);
  await contexte.addInitScript((m) => {
    if (sessionStorage.getItem('seme')) return;
    sessionStorage.setItem('seme', '1');
    localStorage.setItem('pp:moments:v1', JSON.stringify(m));
  }, moments);
  const page = await contexte.newPage();
  const soucis = [];
  page.on('pageerror', (e) => soucis.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  return { contexte, page, soucis };
}
const ilYA = (jours, heure = 12) => {
  const d = new Date(); d.setDate(d.getDate() - jours); d.setHours(heure, 0, 0, 0);
  return Math.min(d.getTime(), Date.now() - 60000);
};
const unMoment = (id, instant, langue = null) => ({ id, instant, auteur: 'moi', langue, supprime: false });
const vivantsRanges = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('pp:moments:v1')).filter((m) => !m.supprime).length);

// 21. Aller à l'année et en revenir, y compris par le retour système.
{
  const { contexte, page, soucis } = await ouvrirAvec([
    unMoment('a', ilYA(40)), unMoment('b', ilYA(2)), unMoment('c', ilYA(0)),
  ]);
  await page.locator('.lien-annee').click();
  verifier("L'année s'ouvre depuis l'accueil", await page.locator('#ecran-annee').isVisible());
  verifier("l'accueil est caché sous l'année", !(await page.locator('#plus').isVisible()));
  const total = await page.locator('.annee-nombre').innerText();
  verifier('le total est celui de la période', total === '3', `lu : ${total}`);
  await page.goBack();
  await page.waitForTimeout(150);
  verifier("le retour système ramène à l'accueil", await page.locator('#plus').isVisible());
  verifier("et l'app n'a pas été quittée", page.url().startsWith(BASE));
  verifier("aucune erreur sur l'écran de l'année", soucis.length === 0, soucis.join(' | '));
  await contexte.close();
}

// 22. Une ligne par mois, et toucher une ligne ouvre son calendrier.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(40)), unMoment('b', ilYA(0))]);
  await page.locator('.lien-annee').click();
  const lignes = await page.locator('.annee-ligne').count();
  verifier('une ligne par mois de la période', lignes >= 2 && lignes <= 3, `${lignes} lignes`);
  const hauteurs = await page.evaluate(() => [...document.querySelectorAll('.annee-ligne')]
    .map((n) => Math.round(n.getBoundingClientRect().height)));
  verifier('chaque ligne se touche à 44 px', hauteurs.every((h) => h >= 44), hauteurs.join(', '));
  await page.locator('.annee-ligne').last().click();
  verifier('toucher une ligne ouvre son mois', await page.locator('.annee-calendrier').isVisible());
  const cases = await page.evaluate(() => [...document.querySelectorAll('button.annee-jour')]
    .map((n) => { const r = n.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
  verifier('les jours touchables font 44 px', cases.every((c) => c >= 43), cases.join(', '));
  await page.goBack();
  await page.waitForTimeout(150);
  verifier("le retour ramène du mois à l'année", await page.locator('.annee-lignes').isVisible());
  await contexte.close();
}

// 23. Un jour vide n'est pas un bouton : rien à promettre.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(0))]);
  await page.locator('.lien-annee').click();
  await page.locator('.annee-ligne').last().click();
  const boutons = await page.locator('button.annee-jour').count();
  verifier('seuls les jours qui ont des moments se touchent', boutons === 1, `${boutons}`);
  await contexte.close();
}

// 24. Le détail d'aujourd'hui : retirer, puis annuler, rend le moment.
{
  const { contexte, page } = await ouvrirAvec([
    unMoment('a', ilYA(0, 8), 'services'), unMoment('b', ilYA(0, 9)),
  ]);
  await page.locator('.lien-annee').click();
  await page.locator('.annee-ligne').last().click();
  await page.locator('button.annee-jour.aujourdhui').click();
  verifier("le volet du jour s'ouvre", await page.locator('#volet-jour').isVisible());
  const lignes = await page.locator('.jour-ligne').count();
  verifier('il montre les deux moments du jour', lignes === 2, `${lignes}`);
  verifier('le langage est écrit en toutes lettres',
    (await page.locator('.jour-langue').first().innerText()) === 'Services rendus');
  await page.locator('.jour-retirer').first().click();
  verifier("retirer l'enlève tout de suite de l'écran", (await page.locator('.jour-ligne').count()) === 1);
  const encore = await vivantsRanges(page);
  verifier("rien n'est écrit pendant la fenêtre d'annulation", encore === 2, `${encore}`);
  await page.locator('#annuler').click();
  verifier('annuler le rend', (await page.locator('.jour-ligne').count()) === 2);
  await contexte.close();
}

// 25. Retirer sans annuler : écrit pour de bon, et l'accueil suit.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(0, 8)), unMoment('b', ilYA(0, 9))]);
  await page.locator('.lien-annee').click();
  await page.locator('.annee-ligne').last().click();
  await page.locator('button.annee-jour.aujourdhui').click();
  await page.locator('.jour-retirer').first().click();
  await page.waitForTimeout(6400);
  const restants = await vivantsRanges(page);
  verifier('le retrait est écrit à la fin de la fenêtre', restants === 1, `${restants}`);
  const lignes = await page.evaluate(() => JSON.parse(localStorage.getItem('pp:moments:v1')).length);
  verifier('la ligne reste, marquée, jamais effacée', lignes === 2, `${lignes}`);
  await page.goBack(); await page.goBack(); await page.goBack();
  await page.waitForTimeout(200);
  verifier("l'accueil compte un moment de moins", (await chiffre(page)) === '1', `lu : ${await chiffre(page)}`);
  await contexte.close();
}

// 26. Quitter l'app pendant la fenêtre : le geste voulu était de retirer.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(0, 8)), unMoment('b', ilYA(0, 9))]);
  await page.locator('.lien-annee').click();
  await page.locator('.annee-ligne').last().click();
  await page.locator('button.annee-jour.aujourdhui').click();
  await page.locator('.jour-retirer').first().click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const restants = await vivantsRanges(page);
  verifier("quitter l'app pendant la fenêtre écrit le retrait", restants === 1, `${restants}`);
  await contexte.close();
}

// 27. Un moment d'hier ne se retire pas.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(1)), unMoment('b', ilYA(0))]);
  await page.locator('.lien-annee').click();
  await page.locator('.annee-ligne').last().click();
  const hier = page.locator('button.annee-jour:not(.aujourdhui)');
  if (await hier.count()) {
    await hier.first().click();
    verifier("un moment d'hier n'offre pas « Retirer »", (await page.locator('.jour-retirer').count()) === 0);
  } else {
    verifier("hier est dans le mois précédent : couvert par les tests du modèle", true);
  }
  await contexte.close();
}

// 28. La répartition n'apparaît qu'au-dessus du seuil.
{
  const peu = Array.from({ length: 12 }, (_, i) => unMoment(`p${i}`, ilYA(i), i < 4 ? 'paroles' : null));
  const assez = Array.from({ length: 12 }, (_, i) => unMoment(`q${i}`, ilYA(i), i < 10 ? 'services' : null));
  let { contexte, page } = await ouvrirAvec(peu);
  await page.locator('.lien-annee').click();
  verifier('sous le seuil, pas de répartition', (await page.locator('.annee-rep').count()) === 0);
  await contexte.close();
  ({ contexte, page } = await ouvrirAvec(assez));
  await page.locator('.lien-annee').click();
  verifier('au-dessus du seuil, la répartition apparaît', await page.locator('.annee-rep').isVisible());
  const premier = await page.locator('.annee-langue').first().innerText();
  verifier('le langage le plus fréquent vient en premier', premier === 'Services rendus', premier);
  await contexte.close();
}


// 29. Un double appui n'empile pas deux écrans : un seul retour suffit.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(40)), unMoment('b', ilYA(0))]);
  await page.locator('.lien-annee').dblclick();
  await page.waitForTimeout(150);
  await page.locator('.annee-ligne').last().dblclick();
  await page.waitForTimeout(150);
  await page.goBack();
  await page.waitForTimeout(150);
  verifier("un double appui sur une ligne ne coûte qu'un retour", await page.locator('.annee-lignes').isVisible());
  await page.goBack();
  await page.waitForTimeout(150);
  verifier("un double appui sur « L'année » ne coûte qu'un retour", await page.locator('#plus').isVisible());
  await contexte.close();
}

// 30. Recharger sur l'écran de l'année le rouvre, au lieu de montrer l'accueil.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(40)), unMoment('b', ilYA(0))]);
  await page.locator('.lien-annee').click();
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
  verifier("recharger sur l'année rouvre l'année", await page.locator('.annee-lignes').isVisible());
  await page.goBack();
  await page.waitForTimeout(150);
  verifier("et le premier retour ramène bien à l'accueil", await page.locator('#plus').isVisible());
  await contexte.close();
}

// 31. Le volet d'un jour sans bouton prend le focus lui-même.
{
  const { contexte, page } = await ouvrirAvec([unMoment('a', ilYA(1)), unMoment('b', ilYA(0))]);
  await page.locator('.lien-annee').click();
  await page.locator('.annee-ligne').last().click();
  const hier = page.locator('button.annee-jour:not(.aujourdhui)');
  if (await hier.count()) {
    await hier.first().click();
    const focus = await page.evaluate(() => document.activeElement?.closest('#volet-jour') !== null);
    verifier("le focus entre dans le volet d'un jour passé", focus);
  } else {
    verifier("hier est dans le mois précédent : contrôle sans objet aujourd'hui", true);
  }
  await contexte.close();
}

await navigateur.close();
console.log(echecs === 0 ? '\nParcours complet : tout est vert.' : `\n${echecs} contrôle(s) en échec.`);
if (echecs > 0) process.exit(1);
