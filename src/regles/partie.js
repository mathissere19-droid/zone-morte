// Déroulement d'une partie : vagues, pauses, apparitions, statistiques.
import { CONFIG } from '../config.js';
import { nombreZombies } from './vagues.js';

export function creerPartie() {
  return {
    vague: 0, phase: 'pause', chrono: CONFIG.vagues.premierePause,
    restants: 0, vivants: 0, bonusLaches: 0,
    kills: 0, killsTete: 0, pointsGagnes: 0, temps: 0,
  };
}

export function majPartie(p, dt) {
  p.temps += dt;
  if (p.phase !== 'pause') return null;
  p.chrono -= dt;
  if (p.chrono > 0) return null;
  p.vague++;
  p.restants = nombreZombies(p.vague);
  p.bonusLaches = 0;
  p.phase = 'combat';
  p.chrono = 0;
  return 'vagueCommence';
}

export function peutFaireApparaitre(p) {
  return p.phase === 'combat' && p.restants > 0 && p.vivants < CONFIG.vagues.maxVivants;
}

export function enregistrerApparition(p) {
  p.restants--;
  p.vivants++;
}

export function enregistrerMort(p, { tete }) {
  p.vivants = Math.max(0, p.vivants - 1);
  p.kills++;
  if (tete) p.killsTete++;
  if (p.phase === 'combat' && p.restants === 0 && p.vivants === 0) {
    p.phase = 'pause';
    p.chrono = CONFIG.vagues.pause;
    return 'vagueTerminee';
  }
  return null;
}

export function tirerBonus(p, rng) {
  if (p.bonusLaches >= CONFIG.bonus.maxParVague) return false;
  if (rng() >= CONFIG.bonus.chance) return false;
  p.bonusLaches++;
  return true;
}

export function choisirPointApparition(points, joueur, estVisible, rng) {
  const dist = (pt) => Math.hypot(pt.x - joueur.x, pt.z - joueur.z);
  const loin = points.filter((pt) => dist(pt) > CONFIG.vagues.distanceMinApparition);
  const caches = loin.filter((pt) => !estVisible(pt));
  const choix = caches.length ? caches : loin;
  if (choix.length) return choix[Math.min(Math.floor(rng() * choix.length), choix.length - 1)];
  return points.reduce((a, b) => (dist(b) > dist(a) ? b : a));
}
