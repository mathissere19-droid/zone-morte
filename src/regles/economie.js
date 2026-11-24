// Points, achats et caisse de ravitaillement.
import { CONFIG } from '../config.js';
import { difficulteActive } from './difficulte.js';
import { possede, ajouterArme, munitionsPleines, remplir } from './inventaire.js';

export function creerPortefeuille(points = difficulteActive().pointsDepart) {
  return { points };
}

export function gainCoup({ mortel, tete, couteau }, doubles) {
  const p = CONFIG.points;
  let gain = !mortel ? p.touche : couteau ? p.killCouteau : tete ? p.killTete : p.kill;
  return doubles ? gain * 2 : gain;
}

export function crediter(pf, n) {
  pf.points += n;
}

export function payer(pf, prix) {
  if (pf.points < prix) return false;
  pf.points -= prix;
  return true;
}

const RARES = Object.keys(CONFIG.armes).filter((id) => CONFIG.armes[id].rare);

export function tirageCaisse(rng, possedees) {
  const rare = rng() < CONFIG.caisse.chanceRare;
  const liste = rare ? RARES : CONFIG.caisse.communes;
  let choix = liste.filter((id) => !possedees.includes(id));
  if (choix.length === 0) choix = liste;
  return choix[Math.min(Math.floor(rng() * choix.length), choix.length - 1)];
}

// Résultat : 'achete' | 'recharge' | 'plein' | 'pas-assez'
export function acheterMur(pf, inv, armeId) {
  const prix = CONFIG.prixMurs[armeId];
  if (possede(inv, armeId)) {
    if (munitionsPleines(inv, armeId)) return 'plein';
    if (!payer(pf, Math.floor(prix / 2))) return 'pas-assez';
    remplir(inv, armeId);
    return 'recharge';
  }
  if (!payer(pf, prix)) return 'pas-assez';
  ajouterArme(inv, armeId);
  return 'achete';
}
