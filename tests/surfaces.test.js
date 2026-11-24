import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hauteurSurfaces, trouverRebord, echelleDevant, liensAuto, choisirLien, bordLePlusProche, degatsChute,
} from '../src/regles/surfaces.js';
import { deplacer, peutSeRelever } from '../src/regles/collisions.js';

const boite = (id, minX, maxX, minZ, maxZ, h, o = {}) => ({ id, minX, maxX, minZ, maxZ, h, ilot: h >= 1.2, liensAuto: h >= 1.2, ...o });
const conteneur = boite('c', 0, 6, 0, 2.4, 2.6);
const toit = boite('toit', 10, 20, 0, 10, 2.9);
const rampe = { id: 'r', minX: 20, maxX: 25, minZ: -29, maxZ: -27, h: 3, ilot: false, liensAuto: false, pente: { axe: 'x', de: 20, a: 25, h0: 0, h1: 3 } };

test('hauteurSurfaces : on ne monte pas sur un conteneur depuis le sol', () => {
  assert.equal(hauteurSurfaces([conteneur], 3, 1, 0).h, 0);
  assert.equal(hauteurSurfaces([conteneur], 3, 1, 0).surface, null);
});
test('hauteurSurfaces : debout sur le conteneur', () => {
  const r = hauteurSurfaces([conteneur], 3, 1, 2.6);
  assert.equal(r.h, 2.6); assert.equal(r.surface.id, 'c');
});
test('hauteurSurfaces : sous un toit, on reste au sol (apparition dans le bunker)', () => {
  assert.equal(hauteurSurfaces([toit], 15, 5, 0).h, 0);
  assert.equal(hauteurSurfaces([toit], 15, 5).h, 0);
});
test('hauteurSurfaces : rampe linéaire', () => {
  assert.ok(Math.abs(hauteurSurfaces([rampe], 22.5, -28, 1.4).h - 1.5) < 1e-9);
});

test('trouverRebord : caisse de 1,2 m juste devant', () => {
  const caisse = boite('k', 0, 2, 0, 2, 1.2);
  const r = trouverRebord([caisse], { x: -0.4, z: 1 }, { x: 1, z: 0 }, 0);
  assert.ok(r); assert.equal(r.h, 1.2); assert.equal(r.surface.id, 'k');
  assert.ok(r.x > 0 && r.x < 2);
});
test('trouverRebord : conteneur trop haut depuis le sol, attrapé en sautant', () => {
  assert.equal(trouverRebord([conteneur], { x: -0.4, z: 1 }, { x: 1, z: 0 }, 0), null);
  assert.ok(trouverRebord([conteneur], { x: -0.4, z: 1 }, { x: 1, z: 0 }, 0.8));
});
test('trouverRebord : muret trop bas, caisse trop loin', () => {
  assert.equal(trouverRebord([boite('m', 0, 2, 0, 2, 0.5)], { x: -0.4, z: 1 }, { x: 1, z: 0 }, 0), null);
  assert.equal(trouverRebord([boite('k', 0, 2, 0, 2, 1.2)], { x: -1.5, z: 1 }, { x: 1, z: 0 }, 0), null);
});

const echelle = { minX: 13.2, maxX: 13.8, minZ: 12, maxZ: 13, bas: 0, haut: 2.9, face: { x: -1, z: 0 }, sortie: { x: 14.6, z: 12.5 } };
test('echelleDevant : avancer vers le mur prend l\'échelle, reculer non', () => {
  assert.equal(echelleDevant([echelle], { x: 13.5, z: 12.5 }, { x: 1, z: 0 }), echelle);
  assert.equal(echelleDevant([echelle], { x: 13.5, z: 12.5 }, { x: -1, z: 0 }), null);
  assert.equal(echelleDevant([echelle], { x: 10, z: 12.5 }, { x: 1, z: 0 }), null);
});

test('liensAuto : un lien par côté, pied dehors, arrivée dessus', () => {
  const s = boite('b', 0, 4, 0, 2, 2);
  const l = liensAuto(s, 1.5);
  assert.equal(l.length, 4);
  const dedans = (p) => p.x > 0 && p.x < 4 && p.z > 0 && p.z < 2;
  for (const k of l) {
    assert.ok(!dedans(k.bas)); assert.ok(dedans(k.haut));
    assert.equal(k.haut.h, 2); assert.equal(k.duree, 1.5); assert.equal(k.surface, 'b');
  }
});
test('choisirLien : le plus proche de la bonne surface', () => {
  const liens = [...liensAuto(boite('a', 0, 4, 0, 2, 2), 1.5), ...liensAuto(boite('b', 10, 14, 0, 2, 2), 1.5)];
  const l = choisirLien(liens, 'a', { x: 5, z: 1 });
  assert.equal(l.surface, 'a'); assert.ok(l.bas.x > 4);
  assert.equal(choisirLien(liens, 'zzz', { x: 0, z: 0 }), null);
});
test('bordLePlusProche : point au sol hors du bord le plus proche', () => {
  const p = bordLePlusProche(boite('a', 0, 4, 0, 2, 2), { x: 3.8, z: 1 });
  assert.ok(p.x > 4 && Math.abs(p.z - 1) < 1e-9);
});

test('degatsChute : rien jusqu\'à 4 m, puis 10 PV par mètre', () => {
  assert.equal(degatsChute(3), 0); assert.equal(degatsChute(4), 0); assert.equal(degatsChute(6), 20);
});

const conduit = { minX: 21, maxX: 23, minZ: -9.6, maxZ: -8.6, minY: 1.2, maxY: 2.6 };
test('deplacer : accroupi (1,2 m) passe sous le conduit, debout (1,8 m) non', () => {
  const debout = deplacer({ x: 20, z: -9.1 }, 2, 0, 0.35, [conduit], 0);
  assert.ok(debout.x < 21);
  const accroupi = deplacer({ x: 20, z: -9.1 }, 2, 0, 0.35, [conduit], 0, 1.2);
  assert.ok(accroupi.x > 21.9);
});
test('peutSeRelever : non sous le conduit, oui à côté', () => {
  assert.equal(peutSeRelever([conduit], { x: 22, z: -9.1 }, 0.35, 0), false);
  assert.equal(peutSeRelever([conduit], { x: 19, z: -9.1 }, 0.35, 0), true);
});
