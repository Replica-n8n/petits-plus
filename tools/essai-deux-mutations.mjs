// Prouve que l'essai à deux téléphones mord. Pour chaque défaut connu, on sert
// une copie ABÎMÉE de l'app sur un autre port, et on exige que
// tools/essai-deux.mjs échoue contre elle. Le serveur du partage local
// (wrangler dev, port 8788) doit tourner.
// Lancer : node tools/essai-deux-mutations.mjs
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';

const PORT = 8106;
const DEFAUTS = [
  ['un appui ne part jamais vers l\'autre téléphone', 'js/app.js',
    '      partage.noter(touches);\n', ''],
  ['le doublon n\'est jamais signalé', 'js/app.js',
    '  if (!doublon) return { texte: \'Gardé\', libelleAnnuler: \'Annuler\' };',
    '  if (true) return { texte: \'Gardé\', libelleAnnuler: \'Annuler\' };'],
  ['un partage coupé ne se voit pas', 'js/app.js',
    '  alerte.hidden = !partage.etat().coupe;', '  alerte.hidden = true;'],
  ['le retour du réseau ne relance rien', 'js/app.js',
    "window.addEventListener('online', () => planifierSynchro(0));", ''],
  ['le réglage des langages est ignoré', 'js/app.js',
    '  if (!reglages.proposerLangages) return;\n', ''],
];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function pret() {
  for (let i = 0; i < 30; i += 1) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return true; } catch { /* pas encore */ }
    await attendre(500);
  }
  return false;
}
const arreter = (enfant) => {
  try { execSync(`taskkill /pid ${enfant.pid} /T /F`, { stdio: 'ignore' }); } catch { enfant.kill(); }
};

let manques = 0;
for (const [nom, fichier, avant, apres] of DEFAUTS) {
  const bac = mkdtempSync(join(tmpdir(), 'pp-app-'));
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) cpSync(f, join(bac, f));
  for (const d of ['js', 'css', 'polices', 'icons']) cpSync(d, join(bac, d), { recursive: true });
  const cible = join(bac, fichier);
  const source = readFileSync(cible, 'utf8');
  if (!source.includes(avant)) {
    console.log(`INUTILISABLE ${nom} : le motif n'existe plus`);
    manques += 1;
    continue;
  }
  writeFileSync(cible, source.replace(avant, apres));
  const serveur = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: bac, stdio: 'ignore' });
  if (!(await pret())) {
    console.log(`INUTILISABLE ${nom} : la copie n'est pas servie`);
    manques += 1;
    arreter(serveur);
    continue;
  }
  const essai = spawnSync(process.execPath, ['tools/essai-deux.mjs'], {
    env: { ...process.env, BASE: `http://localhost:${PORT}` }, encoding: 'utf8', timeout: 240000,
  });
  const attrape = essai.status !== 0;
  if (!attrape) manques += 1;
  const tombes = (essai.stdout.match(/^ÉCHEC .*/gm) ?? []).map((l) => l.slice(6, 58)).slice(0, 2).join(' | ');
  console.log(`${attrape ? 'attrapé ' : 'MANQUÉ  '} ${nom}${tombes ? `  (${tombes})` : ''}`);
  arreter(serveur);
  await attendre(500);
  rmSync(bac, { recursive: true, force: true });
}

console.log(manques === 0
  ? `\n${DEFAUTS.length} défauts injectés dans l'app, ${DEFAUTS.length} attrapés.`
  : `\n${manques} défaut(s) passés au travers de l'essai.`);
if (manques > 0) process.exit(1);
