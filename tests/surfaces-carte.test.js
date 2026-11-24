import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { construireCarte, hauteurSol } from '../src/carte.js';
import { CONFIG } from '../src/config.js';

const carte = construireCarte(new THREE.Scene());

test('dessus du conteneur de la cour : 2,6 depuis le haut, 0 depuis le sol', () => {
  assert.equal(hauteurSol(-13.8, 9, 2.6), 2.6);
  assert.equal(hauteurSol(-13.8, 9, 0), 0);
});
test('rampe et plateforme de la tour radio toujours praticables', () => {
  assert.ok(Math.abs(hauteurSol(22.5, -28, 1.4) - 1.5) < 1e-9);
  assert.equal(hauteurSol(28, -28, 3), 3);
});
test('un point d\'apparition du bunker reste au sol (sous le toit)', () => {
  for (const p of carte.zones.bunker.pointsApparition) assert.equal(hauteurSol(p.x, p.z), 0);
});
test('toit du bunker et passerelle du hangar', () => {
  assert.equal(hauteurSol(20, 12, 2.9), 2.9);
  assert.equal(hauteurSol(-5, -34.8, 3.2), 3.2);
});
test('3 zones d\'échelles : passerelle (2), toit du bunker, guérite', () => {
  assert.equal(carte.echelles.length, 4);
  for (const e of carte.echelles) assert.ok(carte.liens.some((l) => l.bas.x === (e.minX + e.maxX) / 2 && l.haut.h === e.haut));
});
test('chaque îlot a au moins un lien d\'escalade', () => {
  const ilots = carte.surfaces.filter((s) => s.ilot && s.h >= CONFIG.escalade.hauteurIlot);
  assert.ok(ilots.length >= 10, 'îlots : ' + ilots.length);
  for (const s of ilots) assert.ok(carte.liens.some((l) => l.surface === s.id), 'îlot sans lien : ' + s.id);
});
test('les décors sous le plafond du bunker ne sont pas des îlots', () => {
  const sous = carte.surfaces.filter((s) => s.minX >= 14 && s.maxX <= 36 && s.minZ >= -12 && s.maxZ <= 18 && s.h < 2.9);
  assert.ok(sous.length >= 3);
  for (const s of sous) { assert.equal(s.ilot, false); assert.equal(s.grimpable, false); }
});
test('les murs ne sont pas des surfaces', () => {
  assert.ok(!carte.surfaces.some((s) => s.h === 4 || s.h === 8));
});
test('sources de lumière déclarées', () => {
  assert.ok(carte.sourcesLumiere.length >= 9, 'sources : ' + carte.sourcesLumiere.length);
});
