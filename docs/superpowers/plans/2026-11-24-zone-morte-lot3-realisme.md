# Zone Morte — Lot 3 Réalisme visuel (+ décors du Lot 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la base militaire réaliste — vraies textures PBR, ciel HDRI de nuit, projecteurs, lampe torche, post-traitement, effets — et ajouter les nouveaux décors (conteneurs, jeep, sacs de sable, palettes…) comme obstacles solides texturés.

**Architecture:** Deux nouveaux modules visuels (`src/textures.js`, `src/rendu.js`) et un module pur testé (`src/regles/qualite.js`). Les décors sont ajoutés dans `carte.js` avec des UV en mètres (`src/uv.js`) pour que les textures se répètent selon la taille réelle de chaque boîte. Les règles de jeu ne changent pas.

**Tech Stack:** three.js 0.170 (vendor + addons postprocessing / RGBELoader), Node `node --test`, Playwright (Edge, SwiftShader) pour `npm run fumee`. Assets Poly Haven CC0 (API `api.polyhaven.com`).

**Spec:** `docs/superpowers/specs/2026-11-24-zone-morte-jalon2-design.md` — §4 (Lot 3) en entier, §3.1 (décors) **sans** escalade, échelles, accroupi, conduit d'aération ni toits accessibles (restent au Lot 2, choix de l'utilisateur du 24/11).

## Global Constraints

- Textures Poly Haven **CC0, 1K, JPG** : couleur (`Diffuse`) + normale (`nor_gl`) + `arm` (AO/rugosité/métal, canaux R/G/B = ce qu'attend three.js). Fichiers dans `assets/textures/<id>/`, HDRI dans `assets/hdri/`, tous crédités dans `CREDITS.md`.
- Texture ou HDRI manquant → couleur unie / fond uni, `console.warn` (jamais `console.error`, le test de fumée échoue sur toute erreur console), le jeu continue.
- Qualité **Basse / Moyenne / Haute** : résolution de rendu 0,7 / 1 / 1 ; ombres non / projecteurs / tout ; SSAO non / non / oui ; particules ×0,4 / ×1 / ×1 ; projecteurs 2 / 2 / 4 (avec ombres en Moyenne et Haute). Défaut **Moyenne**. Mémorisée dans `localStorage` clé `zoneMorte.qualite` (try/catch comme le record). Choix dans l'accueil **et** dans le menu pause.
- En Haute, sous 40 i/s pendant 5 s → message « Images saccadées : passez en qualité Moyenne » (une fois par partie, jamais de changement automatique).
- Tone mapping ACES, bloom, grain + vignette + légère aberration chromatique + correction froide dans **un seul** `ShaderPass`.
- Lampe torche du joueur : touche `F` (bascule), ombre uniquement en Haute.
- Trous de balle : 64 au maximum (les plus anciens disparaissent).
- Toute valeur chiffrée nouvelle va dans `CONFIG` (`config.js`), section `qualite` / `rendu`.
- Les décors ne doivent bloquer **aucun** chemin : tous les points d'apparition, murs d'armes, la caisse et les portes restent atteignables depuis le départ, toutes portes ouvertes.
- Messages, noms et commits en français.

## Review Focus

1. **Navigation cassée par un décor** (zombie bloqué, vague qui ne finit pas) → couvert par `tests/decors.test.js` (Tâche 4) : A* depuis le départ vers chaque point d'apparition, mur d'arme, caisse et segment de porte.
2. **Un fichier d'asset manquant ou mal nommé** (404 = erreur console, page cassée) → `tests/textures.test.js` (Tâche 1) vérifie que chaque fichier du catalogue existe sur disque.
3. **Performances SwiftShader / petits PC** : le test de fumée doit tourner en `Basse` sans dépasser ses délais → scénario « qualité basse » (Tâche 2), et le reste du test de fumée force `Basse` via `?test=1`.
4. **Changement de qualité en pleine partie** (composer recréé, ombres activées après coup → matériaux à recompiler) → scénario de fumée qui bascule Basse→Haute→Moyenne pendant une partie sans erreur (Tâche 2).
5. **Fuite de mémoire des effets** (trous de balle, fumée, sang) sur une longue partie → test unitaire du tampon circulaire `ajouterBorne` (Tâche 5) et vérification en fumée que `scene.children.length` reste borné après 300 tirs.

---

### Task 1: Assets Poly Haven, UV en mètres et application des textures

**Files:**
- Create: `outils/telecharger-assets.mjs`, `src/uv.js`, `src/textures.js`, `assets/textures/**`, `assets/hdri/moonless_golf_1k.hdr`
- Modify: `src/carte.js` (export `mats`, UV en mètres dans `boite()` et `sol()`), `src/main.js` (appel `appliquerTextures`), `CREDITS.md`
- Test: `tests/textures.test.js`

**Interfaces:**
- Produces:
  - `CATALOGUE_TEXTURES` (dans `src/textures.js`) : `{ [cleMateriau]: { id: string, taille: number /* mètres couverts par une répétition */, teinte?: number } }`
  - `cheminsTexture(id) -> { couleur, normale, arm }` (chemins relatifs `assets/textures/<id>/<id>_diff_1k.jpg`, `_nor_gl_1k.jpg`, `_arm_1k.jpg`)
  - `appliquerTextures(mats, renderer) -> Promise<void>` : charge et pose `map` (sRGB), `normalMap`, `aoMap`, `roughnessMap`, `metalnessMap` ; `wrapS/T = RepeatWrapping`, `repeat = 1/taille`, anisotropie max ; sur erreur : `console.warn` et couleur conservée.
  - `textureGrillage() -> THREE.CanvasTexture` (losanges sur fond transparent, généré en canvas : pas de texture CC0 adaptée)
  - `uvEnMetres(geometrie: THREE.BoxGeometry | THREE.PlaneGeometry, dims: {x, y, z}) -> geometrie` (dans `src/uv.js`) : multiplie les UV de chaque face par ses dimensions en mètres (faces ±x → (z, y), ±y → (x, z), ±z → (x, y) ; plan → (x, z)).
  - `carte.js` exporte `mats`.

Catalogue (clé de `mats` → id Poly Haven, taille en m) :

| clé | id | taille |
|---|---|---|
| asphalte | `worn_asphalt` | 4 |
| beton | `concrete_wall_008` | 3 |
| betonSombre | `dirty_concrete` | 3 |
| solHangar (nouveau, sol du hangar) | `hangar_concrete_floor` | 4 |
| sable (sol de la tour) | `sandy_gravel` | 3 |
| tole | `rusty_corrugated_iron` | 2 |
| metal | `metal_plate` | 1.5 |
| rouille | `rusty_metal_02` | 1.5 |
| bois | `weathered_planks` | 1.5 |
| kaki | `green_metal_rust` | 2 |
| sacs (nouveau) | `dense_sand`, teinte `0xb8a47a` | 0.6 |
| bache (nouveau) | `denim_fabric_04`, teinte `0x5b6640` | 1.5 |
| dehors | `coast_sand_rocks_02` | 6 |

HDRI : `moonless_golf` 1K `.hdr`.

- [ ] **Step 1: Écrire `outils/telecharger-assets.mjs`** — lit le catalogue (import de `src/textures.js` : exporter `CATALOGUE_TEXTURES` et `HDRI` sans dépendance au DOM au chargement du module), interroge `https://api.polyhaven.com/files/<id>`, télécharge `Diffuse`/`nor_gl`/`arm` en `1k.jpg` et l'HDRI `hdri.1k.hdr`, saute les fichiers déjà présents, ajoute les lignes manquantes à `CREDITS.md` (`- <id> — Poly Haven — CC0 — https://polyhaven.com/a/<id>`).

- [ ] **Step 2: Lancer le script**
Run: `node outils/telecharger-assets.mjs`
Expected: 13 dossiers dans `assets/textures/`, 39 JPG, `assets/hdri/moonless_golf_1k.hdr`, aucune erreur.

- [ ] **Step 3: Écrire le test qui échoue `tests/textures.test.js`**

```js
test('chaque clé de mats a une texture dans le catalogue', () => {
  for (const cle of Object.keys(mats)) {
    if (['porte', 'porteBande', 'caisse', 'murArme'].includes(cle)) continue; // couleurs de jeu volontaires
    assert.ok(CATALOGUE_TEXTURES[cle], 'texture manquante pour ' + cle);
  }
});
test('tous les fichiers du catalogue existent sur disque', () => {
  for (const { id } of Object.values(CATALOGUE_TEXTURES))
    for (const f of Object.values(cheminsTexture(id))) assert.ok(existsSync(f), f);
  assert.ok(existsSync(HDRI.chemin));
});
test('uvEnMetres : une face de 4 m × 2 m va de 0 à 4 et de 0 à 2', () => {
  const g = uvEnMetres(new THREE.BoxGeometry(4, 2, 1), { x: 4, y: 2, z: 1 });
  const uv = g.attributes.uv; // face +z = 5e groupe (index 16..19)
  const us = [16, 17, 18, 19].map((i) => uv.getX(i)), vs = [16, 17, 18, 19].map((i) => uv.getY(i));
  assert.deepEqual([Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)], [0, 4, 0, 2]);
});
```

- [ ] **Step 4: Run** `npm test` → Expected: FAIL (modules absents).

- [ ] **Step 5: Implémenter `src/uv.js`, `src/textures.js`** ; dans `carte.js`, exporter `mats`, ajouter `solHangar`, `sacs`, `bache`, appliquer `uvEnMetres` dans `boite()` et `sol()`, utiliser `solHangar` pour le sol du hangar et un matériau `mats.grillage` (`transparent`, `alphaTest: 0.5`, `side: DoubleSide`) à la place du grillage `wireframe` ; sa texture `textureGrillage()` est posée par `appliquerTextures` (jamais à la construction : `construireCarte` doit rester exécutable sous Node, sans canvas — la Tâche 4 en dépend). `grillage` est exclu du test du catalogue comme les couleurs de jeu. Les couleurs de base des matériaux texturés passent à `0xffffff` (ou `teinte`) au moment où la texture est posée. Dans `main.js`, `appliquerTextures(mats, renderer)` après `construireCarte`.

- [ ] **Step 6: Run** `npm test` → Expected: PASS (tous les tests, anciens compris).

- [ ] **Step 7: Run** `npm run fumee` → Expected: `FUMEE OK`, capture montrant des murs texturés.

- [ ] **Step 8: Commit** `git add -A outils src assets tests CREDITS.md && git commit -m "Textures PBR Poly Haven et UV en mètres"`

---

### Task 2: Rendu, post-traitement et réglage de qualité

**Files:**
- Create: `src/regles/qualite.js`, `src/rendu.js`
- Modify: `src/config.js` (section `qualite`), `src/main.js` (remplace la création du renderer, de la scène/brouillard et `renderer.render`), `index.html` + `src/interface.js` (choix de qualité accueil + pause, message de perf), `style.css`, `tests/fumee/scenarios.mjs`
- Test: `tests/qualite.test.js`

**Interfaces:**
- Consumes: `HDRI.chemin` (Tâche 1).
- Produces:
  - `CONFIG.qualite = { basse: {nom:'Basse', resolution:0.7, ombres:'non', ssao:false, particules:0.4, projecteurs:2}, moyenne: {nom:'Moyenne', resolution:1, ombres:'projecteurs', ssao:false, particules:1, projecteurs:2}, haute: {nom:'Haute', resolution:1, ombres:'tout', ssao:true, particules:1, projecteurs:4}, perf: {seuil:40, duree:5} }`
  - `regles/qualite.js` : `IDS_QUALITE = ['basse','moyenne','haute']`, `parametresQualite(id) -> objet CONFIG.qualite[id]` (id inconnu → moyenne), `creerSurveillancePerf() -> {lent:0, signale:false}`, `majSurveillancePerf(s, dt, idQualite) -> boolean` (vrai une seule fois quand `idQualite==='haute'` et que `1/dt < seuil` cumulé ≥ `duree` s ; une image rapide remet `lent` à 0).
  - `rendu.js` : `creerRendu(conteneur) -> { renderer, scene, camera, appliquerQualite(id), rendre(), redimensionner(), qualite /* id actif */ }`. Scène : fond + `environment` = HDRI (PMREM), `scene.environmentIntensity = 0.35`, `scene.backgroundIntensity = 0.25`, `FogExp2(0x0b0f1a, 0.028)`, `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.1`. Composer : `RenderPass` → `SSAOPass` (si `ssao`) → `UnrealBloomPass(force 0.6, rayon 0.4, seuil 0.85)` → `ShaderPass(FINITION)` → `OutputPass`. `FINITION` : uniforms `temps`, `grain 0.06`, `vignette 0.35`, `aberration 0.0015`, `froid vec3(0.92, 1.0, 1.08)`.
  - `jeu.qualite` / `jeu.changerQualite(id)` exposés sur `window.__jeu`.
  - En `?test=1`, qualité forcée à `basse` au démarrage sauf si `&qualite=<id>`.

- [ ] **Step 1: Test qui échoue `tests/qualite.test.js`**

```js
test('paramètres par niveau', () => {
  assert.equal(parametresQualite('basse').resolution, 0.7);
  assert.equal(parametresQualite('haute').ssao, true);
  assert.equal(parametresQualite('xxx').nom, 'Moyenne');
});
test('alerte perf : seulement en Haute, après 5 s sous 40 i/s, une seule fois', () => {
  const s = creerSurveillancePerf();
  for (let i = 0; i < 200; i++) assert.equal(majSurveillancePerf(s, 1 / 30, 'moyenne'), false);
  let alertes = 0;
  for (let i = 0; i < 149; i++) alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  assert.equal(alertes, 0);                    // 149/30 s < 5 s
  alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  for (let i = 0; i < 300; i++) alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  assert.equal(alertes, 1);
});
test('une image rapide remet le compteur à zéro', () => {
  const s = creerSurveillancePerf();
  for (let i = 0; i < 140; i++) majSurveillancePerf(s, 1 / 30, 'haute');
  majSurveillancePerf(s, 1 / 60, 'haute');
  assert.equal(s.lent, 0);
});
```

- [ ] **Step 2: Run** `node --test tests/qualite.test.js` → FAIL (module absent).
- [ ] **Step 3: Implémenter `config.js` + `regles/qualite.js`** ; Run → PASS.
- [ ] **Step 4: Implémenter `rendu.js` et brancher `main.js`** (la boucle appelle `rendu.rendre()` ; `resize` appelle `rendu.redimensionner()` ; `appliquerQualite` règle `setPixelRatio(min(devicePixelRatio,2) * resolution)`, `renderer.shadowMap.enabled`, la présence du SSAO, et appelle les rappels enregistrés par les Tâches 3 et 5 via `rendu.surQualite(fn)` ; quand les ombres changent, parcourir la scène et mettre `material.needsUpdate = true`). Lecture/écriture `localStorage` dans `main.js` comme pour la difficulté.
- [ ] **Step 5: Interface** — dans `#ecran-menu` et `#ecran-pause`, un groupe `#choix-qualite` / `#choix-qualite-pause` de 3 boutons `data-qualite` (classe `actif` sur le choix courant, même style que les boutons de difficulté) ; `ui.message(texte)` existant pour l'alerte de perf.
- [ ] **Step 6: Scénarios de fumée** — ajouter « qualité : bascule Basse → Haute → Moyenne en pleine partie » (vérifie `__jeu.qualite`, 1 s de jeu après chaque bascule, pas d'erreur) et « HDRI chargé » (`__jeu.scene.environment !== null` après 5 s).
- [ ] **Step 7: Run** `npm test && npm run fumee` → PASS / `FUMEE OK`.
- [ ] **Step 8: Commit** `git commit -am "Rendu réaliste : HDRI, ACES, bloom, finition et niveaux de qualité"` (ajouter les nouveaux fichiers).

---

### Task 3: Éclairage — lune, projecteurs, gyrophare, lampe torche

**Files:**
- Modify: `src/carte.js` (mâts + `SpotLight`, gyrophare), `src/main.js` (lune avec ombres, lampe torche, touche F), `src/joueur.js` si les touches y sont lues, `src/config.js` (section `rendu.lumieres`), `index.html` (ligne des touches : `<b>F</b> lampe`), `tests/fumee/scenarios.mjs`

**Interfaces:**
- Consumes: `rendu.surQualite(fn)`, `parametresQualite(id)` (Tâche 2).
- Produces:
  - `carte.projecteurs: Array<{ lumiere: THREE.SpotLight, rang: number }>` — 4 mâts : cour (0,0) existant, cour (-12,-9), hangar (-15,-14), tour (18,-20). `rang` 0..3 ; un projecteur est visible si `rang < parametres.projecteurs`. SpotLight `0xdfe8ff`, intensité 120, portée 35, angle 0,6 rad, pénombre 0,5, `castShadow` si `ombres !== 'non'`, `shadow.mapSize 1024`. Ampoule émissive au sommet (le bloom la fait briller).
  - `carte.gyrophare: { lumiere: THREE.SpotLight, mesh }` au sommet de la tour (28, 14, -28), rouge `0xff2020`, tourne à 2 tours/s dans `majCarte`.
  - Lune : `DirectionalLight 0x8fa6d8` intensité 0,8, `castShadow` seulement si `ombres === 'tout'`, caméra d'ombre couvrant x[-20,38] z[-38,20], `mapSize 2048`.
  - `jeu.lampe: { allumee: boolean, lumiere: THREE.SpotLight }` — SpotLight blanc chaud `0xfff1d6`, intensité 40, portée 25, angle 0,45, pénombre 0,6, attachée à la caméra visant devant ; `castShadow` seulement en Haute. `F` (`entrees.appuis.has('KeyF')`) bascule.

- [ ] **Step 1: Scénario de fumée qui échoue** — « lampe torche F » : démarrer, `__jeu.entrees.appuis.add('KeyF')` sur une image, vérifier `__jeu.lampe.allumee === true`, recommencer → `false` ; « projecteurs selon qualité » : en `basse` 2 projecteurs visibles, en `haute` 4 et `castShadow` vrai.
- [ ] **Step 2: Run** `npm run fumee` → FAIL sur « lampe torche F ».
- [ ] **Step 3: Implémenter** (valeurs ci-dessus dans `CONFIG.rendu.lumieres`), retirer l'ancienne `PointLight` du mât de la cour remplacée par le projecteur, garder les néons vacillants du bunker.
- [ ] **Step 4: Run** `npm test && npm run fumee` → PASS / `FUMEE OK`.
- [ ] **Step 5: Commit** `git commit -am "Projecteurs, gyrophare, lune avec ombres et lampe torche (F)"`

---

### Task 4: Nouveaux décors solides et texturés

**Files:**
- Create: `src/decors.js` (fabriques de modèles : `conteneur`, `jeep`, `muretSacs`, `palettes`, `baril`, `vehiculeBache`, `pileCaisses`, `armoireRenversee`, `bureauRenverse`, `guerite`)
- Modify: `src/carte.js` (placement + AABB), `tests/fumee/scenarios.mjs`
- Test: `tests/decors.test.js`

**Interfaces:**
- Consumes: `mats` (y compris `sacs`, `bache`), `uvEnMetres` (Tâche 1).
- Produces: chaque fabrique `(groupe, mats, {minX,maxX,minZ,maxZ}, options) -> THREE.Object3D` construit un modèle détaillé (ex. conteneur : caisse + nervures + portes et barres de verrouillage ; jeep : châssis, capot, 4 roues cylindres, arceau ; muret : rangées de sacs arrondis décalés ; baril : cylindre avec cerclages). La **collision reste la boîte englobante** passée à `boite()`-like (`aabbs`, `aabbsZombies`, `navObstacles`) ; les meshes s'ajoutent à `carte.obstaclesVisibles` pour que balles et grenades s'y arrêtent.

Placements (boîte englobante `minX,maxX,minZ,maxZ`, hauteur) :

| zone | objet | boîte | h |
|---|---|---|---|
| cour | conteneur | -15, -12.6, 6, 12 | 2.6 |
| cour | conteneur | 4, 10, -10, -7.6 | 2.6 |
| cour | muret de sacs | -2, 2, 12, 12.6 | 1.0 |
| cour | carcasse de jeep | 6, 9.5, 4, 5.8 | 1.5 |
| cour | palettes | -8, -6.8, -8, -6.8 | 0.6 |
| cour | 2 barils | 11, 12.2, -10, -8.8 | 1.2 |
| cour | camion renversé existant | même boîte, modèle détaillé (cabine, roues, bâche) | — |
| cour | sacs de sable existants | modèle `muretSacs` | — |
| hangar | pile de caisses en escalier | -6, -3, -35, -33 | 2.0 |
| hangar | 3 barils | 5, 6.2, -16, -14.8 | 1.2 |
| hangar | véhicules existants | modèle `vehiculeBache` (bâche `mats.bache`) | — |
| bunker | armoire renversée | 24, 26, 12, 13 | 0.8 |
| bunker | bureau renversé | 16, 18, -8, -7 | 0.9 |
| bunker | armoire renversée | 33, 35, -2, -1.4 | 0.8 |
| tour | guérite | 32, 35, -20, -17 | 2.5 |
| tour | muret de sacs | 18, 22, -22, -21.4 | 1.0 |
| tour | 2 barils | 10, 11.2, -20, -18.8 | 1.2 |

Si un placement échoue au test d'accessibilité, le décaler de 1 m vers le centre de sa zone et le noter dans le commit.

- [ ] **Step 1: Test qui échoue `tests/decors.test.js`**

```js
// construireCarte(new THREE.Scene()) tourne sous Node (pas de chargement de texture à la construction)
const carte = construireCarte(new THREE.Scene());
for (const p of carte.portes) ouvrirPorte(carte, p);
const g = creerGrille({ minX: -18, minZ: -36, largeur: 54, profondeur: 54, taille: 0.5 });
marquerObstacles(g, carte.navObstacles);
const cibles = [
  ...Object.values(carte.zones).flatMap((z) => z.pointsApparition),
  ...carte.mursArmes.map((m) => m.position), carte.caisse.position,
  ...carte.portes.flatMap((p) => p.segments),
];
test('les décors existent', () => assert.ok(carte.aabbs.length >= 60));
test('tout reste atteignable depuis le départ, toutes portes ouvertes', () => {
  for (const c of cibles) assert.ok(trouverChemin(g, carte.depart, { x: c.x, z: c.z }), `inatteignable : ${c.x},${c.z}`);
});
test('aucun point d\'apparition ni le départ dans un obstacle', () => {
  for (const p of [carte.depart, ...Object.values(carte.zones).flatMap((z) => z.pointsApparition)])
    for (const b of carte.aabbs) assert.ok(!dansAABB(p, b, 0.5), `${p.x},${p.z} dans un décor`);
});
```

(Ajuster le seuil `>= 60` au nombre réel d'AABB actuel + 17 nouveaux décors : relever le compte actuel avant d'écrire le test.)

- [ ] **Step 2: Run** `node --test tests/decors.test.js` → FAIL sur « les décors existent ».
- [ ] **Step 3: Implémenter `src/decors.js` et les placements** dans `carte.js`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Run** `npm run fumee` → `FUMEE OK` (le scénario existant « vague 5 en Cauchemar, toutes zones ouvertes » prouve qu'aucun zombie ne reste coincé).
- [ ] **Step 6: Commit** `git commit -am "Nouveaux décors : conteneurs, jeep, sacs de sable, barils, guérite…"` (ajouter `src/decors.js`, `tests/decors.test.js`).

---

### Task 5: Effets — flamme de bouche, impacts, trous de balle, sang, feu, éclair, fumée

**Files:**
- Create: `src/regles/tampon.js`, `src/effets.js`
- Modify: `src/armes.js` (appelle `effets` au lieu de ses impacts / flammes / éclairs actuels), `src/main.js` (explosion → `effets.explosion`), `src/zombies.js` (sang), `src/config.js` (`rendu.effets`), `tests/fumee/scenarios.mjs`
- Test: `tests/tampon.test.js`

**Interfaces:**
- Consumes: `rendu.surQualite(fn)` / `parametresQualite(id).particules` (Tâche 2), `obstaclesVisibles` (Tâche 4).
- Produces:
  - `regles/tampon.js` : `ajouterBorne(liste, element, max) -> element|null` (ajoute à la fin, retire et renvoie le plus ancien si `length > max`, sinon `null`) ; `nombreParticules(base, facteur) -> entier ≥ 1`.
  - `effets.js` : `creerEffets(scene) -> { impactMur(point, normale), impactChair(point, zombie), flammeBouche(position), feu(origine, direction), eclair(points[]), explosion(position), maj(dt), qualite(params), vider() }`
    - `impactMur` : 6×facteur étincelles (points additifs orange, 0,25 s, gravité) + 4×facteur poussière grise (sprites, 0,8 s) + **trou de balle** : disque `CircleGeometry(0.04)` sombre, orienté sur `normale`, décalé de 0,01 m, tampon de **64** (`CONFIG.rendu.effets.trousMax`).
    - `impactChair` : gerbe rouge sombre (8×facteur, 0,4 s) + tache de sang (plan rouge sombre 0,15 m) attachée au mesh du zombie touché, 6 au maximum par zombie.
    - `flammeBouche` : sprite étoile additif 0,05 s (la `PointLight` de flash existante reste).
    - `feu` : 3×facteur sprites additifs par appel, dégradé jaune→orange→rouge→fumée, montent, 0,5 s ; remplace les flammes actuelles du lance-flammes.
    - `eclair` : ligne brisée existante + seconde ligne plus large et transparente (halo) + `PointLight` bleutée 0,1 s.
    - `explosion` : boule de feu actuelle (déplacée depuis `main.js`) + 12×facteur sprites de fumée grise qui grossissent et montent pendant 2,5 s.
    - Textures des sprites générées en canvas (dégradé radial), pas de fichier.
  - `vider()` appelé dans `demarrerPartie`.

- [ ] **Step 1: Test qui échoue `tests/tampon.test.js`**

```js
test('ajouterBorne garde les 64 plus récents', () => {
  const l = []; let retires = 0;
  for (let i = 0; i < 100; i++) if (ajouterBorne(l, i, 64) !== null) retires++;
  assert.equal(l.length, 64); assert.equal(l[0], 36); assert.equal(retires, 36);
});
test('nombreParticules applique le facteur, au moins 1', () => {
  assert.equal(nombreParticules(10, 0.4), 4);
  assert.equal(nombreParticules(1, 0.4), 1);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** implémenter `tampon.js` → PASS.
- [ ] **Step 4: Implémenter `effets.js`** et brancher `armes.js` (la normale vient de `hit.face.normal` transformée en monde), `main.js`, `zombies.js`.
- [ ] **Step 5: Scénarios de fumée** — « trous de balle bornés » : face à un mur, 300 tirs forcés (`__jeu.tirer()` en remplissant le chargeur), `__jeu.effets.trous.length === 64` et `scene.children.length` stable à ±20 entre le 100e et le 300e tir après 3 s ; « explosion avec fumée » : grenade, puis `effets.fumees.length > 0`, puis 0 après 4 s.
- [ ] **Step 6: Run** `npm test && npm run fumee` → PASS / `FUMEE OK`.
- [ ] **Step 7: Vérification finale** — lancer `npm run fumee` avec `&qualite=haute` en plus du défaut (passer l'URL via une variable d'environnement `FUMEE_QUALITE=haute` lue par `fumee.mjs`) ; regarder `tests/fumee/capture.png` ; mettre à jour `LISEZMOI.md` (touche F, qualité, crédits Poly Haven) et la ligne des touches de `index.html`.
- [ ] **Step 8: Commit** `git commit -am "Effets réalistes : impacts, trous de balle, sang, feu, éclair, fumée"` puis `git commit -am "Lot 3 terminé : vérification et LISEZMOI"`.
