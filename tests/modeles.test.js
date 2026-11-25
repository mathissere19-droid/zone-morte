import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

// Lit le bloc JSON d'un fichier glTF binaire (.glb) sans three.js.
export function lireJsonGlb(chemin) {
  const buf = readFileSync(chemin);
  assert.equal(buf.readUInt32LE(0), 0x46546c67, 'magic glTF');
  const longueurJson = buf.readUInt32LE(12);
  assert.equal(buf.readUInt32LE(16), 0x4e4f534a, 'premier bloc JSON');
  return JSON.parse(buf.subarray(20, 20 + longueurJson).toString('utf8'));
}

const ANIMATIONS = ['marche', 'course', 'attaque', 'mort1', 'mort2', 'ramper', 'sortie', 'attente'];

for (const nom of ['zombie1', 'zombie2', 'boss']) {
  test(`modèle ${nom}.glb complet`, () => {
    const chemin = `assets/zombies/${nom}.glb`;
    assert.ok(statSync(chemin).size < 12 * 1024 * 1024, 'moins de 12 Mo');
    const gltf = lireJsonGlb(chemin);
    const noms = (gltf.animations || []).map((a) => a.name).sort();
    assert.deepEqual(noms, [...ANIMATIONS].sort());
    assert.ok((gltf.skins || []).length >= 1, 'au moins une skin');
    assert.ok(gltf.nodes.some((n) => /Head$/.test(n.name || '')), 'os de tête');
  });
}
