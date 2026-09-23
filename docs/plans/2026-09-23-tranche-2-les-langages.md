# Tranche 2 : les langages

Plan écrit le 2026-09-23, après la tranche 1 livrée et vérifiée en production.

**But** : pouvoir dire, sans ralentir le geste, lequel des cinq langages un
moment portait. Facultatif pour toujours.

**Fini quand** : l'appui long ouvre les cinq langages, `préciser` les rend
visibles depuis le bandeau, un moment sans langage reste compté partout, et le
tout est prouvé sur Chromium au format Pixel 9 puis contre la production.

## Les noms des cinq langages : repris de `a-deux`, pas réinventés

`a-deux/js/coeur.js` les nomme déjà. On reprend **les mêmes identifiants et les
mêmes mots**, sinon « services » ne voudra pas dire la même chose dans les deux
apps, et les rapprocher un jour deviendra impossible.

| id | nom | court |
|---|---|---|
| `paroles` | Paroles valorisantes | Paroles |
| `moments` | Moments de qualité | Moments |
| `cadeaux` | Cadeaux | Cadeaux |
| `services` | Services rendus | Services |
| `toucher` | Toucher physique | Toucher |

## Les étapes, chacune avec sa preuve

### 1. Le modèle
`preciser(liste, id, langue)` pose un langage sur un moment existant, et
`repartition(liste, { fin })` compte par langage sur une période.
**Preuve** : tests écrits avant le code. Un moment retiré ne compte pas dans la
répartition, un langage inconnu est refusé, préciser deux fois remplace au lieu
d'empiler, et un moment sans langage reste compté dans le mois.

### 2. L'appui long, sans jamais perdre ni doubler un geste
Le volet s'ouvre à 400 ms. **Le moment est gardé dans les deux cas** : appui
court, il est gardé au relâchement ; appui long, il est gardé quand le volet
s'ouvre, et le langage vient s'y poser ensuite.
**Preuve** : un appui court compte 1, un appui long compte 1 et pas 2, la
touche Entrée compte 1, et l'enchaînement long puis relâchement ne compte pas
un moment de plus. Chaque cas est injecté en défaut pour vérifier que le
contrôle mord.

### 3. Le volet
Cinq cibles pleine largeur de 48 px, 8 px entre elles, dans l'ordre du tableau
ci-dessus. Il se ferme par un choix, par un appui hors du volet, ou par Échap.
Aucune phrase d'explication.
**Preuve** : cibles mesurées, fermeture par les trois chemins, et le moment
reste gardé quand on ferme sans choisir.

### 4. La cible `préciser` dans le bandeau
Après un appui court, le bandeau devient `Gardé · préciser · Annuler` et
`préciser` ouvre le même volet pour ce moment-là. C'est ce qui rend l'appui
long visible sans écrire de notice.
**Preuve** : les trois cibles tiennent 44 px avec 8 px entre elles sur 360 px
de large, et `préciser` pose bien le langage sur le dernier moment.

### 5. Le réglage `Proposer les langages` : REPORTÉ, et voici pourquoi
Décidé le 2026-09-23 en cours de tranche. Le volet ne s'ouvre jamais tout seul :
il faut un appui long ou toucher `préciser`. Il n'interrompt donc rien, et il
n'y a rien à éteindre. Construire une feuille de réglages entière pour une
seule ligne, c'est bâtir un écran avant son contenu. Le réglage arrivera avec
la feuille de réglages, en tranche 4, quand l'appairage lui donnera de quoi
exister.

### 5 bis. L'ancien réglage, pour mémoire
Une ligne nommée avec une coche, pas un interrupteur. Décochée, l'appui long ne
fait plus rien et `préciser` disparaît du bandeau. Les langages déjà posés
restent.
**Preuve** : le réglage survit au rechargement, et l'app décochée ne perd aucun
moment.

### 6. La répartition : deux maquettes avant de coder
La question laissée ouverte par la spec, à trancher sur pièces avec elle : où
la montrer sans ajouter une légende qu'on relit à chaque coup d'oeil, et à
partir de combien de moments précisés elle a de quoi dire quelque chose.
**Preuve** : deux captures au format Pixel 9, et son choix noté ici.

### 7. Audit, revue, production
`npm run audit`, `/code-review`, puis le parcours complet contre la production.
⚠️ Toujours relancer la vérification de production une deuxième fois : le cache
de Pages a déjà fait tomber deux contrôles pour rien.

## Ce que cette tranche ne fait pas

L'écran de l'année, le Worker, l'appairage, la sauvegarde. Et surtout : **aucun
langage ne se rattrape après coup**. Ce qui n'a pas été précisé sur le moment
reste « non précisé », c'est écrit dans la spec et ça ne se négocie pas ici.
