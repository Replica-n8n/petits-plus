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
