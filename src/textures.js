// Textures PBR (Poly Haven, CC0, 1K) : chargement et application aux matériaux de la carte.
// Ce module ne touche pas au DOM au chargement : le catalogue est lu par l'outil de téléchargement (Node).
import * as THREE from 'three';

// clé de `mats` (carte.js) → texture Poly Haven ; taille = mètres couverts par une répétition
export const CATALOGUE_TEXTURES = {
  asphalte:    { id: 'worn_asphalt', taille: 4 },
  beton:       { id: 'concrete_wall_008', taille: 3 },
  betonSombre: { id: 'dirty_concrete', taille: 3 },
  solHangar:   { id: 'hangar_concrete_floor', taille: 4 },
  sable:       { id: 'sandy_gravel', taille: 3 },
  tole:        { id: 'rusty_corrugated_iron', taille: 2, metal: true },
  metal:       { id: 'metal_plate', taille: 1.5, metal: true },
  rouille:     { id: 'rusty_metal_02', taille: 1.5, metal: true },
  bois:        { id: 'weathered_planks', taille: 1.5 },
  kaki:        { id: 'green_metal_rust', taille: 2, metal: true },
  sacs:        { id: 'dense_sand', taille: 0.6, teinte: 0xb8a47a },
  bache:       { id: 'denim_fabric_04', taille: 1.5, teinte: 0x5b6640 },
  dehors:      { id: 'coast_sand_rocks_02', taille: 6 },
};

export const HDRI = { id: 'moonless_golf', chemin: 'assets/hdri/moonless_golf_1k.hdr' };

export function cheminsTexture(id) {
  const base = `assets/textures/${id}/${id}`;
  return { couleur: `${base}_diff_1k.jpg`, normale: `${base}_nor_gl_1k.jpg`, arm: `${base}_arm_1k.jpg` };
}

// Grillage en losanges sur fond transparent (pas de texture CC0 adaptée : générée en canvas)
export function textureGrillage() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#9a9c98';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 64); g.lineTo(64, 0); g.lineTo(128, 64); g.lineTo(64, 128); g.closePath();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.12, 1 / 0.12);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function charger(chargeur, url) {
  return new Promise((ok) => {
    chargeur.load(url, ok, undefined, () => { console.warn('Texture manquante : ' + url); ok(null); });
  });
}

export async function appliquerTextures(mats, renderer) {
  const chargeur = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const regler = (t, srgb, taille) => {
    if (!t) return null;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / taille, 1 / taille);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  if (mats.grillage) {
    mats.grillage.map = textureGrillage();
    mats.grillage.needsUpdate = true;
  }
  await Promise.all(Object.entries(CATALOGUE_TEXTURES).map(async ([cle, def]) => {
    const mat = mats[cle];
    if (!mat) return;
    const ch = cheminsTexture(def.id);
    const [couleur, normale, arm] = await Promise.all([ch.couleur, ch.normale, ch.arm].map((u) => charger(chargeur, u)));
    if (!couleur) return; // repli : couleur unie
    mat.map = regler(couleur, true, def.taille);
    mat.color.set(def.teinte ?? 0xffffff);
    if (normale) mat.normalMap = regler(normale, false, def.taille);
    if (arm) {
      regler(arm, false, def.taille);
      mat.aoMap = mat.roughnessMap = mat.metalnessMap = arm;
      mat.roughness = 1;
      mat.metalness = def.metal ? 1 : 0;
    }
    mat.emissive?.set(0x000000);
    mat.needsUpdate = true;
  }));
}
