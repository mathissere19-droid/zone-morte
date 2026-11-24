import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerSuiviBlocage, majSuiviBlocage } from '../src/regles/blocage.js';

test('immobile loin du joueur : bloqué au bout de 8 s', () => {
  const s = creerSuiviBlocage({ x: 0, z: 0 });
  for (let i = 0; i < 79; i++) assert.equal(majSuiviBlocage(s, { x: 0, z: 0 }, 0.1, 10), false);
  assert.equal(majSuiviBlocage(s, { x: 0, z: 0 }, 0.1, 10), true);
  assert.equal(majSuiviBlocage(s, { x: 0, z: 0 }, 0.1, 10), false); // compteur remis à zéro
});

test('immobile près du joueur (il frappe) : jamais bloqué', () => {
  const s = creerSuiviBlocage({ x: 0, z: 0 });
  for (let i = 0; i < 200; i++) assert.equal(majSuiviBlocage(s, { x: 0, z: 0 }, 0.1, 2), false);
});

test('un déplacement suffisant remet le compteur à zéro', () => {
  const s = creerSuiviBlocage({ x: 0, z: 0 });
  for (let i = 0; i < 50; i++) majSuiviBlocage(s, { x: 0, z: 0 }, 0.1, 10);
  assert.equal(majSuiviBlocage(s, { x: 0.5, z: 0 }, 0.1, 10), false);
  for (let i = 0; i < 70; i++) assert.equal(majSuiviBlocage(s, { x: 0.5, z: 0 }, 0.1, 10), false);
});
