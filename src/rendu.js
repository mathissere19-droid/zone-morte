// Rendu réaliste : renderer, ciel HDRI, brouillard, post-traitement et niveaux de qualité.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';
import { HDRI } from './textures.js';
import { parametresQualite } from './regles/qualite.js';

// Grain de film + vignette + légère aberration chromatique + correction froide, en une passe.
const FINITION = {
  uniforms: {
    tDiffuse: { value: null }, temps: { value: 0 },
    grain: { value: 0 }, vignette: { value: 0 }, aberration: { value: 0 }, froid: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float temps, grain, vignette, aberration; uniform vec3 froid;
    varying vec2 vUv;
    float hasard(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + d * aberration).r;
      c.b = texture2D(tDiffuse, vUv - d * aberration).b;
      c.rgb *= froid;
      c.rgb *= 1.0 - vignette * dot(d, d) * 2.0;
      c.rgb += (hasard(vUv * 1000.0 + temps) - 0.5) * grain * (0.3 + c.rgb);
      gl_FragColor = c;
    }`,
};

export function creerRendu(conteneur) {
  const R = CONFIG.rendu;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = R.exposition;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(R.brouillard.couleur);
  scene.fog = new THREE.FogExp2(R.brouillard.couleur, R.brouillard.densite);
  scene.environmentIntensity = R.intensiteEnvironnement;
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.03, 200);
  scene.add(camera);

  // Ciel de nuit : éclairage d'ambiance (PMREM) + sphère de ciel qui suit la caméra.
  // (le fond « scene.background » d'un HDRI est dessiné au plan lointain : certains pilotes en coupent
  //  des triangles, d'où une sphère de 150 m, bien en deçà du plan lointain de 200 m ; repli : fond uni)
  let ciel = null;
  new RGBELoader().load(HDRI.chemin, (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    const texCiel = hdr.clone();
    texCiel.mapping = THREE.UVMapping;
    texCiel.needsUpdate = true;
    ciel = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.MeshBasicMaterial({
      map: texCiel, side: THREE.BackSide, fog: false, depthWrite: false,
      color: new THREE.Color().setScalar(R.intensiteFond),
    }));
    ciel.scale.x = -1; // vu de l'intérieur : remettre le panorama à l'endroit
    ciel.renderOrder = -1;
    ciel.name = 'ciel';
    ciel.raycast = () => {}; // n'arrête ni les balles ni les rayons de visée
    scene.add(ciel);
  }, undefined, () => console.warn('Ciel HDRI manquant : ' + HDRI.chemin));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssao = new SSAOPass(scene, camera, innerWidth, innerHeight);
  ssao.kernelRadius = 0.6; ssao.minDistance = 0.002; ssao.maxDistance = 0.08;
  composer.addPass(ssao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), R.bloom.force, R.bloom.rayon, R.bloom.seuil);
  composer.addPass(bloom);
  const finition = new ShaderPass(FINITION);
  const f = finition.uniforms, F = R.finition;
  f.grain.value = F.grain; f.vignette.value = F.vignette; f.aberration.value = F.aberration; f.froid.value.fromArray(F.froid);
  composer.addPass(finition);
  composer.addPass(new OutputPass());

  const abonnes = [];
  const rendu = {
    renderer, scene, camera, qualite: null, postTraitement: true,
    surQualite(fn) { abonnes.push(fn); if (rendu.qualite) fn(parametresQualite(rendu.qualite), rendu.qualite); },
    appliquerQualite(id) {
      const p = parametresQualite(id);
      const ombresAvant = renderer.shadowMap.enabled;
      rendu.qualite = id;
      const ratio = Math.min(devicePixelRatio, 2) * p.resolution;
      renderer.setPixelRatio(ratio);
      composer.setPixelRatio(ratio);
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
      renderer.shadowMap.enabled = p.ombres !== 'non';
      ssao.enabled = p.ssao;
      for (const fn of abonnes) fn(p, id);
      // les matériaux doivent être recompilés quand les ombres changent
      if (ombresAvant !== renderer.shadowMap.enabled) {
        scene.traverse((o) => {
          for (const m of [].concat(o.material ?? [])) m.needsUpdate = true;
        });
      }
    },
    redimensionner() {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
    },
    rendre(dt) {
      if (ciel) ciel.position.copy(camera.position);
      f.temps.value = (f.temps.value + dt) % 1000;
      if (rendu.postTraitement) composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
  return rendu;
}
