// Génère css/couleurs.css depuis une seule graine, et refuse de sortir un fichier
// dont un contraste ne tient pas. Lancer : node --import ./tools/crochets.mjs tools/palette.mjs
//
// Règle de la maison : aucune couleur n'est écrite à la main. La graine est le
// rouge pâle retenu pour Petits plus, tout le reste en découle.
import { writeFileSync } from 'node:fs';
import {
  Hct, SchemeFidelity, SchemeNeutral, MaterialDynamicColors,
  argbFromHex, hexFromArgb,
} from '@material/material-color-utilities';

const GRAINE = '#c05a7d';
const SOMBRE = true;

const hct = Hct.fromInt(argbFromHex(GRAINE));
const accentue = new SchemeFidelity(hct, SOMBRE, 0);
const neutre = new SchemeNeutral(hct, SOMBRE, 0);

const pris = (schema, role) => hexFromArgb(MaterialDynamicColors[role].getArgb(schema));

// Contraste WCAG, calculé, jamais estimé.
const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
const rapport = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const FOND = pris(neutre, 'surface');

// Les colonnes des mois passés doivent être plus sobres que le mois en cours,
// mais rester au-dessus du seuil. On prend donc le ton le PLUS sombre de la
// palette qui tient encore, au lieu d'un rôle choisi au hasard : c'est ce qui
// avait fait tomber inversePrimary à 2,86:1.
function tonLePlusSobre(palette, seuil) {
  for (let ton = 40; ton <= 90; ton += 5) {
    const teinte = hexFromArgb(palette.tone(ton));
    if (rapport(teinte, FOND) >= seuil) return teinte;
  }
  throw new Error('aucun ton de la palette ne tient le seuil demandé');
}

// Les jours de l'écran de l'année portent leur NUMÉRO écrit dessus. Une case
// doit donc tenir deux contraintes à la fois : 3:1 contre le fond, pour qu'on
// la voie, et 4,5:1 avec le chiffre foncé posé dessus, pour qu'on le lise. Le
// ton 45 de la maquette ne tenait ni l'un ni l'autre : le chiffre y tombait à
// 3,54:1. On prend donc le premier ton qui tient les DEUX, puis deux pas plus
// clairs, et l'échelle ne dépend plus de l'oeil.
const SUR_JOUR = pris(accentue, 'onPrimaryContainer');
function premierTonLisible(palette) {
  for (let ton = 40; ton <= 90; ton += 5) {
    const teinte = hexFromArgb(palette.tone(ton));
    if (rapport(teinte, FOND) >= 3 && rapport(SUR_JOUR, teinte) >= 4.5) return ton;
  }
  throw new Error('aucun ton ne se voit sur le fond ET ne laisse lire un chiffre');
}
const TON_JOUR = premierTonLisible(accentue.primaryPalette);

const couleurs = {
  '--fond': pris(neutre, 'surface'),
  '--fond-eleve': pris(neutre, 'surfaceContainerHigh'),
  '--texte': pris(neutre, 'onSurface'),
  '--texte-doux': pris(neutre, 'onSurfaceVariant'),
  '--contour': pris(neutre, 'outlineVariant'),
  // L'accent sert au texte et aux gros chiffres, le bouton prend le ton plus
  // soutenu : c'est celui qui ressemble au rouge pâle des maquettes retenues.
  '--accent': pris(accentue, 'primary'),
  '--accent-passe': tonLePlusSobre(accentue.primaryPalette, 3),
  '--bouton': pris(accentue, 'primaryContainer'),
  '--sur-bouton': pris(accentue, 'onPrimaryContainer'),
  // Trois intensités pour les jours, du plus sobre au plus vif.
  '--jour-1': hexFromArgb(accentue.primaryPalette.tone(TON_JOUR)),
  '--jour-2': hexFromArgb(accentue.primaryPalette.tone(TON_JOUR + 10)),
  '--jour-3': pris(accentue, 'primary'),
  '--sur-jour': SUR_JOUR,
};

// Essai du garde-fou : force une couleur que l'on sait mauvaise, pour vérifier
// que le script refuse d'écrire. Un contrôle qui n'a jamais échoué ne prouve rien.
if (process.argv.includes('--essai-defaut')) {
  couleurs['--texte-doux'] = '#3a3536';
  console.log('essai : --texte-doux forcé à une valeur illisible');
}

// Chaque paire porte son seuil : 4,5 pour du texte courant, 3 au-delà de 24 px.
const exigences = [
  ['texte sur fond', '--texte', '--fond', 4.5],
  ['texte doux sur fond', '--texte-doux', '--fond', 4.5],
  ['texte sur fond élevé', '--texte', '--fond-eleve', 4.5],
  ['signe du bouton', '--sur-bouton', '--bouton', 4.5],
  ['gros chiffre en accent', '--accent', '--fond', 3],
  ['bouton sur le fond', '--bouton', '--fond', 3],
  ['colonne du mois en cours', '--accent', '--fond', 3],
  ['colonne des mois passés', '--accent-passe', '--fond', 3],
  ['jour sans rien, son numéro', '--texte-doux', '--fond-eleve', 4.5],
  ['jour à un moment, sur le fond', '--jour-1', '--fond', 3],
  ['jour à un moment, son numéro', '--sur-jour', '--jour-1', 4.5],
  ['jour à deux moments, son numéro', '--sur-jour', '--jour-2', 4.5],
  ['jour à trois et plus, son numéro', '--sur-jour', '--jour-3', 4.5],
];

let echecs = 0;
console.log(`graine ${GRAINE}, thème sombre\n`);
for (const [nom, devant, derriere, seuil] of exigences) {
  const r = rapport(couleurs[devant], couleurs[derriere]);
  const tenu = r >= seuil;
  if (!tenu) echecs += 1;
  console.log(
    `${tenu ? 'ok  ' : 'ÉCHEC'} ${nom.padEnd(26)} ${couleurs[devant]} sur ${couleurs[derriere]}` +
    `  ${r.toFixed(2)}:1  (minimum ${seuil}:1)`,
  );
}

if (echecs > 0) {
  console.error(`\n${echecs} contraste(s) sous le seuil : aucun fichier écrit.`);
  process.exit(1);
}

const lignes = Object.entries(couleurs).map(([nom, valeur]) => `  ${nom}: ${valeur};`);
writeFileSync(
  'css/couleurs.css',
  `/* Généré par tools/palette.mjs depuis la graine ${GRAINE}. Ne pas modifier à la main. */\n` +
  `:root {\n  color-scheme: dark;\n${lignes.join('\n')}\n}\n`,
);
console.log('\ncss/couleurs.css écrit.');
