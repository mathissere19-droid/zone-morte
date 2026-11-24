import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterBorne, nombreParticules } from '../src/regles/tampon.js';

test('ajouterBorne garde les 64 plus récents', () => {
  const l = []; let retires = 0;
  for (let i = 0; i < 100; i++) if (ajouterBorne(l, i, 64) !== null) retires++;
  assert.equal(l.length, 64); assert.equal(l[0], 36); assert.equal(retires, 36);
});

test('ajouterBorne renvoie l\'élément retiré', () => {
  const l = [1, 2];
  assert.equal(ajouterBorne(l, 3, 2), 1);
  assert.deepEqual(l, [2, 3]);
  assert.equal(ajouterBorne(l, 4, 5), null);
});

test('nombreParticules applique le facteur, au moins 1', () => {
  assert.equal(nombreParticules(10, 0.4), 4);
  assert.equal(nombreParticules(1, 0.4), 1);
  assert.equal(nombreParticules(6, 1), 6);
});
