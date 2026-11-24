// Surfaces en hauteur (dessus des décors, toits, passerelles, rampes), rebords, échelles,
// liens d'escalade des zombies, dégâts de chute. Pur, sans three.js.
// Surface : { id, minX, maxX, minZ, maxZ, h, ilot, liensAuto, pente? }
//   pente = { axe: 'x'|'z', de, a, h0, h1 } : hauteur linéaire de h0 (en « de ») à h1 (en « a »)
import { CONFIG } from '../config.js';

const MARCHE = 0.35;

const contient = (s, x, z) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;

function hauteurDe(s, x, z) {
  if (!s.pente) return s.h;
  const P = s.pente, c = P.axe === 'x' ? x : z;
  const k = Math.min(1, Math.max(0, (c - P.de) / (P.a - P.de)));
  return P.h0 + (P.h1 - P.h0) * k;
}

// La plus haute surface sous (x, z) qu'on peut atteindre depuis la hauteur y (marche de 0,35 m)
export function hauteurSurfaces(surfaces, x, z, y = 0) {
  let h = 0, surface = null;
  for (const s of surfaces) {
    if (!contient(s, x, z)) continue;
    const hs = hauteurDe(s, x, z);
    if (hs <= y + MARCHE && hs > h) { h = hs; surface = s; }
  }
  return { h, surface };
}

// Entrée d'un rayon (pos, dir) dans le rectangle de s : distance, ou Infinity
function entree(s, pos, dir) {
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, d, min, max] of [[pos.x, dir.x, s.minX, s.maxX], [pos.z, dir.z, s.minZ, s.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < min || p > max) return Infinity; continue; }
    let a = (min - p) / d, b = (max - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t0 <= t1 && t0 >= 0 ? t0 : Infinity;
}

// Rebord à hisser devant le joueur : { x, z, h, surface } (point d'arrivée 0,4 m après le bord) ou null
export function trouverRebord(surfaces, pos, dir, yPieds) {
  const E = CONFIG.escalade;
  let meilleur = null, tMin = Infinity;
  for (const s of surfaces) {
    if (s.pente || s.grimpable === false || contient(s, pos.x, pos.z)) continue;
    const d = s.h - yPieds;
    if (d < E.rebordMin || d > E.rebordMax) continue;
    const t = entree(s, pos, dir);
    if (t > E.portee || t >= tMin) continue;
    tMin = t;
    const x = Math.min(s.maxX, Math.max(s.minX, pos.x + dir.x * (t + 0.4)));
    const z = Math.min(s.maxZ, Math.max(s.minZ, pos.z + dir.z * (t + 0.4)));
    meilleur = { x, z, h: s.h, surface: s };
  }
  return meilleur;
}

// Échelle : { minX, maxX, minZ, maxZ, bas, haut, face: {x,z}, sortie: {x,z} } (face : normale vers le joueur)
export function echelleDevant(echelles, pos, dirMouvement) {
  for (const e of echelles) {
    if (!contient(e, pos.x, pos.z)) continue;
    if (-(dirMouvement.x * e.face.x + dirMouvement.z * e.face.z) > 0.5) return e;
  }
  return null;
}

// Lien : { bas: {x,z}, haut: {x,z,h}, duree, surface }
export function liensAuto(s, duree) {
  const cx = (s.minX + s.maxX) / 2, cz = (s.minZ + s.maxZ) / 2;
  const dedansX = (bord, sens) => (s.maxX - s.minX > 0.8 ? bord + sens * 0.4 : cx);
  const dedansZ = (bord, sens) => (s.maxZ - s.minZ > 0.8 ? bord + sens * 0.4 : cz);
  const lien = (bas, hx, hz) => ({ bas, haut: { x: hx, z: hz, h: s.h }, duree, surface: s.id });
  return [
    lien({ x: s.minX - 0.6, z: cz }, dedansX(s.minX, 1), cz),
    lien({ x: s.maxX + 0.6, z: cz }, dedansX(s.maxX, -1), cz),
    lien({ x: cx, z: s.minZ - 0.6 }, cx, dedansZ(s.minZ, 1)),
    lien({ x: cx, z: s.maxZ + 0.6 }, cx, dedansZ(s.maxZ, -1)),
  ];
}

export function choisirLien(liens, idSurface, pos) {
  let meilleur = null, dMin = Infinity;
  for (const l of liens) {
    if (l.surface !== idSurface) continue;
    const d = Math.hypot(l.bas.x - pos.x, l.bas.z - pos.z);
    if (d < dMin) { dMin = d; meilleur = l; }
  }
  return meilleur;
}

// Point au sol, 0,6 m hors du bord de s le plus proche de pos
export function bordLePlusProche(s, pos) {
  const x = Math.min(s.maxX, Math.max(s.minX, pos.x)), z = Math.min(s.maxZ, Math.max(s.minZ, pos.z));
  const options = [
    [x - s.minX, { x: s.minX - 0.6, z }], [s.maxX - x, { x: s.maxX + 0.6, z }],
    [z - s.minZ, { x, z: s.minZ - 0.6 }], [s.maxZ - z, { x, z: s.maxZ + 0.6 }],
  ];
  options.sort((a, b) => a[0] - b[0]);
  return options[0][1];
}

export function degatsChute(hauteur) {
  const E = CONFIG.escalade;
  return hauteur <= E.chuteSansDegats ? 0 : Math.round((hauteur - E.chuteSansDegats) * E.degatsParMetre);
}
