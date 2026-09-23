// Capture les maquettes aux deux formats à tester, et dit si la page déborde.
// Lancer avec le serveur local en marche : node tools/captures.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8105';
const PAGES = [
  ['accueil-a', '/maquettes/accueil-a.html'],
  ['accueil-b', '/maquettes/accueil-b.html'],
];
// Pixel 9 utile, puis l'écran étroit qui avait fait déborder le bouton de GVT.
const FORMATS = [['732', 360, 732], ['640', 360, 640]];

mkdirSync('maquettes/captures', { recursive: true });
const navigateur = await chromium.launch();
let deborde = 0;

for (const [nom, chemin] of PAGES) {
  for (const [suffixe, largeur, hauteur] of FORMATS) {
    const contexte = await navigateur.newContext({
      ...devices['Pixel 9'],
      viewport: { width: largeur, height: hauteur },
    });
    const page = await contexte.newPage();
    await page.goto(BASE + chemin, { waitUntil: 'load' });

    // Essai du garde-fou : grossit le bouton jusqu'à le faire sortir de l'écran.
    // Un contrôle qui n'a jamais échoué ne prouve rien.
    // Deux défauts à injecter, parce qu'il a fallu deux contrôles : un bloc qui
    // ne peut pas rétrécir pousse le bouton dehors, un bouton trop haut écrase
    // au contraire le contenu sans jamais sortir de l'écran.
    if (process.argv.includes('--essai-pousse')) {
      await page.addStyleTag({ content: '.compte { min-height: 520px }' });
    }
    if (process.argv.includes('--essai-ecrase')) {
      await page.addStyleTag({ content: '.plus { height: 420px }' });
    }
    const fichier = `maquettes/captures/${nom}-${suffixe}.png`;
    await page.screenshot({ path: fichier });

    const mesures = await page.evaluate(() => ({
      defile: document.documentElement.scrollHeight > window.innerHeight + 1,
      basDuBouton: document.querySelector('.plus').getBoundingClientRect().bottom,
      hauteBouton: document.querySelector('.plus').getBoundingClientRect().height,
      hautesColonnes: document.querySelector('.colonnes').getBoundingClientRect().height,
      hauteur: window.innerHeight,
    }));
    // Deux façons de rater, et il faut les deux : sortir de l'écran, ou y rester
    // en écrasant le graphe jusqu'à ce qu'il ne veuille plus rien dire.
    const sort = mesures.defile || mesures.basDuBouton > mesures.hauteur + 1;
    const ecrase = mesures.hautesColonnes < 60 || mesures.hauteBouton < 64;
    const souci = sort || ecrase;
    if (souci) deborde += 1;
    const verdict = sort ? 'SORT   ' : ecrase ? 'ÉCRASÉ ' : 'ok     ';
    console.log(
      `${verdict} ${nom} ${largeur}x${hauteur}` +
      `  bouton ${Math.round(mesures.basDuBouton)}/${mesures.hauteur}` +
      `  colonnes ${Math.round(mesures.hautesColonnes)} px` +
      `  ${fichier}`,
    );
    await contexte.close();
  }
}

await navigateur.close();
if (deborde > 0) process.exit(1);
