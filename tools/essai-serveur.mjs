// Le serveur du partage, éprouvé de l'extérieur, comme le verront les téléphones.
// Lancer : SERVEUR=http://127.0.0.1:8788 node tools/essai-serveur.mjs
// (wrangler dev en marche), puis contre la production :
// SERVEUR=https://petits-plus.jfrxdi0zz.workers.dev node tools/essai-serveur.mjs
const SERVEUR = process.env.SERVEUR ?? 'http://127.0.0.1:8788';
const ORIGINE = SERVEUR.startsWith('https://') ? 'https://replica-n8n.github.io' : 'http://localhost:8105';
const VERSION_ATTENDUE = process.env.VERSION_ATTENDUE ?? 'pp-1';

let echecs = 0;
const verifier = (nom, va, details = '') => {
  if (!va) echecs += 1;
  console.log(`${va ? 'ok   ' : 'ÉCHEC'} ${nom}${details ? `  ${details}` : ''}`);
};

async function appel(chemin, corps, { origine = ORIGINE, brut } = {}) {
  const r = await fetch(SERVEUR + chemin, {
    method: corps === undefined && !brut ? 'GET' : 'POST',
    headers: { Origin: origine, 'content-type': 'application/json' },
    body: brut ?? (corps === undefined ? undefined : JSON.stringify(corps)),
  });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* réponse sans JSON */ }
  return { status: r.status, donnees, entetes: r.headers };
}

let n = 0;
const id = () => (Date.now().toString(16) + (n++).toString(16).padStart(6, '0') + 'abcdef').slice(0, 24);
const moment = (champs = {}) => {
  const t = Date.now() - 3600e3;
  return { id: id(), instant: t, auteur: 'essai-a', langue: null, supprime: false, modifieLe: t, ...champs };
};
const sync = (code, depuis, moments = []) => appel(`/couples/${code}/sync`, { depuis, moments });

// 1. La racine dit quelle version tourne vraiment.
{
  const r = await appel('/');
  verifier('la racine donne la version', r.donnees?.petitsPlus === VERSION_ATTENDUE, JSON.stringify(r.donnees));
}

// 2. Un autre site est refusé.
{
  const r = await appel('/couples', {}, { origine: 'https://ailleurs.example' });
  verifier('un autre site est refusé', r.status === 403, `${r.status}`);
}

// 3. Créer un couple rend un code lisible, sans lettre ambiguë.
const { donnees: cree } = await appel('/couples', {});
const code = cree?.code;
verifier('créer un couple rend un code de six caractères', /^[ABCDEFGHJKMNPRSTUVWXYZ23456789]{6}$/.test(code ?? ''), code);
{
  const r = await appel('/couples', {});
  verifier('deux couples n\'ont pas le même code', r.donnees?.code && r.donnees.code !== code);
}

// 4. Un code inconnu ne rend rien.
{
  const r = await sync('ZZZZZZ', 0);
  verifier('un code inconnu répond 404', r.status === 404, `${r.status}`);
  const autorisation = r.entetes.get('access-control-allow-origin');
  verifier('même une erreur porte l\'en-tête CORS, sinon le téléphone ne la lit pas', autorisation === ORIGINE, autorisation);
  // Un code MAL FORMÉ prend un autre chemin : c'est celui d'un doigt qui tape
  // un O au lieu d'un 0. Sans l'en-tête, le téléphone y verrait « pas de
  // réseau » au lieu de « ce code n'existe pas ».
  const mal = await sync('OOOOOO', 0);
  verifier('un code mal formé répond 404, lisible par le téléphone',
    mal.status === 404 && mal.entetes.get('access-control-allow-origin') === ORIGINE,
    `${mal.status} ${mal.entetes.get('access-control-allow-origin')}`);
}

// 5. Deux téléphones : chacun envoie, chacun reçoit tout.
const a1 = moment();
const a2 = moment();
const b1 = moment({ auteur: 'essai-b' });
let curseurA;
{
  const r = await sync(code, 0, [a1, a2]);
  verifier('A envoie deux moments et les retrouve', r.status === 200 && r.donnees.moments.length === 2, `${r.status}`);
  curseurA = r.donnees.curseur;
  verifier('le curseur avance', curseurA === 2, `${curseurA}`);
}
{
  const r = await sync(code, 0, [b1]);
  verifier('B, tout neuf, reçoit tout le couple', r.donnees.moments.length === 3, `${r.donnees.moments.length}`);
}
{
  const r = await sync(code, curseurA);
  verifier('A ne reçoit que ce qu\'il n\'a pas encore', r.donnees.moments.length === 1 && r.donnees.moments[0].id === b1.id);
  curseurA = r.donnees.curseur;
}

// 6. Renvoyer la même chose ne fait rien bouger.
{
  const r = await sync(code, curseurA, [a1, a2]);
  verifier('renvoyer un moment inchangé ne le renvoie à personne', r.donnees.moments.length === 0 && r.donnees.curseur === curseurA,
    `${r.donnees.moments.length} moments, curseur ${r.donnees.curseur}`);
}

// 7. Un retrait suit, et l'emporte sur un langage posé après lui.
{
  const t = Date.now();
  const retire = { ...a1, supprime: true, retireLe: t - 1000, modifieLe: t - 1000 };
  const precise = { ...a1, langue: 'toucher', modifieLe: t };
  await sync(code, curseurA, [retire]);
  const r = await sync(code, curseurA, [precise]);
  const recu = r.donnees.moments.find((m) => m.id === a1.id);
  verifier('le retrait arrive à l\'autre téléphone', recu?.supprime === true);
  verifier('un langage posé après ne ressuscite pas le moment', recu?.supprime === true && recu?.langue === 'toucher',
    JSON.stringify(recu));
  curseurA = r.donnees.curseur;
}

// 8. Rien d'invalide n'est rangé.
{
  const invalides = [
    { ...moment(), id: 'PAS-HEXA' },
    { ...moment(), langue: 'devinettes' },
    { ...moment(), supprime: 'non' },
    { ...moment(), instant: Date.now() + 30 * 86400e3 },
    { ...moment(), auteur: '' },
    'pas un objet',
  ];
  const intrus = { ...moment(), cachette: 'un champ qui n\'existe pas' };
  const r = await sync(code, curseurA, [...invalides, intrus]);
  verifier('les six moments invalides sont écartés', r.donnees.ecartes === 6, `${r.donnees.ecartes}`);
  const range = r.donnees.moments.find((m) => m.id === intrus.id);
  verifier('un champ inconnu n\'est pas rangé', range && !('cachette' in range));
  curseurA = r.donnees.curseur;
}

// 9. Les plafonds tiennent.
{
  const trop = Array.from({ length: 501 }, () => moment());
  const r = await sync(code, curseurA, trop);
  verifier('plus de 500 moments d\'un coup est refusé', r.status === 413, `${r.status}`);
  const gros = await appel(`/couples/${code}/sync`, undefined, { brut: JSON.stringify({ depuis: 0, bourrage: 'x'.repeat(600 * 1024) }) });
  verifier('un corps de plus de 512 Ko est refusé', gros.status === 413, `${gros.status}`);
  const casse = await appel(`/couples/${code}/sync`, undefined, { brut: '{ pas du json' });
  verifier('un JSON cassé est refusé proprement', casse.status === 400, `${casse.status}`);
}

// 10. Une longue histoire revient en plusieurs fois, sans rien perdre.
{
  const { donnees: autre } = await appel('/couples', {});
  for (let lot = 0; lot < 3; lot += 1) {
    await sync(autre.code, 0, Array.from({ length: 400 }, () => moment()));
  }
  let depuis = 0;
  let recus = 0;
  let allers = 0;
  for (;;) {
    const r = await sync(autre.code, depuis);
    recus += r.donnees.moments.length;
    depuis = r.donnees.curseur;
    allers += 1;
    if (!r.donnees.encore || allers > 5) break;
  }
  verifier('1 200 moments reviennent tous, en plusieurs allers', recus === 1200 && allers === 2, `${recus} en ${allers} allers`);
}

// 11. Changer le code : l'ancien rend tout une dernière fois, puis plus rien.
{
  const r = await appel(`/couples/${code}/couper`, {});
  verifier('couper rend tous les moments du couple', r.status === 200 && r.donnees.moments.length >= 4,
    `${r.status}, ${r.donnees?.moments?.length}`);
  const apres = await sync(code, 0, [moment()]);
  verifier('l\'ancien code répond 410 ensuite', apres.status === 410, `${apres.status}`);
  verifier('et il ne révèle rien, pas même le nouveau code', !apres.donnees?.moments && !apres.donnees?.code,
    JSON.stringify(apres.donnees));
}

console.log(echecs === 0 ? '\nServeur : tout est vert.' : `\n${echecs} contrôle(s) en échec.`);
if (echecs > 0) process.exit(1);
