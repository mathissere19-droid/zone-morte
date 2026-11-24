// Télécharge les textures et l'HDRI Poly Haven (CC0) listés dans src/textures.js.
// Usage : node outils/telecharger-assets.mjs   (les fichiers déjà présents sont sautés)
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE_TEXTURES, HDRI, cheminsTexture } from '../src/textures.js';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.polyhaven.com/files/';

async function telecharger(url, dest) {
  const d = path.join(racine, dest);
  if (existsSync(d)) return false;
  mkdirSync(path.dirname(d), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} pour ${url}`);
  writeFileSync(d, Buffer.from(await r.arrayBuffer()));
  return true;
}

const ids = new Set();
for (const { id } of Object.values(CATALOGUE_TEXTURES)) {
  ids.add(id);
  const f = await (await fetch(API + id)).json();
  const ch = cheminsTexture(id);
  for (const [cle, dest] of [['Diffuse', ch.couleur], ['nor_gl', ch.normale], ['arm', ch.arm]]) {
    const url = f[cle]?.['1k']?.jpg?.url;
    if (!url) throw new Error(`pas de ${cle} 1k pour ${id}`);
    if (await telecharger(url, dest)) console.log('  ' + dest);
  }
}
const h = await (await fetch(API + HDRI.id)).json();
if (await telecharger(h.hdri['1k'].hdr.url, HDRI.chemin)) console.log('  ' + HDRI.chemin);
ids.add(HDRI.id);

const credits = path.join(racine, 'CREDITS.md');
const actuel = readFileSync(credits, 'utf8');
for (const id of ids) {
  if (!actuel.includes(`/a/${id}`)) appendFileSync(credits, `- ${id} — Poly Haven — CC0 — https://polyhaven.com/a/${id}\n`);
}
console.log('Assets à jour.');
