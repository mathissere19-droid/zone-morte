// Perception des zombies (pur, sans three.js) : vue, bruit, ombre et états traque / recherche / flair.
import { CONFIG } from '../config.js';

const P = () => CONFIG.perception;

export function creerPerception(pos) {
  return { etat: 'traque', derniere: { x: pos.x, z: pos.z }, sansContact: 0, cible: null, memoire: P().memoire };
}

// Distance à laquelle le joueur s'entend : tir (selon l'arme), sprint, marche, accroupi ; immobile = 0.
export function rayonBruit({ tir, armeId, sprint, mouvement, accroupi } = {}) {
  const B = P().bruit;
  if (tir) return CONFIG.armes[armeId]?.bruit ?? B.tir;
  if (!mouvement) return 0;
  if (sprint) return B.sprint;
  return accroupi ? B.accroupi : B.marche;
}

// orientation : direction du regard du zombie, en radians comme atan2(dx, dz).
export function voit({ zombie, orientation, joueur, ligneLibre, cacheDansOmbre }) {
  if (!ligneLibre) return false;
  const dx = joueur.x - zombie.x, dz = joueur.z - zombie.z;
  const d = Math.hypot(dx, dz);
  if (d > (cacheDansOmbre ? P().vueOmbre : P().vue)) return false;
  if (d < 1e-6) return true;
  let ecart = Math.atan2(dx, dz) - orientation;
  ecart = Math.atan2(Math.sin(ecart), Math.cos(ecart)); // ramené dans [-π, π]
  return Math.abs(ecart) <= (P().cone / 2) * Math.PI / 180;
}

export function dansOmbre(pos, sources, lampeAllumee) {
  if (lampeAllumee) return false;
  return !sources.some((s) => Math.hypot(pos.x - s.x, pos.z - s.z) <= s.rayon);
}

// En traque, la position du joueur reste connue pendant p.memoire secondes sans repérage.
// L'appelant calcule `repere` (vue, bruit ou contact) et remet `p.cible = null` quand le zombie l'atteint.
export function majPerception(p, { repere, joueur, alerte }, dt, delaiFlair, rng = Math.random) {
  if (repere || alerte) {
    p.etat = 'traque'; p.derniere = { x: joueur.x, z: joueur.z }; p.sansContact = 0; p.cible = null;
    p.memoire = Math.max(p.memoire ?? 0, P().memoire);
    return 'traque';
  }
  if (p.etat === 'traque') {
    // il garde la trace un instant (après un flair : le temps de rejoindre le joueur, même perché)
    p.memoire = (p.memoire ?? 0) - dt;
    if (p.memoire > 1e-9) { p.derniere = { x: joueur.x, z: joueur.z }; return 'traque'; }
    p.etat = 'recherche'; p.sansContact = 0; p.cible = { ...p.derniere };
    return 'recherche';
  }
  p.sansContact += dt;
  if (p.sansContact >= delaiFlair - 1e-9) {
    // la horde finit toujours par retrouver le joueur
    p.etat = 'traque'; p.derniere = { x: joueur.x, z: joueur.z }; p.sansContact = 0; p.cible = null;
    p.memoire = P().memoireFlair;
    return 'flair';
  }
  if (!p.cible) {
    const a = rng() * Math.PI * 2, r = rng() * P().fouille;
    p.cible = { x: p.derniere.x + Math.sin(a) * r, z: p.derniere.z + Math.cos(a) * r };
  }
  return 'recherche';
}
