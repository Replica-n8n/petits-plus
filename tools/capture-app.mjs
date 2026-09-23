// Capture l'app avec des moments plausibles, pour la montrer telle qu'elle sera.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8105';
const REPARTITION = [6, 9, 5, 11, 9, 14]; // avril à septembre

mkdirSync('maquettes/captures', { recursive: true });
const navigateur = await chromium.launch();

for (const [suffixe, largeur, hauteur] of [['732', 360, 732], ['640', 360, 640]]) {
  const contexte = await navigateur.newContext({
    ...devices['Pixel 9'],
    viewport: { width: largeur, height: hauteur },
  });
  await contexte.addInitScript((repartition) => {
    const moments = [];
    const aujourdhui = new Date();
    repartition.forEach((combien, rang) => {
      const recul = repartition.length - 1 - rang;
      for (let i = 0; i < combien; i += 1) {
        const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - recul, 1 + i, 20, 0);
        moments.push({
          id: `essai-${rang}-${i}`, instant: d.getTime(),
          auteur: i % 2 ? 'elle' : 'moi', langue: null, supprime: false,
        });
      }
    });
    localStorage.setItem('pp:moments:v1', JSON.stringify(moments));
  }, REPARTITION);

  const page = await contexte.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `maquettes/captures/app-${suffixe}.png` });
  console.log(`maquettes/captures/app-${suffixe}.png`);
  await contexte.close();
}

await navigateur.close();
