// Calcul des dégâts.
import { CONFIG } from '../config.js';

export function degatsTir(armeId, zone, distance) {
  const arme = CONFIG.armes[armeId];
  let degats = arme.degats;
  if (arme.plombs) {
    const { debut, fin, minimum } = CONFIG.pompeChute;
    const t = Math.min(Math.max((distance - debut) / (fin - debut), 0), 1);
    degats *= 1 - t * (1 - minimum);
  }
  if (zone === 'tete') degats *= arme.multTete ?? (arme.plombs ? CONFIG.multiplicateurTetePompe : CONFIG.multiplicateurTete);
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

// Le point est-il dans le cône (vu de dessus) ? angleDeg = ouverture totale.
export function dansCone(origine, direction, point, portee, angleDeg) {
  const dx = point.x - origine.x, dz = point.z - origine.z;
  const d = Math.hypot(dx, dz);
  if (d > portee) return false;
  if (d < 1e-6) return true;
  const cos = (dx * direction.x + dz * direction.z) / (d * Math.hypot(direction.x, direction.z));
  return cos >= Math.cos((angleDeg / 2) * Math.PI / 180) - 1e-9;
}

// Zombies touchés par l'éclair, dans l'ordre : le premier puis jusqu'à `sauts` voisins.
export function chaineElectrique(premier, zombies, { sauts, portee }) {
  const touches = [premier];
  let dernier = premier;
  for (let i = 0; i < sauts; i++) {
    let meilleur = null, dMin = portee;
    for (const z of zombies) {
      if (z.mort || touches.includes(z)) continue;
      const d = Math.hypot(z.position.x - dernier.position.x, z.position.z - dernier.position.z);
      if (d <= dMin) { dMin = d; meilleur = z; }
    }
    if (!meilleur) break;
    touches.push(meilleur);
    dernier = meilleur;
  }
  return touches;
}

export function degatsChaine(base, index, facteur) {
  return Math.round(base * facteur ** index);
}

export function enflammer(z, dps, duree) {
  z.brulure = { t: duree, dps };
}

// Dégâts de brûlure pour ce pas de temps (0 si le zombie ne brûle pas).
export function majBrulure(z, dt) {
  const b = z.brulure;
  if (!b || b.t <= 0) return 0;
  const d = b.dps * Math.min(dt, b.t);
  b.t -= dt;
  return d;
}

// Dégâts d'explosion qui diminuent linéairement jusqu'au bord du rayon.
export function degatsZone(distance, max, rayon) {
  return distance <= rayon ? Math.round(max * (1 - distance / rayon)) : 0;
}
