// Grille de navigation et recherche de chemin A* (8 directions, sans couper les coins).

export function creerGrille({ minX, minZ, largeur, profondeur, taille = 0.5 }) {
  const nx = Math.ceil(largeur / taille), nz = Math.ceil(profondeur / taille);
  return { minX, minZ, taille, nx, nz, bloque: new Uint8Array(nx * nz) };
}

export function marquerObstacles(g, aabbs, marge = 0.3) {
  g.bloque.fill(0);
  for (const b of aabbs) {
    if ((b.maxY ?? 3) <= 0.35) continue;
    const i0 = Math.max(0, Math.floor((b.minX - marge - g.minX) / g.taille));
    const i1 = Math.min(g.nx - 1, Math.floor((b.maxX + marge - g.minX) / g.taille - 1e-9));
    const j0 = Math.max(0, Math.floor((b.minZ - marge - g.minZ) / g.taille));
    const j1 = Math.min(g.nz - 1, Math.floor((b.maxZ + marge - g.minZ) / g.taille - 1e-9));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g.bloque[j * g.nx + i] = 1;
  }
}

const caseDe = (g, p) => [
  Math.min(g.nx - 1, Math.max(0, Math.floor((p.x - g.minX) / g.taille))),
  Math.min(g.nz - 1, Math.max(0, Math.floor((p.z - g.minZ) / g.taille))),
];
const centre = (g, i, j) => ({ x: g.minX + (i + 0.5) * g.taille, z: g.minZ + (j + 0.5) * g.taille });
const libre = (g, i, j) => i >= 0 && j >= 0 && i < g.nx && j < g.nz && !g.bloque[j * g.nx + i];

function plusProcheLibre(g, i, j, rayon = 3) {
  if (libre(g, i, j)) return [i, j];
  let meilleur = null, dMin = Infinity;
  for (let dj = -rayon; dj <= rayon; dj++) for (let di = -rayon; di <= rayon; di++) {
    const d = di * di + dj * dj;
    if (d < dMin && libre(g, i + di, j + dj)) { dMin = d; meilleur = [i + di, j + dj]; }
  }
  return meilleur;
}

// Tas binaire minimal sur f
class Tas {
  constructor() { this.t = []; }
  get taille() { return this.t.length; }
  pousser(n) {
    const t = this.t; t.push(n);
    let i = t.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (t[p].f <= t[i].f) break; [t[p], t[i]] = [t[i], t[p]]; i = p; }
  }
  extraire() {
    const t = this.t, haut = t[0], bas = t.pop();
    if (t.length) {
      t[0] = bas; let i = 0;
      for (;;) {
        const g = 2 * i + 1, d = g + 1; let m = i;
        if (g < t.length && t[g].f < t[m].f) m = g;
        if (d < t.length && t[d].f < t[m].f) m = d;
        if (m === i) break; [t[m], t[i]] = [t[i], t[m]]; i = m;
      }
    }
    return haut;
  }
}

const VOISINS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export function trouverChemin(g, de, vers) {
  const a = plusProcheLibre(g, ...caseDe(g, de));
  const b = plusProcheLibre(g, ...caseDe(g, vers));
  if (!a || !b) return null;
  const n = g.nx * g.nz, cible = b[1] * g.nx + b[0];
  const cout = new Float32Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const ferme = new Uint8Array(n);
  const h = (i, j) => { const dx = Math.abs(i - b[0]), dz = Math.abs(j - b[1]); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  const tas = new Tas();
  const depart = a[1] * g.nx + a[0];
  cout[depart] = 0;
  tas.pousser({ k: depart, f: h(a[0], a[1]) });
  while (tas.taille) {
    const { k } = tas.extraire();
    if (ferme[k]) continue;
    ferme[k] = 1;
    if (k === cible) break;
    const i = k % g.nx, j = (k - i) / g.nx;
    for (const [di, dj, c] of VOISINS) {
      const ii = i + di, jj = j + dj;
      if (!libre(g, ii, jj)) continue;
      if (di && dj && (!libre(g, i + di, j) || !libre(g, i, j + dj))) continue;
      const kk = jj * g.nx + ii, nc = cout[k] + c;
      if (nc < cout[kk]) { cout[kk] = nc; parent[kk] = k; tas.pousser({ k: kk, f: nc + h(ii, jj) }); }
    }
  }
  if (!ferme[cible]) return null;
  const chemin = [];
  for (let k = cible; k !== -1 && k !== depart; k = parent[k]) {
    const i = k % g.nx; chemin.push(centre(g, i, (k - i) / g.nx));
  }
  return chemin.reverse();
}
