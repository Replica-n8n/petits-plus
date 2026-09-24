// Le partage à deux, sans interface : appairer, envoyer, recevoir, et dire la
// vérité quand ça échoue.
//
// Trois règles tiennent tout le reste :
// - La FILE D'ENVOI survit au rechargement et à l'app tuée : un appui fait hors
//   ligne part au retour du réseau, jamais perdu.
// - Un moment modifié PENDANT qu'un envoi est en route reste dans la file :
//   sinon la réponse de l'envoi le rayerait, et sa dernière version ne
//   partirait jamais.
// - Seuls 404 (code inconnu) et 410 (code changé) coupent le partage. Le reste,
//   réseau absent ou erreur 500, est passager et se retente tout seul : juste
//   après un déploiement, le vrai serveur a répondu 500 quelques secondes.
import { fusionner } from './moments.js';

export const CLE_PARTAGE = 'pp:partage:v1';
const ALPHABET = 'ABCDEFGHJKMNPRSTUVWXYZ23456789';
export const FORMAT_CODE = new RegExp(`^[${ALPHABET}]{6}$`);
const PAR_LOT = 500;
const TOURS_MAX = 50;

/** Ce qu'une personne tape, remis au propre : majuscules, sans espaces. */
export const normaliserCode = (texte) => String(texte ?? '').toUpperCase().replace(/[\s-]/g, '');

/**
 * Le moment de l'AUTRE téléphone le plus proche du nôtre, dans la fenêtre :
 * c'est peut-être le même compliment noté deux fois.
 */
export function doublonRecent(liste, moment, { appareil, fenetreMs = 30 * 60e3 }) {
  let meilleur = null;
  for (const m of liste) {
    if (m.id === moment.id || m.supprime || m.auteur === appareil || m.auteur === 'moi') continue;
    const ecart = Math.abs(m.instant - moment.instant);
    if (ecart <= fenetreMs && (!meilleur || ecart < meilleur.ecart)) meilleur = { moment: m, ecart };
  }
  return meilleur;
}

const nouvelAppareil = () => {
  const octets = new Uint8Array(8);
  globalThis.crypto.getRandomValues(octets);
  return [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');
};

/**
 * @param zone            un objet à la manière de localStorage, ou null
 * @param serveur         l'adresse du serveur
 * @param appeler         fetch, remplaçable dans les tests
 * @param lireMoments     rend la liste locale à jour
 * @param ecrireMoments   range une liste, LÈVE si le rangement refuse
 * @param maintenant      l'horloge, remplaçable dans les tests
 */
export function creerPartage({ zone, serveur, appeler = globalThis.fetch?.bind(globalThis), lireMoments, ecrireMoments, maintenant = Date.now }) {
  const lire = () => {
    try { return JSON.parse(zone?.getItem(CLE_PARTAGE) ?? 'null') ?? {}; } catch { return {}; }
  };
  const etat = { appareil: null, code: null, curseur: 0, aEnvoyer: [], coupe: null, derniereSynchro: null, ...lire() };
  if (!etat.appareil) etat.appareil = nouvelAppareil();
  const file = new Set(etat.aEnvoyer);

  const ranger = () => {
    etat.aEnvoyer = [...file];
    try { zone?.setItem(CLE_PARTAGE, JSON.stringify(etat)); } catch { /* le partage n'est pas vital */ }
  };
  ranger();

  let enVol = false;
  let aRefaire = false;
  const modifiesPendant = new Set();

  async function poster(chemin, corps) {
    let r;
    try {
      r = await appeler(`${serveur}${chemin}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps),
      });
    } catch {
      return { passager: true };
    }
    if (r.status === 404) return { coupe: 'inconnu' };
    if (r.status === 410) return { coupe: 'code-change' };
    if (!r.ok) return { passager: true };
    try { return { donnees: await r.json() }; } catch { return { passager: true }; }
  }

  /** Tout ce qui est rangé part à la prochaine synchro. */
  function toutMettreEnFile() {
    for (const m of lireMoments()) file.add(m.id);
  }

  /**
   * Les moments d'avant la tranche 4 portent l'auteur « moi ». À l'appairage,
   * ils reçoivent l'identifiant de CE téléphone : c'est lui qui les a notés.
   */
  function signerLesAnciens() {
    const liste = lireMoments();
    if (!liste.some((m) => m.auteur === 'moi')) return;
    ecrireMoments(liste.map((m) => (m.auteur === 'moi' ? { ...m, auteur: etat.appareil } : m)));
  }

  async function synchroniser() {
    if (!etat.code || etat.coupe) return { fait: false };
    if (enVol) { aRefaire = true; return { fait: false, enCours: true }; }
    enVol = true;
    try {
      for (let tour = 0; tour < TOURS_MAX; tour += 1) {
        const parId = new Map(lireMoments().map((m) => [m.id, m]));
        const lot = [...file].filter((id) => parId.has(id)).slice(0, PAR_LOT);
        for (const id of file) if (!parId.has(id)) file.delete(id);
        modifiesPendant.clear();

        const reponse = await poster(`/couples/${etat.code}/sync`, {
          depuis: etat.curseur, moments: lot.map((id) => parId.get(id)),
        });
        if (reponse.coupe) {
          etat.coupe = reponse.coupe;
          ranger();
          return { fait: false, coupe: reponse.coupe };
        }
        if (reponse.passager) { ranger(); return { fait: false, passager: true }; }

        const { moments, curseur, encore } = reponse.donnees;
        if (moments.length) {
          // Si le rangement refuse, le curseur N'AVANCE PAS : on recevra de nouveau.
          ecrireMoments(fusionner(lireMoments(), moments));
        }
        for (const id of lot) if (!modifiesPendant.has(id)) file.delete(id);
        etat.curseur = curseur;
        etat.derniereSynchro = maintenant();
        ranger();
        if (!encore && file.size === 0) return { fait: true, recus: moments.length };
      }
      return { fait: true };
    } finally {
      enVol = false;
      if (aRefaire) { aRefaire = false; queueMicrotask(() => { synchroniser(); }); }
    }
  }

  return {
    get appareil() { return etat.appareil; },
    etat: () => ({
      appaire: Boolean(etat.code), code: etat.code, coupe: etat.coupe,
      derniereSynchro: etat.derniereSynchro, enAttente: file.size,
    }),

    /** Un moment a changé ici : il partira à la prochaine synchro. */
    noter(ids) {
      for (const id of [].concat(ids)) {
        file.add(id);
        if (enVol) modifiesPendant.add(id);
      }
      ranger();
    },

    synchroniser,

    async creerCouple() {
      const r = await poster('/couples', {});
      if (!r.donnees?.code) return { ok: false, passager: Boolean(r.passager) };
      signerLesAnciens();
      Object.assign(etat, { code: r.donnees.code, curseur: 0, coupe: null });
      toutMettreEnFile();
      ranger();
      await synchroniser();
      return { ok: true, code: etat.code };
    },

    async rejoindre(texte) {
      const code = normaliserCode(texte);
      if (!FORMAT_CODE.test(code)) return { ok: false, raison: 'format' };
      // On essaie AVANT de s'engager : un code inconnu ne doit rien changer ici.
      const essai = await poster(`/couples/${code}/sync`, { depuis: 0, moments: [] });
      if (essai.coupe) return { ok: false, raison: essai.coupe };
      if (essai.passager) return { ok: false, raison: 'reseau' };
      signerLesAnciens();
      Object.assign(etat, { code, curseur: 0, coupe: null });
      toutMettreEnFile();
      ranger();
      await synchroniser();
      return { ok: true, code };
    },

    /**
     * Changer le code : un nouveau couple, puis l'ancien se coupe en rendant
     * tout ce qu'il avait. Un moment envoyé par l'autre téléphone juste avant
     * est dans ce qu'il rend, et part sur le nouveau code avec le reste.
     */
    async changerCode() {
      if (!etat.code) return { ok: false };
      const neuf = await poster('/couples', {});
      if (!neuf.donnees?.code) return { ok: false, raison: 'reseau' };
      const ancien = await poster(`/couples/${etat.code}/couper`, {});
      if (ancien.donnees?.moments?.length) {
        ecrireMoments(fusionner(lireMoments(), ancien.donnees.moments));
      }
      Object.assign(etat, { code: neuf.donnees.code, curseur: 0, coupe: null });
      toutMettreEnFile();
      ranger();
      await synchroniser();
      return { ok: true, code: etat.code };
    },
  };
}
