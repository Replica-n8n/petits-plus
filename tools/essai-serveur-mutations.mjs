// Prouve que le banc du serveur mord. Pour chaque défaut connu, on lance une
// copie ABÎMÉE du serveur dans un dossier jetable, et on exige que
// tools/essai-serveur.mjs échoue contre elle. Un banc vert du premier coup ne
// prouve rien tant qu'on ne l'a pas vu échouer.
// Lancer : node tools/essai-serveur-mutations.mjs
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';

const PORT = 8789;
const DEFAUTS = [
  ['la validation ne filtre plus rien', 'const m = nettoyer(brut);', 'const m = brut;'],
  ['un code changé répond encore',
    "if (this.lire('coupe')) return repondre({ erreur: 'coupe' }, 410);", ''],
  ['un moment inchangé repart vers tout le monde',
    'if (connu && canonique(fusion) === canonique(connu)) continue;', ''],
  ['les erreurs perdent leur en-tête CORS',
    "if (!m || !CODE.test(m[1])) return json(req, { erreur: 'introuvable' }, 404);",
    "if (!m || !CODE.test(m[1])) return new Response('{}', { status: 404 });"],
  ['la pagination perd le reste', 'curseur: encore ? rendus.at(-1).seq : seq,', 'curseur: seq,'],
];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function pret() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return true;
    } catch { /* pas encore */ }
    await attendre(1000);
  }
  return false;
}
const arreter = (enfant) => {
  try { execSync(`taskkill /pid ${enfant.pid} /T /F`, { stdio: 'ignore' }); } catch { enfant.kill(); }
};

let manques = 0;
for (const [nom, avant, apres] of DEFAUTS) {
  const bac = mkdtempSync(join(tmpdir(), 'pp-serveur-'));
  cpSync('serveur', join(bac, 'serveur'), { recursive: true, filter: (s) => !s.includes('.wrangler') });
  cpSync('js', join(bac, 'js'), { recursive: true });
  writeFileSync(join(bac, 'package.json'), '{"type":"module"}');
  const fichier = join(bac, 'serveur', 'worker.js');
  const source = readFileSync(fichier, 'utf8');
  if (!source.includes(avant)) {
    console.log(`INUTILISABLE ${nom} : le motif n'existe plus`);
    manques += 1;
    continue;
  }
  writeFileSync(fichier, source.replace(avant, apres));

  const serveur = spawn('npx', ['--yes', 'wrangler@4', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'],
    { cwd: join(bac, 'serveur'), shell: true, stdio: 'ignore' });
  if (!(await pret())) {
    console.log(`INUTILISABLE ${nom} : la copie abîmée n'a pas démarré`);
    manques += 1;
    arreter(serveur);
    continue;
  }
  const banc = spawnSync(process.execPath, ['tools/essai-serveur.mjs'], {
    env: { ...process.env, SERVEUR: `http://127.0.0.1:${PORT}` }, encoding: 'utf8',
  });
  const attrape = banc.status !== 0;
  if (!attrape) manques += 1;
  const tombes = (banc.stdout.match(/^ÉCHEC .*/gm) ?? []).map((l) => l.slice(6, 60)).join(' | ');
  console.log(`${attrape ? 'attrapé ' : 'MANQUÉ  '} ${nom}${tombes ? `  (${tombes})` : ''}`);
  arreter(serveur);
  await attendre(1500);
  rmSync(bac, { recursive: true, force: true });
}

console.log(manques === 0
  ? `\n${DEFAUTS.length} défauts injectés dans le serveur, ${DEFAUTS.length} attrapés.`
  : `\n${manques} défaut(s) passés au travers du banc.`);
if (manques > 0) process.exit(1);
