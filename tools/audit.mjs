// Audit de Petits plus. Les contrastes sont mesurés sur les PIXELS d'une
// capture, pas sur les couleurs déclarées : c'est la seule mesure qui tienne
// compte de ce que le navigateur a vraiment peint.
// Lancer : node tools/audit.mjs   (défauts : --essai-cible, --essai-couleur)
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8105';
const PIXEL = { ...devices['Pixel 9'], viewport: { width: 360, height: 732 } };

let echecs = 0;
const verifier = (nom, va, details = '') => {
  if (!va) echecs += 1;
  console.log(`${va ? 'ok   ' : 'ÉCHEC'} ${nom}${details ? `  ${details}` : ''}`);
};

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * canal(r / 255) + 0.7152 * canal(g / 255) + 0.0722 * canal(b / 255);
const rapport = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext(PIXEL);
const page = await contexte.newPage();

await contexte.addInitScript(() => {
  const moments = [];
  const aujourdhui = new Date();
  [6, 9, 5, 11, 9, 14].forEach((combien, rang) => {
    for (let i = 0; i < combien; i += 1) {
      const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - (5 - rang), 1 + i, 20, 0);
      moments.push({ id: `audit-${rang}-${i}`, instant: d.getTime(), auteur: 'moi', langue: null, supprime: false });
    }
  });
  localStorage.setItem('pp:moments:v1', JSON.stringify(moments));
});

await page.goto(BASE + '/', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

if (process.argv.includes('--essai-cible')) {
  await page.addStyleTag({ content: '.plus { height: 30px } .annuler { min-height: 20px }' });
}
if (process.argv.includes('--essai-couleur')) {
  await page.addStyleTag({ content: '.valeurs span.en-cours { color: #4a4646 }' });
}
await page.waitForTimeout(250);

// 1. Les contrastes, mesurés sur la capture.
const capture = (await page.screenshot()).toString('base64');
const zones = await page.evaluate(() => {
  const r = (sel) => {
    const b = document.querySelector(sel).getBoundingClientRect();
    return { x: b.x, y: b.y, l: b.width, h: b.height };
  };
  return {
    chiffre: r('#chiffre'),
    bouton: r('#plus'),
    valeurEnCours: r('.valeurs span.en-cours'),
    nomDeMois: r('.noms span'),
  };
});

const analyserPixels = async ({ capture, zones, echelle }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${capture}`;
  await image.decode();
  const toile = document.createElement('canvas');
  toile.width = image.width; toile.height = image.height;
  toile.getContext('2d').drawImage(image, 0, 0);
  const ctx = toile.getContext('2d');

  // Dans une zone, la couleur la plus fréquente est le fond, et l'encre est la
  // couleur fréquente la plus éloignée : on ne suppose ni l'une ni l'autre.
  const analyser = (zone) => {
    const d = ctx.getImageData(
      Math.round(zone.x * echelle), Math.round(zone.y * echelle),
      Math.max(1, Math.round(zone.l * echelle)), Math.max(1, Math.round(zone.h * echelle)),
    ).data;
    const comptes = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const cle = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
    }
    const tries = [...comptes.entries()].sort((a, b) => b[1] - a[1]);
    const fond = tries[0][0].split(',').map(Number);
    const assezPresentes = tries.filter(([, n]) => n > d.length / 4 / 200);
    const distance = (c) => {
      const p = c.split(',').map(Number);
      return Math.abs(p[0] - fond[0]) + Math.abs(p[1] - fond[1]) + Math.abs(p[2] - fond[2]);
    };
    const encre = assezPresentes.map(([c]) => c).sort((a, b) => distance(b) - distance(a))[0];
    return { fond, encre: encre.split(',').map(Number) };
  };

  return Object.fromEntries(Object.entries(zones).map(([nom, zone]) => [nom, analyser(zone)]));
};

const mesures = await page.evaluate(analyserPixels,
  { capture, zones, echelle: PIXEL.deviceScaleFactor ?? 1 });

const SEUILS = {
  chiffre: ['le gros chiffre sur son fond', 3],
  bouton: ['le signe du bouton sur le bouton', 4.5],
  valeurEnCours: ['le compte du mois en cours', 4.5],
  nomDeMois: ['le nom d\'un mois', 4.5],
};
for (const [cle, [nom, seuil]] of Object.entries(SEUILS)) {
  const { fond, encre } = mesures[cle];
  const r = rapport(encre, fond);
  verifier(`${nom} tient ${seuil}:1`, r >= seuil,
    `mesuré ${r.toFixed(2)}:1 sur les pixels`);
}

// 2. Les cibles, une fois le bandeau ouvert : 44 px au minimum, 8 px entre deux d'entre elles.
await page.click('#plus'); // pour que le bandeau et son « Annuler » existent
await page.waitForTimeout(250);

const cibles = await page.evaluate(() => [...document.querySelectorAll('button, a[href]')]
  .filter((n) => n.offsetParent !== null)
  .map((n) => {
    const r = n.getBoundingClientRect();
    return { nom: n.id || n.className || n.tagName, l: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.x), y: Math.round(r.y) };
  }));

for (const c of cibles) {
  verifier(`cible « ${c.nom} » d'au moins 44 px`, c.h >= 44 && c.l >= 44, `${c.l} × ${c.h}`);
}
for (let i = 0; i < cibles.length; i += 1) {
  for (let j = i + 1; j < cibles.length; j += 1) {
    const a = cibles[i]; const b = cibles[j];
    const ecartY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
    const ecartX = Math.max(a.x - (b.x + b.l), b.x - (a.x + a.l));
    const separees = Math.max(ecartX, ecartY) >= 8;
    verifier(`8 px entre « ${a.nom} » et « ${b.nom} »`, separees,
      `${Math.round(Math.max(ecartX, ecartY))} px`);
  }
}

// Le bandeau a le droit de passer devant les petites étiquettes du bas, jamais
// devant le chiffre : c'est lui qui vient de changer, et le cacher priverait
// l'appui de sa réponse.
const recouvrement = await page.evaluate(() => {
  const b = document.querySelector('#bandeau').getBoundingClientRect();
  const c = document.querySelector('#chiffre').getBoundingClientRect();
  const croise = !(b.bottom < c.top || b.top > c.bottom || b.right < c.left || b.left > c.right);
  return { croise, hautBandeau: Math.round(b.top), basChiffre: Math.round(c.bottom) };
});
verifier('le bandeau ne cache pas le chiffre', !recouvrement.croise,
  `bandeau à ${recouvrement.hautBandeau}, chiffre jusqu'à ${recouvrement.basChiffre}`);

// Le volet des langages : ses cibles et son texte se mesurent aussi, sur les
// pixels, parce qu'il est posé sur un fond plus clair que le reste.
await page.evaluate(() => document.querySelector('#preciser').click());
await page.waitForTimeout(300);
const captureVolet = (await page.screenshot()).toString('base64');
const zonesVolet = await page.evaluate(() => {
  const n = document.querySelector('.langue');
  const b = n.getBoundingClientRect();
  return { langue: { x: b.x, y: b.y, l: b.width, h: b.height } };
});
const mesuresVolet = await page.evaluate(analyserPixels,
  { capture: captureVolet, zones: zonesVolet, echelle: PIXEL.deviceScaleFactor ?? 1 });
{
  const { fond, encre } = mesuresVolet.langue;
  const r = rapport(encre, fond);
  verifier("le nom d'un langage tient 4,5:1", r >= 4.5, `mesuré ${r.toFixed(2)}:1 sur les pixels`);
}
const ecartsVolet = await page.evaluate(() => {
  const boites = [...document.querySelectorAll('.langue')].map((n) => n.getBoundingClientRect());
  return boites.slice(1).map((b, i) => Math.round(b.top - boites[i].bottom));
});
verifier('8 px entre deux langages', ecartsVolet.every((e) => e >= 8), ecartsVolet.join(', '));

// 3. La couleur du thème ne doit pas diverger de la palette générée.
const couleurs = readFileSync('css/couleurs.css', 'utf8');
const fondGenere = couleurs.slice(couleurs.indexOf('--fond:') + 7, couleurs.indexOf(';', couleurs.indexOf('--fond:'))).trim();
const html = readFileSync('index.html', 'utf8');
const manifeste = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
verifier('le theme-color de la page suit la palette', html.includes(`content="${fondGenere}"`), fondGenere);
verifier('les couleurs du manifeste suivent la palette',
  manifeste.theme_color === fondGenere && manifeste.background_color === fondGenere,
  `${manifeste.theme_color} / ${manifeste.background_color}`);

// 4. Le tampon de version ne vit que dans sw.js : deux endroits finissent
// toujours par diverger, et donnent du nouveau HTML avec de l'ancien JS.
for (const fichier of ['index.html', 'js/app.js', 'js/moments.js', 'js/stockage.js', 'js/langages.js', 'css/app.css']) {
  verifier(`aucun tampon ?v= écrit à la main dans ${fichier}`,
    !readFileSync(fichier, 'utf8').includes('?v='));
}

// 5. Aucun tiret cadratin dans ce qui s'affiche.
const textes = ['index.html', 'js/app.js', 'js/langages.js', 'manifest.webmanifest', 'css/app.css']
  .map((f) => [f, readFileSync(f, 'utf8')]);
for (const [fichier, contenu] of textes) {
  verifier(`aucun tiret cadratin dans ${fichier}`, !contenu.includes('—'));
}

await navigateur.close();
console.log(echecs === 0 ? '\nAudit : tout est vert.' : `\n${echecs} point(s) en échec.`);
if (echecs > 0) process.exit(1);
