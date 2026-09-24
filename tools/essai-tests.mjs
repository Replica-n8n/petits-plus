// Prouve que les tests mordent. Pour chaque défaut connu, on abîme le code dans
// une copie jetable et on exige que la batterie ÉCHOUE. Un test qui n'a jamais
// échoué ne prouve rien.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAUTS = [
  ['retirer efface la ligne au lieu de la marquer', 'js/moments.js',
    'return liste.map((m) => (m.id === id\n    ? { ...m, supprime: true, retireLe: m.retireLe ?? maintenant, modifieLe: maintenant }\n    : m));',
    'return liste.filter((m) => m.id !== id);'],
  ['fusionner empile sans regarder les identifiants', 'js/moments.js',
    'const parId = new Map(liste.map((m) => [m.id, m]));',
    'const parId = new Map(liste.map((m, i) => [`${m.id}:${i}`, m]));'],
  ['les moments retirés continuent de compter', 'js/moments.js',
    'const vivants = (liste) => liste.filter((m) => !m.supprime);',
    'const vivants = (liste) => liste;'],
  ['les mois vides disparaissent du graphe', 'js/moments.js',
    'compte: comptes.get(cle) ?? 0,',
    'compte: comptes.get(cle) ?? null,'],
  ['une écriture refusée est avalée en silence', 'js/stockage.js',
    'zone.setItem(CLE_MOMENTS, JSON.stringify(moments));',
    'try { zone.setItem(CLE_MOMENTS, JSON.stringify(moments)); } catch { /* avalée */ }'],
  ['à égalité d\'heure, la fusion dépend de l\'ordre de réception', 'js/moments.js',
    'return empreinte(a) >= empreinte(b) ? a : b;',
    'return a;'],
  ['la suppression ne l\'emporte plus sur un langage posé après', 'js/moments.js',
    'supprime: Boolean(connu.supprime || entrant.supprime),',
    'supprime: Boolean(recente.supprime),'],
  ['la date du retrait n\'est plus la première connue', 'js/moments.js',
    'if (retraits.length) fusion.retireLe = Math.min(...retraits);',
    'if (retraits.length) fusion.retireLe = Math.max(...retraits);'],
  ['préciser ne date plus sa modification', 'js/langages.js',
    '{ ...m, langue, modifieLe: maintenant }',
    '{ ...m, langue }'],
];

let manques = 0;
for (const [nom, fichier, avant, apres] of DEFAUTS) {
  const bac = mkdtempSync(join(tmpdir(), 'pp-essai-'));
  cpSync('js', join(bac, 'js'), { recursive: true });
  cpSync('test', join(bac, 'test'), { recursive: true });
  writeFileSync(join(bac, 'package.json'), '{"type":"module"}');

  const cible = join(bac, fichier);
  const source = readFileSync(cible, 'utf8');
  if (!source.includes(avant)) {
    console.log(`INUTILISABLE ${nom} : le motif n'existe plus dans ${fichier}`);
    manques += 1;
    rmSync(bac, { recursive: true, force: true });
    continue;
  }
  writeFileSync(cible, source.replace(avant, apres));

  const passe = spawnSync(process.execPath,
    ['--test', 'test/moments.test.mjs', 'test/stockage.test.mjs', 'test/fusion.test.mjs', 'test/langages.test.mjs', 'test/jours.test.mjs'],
    { cwd: bac, encoding: 'utf8' });
  const attrape = passe.status !== 0;
  if (!attrape) manques += 1;
  console.log(`${attrape ? 'attrapé ' : 'MANQUÉ  '} ${nom}`);
  rmSync(bac, { recursive: true, force: true });
}

console.log(manques === 0
  ? `\n${DEFAUTS.length} défauts injectés, ${DEFAUTS.length} attrapés.`
  : `\n${manques} défaut(s) passés au travers de la batterie.`);
if (manques > 0) process.exit(1);
