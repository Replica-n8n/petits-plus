# Tranche 1 : le geste

Plan d'exécution écrit le 2026-09-23, après validation de la spec
`docs/superpowers/specs/2026-09-22-petits-plus-design.md`. Écrit à la main :
la skill `writing-plans` n'est pas installée sur cette machine.

**But de la tranche** : une app installée sur le Pixel, qui compte un appui et
n'oublie rien. Ni langages, ni serveur, ni écran de l'année.

**Fini quand** : l'app est sur l'écran d'accueil du Pixel, l'appui compte, le
compte survit à l'app tuée et au mode avion, et la production est vérifiée.

## Les fichiers de la tranche

```
index.html
css/app.css            couleurs générées incluses
js/app.js              démarrage, événements, rendu
js/moments.js          le modèle : ajouter, retirer, compter par mois
js/stockage.js         localStorage, et l'échec d'écriture qui doit se voir
polices/<police>.woff2 sous-ensemble latin, hébergée
icons/                 192, 512, maskable 512
manifest.webmanifest
sw.js                  une seule constante VERSION
tools/palette.mjs      génère les variables CSS depuis la graine
tools/audit.mjs        contrastes, cibles, formats d'écran
CLAUDE.md              court, pointe vers les skills, ne les recopie pas
README.md
```

## Les étapes, dans l'ordre, chacune avec sa preuve

### 1. Maquette avant le code
Deux variantes de l'accueil en HTML statique, ouvertes au format Pixel 9.
Elles diffèrent sur une seule chose : la place du compte du mois précédent et la
taille des colonnes. Tu choisis.
**Preuve** : capture des deux à 360 × 732, et le choix est noté ici.
**Fait le 2026-09-23 : elle a choisi la variante B.** Le compte de chaque mois
passe sous sa colonne, le graphe prend toute la place restante (357 px mesurés
contre 132 pour A), et la ligne « août : 9 » disparaît puisqu'elle était déjà
lisible dans le graphe.

### 2. La palette, générée
`tools/palette.mjs` prend le rouge pâle comme graine, sort les variables CSS :
accent en SchemeFidelity, fonds et gris en SchemeNeutral. Sortie commitée dans
`css/app.css`, jamais retouchée à la main.
**Preuve** : le script imprime chaque paire texte/fond avec son rapport calculé.
Aucune paire sous 4,5:1, ni sous 3:1 au-delà de 24 px. Une valeur forcée hors
norme doit faire échouer le script : on le vérifie en en cassant une exprès.

### 3. La police
Deux ou trois candidates variables, chiffres à chasse fixe, sous-ensemble latin
en woff2, posées dans `polices/`.
**Preuve** : poids du fichier annoncé, et la page rendue **réseau coupé** avec la
bonne police, pas un repli système.

### 4. Le modèle, avant toute interface
`js/moments.js` et `js/stockage.js`. Un moment porte : identifiant tiré au hasard,
instant absolu, auteur, langage à `null`, marque de suppression. Rien de tout ça
n'est utilisé cette tranche, et tout doit y être : sans ça, rien de ce qui est
gardé avant l'appairage ne sera synchronisable.
**Preuve** : `node --test`, écrit avant le code. Cas couverts : ajouter, compter
par mois sur un changement d'année, retirer par marque sans perdre la ligne,
reposer deux fois le même identifiant sans créer de doublon, et une écriture
refusée qui **lève** au lieu de mentir. Chaque test est prouvé en injectant le
défaut qu'il doit attraper.

### 5. L'accueil, sans interaction
Structure et style : `height:100svh`, la page ne défile pas, bouton pleine largeur
de 72 px en bas, au moins 24 px de vide avant lui, échelle d'espacement en 4, 8,
12, 16, 24, 32 px. Pas de cartes bordées, pas de capitales partout.
**Preuve** : rendu à 360 × 732 **et** 360 × 640, rien ne dépasse, rien ne défile.

### 6. L'appui court
Le chiffre roule vers le haut, la colonne du mois grandit dans le même mouvement,
200 ms, décélération franche. L'interface est bloquée pendant l'animation, sinon
un second appui compte un moment de trop. Vibration brève.
**Preuve** : deux appuis en 100 ms comptent 2, jamais 3. Sous
`prefers-reduced-motion`, le chiffre change tout de suite et reste juste.
⚠️ Un élément recréé par `innerHTML` naît à son état final : animer l'élément qui
existe déjà, pas un nouveau.

### 7. Le bandeau et l'annulation
`Gardé · Annuler`, six secondes, puis il s'en va tout seul. `préciser` n'existe pas
encore, il arrive avec les langages en tranche 2.
**Preuve** : annuler dans la fenêtre retire le moment et remet le chiffre, annuler
après ne fait rien. Le bandeau ne bloque jamais le bouton.

### 8. Les six colonnes
Les six derniers mois, mois en cours en couleur vive, mois sans rien à zéro et non
absent. Le mois précédent en petit sous le grand chiffre.
**Preuve** : jeu de données couvrant un passage de décembre à janvier.

### 9. La persistance
**Preuve** : appuyer, recharger, le compte est là. Tuer l'app, rouvrir, le compte
est là. Bloquer les données de site dans Chrome : l'app dit que ça n'a pas été
gardé, elle n'affiche pas un moment qui n'existe pas.

### 10. Manifeste, icônes, service worker
`manifest.webmanifest`, icônes 192, 512 et maskable, `theme-color` unique puisque
le fond reste sombre. `sw.js` : une seule constante `VERSION`, cache
`petits-plus:app:v1`, ne supprime que ses propres caches, `?v=` à l'installation,
`res.clone()` **avant** tout `then`, navigation en `fetch(url,{cache:'no-cache'})`.
**Preuve** : réseau coupé, l'app se relance depuis l'écran d'accueil. Les caches
des autres apps de l'origine sont intacts après installation.

### 11. L'installation
Capter `beforeinstallprompt` et proposer un bouton visible. Le repli iOS
(« Partager, puis Sur l'écran d'accueil ») s'écrit sans être vérifiable ici.
**Preuve** : installée sur ton Pixel, par toi, et confirmée.

### 12. L'audit et la revue
`tools/audit.mjs` : contrastes **mesurés sur les pixels d'une capture**, cibles à
44 px avec 8 px entre elles, deux formats d'écran, aucun tiret cadratin dans les
textes de l'interface. Puis `/code-review`.
**Preuve** : l'audit échoue quand on injecte une cible de 30 px ou un gris trop
pâle. Un audit qui n'a jamais échoué ne prouve rien.

### 13. Pousser et vérifier en production
Commit, push sur `main`, Pages activé par toi, puis vérifier **sur l'adresse
publique** que les fichiers répondent, que le service worker prend la main au
rechargement et que l'app se relance hors ligne.
**Preuve** : la sortie du script de vérification en ligne, et le commit de retour
en arrière noté dans la mémoire du projet.

## Ce que cette tranche ne fait pas

Les cinq langages, l'appui long, la cible `préciser`, l'écran de l'année, le
Worker, l'appairage, la synchronisation, l'export JSON. Chacun a sa tranche.

## Les deux pièges déjà payés ailleurs, à ne pas repayer

- **Le service worker ment pendant le développement** : `VERSION` inchangée veut
  dire ancien fichier servi, donc un audit peut mesurer du code déjà corrigé. Se
  désinscrire et vider les caches avant de conclure quoi que ce soit.
- **Pages garde le HTML dix minutes** : tout élément ajouté au HTML reste
  facultatif pour le JS, sinon une visite tombe sur du nouveau JS et de l'ancien
  HTML.
