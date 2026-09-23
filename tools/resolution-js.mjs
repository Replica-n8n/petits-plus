// Le paquet @material/material-color-utilities publie des imports sans extension,
// que Node refuse de résoudre. Ce crochet ajoute « .js » quand c'est le seul défaut.
export async function resolve(specifier, context, suivant) {
  try {
    return await suivant(specifier, context);
  } catch (erreur) {
    if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
      return suivant(specifier + '.js', context);
    }
    throw erreur;
  }
}
