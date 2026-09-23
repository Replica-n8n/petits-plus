// Vérifie que la police hébergée est bien CELLE qui s'affiche, et que ses
// chiffres ont la même largeur. Une police qui retombe sur le système passerait
// inaperçue sur une capture.
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:8105';
const ESSAIS = [
  ['archivo', 'Archivo', '/maquettes/police-archivo.html'],
];

const navigateur = await chromium.launch();
let echecs = 0;

for (const [nom, famille, chemin] of ESSAIS) {
  const contexte = await navigateur.newContext({ ...devices['Pixel 9'], viewport: { width: 360, height: 732 } });
  const page = await contexte.newPage();
  // Essai du garde-fou : coupe le fichier de police pour vérifier qu'un repli
  // système est bien vu. Sur une capture seule, il passerait inaperçu.
  if (process.argv.includes('--essai-defaut')) {
    await page.route('**/*.woff2', (route) => route.abort());
  }
  await page.goto(BASE + chemin, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `maquettes/captures/police-${nom}.png` });

  const m = await page.evaluate((famille) => {
    const chargee = document.fonts.check(`800 104px "${famille}"`);
    const sonde = document.createElement('span');
    sonde.style.cssText = 'position:absolute;font-size:104px;font-weight:800;font-variant-numeric:tabular-nums;visibility:hidden';
    document.body.append(sonde);
    const largeur = (texte) => { sonde.textContent = texte; return sonde.getBoundingClientRect().width; };
    const resultat = { chargee, un: largeur('111'), neuf: largeur('999') };
    sonde.remove();
    return resultat;
  }, famille);

  const memeLargeur = Math.abs(m.un - m.neuf) < 0.5;
  if (!m.chargee || !memeLargeur) echecs += 1;
  console.log(
    `${m.chargee && memeLargeur ? 'ok   ' : 'ÉCHEC'} ${nom.padEnd(10)}` +
    ` police servie : ${m.chargee ? 'oui' : 'NON, repli système'}` +
    `  chiffres 111/999 : ${m.un.toFixed(1)} / ${m.neuf.toFixed(1)} px` +
    `  ${memeLargeur ? 'même largeur' : 'LARGEURS DIFFÉRENTES'}`,
  );
  await contexte.close();
}

await navigateur.close();
if (echecs > 0) process.exit(1);
