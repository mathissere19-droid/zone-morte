// Formules de progression des vagues.

export function nombreZombies(v) {
  return Math.round(6 + 4 * v + 0.15 * v * v);
}

export function pvZombie(v) {
  if (v <= 9) return 150 + 100 * (v - 1);
  return Math.round(950 * Math.pow(1.1, v - 9));
}

export function partCoureurs(v, premiere = 5) {
  if (v < premiere) return 0;
  return Math.round(Math.min(0.1 * (v - premiere + 1), 0.8) * 1e9) / 1e9;
}

export function typeDeplacement(v, rng, premiere = 5) {
  if (rng() < partCoureurs(v, premiere)) return 'course';
  return v > 12 ? 'marcheRapide' : 'marche';
}
