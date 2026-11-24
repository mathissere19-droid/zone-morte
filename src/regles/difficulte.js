// Difficulté de la partie : niveau actif et valeurs qui en dépendent.
import { CONFIG } from '../config.js';
import { pvZombie } from './vagues.js';

export const IDS_DIFFICULTE = ['recrue', 'soldat', 'veteran', 'cauchemar'];

let active = 'soldat';

export function choisirDifficulte(id) {
  active = IDS_DIFFICULTE.includes(id) ? id : 'soldat';
}

export function difficulteActive() {
  return { id: active, ...CONFIG.difficultes[active] };
}

export function pvZombieActif(v) {
  return Math.round(pvZombie(v) * CONFIG.difficultes[active].pvZombies);
}

export function degatsRecus(d) {
  return Math.round(d * CONFIG.difficultes[active].degatsRecus);
}

export function reserveMax(armeId) {
  return Math.round(CONFIG.armes[armeId].reserve * CONFIG.difficultes[active].munitions);
}
