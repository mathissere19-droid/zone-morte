// Règles pures des zombies animés : choix de l'animation, moment du coup,
// mise à jour réduite au loin, démembrement.
import { CONFIG } from '../config.js';

// etat : { emergence, mort, escalade ('monte' | 'descend' | null), attaque, rampe, vitesse, type }
// Renvoie { nom, vitesse } ou null (mort : gérée à part).
export function choisirAnimation({ emergence, mort, escalade, attaque, rampe, vitesse, type }) {
  if (mort) return null;
  if (emergence > 0) return { nom: 'sortie', vitesse: 1 };
  if (escalade === 'monte') return { nom: 'attaque', vitesse: 0.6 };
  if (escalade === 'descend') return { nom: 'course', vitesse: 0 };
  // un rampeur reste au sol : il mord en rampant (pas d'attaque debout)
  if (rampe) return { nom: 'ramper', vitesse: attaque || vitesse > 0 ? 1 : 0 };
  if (attaque) return { nom: 'attaque', vitesse: 1 };
  if (vitesse < 0.05) return { nom: 'attente', vitesse: 1 };
  if (type === 'course') return { nom: 'course', vitesse: 1 };
  if (type === 'marcheRapide') return { nom: 'marche', vitesse: CONFIG.zombie.animation.marcheRapide };
  return { nom: 'marche', vitesse: 1 };
}

// Vrai quand l'instant d'impact (fraction de l'animation d'attaque) est franchi entre tPrecedent (exclu) et t (inclus).
export function momentImpact(tPrecedent, t, duree) {
  const impact = CONFIG.zombie.animation.impact * duree;
  return tPrecedent < impact && t >= impact;
}

// Au-delà de distanceReduite, l'animation n'est mise à jour qu'une image sur deux.
export function doitAnimer(distance, image) {
  return distance <= CONFIG.zombie.animation.distanceReduite || image % 2 === 0;
}

// Cumule les dégâts aux jambes ; vrai quand le zombie doit passer rampeur (une seule fois).
// z.pv est la vie APRÈS le coup.
export function toucheJambes(z, degats, pvMax) {
  z.degatsJambes = (z.degatsJambes || 0) + degats;
  if (z.rampe || z.boss || z.pv <= 0) return false;
  return z.degatsJambes >= CONFIG.zombie.rampe.seuil * pvMax;
}

export function teteArrachee({ tete, mortel, boss }) {
  return Boolean(tete && mortel && !boss);
}
