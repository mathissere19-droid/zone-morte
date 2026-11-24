import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { mats } from '../src/carte.js';
import { CATALOGUE_TEXTURES, HDRI, cheminsTexture } from '../src/textures.js';
import { uvEnMetres } from '../src/uv.js';

const SANS_TEXTURE = ['porte', 'porteBande', 'caisse', 'murArme', 'grillage'];

test('chaque clé de mats a une texture dans le catalogue', () => {
  for (const cle of Object.keys(mats)) {
    if (SANS_TEXTURE.includes(cle)) continue; // couleurs de jeu volontaires
    assert.ok(CATALOGUE_TEXTURES[cle], 'texture manquante pour ' + cle);
  }
});

test('tous les fichiers du catalogue existent sur disque', () => {
  for (const { id } of Object.values(CATALOGUE_TEXTURES)) {
    for (const f of Object.values(cheminsTexture(id))) assert.ok(existsSync(f), f);
  }
  assert.ok(existsSync(HDRI.chemin), HDRI.chemin);
});

test('uvEnMetres : une face de 4 m × 2 m va de 0 à 4 et de 0 à 2', () => {
  const g = uvEnMetres(new THREE.BoxGeometry(4, 2, 1), { x: 4, y: 2, z: 1 });
  const uv = g.attributes.uv; // face +z = 5e groupe (index 16..19)
  const us = [16, 17, 18, 19].map((i) => uv.getX(i)), vs = [16, 17, 18, 19].map((i) => uv.getY(i));
  assert.deepEqual([Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)], [0, 4, 0, 2]);
});

test('uvEnMetres : face +x d\'une boîte 4×2×3 couvre (z, y) = (3, 2)', () => {
  const g = uvEnMetres(new THREE.BoxGeometry(4, 2, 3), { x: 4, y: 2, z: 3 });
  const uv = g.attributes.uv;
  const us = [0, 1, 2, 3].map((i) => uv.getX(i)), vs = [0, 1, 2, 3].map((i) => uv.getY(i));
  assert.deepEqual([Math.max(...us), Math.max(...vs)], [3, 2]);
});

test('uvEnMetres : plan 10×6', () => {
  const g = uvEnMetres(new THREE.PlaneGeometry(10, 6), { x: 10, z: 6 });
  const uv = g.attributes.uv;
  const us = [0, 1, 2, 3].map((i) => uv.getX(i)), vs = [0, 1, 2, 3].map((i) => uv.getY(i));
  assert.deepEqual([Math.max(...us), Math.max(...vs)], [10, 6]);
});
