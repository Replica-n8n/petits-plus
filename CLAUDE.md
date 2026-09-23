# Petits plus, pour une session Claude

PWA vanilla hors ligne. Lire d'abord la spec
`docs/superpowers/specs/2026-09-22-petits-plus-design.md` et le plan de la
tranche en cours dans `docs/plans/`.

## Ce qui est propre à ce dépôt

- **Aucune couleur ne s'écrit à la main.** `css/couleurs.css` est généré par
  `npm run palette` depuis une seule graine, et le script refuse d'écrire si un
  contraste calculé passe sous son seuil.
- **Une seule constante `VERSION`**, en haut de `sw.js`. Les fichiers sont
  précachés avec `?v=` : sans ça, un service worker installé juste après une
  mise en ligne range l'ancien fichier servi par le cache de Pages.
- **Le modèle est prêt pour la synchronisation depuis la tranche 1** :
  identifiant tiré par le téléphone, instant absolu, auteur, suppression par
  marque. Ne jamais effacer une ligne : un téléphone hors ligne la ferait
  revenir.
- **Une écriture de rangement refusée doit se voir à l'écran.** L'app ne compte
  jamais un moment qu'elle n'a pas réussi à garder.
- **Aucun négatif, aucun objectif, aucune notification.** Ces absences sont des
  décisions, pas des oublis : voir la section 2 de la spec avant d'ajouter quoi
  que ce soit.

## Les contrôles

`npm test`, `npm run essai-tests`, `npm run essai-app`, `npm run captures`,
`npm run polices`. Chacun sait se mettre en défaut sur commande, et doit le
rester : un contrôle qui n'a jamais échoué ne prouve rien.

Les skills de la maison (brainstorming, test-driven-development, code-review)
ne sont pas recopiées ici : les appeler par leur nom.
