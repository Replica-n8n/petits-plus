// Le paquet @material/material-color-utilities publie des imports relatifs sans
// extension, que Node refuse de résoudre. Ce crochet ajoute « .js », et seulement
// dans ce cas : toute autre erreur de résolution remonte telle quelle.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, contexte, suivant) {
    try {
      return suivant(specifier, contexte);
    } catch (erreur) {
      if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
        return suivant(specifier + '.js', contexte);
      }
      throw erreur;
    }
  },
});
