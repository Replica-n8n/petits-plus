# Petits plus : spec de conception

Écrite le 2026-09-22, à la suite d'un brainstorm complet. Chaque décision ci-dessous
a été prise avec toi, option par option. Les raisons sont gardées : une règle dont
on a perdu la raison finit par être contournée.

## 1. Ce que c'est

Une PWA vanilla, hors ligne d'abord, qui **compte les moments où ta copine te fait
du bien**, mot ou geste. Un appui, c'est tout. Deux téléphones alimentent le même
compteur.

**Le but retenu, entre trois proposés : remarquer le positif.** Pas arbitrer un
équilibre, pas tenir un journal. Ça commande tout le reste.

**Le négatif a été écarté en cours de route, et c'est définitif.** Le premier jet
prévoyait un bouton rouge pour les critiques. Deux raisons de l'avoir retiré :

- Un compteur de critiques ne mesure pas le comportement de l'autre, il mesure
  l'attention de celui qui appuie. On remarque mieux une critique qu'un compliment,
  surtout un jour de fatigue. Un ratio calculé là-dessus n'apprend rien de fiable.
- Deux boutons symétriques racontent un match. L'app deviendrait un dossier à charge,
  ce qui n'est pas ce que tu veux fabriquer.

## 2. Ce que l'app ne fait pas, délibérément

Cette liste a la même valeur que la liste des fonctions. Elle protège le sujet.

- **Aucun négatif.** Pas de rouge, pas de « moins », jamais.
- **Aucun objectif, aucune série à ne pas casser, aucun rappel, aucune notification.**
  L'app compte, elle ne réclame rien. C'est ce qui empêche complimenter de devenir
  une tâche à cocher, puisque ta copine voit le même écran.
- **Aucune phrase de jugement.** Un mois plus bas est une colonne plus courte.
  L'app n'écrit jamais « moins que le mois dernier ».
- **Aucun texte libre.** Rien d'intime ne quitte les téléphones : un moment, c'est une
  date, un langage éventuel, et qui a appuyé.
- **Aucun compte, aucun courriel, aucun mot de passe.** Un code de couple, tapé une fois.
- **Aucun langage rattrapé après coup.** Cocher « c'était des services rendus » trois
  mois plus tard, c'est inventer une donnée.
- **Aucun comptage par personne affiché.** Qui a appuyé est stocké, sert uniquement à
  repérer un doublon, et n'apparaît jamais sous forme de « elle 8, toi 6 ».

## 3. Les cinq langages

Un moment peut porter un des cinq langages de l'amour : paroles valorisantes,
moments de qualité, cadeaux, services rendus, toucher.

Pourquoi eux plutôt qu'une liste de thèmes libres : la question n'est plus « est-ce
que ça compte ? », qui fait hésiter et tue le geste rapide, mais « c'était lequel ? »,
à laquelle on répond toujours. Et comme `a-deux` fait classer les cinq langages de
chacun, compter ce que tu **reçois** par langage dit quelque chose que personne ne
devine : elle t'aime peut-être en services rendus quand tu attends des paroles.

**Le langage est facultatif pour toujours.** « Non précisé » est une vraie valeur :
un moment sans langage est compté partout comme les autres. La répartition des
langages ne s'affiche que lorsqu'assez de moments en portent un, sinon elle
mentirait. Le volet, lui, reste toujours proposé : une option qui se cache n'existe
plus. Une ligne de réglage l'éteint, une autre le rallume.

## 4. Les écrans et les gestes

Trois écrans : un pour agir, un pour regarder, une feuille pour les réglages.

### L'accueil, écran d'usage

De haut en bas : le mois en cours en gros chiffre, le mois précédent en petit
dessous, les six derniers mois en colonnes avec le mois en cours en couleur vive,
la répartition des langages si elle a de quoi parler, un espace vide, puis le
bouton **+** pleine largeur en bas, 72 px de haut, sous le pouce. `height:100svh`,
la page ne défile pas. Une cible `L'année ›` en haut ouvre le second écran, une
icône ouvre les réglages.

### L'appui court

Compté à la seconde. Le chiffre roule vers le haut, la colonne du mois grandit dans
le même mouvement, vibration brève. Un bandeau apparaît six secondes :
`Gardé · préciser · Annuler`, puis s'en va tout seul. Rien à confirmer, jamais.

### L'appui long

Le volet des cinq langages monte : cinq cibles pleine largeur de 48 px, 8 px entre
elles. Un choix ferme le volet et enregistre. Relâcher sans choisir enregistre quand
même, sans langage : le geste n'est jamais perdu.

**Le problème connu de l'appui long, et sa réponse.** Un appui long ne se voit pas, et
on n'écrit pas de notice sous un bouton. La réponse est la cible `préciser` du
bandeau : après un appui court, le contrôle est visible pendant ces six secondes,
donc la fonction existe. L'appui long reste le chemin rapide de celui qui la connaît.

### Le même moment noté deux fois

Si l'autre téléphone a noté il y a moins de trente minutes, le bandeau dit
`Elle a déjà noté il y a 4 min` avec une cible `c'est le même`, qui n'en laisse qu'un.
Sans réponse, **les deux restent** : un appui volontaire ne se supprime pas tout seul.

### L'écran de l'année

La grille des jours en pastilles, plus foncées quand plusieurs moments, le total de
l'année, la répartition des cinq langages. Toucher un jour montre ce qu'il contient,
et permet d'en retirer un **le jour même** seulement.

### La feuille de réglages

Le code de couple et l'appairage, la ligne `Proposer les langages` avec sa coche, la
sauvegarde, la version. Le corps défile, le pied reste hors de ce défilement.

## 5. Les données et le partage à deux

**L'app marche seule dès la première ouverture.** Aucun code, aucun appairage. Tu peux
t'en servir le soir même, ta copine installera l'app quand elle voudra.

**Ta copine voit exactement le même écran que toi.** Choisi parmi trois options : masquer
le résultat d'une mesure qui porte sur son comportement à elle en ferait un outil de
surveillance, même gentil.

- **Front** : PWA vanilla, aucun build, aucune dépendance, dépôt autonome
  `petits-plus` servi par GitHub Pages, même forme que `a-deux`.
- **Serveur** : un Worker Cloudflare avec un Durable Object en SQLite, dossier
  `serveur/` du même dépôt, déployé par `npx wrangler deploy`. Patron déjà éprouvé
  chez elle : `games/serveur-paper-race/`, plan gratuit.
- **Appairage** : le premier téléphone crée le couple et affiche un code de six
  caractères sans lettres ambiguës. Le second le tape une fois. Le code est la seule
  clé, régénérable depuis les réglages, ce qui coupe l'accès à l'ancien.
- **Un moment** : un identifiant tiré au hasard par le téléphone, l'instant absolu,
  le langage ou rien, l'auteur, et une marque de suppression éventuelle.
- **Pas de conflit possible, par construction** : le serveur n'ajoute que des moments.
  Comme l'identifiant vient du téléphone, renvoyer deux fois le même appui ne crée
  pas de doublon. Retirer un moment pose une marque, n'efface jamais une ligne :
  sinon un téléphone hors ligne le ferait réapparaître à son retour.
- **Rythme des échanges** : à l'ouverture, au retour sur l'app, juste après un appui,
  et toutes les minutes tant que l'écran est allumé. Pas de connexion permanente :
  un compliment n'a pas besoin d'arriver en 200 ms, et la batterie compte.
- **Hors ligne** : l'appui est écrit localement puis mis dans une file qui survit au
  rechargement et à l'app tuée. Les chiffres affichés sont ceux du téléphone, tout de
  suite, jamais un écran d'attente.
- **Sauvegarde** : une ligne des réglages exporte tout en JSON et sait le relire. Deux
  ans de moments ne doivent pas tenir à un service gratuit.
- **Cache** : une seule constante `VERSION` dans `sw.js`, cache nommé
  `petits-plus:app:vN` qui ne supprime que les siens, `?v=` à l'installation pour ne
  pas ranger un ancien fichier. Les clés de stockage ne sont jamais renommées.
- **Une écriture de stockage refusée doit se voir** : un navigateur qui bloque les
  données de site fait lever l'écriture, et l'app ne doit pas annoncer un moment gardé
  qui ne l'est pas. Piège déjà rencontré sur `a-deux`.

## 6. L'identité visuelle

**Fond sombre et rouge pâle**, choisi par toi après avoir vu six autres directions
(bocal de billes, tampon encré, lumière du jour, tricot, fil de perles, mosaïque).
Tu as tranché : « on revient sur les premiers mockups, ça allait très bien ».

**Le fond reste sombre en permanence**, il ne suit pas le thème du téléphone. Choisi
entre les deux options : une seule version à dessiner, à mesurer et à maintenir.

Ce qui faisait que tes apps se ressemblaient n'était pas le fond sombre, c'étaient
les cartes bordées de 1 px et les petites étiquettes en capitales partout. Donc :

- Palette générée par `material-color-utilities` à partir de ce rouge pâle comme
  graine : accent en SchemeFidelity, fonds et gris en SchemeNeutral, qui n'ont aucune
  teinte. Aucune couleur écrite à la main.
- Pas de cartes bordées, pas d'étiquettes en capitales partout. La hiérarchie vient
  de la taille des chiffres et du vide autour.
- **Une seule signature** : le chiffre du mois qui roule vers le haut et la colonne en
  cours qui grandit dans le même mouvement, 200 ms, décélération franche, immobile
  sous `prefers-reduced-motion`.
- Une police variable hébergée dans le dépôt, woff2, sous-ensemble latin, chiffres à
  chasse fixe. Aucune police chargée depuis un serveur extérieur.
- Contrastes **calculés** : 4,5:1 pour le texte, 3:1 au-delà de 24 px. Le bouton doit
  rester lisible en plein jour, ce qui est le risque assumé d'un fond sombre unique.
- Cibles de 44 px minimum, 8 px entre deux cibles, au moins 24 px avant le bouton
  principal, échelle d'espacement unique en 4, 8, 12, 16, 24, 32 px.
- Pas de glyphe de police pour une icône : SVG en ligne, en `currentColor`. Sur
  Android le repli d'un caractère comme `✎` n'a que le dessin émoji.

## 7. L'ordre de construction

Dès la tranche 1, l'app est utilisable tous les jours, seule sur ton téléphone.

1. **Le geste.** Accueil, appui court, chiffre qui roule, six colonnes, « Annuler »,
   stockage local, service worker, icône, manifeste, installation sur le Pixel.
   Ni langages, ni serveur.
2. **Les langages.** Appui long, volet des cinq, cible `préciser`, répartition quand
   elle a de quoi parler, ligne de réglage pour l'éteindre.
3. **L'année.** Grille des jours, total, répartition des langages, retrait d'un moment
   le jour même.
4. **Le partage à deux.** Worker, appairage par code, file hors ligne, synchronisation,
   détection du doublon. Tranche risquée, donc seule.
5. **La sauvegarde.** Export et import JSON, régénération du code de couple.

**Ce qui ne peut pas attendre la tranche 4** : dès la tranche 1, chaque moment est
écrit avec son identifiant, l'instant absolu et l'auteur, et une suppression est une
marque. Sinon tout ce qui aura été gardé avant l'appairage sera impossible à
synchroniser, et il faudra le jeter.

## 8. Ce qui vaut comme preuve

- **Sur ton vrai Pixel 9a**, pas dans un simulateur : appuyer, tuer l'app, la rouvrir,
  le compte est là. Mode avion, appuyer, revenir en ligne, ça part.
- **Aux deux formats**, 360 × 732 et 360 × 640 : le bouton ne dépasse pas, la page ne
  défile pas.
- **Animations réduites** : l'état change quand même, tout de suite.
- **Contrastes mesurés sur les pixels d'une capture**, pas sur les couleurs déclarées.
- **La tranche 4 se teste contre le vrai Worker déployé, avec deux téléphones**, jamais
  contre une imitation locale. Worker éteint, l'app doit continuer de compter.
- **Chaque contrôle est prouvé en injectant un défaut.** Un essai qui n'a jamais
  échoué ne prouve rien.
- **Audit et `/code-review` avant de pousser.**
- **Vérifier sur la production après avoir poussé**, et noter le commit de retour en
  arrière dans la mémoire du projet.

## 9. Ce que tu fais, et que je ne peux pas faire

- **Créer le dépôt** `Replica-n8n/petits-plus`, public et vide, puisqu'il n'y a pas de
  `gh` en ligne de commande ici.
- **Activer GitHub Pages** : `Settings` > `Pages`, branche `main`, dossier racine.
- **`npx wrangler login`** une fois, à la tranche 4, avec ton compte Cloudflare.
- **Installer l'app sur ton Pixel**, et ta copine sur le sien à la tranche 4.

Le dépôt est public : le code est lisible par tous, **les moments ne le sont pas**,
ils ne sont jamais dans le dépôt. Pages sur un dépôt privé demande un compte payant.

## 10. Questions laissées ouvertes

- **Le nom des cinq langages à l'écran** reste à écrire court, sans notice : « paroles »,
  « moments », « cadeau », « service », « toucher » sont des candidats de travail.
- **La police exacte** se choisit à la maquette de la tranche 1, parmi des variables
  hébergeables, avec chiffres à chasse fixe.
- **Le seuil d'affichage de la répartition des langages** (combien de moments
  précisés avant de l'afficher) se règle sur de vraies données à la tranche 2, pas
  au jugé.

## Contexte utile pour la suite

- Ce document sera commité dans le dépôt `petits-plus` à l'ouverture de la tranche 1,
  avec un `CLAUDE.md` court qui pointe vers les skills au lieu de les recopier.
- La skill `writing-plans` n'est pas installée : le plan de chaque tranche s'écrit
  à la main.
