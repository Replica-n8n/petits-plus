# Petits plus

Compter les moments où ta copine te fait du bien. Un appui, c'est tout.

PWA vanilla, hors ligne, sans build et sans dépendance : les seules dépendances
du dépôt servent aux OUTILS de vérification, jamais à l'app.

- Spec : `docs/superpowers/specs/2026-09-22-petits-plus-design.md`
- Plan de la tranche en cours : `docs/plans/2026-09-23-tranche-1-le-geste.md`

## Vérifier

Le serveur local est lancé par le panneau navigateur (`petits-plus`, port 8105).

```
npm test                  le modèle et le rangement
npm run essai-tests       abîme le code exprès et exige que la batterie échoue
npm run essai-app         le parcours complet sur un vrai navigateur
npm run captures          les maquettes aux deux formats d'écran
npm run polices           la police est-elle vraiment servie
npm run palette           régénère css/couleurs.css depuis la graine
```

Aucun de ces contrôles n'a le droit de n'avoir jamais échoué : chacun sait se
mettre en défaut sur commande.

## Ce qui reste à la main

Activer GitHub Pages (`Settings` > `Pages`, `main`, racine), et déployer le
Worker à la tranche 4 depuis `serveur/`.
