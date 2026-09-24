# Tranche 4 : le partage à deux

Plan écrit le 2026-09-24, après les tranches 1 à 3 vérifiées, et la 1 prouvée
sur son vrai Pixel.

**But** : deux téléphones, un seul compteur. Elle appuie quand elle te dit
quelque chose, tu appuies quand elle ne l'a pas fait, et les deux voient la
même chose, y compris après un passage hors ligne.

**Fini quand** : deux téléphones appairés par un code tapé une fois voient le
même compte, un appui fait hors ligne arrive à l'autre au retour du réseau, un
retrait et un langage suivent, le même moment noté deux fois se signale, et le
tout est prouvé contre le VRAI Worker déployé, puis sur vos deux vrais
téléphones.

## Repris du relais de Paper Race (`games/serveur-paper-race/`), qui a fait ses preuves

- `WORKER_VERSION` renvoyée par `GET /` : la seule façon de savoir quel code
  tourne vraiment.
- Les origines autorisées : nos sites et le local, personne d'autre.
- L'alphabet des codes sans lettres ambiguës (ni 0/O/Q, ni 1/I/L).
- **Déployer le serveur AVANT de publier l'app qui s'en sert.**

Différences voulues : **rien ne s'efface** (Paper Race oublie une course après
24 h, ici c'est des années de moments), et **aucune connexion permanente** : la
spec demande des échanges ponctuels, pour la batterie.

## Tranché d'office, et pourquoi

- **Une seule règle de fusion, écrite une fois.** Le Worker importe
  `js/moments.js` et appelle le même `fusionner` que les téléphones. Deux
  copies de la règle finiraient par diverger, et deux téléphones par ne plus
  voir la même chose.
- **Un moment porte désormais `modifieLe`.** Poser un langage modifie un moment
  existant ; sans horodatage, deux téléphones qui précisent le même moment ne
  sauraient pas lequel garder. La suppression, elle, l'emporte toujours.
- **Chaque téléphone a un identifiant d'appareil**, qui devient l'auteur de ses
  appuis. Les moments d'avant l'appairage, marqués `moi`, reçoivent celui du
  téléphone qui les a notés au moment de l'appairage.
- **Le doublon se dit sans genre** : « Déjà noté sur l'autre téléphone il y a
  4 min ». La spec disait « Elle a déjà noté », ce qui est faux sur le
  téléphone de ta copine. Et la cible s'appelle « C'est le même » : c'est la
  même action qu'« Annuler », avec le bon nom.
- **Changer le code se fait en deux appuis**, sans boîte de dialogue : le
  premier transforme le bouton en « Toucher encore pour changer » trois
  secondes. Ça ne s'annule pas : l'ancien code est mort pour de bon.
- **Un partage coupé se voit sur l'accueil**, discrètement, avec un chemin vers
  les réglages. Être hors ligne, non : c'est passager et ça se rattrape seul.
  Mais un code changé ou inconnu ne se répare pas tout seul, et une panne que
  personne ne voit, c'est deux téléphones qui divergent en silence.
- **Le réglage « Proposer les langages »** reporté de la tranche 2 arrive ici,
  avec la feuille de réglages : deux lignes nommées avec une coche.

## Les étapes, chacune avec sa preuve

### 1. Le modèle
`modifieLe` posé par `ajouter`, `preciser` et `retirer`. `fusionner` garde le
langage le plus récent, et la suppression l'emporte toujours.
**Preuve** : tests écrits avant le code, défauts injectés dans le banc de
mutations.

### 2. Le serveur, testé en local
Worker + Durable Object en SQLite dans `serveur/`. `POST /couples` crée un
code ; `POST /couples/:code/sync` reçoit des moments et rend ceux qui ont
changé depuis un curseur ; `POST /couples/:code/code` change le code et coupe
l'ancien. Tout moment reçu est validé, les requêtes sont plafonnées.
**Preuve** : `tools/essai-serveur.mjs` contre `wrangler dev`, puis les mêmes
contrôles avec des défauts injectés.

### 3. Le déploiement
`npx wrangler deploy` depuis `serveur/`, avec son compte déjà connecté.
**Preuve** : `GET /` renvoie la bonne `WORKER_VERSION`, et le même banc passe
contre `https://petits-plus.jfrxdi0zz.workers.dev`.

### 4. L'app : appairer, synchroniser, signaler
La feuille de réglages, le code, la file d'envoi qui survit au rechargement, le
rythme (ouverture, retour sur l'app, après un appui, chaque minute), le doublon,
et le partage coupé.
**Preuve** : deux contextes de navigateur, deux « téléphones », contre le
Worker local, puis contre le vrai.

### 5. Audit, revue, production, puis vos deux téléphones
⚠️ Attendre que la production serve vraiment le nouveau fichier avant d'y
croire. Et le test qui compte : ton Pixel et le téléphone de ta copine.
