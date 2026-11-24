import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { construireCarte, ouvrirPorte } from '../src/carte.js';
import { creerGrille, marquerObstacles, trouverChemin } from '../src/regles/navigation.js';
import { dansAABB } from '../src/regles/collisions.js';

// construireCarte tourne sous Node : aucune texture n'est chargée à la construction
const carte = construireCarte(new THREE.Scene());
const AVANT_DECORS = 44; // obstacles avant le lot 3 (mâts de projecteurs compris)
const NOUVEAUX_DECORS = 14;

test('les nouveaux décors existent', () => {
  assert.ok(carte.aabbs.length >= AVANT_DECORS + NOUVEAUX_DECORS, 'obstacles : ' + carte.aabbs.length);
});

test('les décors arrêtent les balles (maillages dans obstaclesVisibles)', () => {
  assert.ok(carte.obstaclesVisibles.length >= 120, 'maillages : ' + carte.obstaclesVisibles.length);
});

test('aucun point d\'apparition ni le départ dans un obstacle', () => {
  const points = [carte.depart, ...Object.values(carte.zones).flatMap((z) => z.pointsApparition)];
  for (const p of points) {
    for (const b of carte.aabbs) assert.ok(!dansAABB(p, b, 0.5), `${p.x},${p.z} dans un décor`);
  }
});

test('tout reste atteignable depuis le départ, toutes portes ouvertes', () => {
  for (const p of carte.portes) ouvrirPorte(carte, p);
  const g = creerGrille({ minX: -18, minZ: -36, largeur: 54, profondeur: 54, taille: 0.5 });
  marquerObstacles(g, carte.navObstacles);
  const cibles = [
    ...Object.values(carte.zones).flatMap((z) => z.pointsApparition),
    ...carte.mursArmes.map((m) => m.position),
    carte.caisse.position,
    ...carte.portes.flatMap((p) => p.segments),
    ...(carte.liens ?? [null]).map((l) => l?.bas ?? { x: 1e3, z: 1e3 }), // pieds des liens d'escalade et des échelles
  ];
  for (const c of cibles) {
    assert.ok(trouverChemin(g, carte.depart, { x: c.x, z: c.z }), `inatteignable : ${c.x},${c.z}`);
  }
});
