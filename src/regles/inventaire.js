// Armes portées (2 emplacements) et munitions.
import { CONFIG } from '../config.js';
import { reserveMax } from './difficulte.js';

const nouvelle = (id) => ({ id, chargeur: CONFIG.armes[id].chargeur, reserve: reserveMax(id) });

export function creerInventaire() {
  return { armes: [nouvelle('pistolet')], active: 0, grenades: CONFIG.grenade.max };
}

export function armeActive(inv) {
  return inv.armes[inv.active];
}

export function tirer(inv) {
  const a = armeActive(inv);
  if (a.chargeur <= 0) return false;
  a.chargeur--;
  return true;
}

export function peutRecharger(inv) {
  const a = armeActive(inv);
  return a.reserve > 0 && a.chargeur < CONFIG.armes[a.id].chargeur;
}

export function recharger(inv) {
  const a = armeActive(inv);
  const n = Math.min(CONFIG.armes[a.id].chargeur - a.chargeur, a.reserve);
  a.chargeur += n;
  a.reserve -= n;
}

export function possede(inv, id) {
  return inv.armes.some((a) => a.id === id);
}

export function ajouterArme(inv, id) {
  if (inv.armes.length < 2) {
    inv.armes.push(nouvelle(id));
    inv.active = inv.armes.length - 1;
  } else {
    inv.armes[inv.active] = nouvelle(id);
  }
}

export function remplir(inv, id) {
  const a = inv.armes.find((x) => x.id === id);
  if (a) Object.assign(a, nouvelle(id));
}

export function remplirTout(inv) {
  for (const a of inv.armes) remplir(inv, a.id);
  rendreGrenades(inv);
}

export function lancerGrenade(inv) {
  if (inv.grenades <= 0) return false;
  inv.grenades--;
  return true;
}

export function rendreGrenades(inv) {
  inv.grenades = CONFIG.grenade.max;
}

export function munitionsPleines(inv, id) {
  const a = inv.armes.find((x) => x.id === id);
  return !!a && a.chargeur === CONFIG.armes[id].chargeur && a.reserve === reserveMax(id);
}

export function changer(inv, index) {
  if (index >= 0 && index < inv.armes.length) inv.active = index;
}
