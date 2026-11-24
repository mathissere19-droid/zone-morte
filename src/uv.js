// UV en mètres : une unité de texture = 1 m, pour que les textures se répètent
// selon la taille réelle de chaque boîte (la répétition est réglée sur la texture).

// Faces d'une BoxGeometry dans l'ordre : +x, -x, +y, -y, +z, -z (4 sommets chacune).
const AXES_FACES = [['z', 'y'], ['z', 'y'], ['x', 'z'], ['x', 'z'], ['x', 'y'], ['x', 'y']];

export function uvEnMetres(geometrie, dims) {
  const uv = geometrie.attributes.uv;
  const boite = geometrie.groups.length === 6;
  for (let i = 0; i < uv.count; i++) {
    const [au, av] = boite ? AXES_FACES[Math.floor(i / 4)] : ['x', 'z'];
    uv.setXY(i, uv.getX(i) * (dims[au] ?? 1), uv.getY(i) * (dims[av] ?? 1));
  }
  uv.needsUpdate = true;
  return geometrie;
}
