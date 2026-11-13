// Points de vie du joueur et régénération.
import { CONFIG } from '../config.js';

export function creerVie() {
  return { pv: CONFIG.joueur.vieMax, depuisCoup: Infinity };
}

export function subir(vie, degats) {
  vie.pv = Math.max(0, vie.pv - degats);
  vie.depuisCoup = 0;
}

export function majVie(vie, dt) {
  if (estMort(vie)) return;
  const { delaiRegen, dureeRegen, vieMax } = CONFIG.joueur;
  vie.depuisCoup += dt;
  if (vie.depuisCoup >= delaiRegen) {
    vie.pv = Math.min(vieMax, Math.round((vie.pv + (vieMax / dureeRegen) * dt) * 1e6) / 1e6);
  }
}

export function estMort(vie) {
  return vie.pv <= 0;
}
