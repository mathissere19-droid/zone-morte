import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deplacer } from '../src/regles/collisions.js';
import { creerGrille, marquerObstacles, trouverChemin } from '../src/regles/navigation.js';

const mur = { minX: 1, maxX: 2, minZ: -5, maxZ: 5 };

test('glissement le long d\'un mur', () => {
  const p = deplacer({ x: 0, z: 0 }, 2, 1, 0.35, [mur]);
  assert.ok(p.x <= 0.65 + 1e-9, 'x bloqué : ' + p.x);
  assert.equal(p.z, 1);
});

test('gros déplacement : pas de traversée', () => {
  assert.ok(deplacer({ x: 0, z: 0 }, 10, 0, 0.35, [mur]).x < 1);
});

test('déplacement libre', () => {
  assert.deepEqual(deplacer({ x: 0, z: 0 }, 0.5, -0.5, 0.35, [mur]), { x: 0.5, z: -0.5 });
});

test('A* contourne un mur', () => {
  const g = creerGrille({ minX: -5, minZ: -5, largeur: 10, profondeur: 10 });
  marquerObstacles(g, [{ minX: -0.5, maxX: 0.5, minZ: -5, maxZ: 3 }]);
  const ch = trouverChemin(g, { x: -3, z: 0 }, { x: 3, z: 0 });
  assert.ok(ch && ch.length > 0);
  assert.ok(ch.some((n) => n.z > 3));
  const fin = ch[ch.length - 1];
  assert.ok(Math.hypot(fin.x - 3, fin.z) < 0.5);
});

test('zone enfermée : null', () => {
  const g = creerGrille({ minX: -5, minZ: -5, largeur: 10, profondeur: 10 });
  marquerObstacles(g, [{ minX: -5, maxX: 5, minZ: -0.5, maxZ: 0.5 }]);
  assert.equal(trouverChemin(g, { x: 0, z: -3 }, { x: 0, z: 3 }), null);
});

test('départ dans un obstacle : case libre la plus proche', () => {
  const g = creerGrille({ minX: -5, minZ: -5, largeur: 10, profondeur: 10 });
  marquerObstacles(g, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }]);
  assert.ok(trouverChemin(g, { x: 0, z: 0 }, { x: 4, z: 4 }));
});

test('ligne de vue sur la grille', async () => {
  const { ligneLibre } = await import('../src/regles/navigation.js');
  const g = creerGrille({ minX: -5, minZ: -5, largeur: 10, profondeur: 10 });
  marquerObstacles(g, [{ minX: -0.5, maxX: 0.5, minZ: -5, maxZ: 3 }]);
  assert.equal(ligneLibre(g, { x: -3, z: 0 }, { x: 3, z: 0 }), false);
  assert.equal(ligneLibre(g, { x: -3, z: 4 }, { x: 3, z: 4 }), true);
});
