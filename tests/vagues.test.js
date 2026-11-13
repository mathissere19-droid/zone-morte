import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreZombies, pvZombie, partCoureurs, typeDeplacement } from '../src/regles/vagues.js';

test('nombre de zombies par vague', () => {
  assert.equal(nombreZombies(1), 10);
  assert.equal(nombreZombies(5), 30);
  assert.equal(nombreZombies(10), 61);
});

test('PV des zombies', () => {
  assert.equal(pvZombie(1), 150);
  assert.equal(pvZombie(9), 950);
  assert.equal(pvZombie(10), Math.round(950 * 1.1));
});

test('part de coureurs', () => {
  assert.equal(partCoureurs(4), 0);
  assert.equal(partCoureurs(5), 0.1);
  assert.equal(partCoureurs(7), 0.3);
  assert.equal(partCoureurs(20), 0.8);
});

test('type de déplacement', () => {
  assert.equal(typeDeplacement(3, () => 0), 'marche');
  assert.equal(typeDeplacement(6, () => 0.05), 'course');
  assert.equal(typeDeplacement(6, () => 0.9), 'marche');
  assert.equal(typeDeplacement(13, () => 0.95), 'marcheRapide');
});
