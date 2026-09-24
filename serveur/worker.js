// Petits plus : le serveur du partage à deux (Cloudflare Worker + Durable Object).
//
// Il garde les moments d'un couple et les rend à ses deux téléphones. Rien
// d'autre : ni nom, ni compte, ni texte libre. Un moment, c'est une date, un
// langage éventuel, l'appareil qui a appuyé, et une marque de suppression.
//
// ⚠️ La règle de fusion n'est PAS recopiée ici : elle est importée de
// js/moments.js, la même que celle des téléphones. Deux copies finiraient par
// diverger, et deux téléphones par ne plus voir la même chose.
//
// ⚠️ WORKER_VERSION à changer à chaque modification : c'est la seule façon de
// savoir quel code tourne vraiment (GET / la renvoie).
import { fusionnerUn } from '../js/moments.js';
import { estUnLangage } from '../js/langages.js';

const WORKER_VERSION = 'pp-1';
const ORIGINES = ['https://replica-n8n.github.io', 'http://127.0.0.1', 'http://localhost'];
const ALPHABET = 'ABCDEFGHJKMNPRSTUVWXYZ23456789'; // ni 0/O/Q, ni 1/I/L
const CODE = new RegExp(`^[${ALPHABET}]{6}$`);
const ID = /^[0-9a-f-]{16,64}$/;

// Des plafonds, parce qu'un serveur public reçoit aussi ce qu'on ne lui a pas
// demandé. Deux téléphones en usage normal en sont très loin.
const MAX_CORPS = 512 * 1024;
const MAX_PAR_ENVOI = 500;
const MAX_PAR_RETOUR = 1000;
const MAX_MOMENTS = 100000;

const autorise = (o) => !!o && ORIGINES.some((a) => o === a || o.startsWith(`${a}:`));
function entetes(req) {
  const o = req.headers.get('Origin');
  return autorise(o) ? {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  } : {};
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', ...entetes(req) },
});
const nouveauCode = () => {
  const octets = new Uint8Array(6);
  crypto.getRandomValues(octets);
  return Array.from(octets, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

/**
 * Un moment reçu, nettoyé : seuls les champs connus passent, et chacun est
 * vérifié. Un moment invalide est écarté, jamais rangé à moitié.
 */
export function nettoyer(m, maintenant = Date.now()) {
  if (!m || typeof m !== 'object') return null;
  if (typeof m.id !== 'string' || !ID.test(m.id)) return null;
  if (!Number.isFinite(m.instant) || m.instant < 1.6e12 || m.instant > maintenant + 2 * 86400e3) return null;
  if (typeof m.auteur !== 'string' || m.auteur.length === 0 || m.auteur.length > 64) return null;
  if (m.langue !== null && !estUnLangage(m.langue)) return null;
  if (typeof m.supprime !== 'boolean') return null;
  const propre = { id: m.id, instant: m.instant, auteur: m.auteur, langue: m.langue, supprime: m.supprime };
  if (m.retireLe !== undefined) {
    if (!Number.isFinite(m.retireLe)) return null;
    propre.retireLe = m.retireLe;
  }
  if (m.modifieLe !== undefined) {
    if (!Number.isFinite(m.modifieLe)) return null;
    propre.modifieLe = m.modifieLe;
  }
  return propre;
}

// Une écriture canonique, clés triées : deux versions égales doivent se
// reconnaître comme égales, sinon chaque synchro renverrait tout.
const canonique = (m) => JSON.stringify(Object.keys(m).sort().map((k) => [k, m[k]]));

async function lireCorps(req) {
  const texte = await req.text();
  if (texte.length > MAX_CORPS) return { trop: true };
  try { return { corps: JSON.parse(texte || '{}') }; } catch { return { corps: null }; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: entetes(req) });
    if (url.pathname === '/') return json(req, { petitsPlus: WORKER_VERSION });
    // un autre site ne peut pas se servir du serveur
    if (!autorise(req.headers.get('Origin'))) return new Response('origine refusée', { status: 403 });
    if (req.method !== 'POST') return json(req, { erreur: 'methode' }, 405);

    // créer un couple : on tire un code libre
    if (url.pathname === '/couples') {
      for (let essai = 0; essai < 8; essai += 1) {
        const code = nouveauCode();
        const couple = env.COUPLES.get(env.COUPLES.idFromName(code));
        const r = await couple.fetch('https://couple/creer', { method: 'POST' });
        if (r.status === 200) return json(req, { code });
      }
      return json(req, { erreur: 'plein' }, 503);
    }

    const m = url.pathname.match(/^\/couples\/([A-Z0-9]{6})\/(sync|couper)$/);
    if (!m || !CODE.test(m[1])) return json(req, { erreur: 'introuvable' }, 404);
    const couple = env.COUPLES.get(env.COUPLES.idFromName(m[1]));
    const { corps, trop } = await lireCorps(req);
    if (trop) return json(req, { erreur: 'trop-gros' }, 413);
    if (corps === null) return json(req, { erreur: 'json' }, 400);
    const r = await couple.fetch(`https://couple/${m[2]}`, { method: 'POST', body: JSON.stringify(corps) });
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json', ...entetes(req) } });
  },
};

export class Couple {
  constructor(state) {
    this.sql = state.storage.sql;
  }

  // Les tables ne naissent qu'à la création d'un VRAI couple. Les créer dans le
  // constructeur ferait écrire une base vide pour chaque code essayé au hasard.
  existe() {
    return this.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'etat'").toArray().length > 0;
  }

  preparer() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS moments (id TEXT PRIMARY KEY, donnees TEXT NOT NULL, seq INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS par_seq ON moments (seq)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS etat (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)');
  }

  lire(cle) {
    const lignes = this.sql.exec('SELECT valeur FROM etat WHERE cle = ?', cle).toArray();
    return lignes.length ? lignes[0].valeur : null;
  }

  poser(cle, valeur) {
    this.sql.exec('INSERT INTO etat (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur',
      cle, String(valeur));
  }

  async fetch(req) {
    const url = new URL(req.url);
    const repondre = (obj, status = 200) => new Response(JSON.stringify(obj), { status });

    if (url.pathname === '/creer') {
      if (this.existe() && this.lire('cree')) return repondre({ erreur: 'pris' }, 409);
      this.preparer();
      this.poser('cree', Date.now());
      this.poser('seq', 0);
      return repondre({ ok: true });
    }

    if (!this.existe() || !this.lire('cree')) return repondre({ erreur: 'inconnu' }, 404);
    // Un code changé ne rend plus RIEN, pas même le nouveau code : c'est tout
    // l'intérêt de pouvoir le changer.
    if (this.lire('coupe')) return repondre({ erreur: 'coupe' }, 410);

    const corps = await req.json();

    if (url.pathname === '/couper') {
      // On rend tout ce qu'on a, et on se coupe dans le MÊME geste : un moment
      // envoyé par l'autre téléphone juste avant le changement de code est dans
      // cette liste, et le téléphone qui change le code le reporte sur le nouveau.
      const tous = this.sql.exec('SELECT donnees FROM moments').toArray().map((l) => JSON.parse(l.donnees));
      this.poser('coupe', Date.now());
      return repondre({ moments: tous });
    }

    // /sync : recevoir, fusionner, rendre ce qui a changé depuis le curseur.
    const depuis = Number.isInteger(corps.depuis) && corps.depuis >= 0 ? corps.depuis : 0;
    const recus = Array.isArray(corps.moments) ? corps.moments : [];
    if (recus.length > MAX_PAR_ENVOI) return repondre({ erreur: 'trop-de-moments' }, 413);

    let seq = Number(this.lire('seq'));
    let ecartes = 0;
    let nombre = this.sql.exec('SELECT COUNT(*) AS n FROM moments').toArray()[0].n;
    for (const brut of recus) {
      const m = nettoyer(brut);
      if (!m) { ecartes += 1; continue; }
      const lignes = this.sql.exec('SELECT donnees FROM moments WHERE id = ?', m.id).toArray();
      const connu = lignes.length ? JSON.parse(lignes[0].donnees) : null;
      if (!connu && nombre >= MAX_MOMENTS) { ecartes += 1; continue; }
      const fusion = connu ? fusionnerUn(connu, m) : m;
      if (connu && canonique(fusion) === canonique(connu)) continue;
      seq += 1;
      if (!connu) nombre += 1;
      this.sql.exec(
        'INSERT INTO moments (id, donnees, seq) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET donnees = excluded.donnees, seq = excluded.seq',
        m.id, JSON.stringify(fusion), seq,
      );
    }
    this.poser('seq', seq);

    // Au plus MAX_PAR_RETOUR à la fois : une première synchro de plusieurs
    // années se fait en plusieurs allers-retours, sans réponse géante.
    const lignes = this.sql.exec(
      'SELECT donnees, seq FROM moments WHERE seq > ? ORDER BY seq LIMIT ?', depuis, MAX_PAR_RETOUR + 1,
    ).toArray();
    const encore = lignes.length > MAX_PAR_RETOUR;
    const rendus = lignes.slice(0, MAX_PAR_RETOUR);
    return repondre({
      moments: rendus.map((l) => JSON.parse(l.donnees)),
      curseur: encore ? rendus.at(-1).seq : seq,
      encore,
      ecartes,
      version: WORKER_VERSION,
    });
  }
}
