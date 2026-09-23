// Le rangement local, et surtout : ce qu'il fait quand il n'y arrive pas.
//
// Un navigateur qui bloque les données de site fait lever l'écriture. L'app ne
// doit JAMAIS annoncer un moment gardé dans ce cas : le piège a déjà été payé
// sur « À deux », où la coche restait vide pendant que l'app disait oui.

export const CLE_MOMENTS = 'pp:moments:v1';

export class ErreurStockage extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ErreurStockage';
  }
}

/**
 * @param zone un objet à la manière de localStorage, ou null quand le
 *   navigateur n'en donne aucun.
 */
export function creerStockage(zone) {
  let prevenirAbime = () => {};

  const lireMoments = () => {
    if (!zone) return [];
    let brut = null;
    try {
      brut = zone.getItem(CLE_MOMENTS);
    } catch (cause) {
      prevenirAbime(`lecture impossible : ${cause.name}`);
      return [];
    }
    if (brut === null) return [];

    try {
      const relu = JSON.parse(brut);
      if (!Array.isArray(relu)) {
        prevenirAbime('le contenu rangé n\'est pas une liste de moments');
        return [];
      }
      return relu;
    } catch (cause) {
      prevenirAbime(`contenu illisible : ${cause.message}`);
      return [];
    }
  };

  const ecrireMoments = (moments) => {
    if (!zone) {
      throw new ErreurStockage('aucun rangement disponible sur cet appareil');
    }
    try {
      zone.setItem(CLE_MOMENTS, JSON.stringify(moments));
    } catch (cause) {
      throw new ErreurStockage('le navigateur a refusé d\'écrire', { cause });
    }
  };

  return {
    lireMoments,
    ecrireMoments,
    /** Prévenu quand le contenu rangé est inutilisable, pour le dire à l'écran. */
    surContenuAbime(rappel) { prevenirAbime = rappel; },
  };
}

/** Le rangement du navigateur, ou rien du tout s'il le refuse dès l'accès. */
export function stockageDuNavigateur() {
  try {
    return creerStockage(globalThis.localStorage ?? null);
  } catch {
    // Accéder à localStorage peut lever tout seul quand les données de site
    // sont bloquées : ce n'est pas une raison pour que l'app ne s'ouvre pas.
    return creerStockage(null);
  }
}
