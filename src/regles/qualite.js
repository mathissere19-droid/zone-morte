// Niveaux de qualité graphique et surveillance des performances (pur, testé).
import { CONFIG } from '../config.js';

export const IDS_QUALITE = ['basse', 'moyenne', 'haute'];

export function parametresQualite(id) {
  return CONFIG.qualite[IDS_QUALITE.includes(id) ? id : 'moyenne'];
}

export function creerSurveillancePerf() {
  return { lent: 0, signale: false };
}

// Vrai une seule fois : en Haute, après `duree` secondes d'affilée sous `seuil` images/s.
export function majSurveillancePerf(s, dt, idQualite) {
  const { seuil, duree } = CONFIG.qualite.perf;
  if (idQualite !== 'haute' || dt <= 0) { s.lent = 0; return false; }
  if (1 / dt >= seuil) { s.lent = 0; return false; }
  s.lent += dt;
  if (s.lent >= duree - 1e-9 && !s.signale) { s.signale = true; return true; }
  return false;
}
