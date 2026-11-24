// Points de vie du joueur et régénération.
import { CONFIG } from '../config.js';

export function creerVie() {
  return { pv: CONFIG.joueur.vieMax, depuisCoup: Infinity };
}

export function subir(vie, degats) {
  vie.pv = Math.max(0, vie.pv - degats);
  vie.depuisCoup = 0;
}

// delaiRegen null : pas de régénération
export function majVie(vie, dt, delaiRegen = CONFIG.joueur.delaiRegen) {
  if (estMort(vie) || delaiRegen === null) return;
  const { dureeRegen, vieMax } = CONFIG.joueur;
  vie.depuisCoup += dt;
  if (vie.depuisCoup >= delaiRegen) {
    vie.pv = Math.min(vieMax, Math.round((vie.pv + (vieMax / dureeRegen) * dt) * 1e6) / 1e6);
  }
}

export function estMort(vie) {
  return vie.pv <= 0;
}
