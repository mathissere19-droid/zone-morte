import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerInventaire, lancerGrenade, rendreGrenades, remplirTout } from '../src/regles/inventaire.js';
import { degatsZone } from '../src/regles/combat.js';

test('stock de grenades : 2 au départ, rendu à 2', () => {
  const inv = creerInventaire();
  assert.equal(inv.grenades, 2);
  assert.equal(lancerGrenade(inv), true);
  assert.equal(lancerGrenade(inv), true);
  assert.equal(lancerGrenade(inv), false);
  assert.equal(inv.grenades, 0);
  rendreGrenades(inv);
  assert.equal(inv.grenades, 2);
  inv.grenades = 0;
  remplirTout(inv);
  assert.equal(inv.grenades, 2);
});

test('dégâts de zone décroissants', () => {
  assert.equal(degatsZone(0, 300, 5), 300);
  assert.equal(degatsZone(2.5, 300, 5), 150);
  assert.equal(degatsZone(6, 300, 5), 0);
});
