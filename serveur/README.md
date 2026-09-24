# Le serveur du partage

Un Cloudflare Worker et un Durable Object en SQLite qui gardent les moments
d'un couple et les rendent à ses deux téléphones.

- **Rien sur les personnes** : ni nom, ni compte, ni texte libre. Un moment,
  c'est une date, un langage éventuel, l'appareil qui a appuyé, et une marque
  de suppression.
- **Une seule règle de fusion** : `worker.js` importe `../js/moments.js`, la
  même que celle des téléphones. Ne jamais la recopier ici.
- **Rien ne s'efface** avec le temps, contrairement au relais de Paper Race.
- **Seuls nos sites** peuvent s'en servir (`ORIGINES`).
- **Plan gratuit** : les Durable Objects en SQLite y sont inclus.

## Tester en local

```bash
npx wrangler dev --port 8788 --ip 127.0.0.1
```

Puis, depuis la racine du dépôt :

```bash
npm run essai-serveur
npm run essai-serveur-mutations
```

Le second lance des copies abîmées du serveur et exige que le banc les attrape.

## Déployer

Une seule fois, se connecter au compte Cloudflare : `npx wrangler login`.
Puis, à chaque modification, depuis ce dossier :

```bash
npx wrangler deploy
```

⚠️ **Changer `WORKER_VERSION`** dans `worker.js` à chaque modification, et
vérifier en production :

```bash
SERVEUR=https://petits-plus.jfrxdi0zz.workers.dev npm run essai-serveur
```

⚠️ **Juste après un déploiement, le serveur peut répondre 500 quelques
secondes**, le temps que Cloudflare mette en place le stockage. Vu le
2026-09-24 au tout premier déploiement : relancé une minute après, trois
passages verts de suite. Ne pas conclure sur le premier passage.

⚠️ **Déployer le serveur AVANT de publier une app qui s'en sert.**
