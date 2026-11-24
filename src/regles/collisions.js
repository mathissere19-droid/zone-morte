// Collisions cercle (vu de dessus) contre boîtes alignées (AABB).
// AABB = { minX, maxX, minZ, maxZ, minY?=0, maxY?=3 }

const MARCHE = 0.35; // hauteur qu'on peut enjamber

// hauteur : taille du corps (1,8 m debout, 1,2 m accroupi)
function bloquant(b, y, hauteur = 1.8) {
  return (b.maxY ?? 3) > y + MARCHE && (b.minY ?? 0) < y + hauteur;
}

function axe(pos, d, rayon, aabbs, y, cle, hauteur) {
  const autre = cle === 'x' ? 'z' : 'x';
  const minA = cle === 'x' ? 'minX' : 'minZ', maxA = cle === 'x' ? 'maxX' : 'maxZ';
  const minO = cle === 'x' ? 'minZ' : 'minX', maxO = cle === 'x' ? 'maxZ' : 'maxX';
  let v = pos[cle] + d;
  for (const b of aabbs) {
    if (!bloquant(b, y, hauteur)) continue;
    if (pos[autre] + rayon <= b[minO] || pos[autre] - rayon >= b[maxO]) continue;
    if (v + rayon > b[minA] && v - rayon < b[maxA]) {
      if (d > 0 && pos[cle] + rayon <= b[minA] + 1e-6) v = b[minA] - rayon;
      else if (d < 0 && pos[cle] - rayon >= b[maxA] - 1e-6) v = b[maxA] + rayon;
      else if (d !== 0) v = pos[cle]; // déjà dedans : on ne bouge pas sur cet axe
    }
  }
  pos[cle] = v;
}

export function deplacer(pos, dx, dz, rayon, aabbs, y = 0, hauteur = 1.8) {
  const p = { x: pos.x, z: pos.z };
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / rayon));
  let libreX = true, libreZ = true;
  for (let i = 0; i < n; i++) {
    const ax = p.x + dx / n, az = p.z + dz / n;
    axe(p, dx / n, rayon, aabbs, y, 'x', hauteur);
    axe(p, dz / n, rayon, aabbs, y, 'z', hauteur);
    if (p.x !== ax) libreX = false;
    if (p.z !== az) libreZ = false;
  }
  // Sans blocage, on évite l'accumulation d'erreurs d'arrondi des sous-pas
  if (libreX) p.x = pos.x + dx;
  if (libreZ) p.z = pos.z + dz;
  return p;
}

export function dansAABB(p, b, marge = 0) {
  return p.x > b.minX - marge && p.x < b.maxX + marge && p.z > b.minZ - marge && p.z < b.maxZ + marge;
}

// Peut-on se relever (passer de 1,2 m à 1,8 m) sans se cogner à un plafond bas ?
export function peutSeRelever(aabbs, pos, rayon, y) {
  for (const b of aabbs) {
    const minY = b.minY ?? 0;
    if (minY < y + 1.2 || minY >= y + 1.8) continue;
    if (pos.x + rayon > b.minX && pos.x - rayon < b.maxX && pos.z + rayon > b.minZ && pos.z - rayon < b.maxZ) return false;
  }
  return true;
}
