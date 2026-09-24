# Tranche 3 : l'écran de l'année

Plan écrit le 2026-09-24, après la tranche 2 vérifiée contre la production.

**But** : un second écran pour regarder posément ce que l'accueil montre en
trois secondes. Les jours, le total, et la répartition des cinq langages.

**Fini quand** : on y va depuis l'accueil et on en revient, y compris par le
bouton retour d'Android, on voit chaque jour de la période, on peut ouvrir un
jour, retirer un moment d'aujourd'hui seulement, et la répartition n'apparaît
que quand elle a de quoi parler. Prouvé sur Chromium au format Pixel 9, puis
contre la production.

## Tranché d'office, et pourquoi

- **La période est celle du graphe de l'accueil** : les douze derniers mois,
  jamais avant le premier moment. Deux écrans qui parlent de périodes
  différentes, c'est deux totaux qui ne se recoupent pas.
- **Le retour système d'Android ramène à l'accueil.** Sans `history.pushState`,
  il fermerait l'app. C'est le premier geste qu'on fait pour revenir.
- **Retirer un moment se fait en deux temps par « Annuler »**, jamais par une
  boîte de confirmation, comme sur l'accueil.
- **Seuls les moments d'aujourd'hui se retirent.** Au-delà, c'est réécrire le
  passé, ce que la spec refuse comme elle refuse de rattraper un langage.
- **La grille de 53 semaines façon GitHub est écartée d'office** : sur 328 px
  utiles, une case fait 5 px. `a-deux` l'avait déjà rejetée pour la même raison.

## Les étapes, chacune avec sa preuve

### 1. Le modèle
`comptesParJour`, `momentsDuJour`, `peutRetirer` (aujourd'hui seulement), et le
total de la période.
**Preuve** : tests écrits avant le code. Un moment retiré ne compte pas dans son
jour, minuit sépare bien deux jours dans le fuseau du téléphone, un moment
d'hier ne se retire pas.

### 2. Deux maquettes de la grille, avant de coder l'écran
Les jours sont trop nombreux pour être tous touchables à 44 px sur un écran de
360 px. Deux façons de résoudre ça, à trancher avec elle sur pièces.
**Preuve** : deux captures au format Pixel 9 avec de vraies données, et son
choix noté ici.

### 3. La navigation
`L'année ›` en haut de l'accueil, un retour visible en haut de l'écran de
l'année, et le retour système d'Android.
**Preuve** : aller, revenir par la cible, revenir par le retour du navigateur.
L'accueil retrouvé est à jour.

### 4. La grille
Selon le choix de l'étape 2.
**Preuve** : chaque jour de la période est présent une fois, les intensités
suivent les comptes, contrastes mesurés sur les pixels.

### 5. Le détail d'un jour
Ce qu'il contient : l'heure et le langage de chaque moment. Pour aujourd'hui
seulement, une cible pour retirer, suivie d'« Annuler ».
**Preuve** : retirer puis annuler rend le moment, retirer hier est impossible,
et le compte de l'accueil suit.

### 6. La répartition des langages
Déplacée de l'accueil le 2026-09-24. Des barres horizontales avec le nom écrit à
côté de chaque part : aucune légende à décoder.
**Seuil** : au moins la moitié des moments de la période portent un langage, et
au minimum dix. Sinon rien, plutôt qu'un graphe qui décrirait surtout les jours
où on a pensé à préciser.
**Preuve** : sous le seuil elle est absente, au-dessus elle apparaît, et un
moment retiré en sort.

### 7. Audit, revue, production
`npm run audit` étendu au nouvel écran, `/code-review`, puis la production.
⚠️ Attendre que le fichier servi contienne vraiment la nouvelle ligne avant de
croire un résultat de production : la build de Pages a déjà pris cinq minutes.
