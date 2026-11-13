// Calcul des dégâts.
import { CONFIG } from '../config.js';

export function degatsTir(armeId, zone, distance) {
  const arme = CONFIG.armes[armeId];
  let degats = arme.degats;
  if (armeId === 'pompe') {
    const { debut, fin, minimum } = CONFIG.pompeChute;
    const t = Math.min(Math.max((distance - debut) / (fin - debut), 0), 1);
    degats *= 1 - t * (1 - minimum);
  }
  if (zone === 'tete') degats *= armeId === 'pompe' ? CONFIG.multiplicateurTetePompe : CONFIG.multiplicateurTete;
  return Math.round(degats);
}

export function degatsCouteau() {
  return CONFIG.couteau.degats;
}

export function degatsExplosion(distance) {
  const a = CONFIG.armes.lanceGrenades;
  return distance <= a.rayonExplosion ? a.degats : 0;
}

export function degatsExplosionJoueur(distance) {
  return distance <= CONFIG.armes.lanceGrenades.rayonExplosion ? CONFIG.explosionDegatsJoueur : 0;
}
