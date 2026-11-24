import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dansCone, chaineElectrique, degatsChaine, majBrulure, enflammer } from '../src/regles/combat.js';

const zb = (x, z, mort = false) => ({ position: { x, y: 0, z }, mort });

test('cône du lance-flammes', () => {
  const o = { x: 0, z: 0 }, dir = { x: 0, z: -1 };
  assert.equal(dansCone(o, dir, { x: 0, z: -5 }, 6, 20), true);
  assert.equal(dansCone(o, dir, { x: 0, z: -7 }, 6, 20), false);
  const a = 30 * Math.PI / 180;
  assert.equal(dansCone(o, dir, { x: Math.sin(a) * 5, z: -Math.cos(a) * 5 }, 6, 20), false);
  assert.equal(dansCone(o, dir, { x: 0, z: 5 }, 6, 20), false);
});

test('chaîne électrique : plus proche voisin, portée, morts ignorés', () => {
  const ligne = [0, 3, 6, 9, 12, 15].map((x) => zb(x, 0));
  const isole = zb(40, 0);
  const mort = zb(1.5, 0.1, true);
  const r = chaineElectrique(ligne[0], [...ligne, isole, mort], { sauts: 4, portee: 5 });
  assert.deepEqual(r, ligne.slice(0, 5));
  assert.deepEqual(chaineElectrique(isole, ligne, { sauts: 4, portee: 5 }), [isole]);
});

test('dégâts décroissants de la chaîne', () => {
  assert.equal(degatsChaine(250, 0, 0.8), 250);
  assert.equal(degatsChaine(250, 2, 0.8), 160);
});

test('brûlure : dégâts par seconde pendant la durée', () => {
  const z = zb(0, 0);
  assert.equal(majBrulure(z, 1), 0);
  enflammer(z, 30, 3);
  assert.equal(majBrulure(z, 1), 30);
  assert.equal(majBrulure(z, 1), 30);
  assert.equal(majBrulure(z, 1), 30);
  assert.equal(majBrulure(z, 1), 0);
  enflammer(z, 30, 0.5);
  assert.equal(majBrulure(z, 1), 15);
});
