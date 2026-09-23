// Dessine les icônes depuis les couleurs générées : aucune valeur écrite ici.
// Lancer : node tools/icones.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const css = readFileSync('css/couleurs.css', 'utf8');
const lire = (nom) => {
  const depart = css.indexOf(nom + ":");
  if (depart === -1) throw new Error("couleur absente de css/couleurs.css : " + nom);
  const fin = css.indexOf(";", depart);
  return css.slice(depart + nom.length + 1, fin).trim();
};
const fond = lire('--fond');
const bouton = lire('--bouton');
const surBouton = lire('--sur-bouton');

// Le signe occupe 46 % de l'icône ordinaire, et 34 % de la maskable : Android
// rogne jusqu'à 20 % de chaque bord, donc tout ce qui compte tient au centre.
const page = (taille, part, rond) => `<!DOCTYPE html><meta charset="utf-8">
<style>
  html,body{margin:0}
  body{width:${taille}px;height:${taille}px;background:${fond};display:grid;place-items:center}
  .pastille{
    width:${Math.round(taille * (rond ? 0.62 : 0.78))}px;
    height:${Math.round(taille * (rond ? 0.62 : 0.78))}px;
    background:${bouton};border-radius:${rond ? '50%' : `${Math.round(taille * 0.22)}px`};
    display:grid;place-items:center;
  }
  .signe{position:relative;width:${Math.round(taille * part)}px;height:${Math.round(taille * part)}px}
  .signe::before,.signe::after{
    content:"";position:absolute;background:${surBouton};border-radius:${Math.round(taille * 0.02)}px;
  }
  .signe::before{left:0;right:0;top:38%;bottom:38%}
  .signe::after{top:0;bottom:0;left:38%;right:38%}
</style>
<div class="pastille"><div class="signe"></div></div>`;

mkdirSync('icons', { recursive: true });
const navigateur = await chromium.launch();

const aFaire = [
  ['icons/icone-192.png', 192, 0.46, false],
  ['icons/icone-512.png', 512, 0.46, false],
  ['icons/icone-maskable-512.png', 512, 0.34, true],
];

for (const [fichier, taille, part, rond] of aFaire) {
  const contexte = await navigateur.newContext({ viewport: { width: taille, height: taille } });
  const p = await contexte.newPage();
  await p.setContent(page(taille, part, rond));
  await p.screenshot({ path: fichier });
  console.log(`${fichier} ${taille}x${taille}`);
  await contexte.close();
}

await navigateur.close();
