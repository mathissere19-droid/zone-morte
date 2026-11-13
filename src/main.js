import * as THREE from 'three';

const conteneur = document.getElementById('jeu');
const modeTest = new URLSearchParams(location.search).has('test');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
conteneur.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.FogExp2(0x0b0f1a, 0.03);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 1.7, 0);

scene.add(new THREE.HemisphereLight(0x5a6a8a, 0x1a1a1a, 0.6));
const lune = new THREE.DirectionalLight(0x8899cc, 0.8);
lune.position.set(-20, 40, 10);
scene.add(lune);

const sol = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
sol.rotation.x = -Math.PI / 2;
scene.add(sol);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const jeu = { etat: 'menu', scene, camera, renderer, modeTest };
window.__jeu = jeu;

function boucle(dt) {
  dt = Math.min(dt, 0.1);
  renderer.render(scene, camera);
}

let precedent = performance.now();
renderer.setAnimationLoop((t) => {
  const dt = (t - precedent) / 1000;
  precedent = t;
  boucle(dt);
});
