// Détection d'un zombie bloqué : il ne bouge plus alors qu'il est loin du joueur.
import { CONFIG } from '../config.js';

export function creerSuiviBlocage(pos) {
  return { ref: { x: pos.x, z: pos.z }, t: 0 };
}

// Renvoie true quand le zombie est considéré comme bloqué (puis repart de zéro).
export function majSuiviBlocage(s, pos, dt, distanceJoueur) {
  const B = CONFIG.zombie.antiBlocage;
  if (distanceJoueur <= B.distanceMin || Math.hypot(pos.x - s.ref.x, pos.z - s.ref.z) > B.deplacementMin) {
    s.ref = { x: pos.x, z: pos.z };
    s.t = 0;
    return false;
  }
  s.t += dt;
  if (s.t >= B.duree - 1e-9) { s.t = 0; return true; }
  return false;
}
