# Zone Morte — Jalon 1 : version jouable (formes simples) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une partie complète jouable (vague 1 → mort → écran de score) sur la carte complète, en formes simples, avec toutes les règles de la spec v1.

**Architecture:** Modules ES sans compilation, three.js copié dans `vendor/`. Toute règle chiffrée vit dans `src/config.js` + `src/regles/*.js` (pur, sans three.js, testé avec `node --test`). Les modules visuels (`src/*.js`) consomment ces règles. Un objet `window.__jeu` expose l'état pour le test de fumée Playwright.

**Tech Stack:** JavaScript ES2022, three.js 0.170.0 (local), Node 26 (`node:test`), Python 3.12 (`http.server`), playwright-core avec le navigateur Edge installé (`channel: 'msedge'`).

**Spec:** `docs/superpowers/specs/2026-11-13-zone-morte-design.md` (sections 2, 3, 6, 7, 8). Le rendu réaliste (section 4), le son (5) et les modèles Mixamo font l'objet du **jalon 2**, hors de ce plan.

## Global Constraints

- Interface et messages en **français** ; noms de fichiers/fonctions en français comme dans la spec.
- Aucun contenu repris d'un jeu existant (noms d'armes génériques, cf. tableau des armes de la spec).
- Touches lues via `KeyboardEvent.code` (`KeyW/KeyA/KeyS/KeyD`…) → ZQSD sur AZERTY et WASD sur QWERTY sans configuration.
- `src/regles/` n'importe jamais three.js ni le DOM.
- Toutes les valeurs d'équilibrage sont dans `src/config.js`, jamais en dur ailleurs.
- `dt` de la boucle limité à `0,1 s`.
- Lancement : `Jouer.bat` → `python -m http.server 8642` dans le dossier + ouverture de `http://localhost:8642/`.
- Commits fréquents, message en français, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Perte de focus / Échap / onglet caché** → pause immédiate, aucun dégât ni chrono de vague pendant la pause. (Task 9)
2. **Zombie sans chemin** (A* renvoie `null`, ex. joueur dans une zone dont la porte vient de se refermer dans la grille) → le zombie avance en ligne droite au lieu de se figer. (Task 4, Task 7)
3. **Achat impossible** (points insuffisants, munitions déjà pleines, porte déjà ouverte) → refusé sans débit, message clair. (Task 3, Task 8)
4. **Tous les points d'apparition proches/visibles** → on fait quand même apparaître au point le plus éloigné, la vague ne bloque jamais. (Task 5)
5. **Retour d'onglet après longue absence** → `dt` limité, pas de téléportation à travers les murs. (Task 1, Task 6)

---

## File Structure

```
zone-morte/
  index.html               canvas + calques HUD + écrans (menu, pause, fin)
  style.css
  Jouer.bat
  package.json             "type":"module", scripts test / fumee
  vendor/three/            three.module.js + addons/ (copiés depuis npm)
  src/
    main.js                boucle, états de jeu, assemblage
    config.js              CONFIG (toutes les valeurs)
    regles/
      vagues.js            formules de vague
      economie.js          points, achats, caisse
      combat.js            dégâts
      inventaire.js        munitions + 2 emplacements
      vie.js               PV, régénération
      partie.js            machine à états des vagues, bonus par vague, apparitions
      collisions.js        AABB, glissement le long des murs
      navigation.js        grille + A*
    carte.js               géométrie simple de la base, portes, murs d'armes, caisse
    joueur.js              contrôles FPS, mouvement, stamina
    armes.js               tir raycast, visée, couteau, modèle d'arme simple
    zombies.js             capsules tête/corps, IA, attaque
    bonus.js               objets bonus au sol
    interface.js           HUD, invites « E », menus, écran de fin, record
  tests/                   *.test.js (node:test)
  tests/fumee/fumee.mjs    test Playwright
```

---

### Task 1: Squelette, lancement, boucle et caméra libre

**Files:**
- Create: `package.json`, `Jouer.bat`, `index.html`, `style.css`, `src/main.js`, `vendor/three/…`, `.gitignore` (`node_modules/`), `tests/fumee/fumee.mjs`

**Interfaces:**
- Produces: `window.__jeu = { etat: 'menu'|'partie'|'pause'|'fin', scene, camera, renderer }` (complété par les tâches suivantes) ; `boucle(dt)` dans `main.js` avec `dt = Math.min(dt, 0.1)`.

- [ ] **Step 1:** `npm init -y`, mettre `"type": "module"`, scripts `"test": "node --test tests/"` et `"fumee": "node tests/fumee/fumee.mjs"`. `npm i -D three@0.170.0 playwright-core`. Copier `node_modules/three/build/three.module.js` et `node_modules/three/examples/jsm/` vers `vendor/three/` (`three.module.js`, `addons/`). `index.html` utilise une importmap : `"three": "./vendor/three/three.module.js"`, `"three/addons/": "./vendor/three/addons/"`.
- [ ] **Step 2:** `Jouer.bat` : `cd /d "%~dp0"`, `start "" http://localhost:8642/`, `python -m http.server 8642`.
- [ ] **Step 3:** `main.js` : renderer plein écran (redimensionnement), scène avec sol gris 80×80 et ciel nuit uni `#0b0f1a`, brouillard `FogExp2(0x0b0f1a, 0.03)`, lumière ambiante + une directionnelle bleutée, écran menu « Cliquer pour jouer ».
- [ ] **Step 4: Test de fumée** `tests/fumee/fumee.mjs` : lance `python -m http.server 8642` (enfant), `chromium.launch({ channel: 'msedge', headless: true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] })`, ouvre la page, attend `window.__jeu`, échoue s'il y a une erreur console ou `pageerror`, enregistre `tests/fumee/capture.png`, tue le serveur. Sortie attendue : `FUMEE OK`.
- [ ] **Step 5:** `npm run fumee` → `FUMEE OK`. Commit « Squelette du jeu ».

### Task 2: Config + règles de vagues

**Files:** Create `src/config.js`, `src/regles/vagues.js`, `tests/vagues.test.js`

**Interfaces:**
- Produces: `CONFIG` (export nommé) contenant **toutes** les valeurs des sections 2 de la spec : `pointsDepart: 500`, `points: {touche:10, kill:60, killTete:100, killCouteau:130}`, `joueur: {vieMax:100, degatsZombie:40, delaiRegen:4, dureeRegen:1, staminaMax:4, vitesseMarche:4.5, vitesseSprint:7, hauteurYeux:1.7, rayon:0.35, sautVitesse:5}`, `armes: { pistolet, mitraillette, pompe, assaut, precision, mitrailleuse, lanceGrenades }` chacune `{nom, degats, plombs?, cadence ('semi' ou tirs/min), chargeur, reserve, rechargement (s), dispersion, rare:boolean, perce?, rayonExplosion?}` avec les valeurs du tableau de la spec (pompe : `degats:30, plombs:8, cadence:70` ; précision : `perce:3` ; lance-grenades : `degats:300, rayonExplosion:4`), `semiCadenceMax: 400`, `prixMurs: {mitraillette:1000, pompe:1500, assaut:2000}`, `prixPortes: {hangar:750, bunker:1000, tour:1250}`, `caisse: {prix:950, chanceRare:0.10}`, `bonus: {chance:0.05, maxParVague:4, duree:25, clignote:5, pointsDoublesDuree:30, explosionPoints:400}`, `vagues: {pause:10, maxVivants:24, distanceMinApparition:8}`, `couteau: {degats:150, portee:1.6, delai:0.6}`, `zombie: {vitesseMarche:1.2, vitesseMarcheRapide:2.2, vitesseCourse:4.2, porteeAttaque:1.3, delaiAttaque:1.0}`, `multiplicateurTete: 3`, `multiplicateurTetePompe: 2`.
- Produces (`vagues.js`): `nombreZombies(v:number):number`, `pvZombie(v):number`, `partCoureurs(v):number`, `typeDeplacement(v, rng:()=>number):'marche'|'marcheRapide'|'course'`.

- [ ] **Step 1: Tests**
```js
assert.equal(nombreZombies(1), 10); assert.equal(nombreZombies(5), 30); assert.equal(nombreZombies(10), 61);
assert.equal(pvZombie(1), 150); assert.equal(pvZombie(9), 950); assert.equal(pvZombie(10), Math.round(950*1.1));
assert.equal(partCoureurs(4), 0); assert.equal(partCoureurs(5), 0.1); assert.equal(partCoureurs(20), 0.8);
assert.equal(typeDeplacement(3, () => 0), 'marche');
assert.equal(typeDeplacement(6, () => 0.05), 'course');   // 0.05 < 0.2
assert.equal(typeDeplacement(6, () => 0.9), 'marche');
assert.equal(typeDeplacement(13, () => 0.95), 'marcheRapide'); // > 12 : jamais 'marche'
```
- [ ] **Step 2:** `npm test` → FAIL (module absent).
- [ ] **Step 3:** Implémenter. `nombreZombies = round(6 + 4v + 0.15v²)` ; `pvZombie` = `150 + 100(v−1)` si v ≤ 9 sinon `round(950 × 1.1^(v−9))` ; `partCoureurs = v<5 ? 0 : min(0.1(v−4), 0.8)` (arrondi à 1e-9 pour éviter 0.30000000000000004) ; `typeDeplacement` : `rng() < partCoureurs(v)` → course, sinon `v > 12` → marcheRapide, sinon marche.
- [ ] **Step 4:** `npm test` → PASS. Commit.

### Task 3: Économie, combat, inventaire, vie

**Files:** Create `src/regles/economie.js`, `combat.js`, `inventaire.js`, `vie.js` + tests associés.

**Interfaces:**
- `economie.js` : `creerPortefeuille(points=CONFIG.pointsDepart) -> {points}` ; `gainCoup({mortel:boolean, tete:boolean, couteau:boolean}, doubles:boolean) -> number` ; `crediter(pf, n)` ; `payer(pf, prix) -> boolean` (false et rien débité si insuffisant) ; `tirageCaisse(rng, possedees:string[]) -> armeId` (rng() < chanceRare → rare, sinon commune parmi `mitraillette, pompe, assaut, pistolet` ; exclut les armes possédées ; second appel `rng()` pour l'index).
- `combat.js` : `degatsTir(armeId, zone:'tete'|'corps', distance:number) -> number` (par plomb pour le pompe : 100 % jusqu'à 5 m, linéaire jusqu'à 30 % à 20 m, 30 % au-delà) ; `degatsCouteau() -> 150` ; `degatsExplosion(distance) -> number` (300 si ≤ rayon, sinon 0) ; `degatsExplosionJoueur(distance) -> number` (50 si ≤ rayon).
- `inventaire.js` : `creerInventaire() -> {armes:[{id, chargeur, reserve}], active:0}` avec le pistolet ; `armeActive(inv)` ; `tirer(inv) -> boolean` (décrémente, false si chargeur vide) ; `peutRecharger(inv) -> boolean` ; `recharger(inv)` (transfert réserve→chargeur) ; `possede(inv, id)` ; `ajouterArme(inv, id)` (2ᵉ emplacement si libre, sinon remplace l'active ; devient active) ; `remplirTout(inv)` ; `munitionsPleines(inv, id) -> boolean` ; `remplir(inv, id)` ; `changer(inv, index)`.
- `vie.js` : `creerVie() -> {pv:100, depuisCoup:Infinity}` ; `subir(vie, degats)` (remet `depuisCoup` à 0, pv min 0) ; `majVie(vie, dt)` (si `depuisCoup ≥ 4` : +100 PV/s jusqu'à 100) ; `estMort(vie)`.
- Achats (`economie.js`) : `acheterMur(pf, inv, armeId) -> 'achete'|'recharge'|'plein'|'pas-assez'` (prix plein si non possédée ; moitié prix et `remplir` si possédée ; `'plein'` sans débit si déjà plein).

- [ ] **Step 1: Tests** (valeurs exactes) :
```js
assert.equal(gainCoup({mortel:false,tete:false,couteau:false}, false), 10);
assert.equal(gainCoup({mortel:true,tete:true,couteau:false}, false), 100);
assert.equal(gainCoup({mortel:true,tete:false,couteau:true}, true), 260);
const pf = creerPortefeuille(500); assert.equal(payer(pf, 750), false); assert.equal(pf.points, 500);
assert.equal(tirageCaisse(seq([0.05, 0]), ['pistolet']) , 'precision');
assert.ok(!['pistolet'].includes(tirageCaisse(seq([0.5, 0]), ['pistolet'])));
assert.equal(degatsTir('pistolet','tete',10), 120);
assert.equal(degatsTir('pompe','corps',20), 9); assert.equal(degatsTir('pompe','tete',2), 60);
// achat mur
const pf2 = creerPortefeuille(1500), inv = creerInventaire();
assert.equal(acheterMur(pf2, inv, 'mitraillette'), 'achete'); assert.equal(pf2.points, 500);
assert.equal(acheterMur(pf2, inv, 'mitraillette'), 'plein'); assert.equal(pf2.points, 500);
tirer(inv); recharger(inv);  // réserve entamée
assert.equal(acheterMur(pf2, inv, 'mitraillette'), 'recharge'); assert.equal(pf2.points, 0);
// inventaire : 3e arme remplace l'active
ajouterArme(inv, 'pompe'); assert.equal(inv.armes.length, 2); assert.equal(armeActive(inv).id, 'pompe');
// vie
const v = creerVie(); subir(v, 40); subir(v, 40); majVie(v, 3.9); assert.equal(v.pv, 20); majVie(v, 0.2); majVie(v, 1); assert.equal(v.pv, 100);
subir(v, 40); subir(v, 40); subir(v, 40); assert.ok(estMort(v));
```
(`seq(tab)` = petit générateur de test qui renvoie les valeurs dans l'ordre.)
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implémenter les quatre modules.
- [ ] **Step 4:** `npm test` → PASS. Commit.

### Task 4: Collisions et navigation

**Files:** Create `src/regles/collisions.js`, `src/regles/navigation.js`, `tests/collisions.test.js`, `tests/navigation.test.js`

**Interfaces:**
- `collisions.js` : AABB = `{minX, maxX, minZ, maxZ, minY=0, maxY=3}` ; `deplacer(pos:{x,z}, dx, dz, rayon, aabbs) -> {x,z}` (axe X puis axe Z séparément, chaque axe annulé s'il entre dans une AABB gonflée du rayon → glissement) ; si `|dx|` ou `|dz| > rayon`, découpage en sous-pas ≤ rayon (évite de traverser un mur après un gros `dt`).
- `navigation.js` : `creerGrille({minX, minZ, largeur, profondeur, taille=0.5})` ; `marquerObstacles(grille, aabbs, marge=0.3)` (efface et recalcule tout) ; `trouverChemin(grille, de:{x,z}, vers:{x,z}) -> {x,z}[] | null` (A* 8 directions, interdit de couper les coins, heuristique octile, centre des cases ; si départ ou arrivée bloqué → case libre la plus proche dans un rayon de 3 cases, sinon `null`) ; `lissage` optionnel non requis.

- [ ] **Step 1: Tests**
```js
// glissement le long d'un mur
const mur = {minX:1, maxX:2, minZ:-5, maxZ:5};
const p = deplacer({x:0,z:0}, 2, 1, 0.35, [mur]); assert.ok(p.x <= 0.65 + 1e-9); assert.equal(p.z, 1);
// gros dt : pas de traversée
assert.ok(deplacer({x:0,z:0}, 10, 0, 0.35, [mur]).x < 1);
// A* contourne un mur
const g = creerGrille({minX:-5, minZ:-5, largeur:10, profondeur:10});
marquerObstacles(g, [{minX:-0.5, maxX:0.5, minZ:-5, maxZ:3}]);
const ch = trouverChemin(g, {x:-3,z:0}, {x:3,z:0});
assert.ok(ch && ch.some(n => n.z > 3));
// zone enfermée -> null
marquerObstacles(g, [{minX:-5,maxX:5,minZ:-0.5,maxZ:0.5}]);
assert.equal(trouverChemin(g, {x:0,z:-3}, {x:0,z:3}), null);
```
- [ ] **Step 2:** FAIL → **Step 3:** implémenter → **Step 4:** PASS. Commit.

### Task 5: Machine à états de la partie

**Files:** Create `src/regles/partie.js`, `tests/partie.test.js`

**Interfaces:**
- `creerPartie() -> {vague:0, phase:'pause', chrono:CONFIG.vagues.pause, restants:0, vivants:0, bonusLaches:0, kills:0, killsTete:0, pointsGagnes:0, temps:0}` (la 1ʳᵉ vague démarre après la pause initiale ; mettre `chrono: 3` pour la toute première).
- `majPartie(p, dt) -> 'vagueCommence' | null` (en phase pause, décompte ; à 0 → `vague++`, `restants = nombreZombies(vague)`, `phase = 'combat'`).
- `peutFaireApparaitre(p) -> boolean` (`combat && restants > 0 && vivants < 24`) ; `enregistrerApparition(p)` ; `enregistrerMort(p, {tete:boolean}) -> 'vagueTerminee' | null` (passe en pause 10 s quand `restants === 0 && vivants === 0`) ; `tirerBonus(p, rng) -> boolean` (`rng() < 0.05 && bonusLaches < 4`, remis à 0 à chaque vague) ; `tuerTous(p, n)` pour l'explosion.
- `choisirPointApparition(points:{x,z}[], joueur:{x,z}, estVisible:(pt)=>boolean, rng) -> {x,z}` : candidats à > 8 m et non visibles ; sinon > 8 m ; sinon le plus éloigné. Ne renvoie jamais `undefined` si `points` est non vide.

- [ ] **Step 1: Tests** : démarrage de la vague 1 après 3 s avec `restants === 10` ; plafond 24 vivants ; fin de vague → `'vagueTerminee'` et `phase 'pause'` ; `tirerBonus` refusé au 5ᵉ ; `choisirPointApparition` avec tous les points visibles et à < 8 m renvoie le plus éloigné.
- [ ] **Step 2:** FAIL → **Step 3:** implémenter → **Step 4:** PASS. Commit.

### Task 6: Carte et joueur

**Files:** Create `src/carte.js`, `src/joueur.js` ; Modify `src/main.js`

**Interfaces:**
- `construireCarte(scene) -> Carte` avec `Carte = { aabbs: AABB[] (murs + portes fermées), zones: {cour, hangar, bunker, tour}: {pointsApparition:{x,z}[], debloquee:boolean}, portes: [{id:'hangar'|'bunker'|'tour', prix, aabbs:AABB[], meshes:Mesh[], position:Vector3, ouverte:false, debloque:string[]}], mursArmes: [{armeId, position:Vector3}], caisse: {position:Vector3}, depart:{x,z}, obstaclesVisibles: Mesh[] }` et `ouvrirPorte(carte, porte)` (retire meshes et AABB, débloque les zones de `porte.debloque`, recalcule la grille via un callback).
- Disposition (80 × 80 m, origine au centre, nord = −Z) : **cour** au centre (30 × 30) ; **hangar** au nord (z −15 → −38, x −20 → 10), porte « hangar » au sud du hangar ; **bunker** à l'est (x 15 → 38, z −8 → 20, plafond 2,6 m), porte « bunker » à l'ouest du bunker ; **tour radio** au nord-est (x 15 → 38, z −38 → −13), plateforme surélevée 3 m avec escalier rampe (collision au sol simple : rampe traitée comme sol plat en jalon 1) ; porte « tour » = **deux** barrières (côté hangar et côté bunker) payées une fois, `debloque: ['tour']`. Grillage périmétrique (AABB). Points d'apparition : cour 4, hangar 3, bunker 3, tour 2 (aux bords extérieurs). Murs d'armes : mitraillette (cour), pompe (hangar), assaut (bunker). Caisse : hangar. Décor de blocs (camion, sacs de sable, caisses) dans chaque zone, couleurs distinctes par zone.
- `creerJoueur(camera, dom) -> Joueur` : `{ position:{x,y,z}, vie, stamina, majJoueur(dt, aabbs), verrouiller(), estVerrouille }` ; `PointerLockControls` de three/addons ; `KeyW/S/A/D` (+ flèches), `ShiftLeft` sprint (stamina 4 s, recharge 2 s après arrêt), `Space` saut (gravité 15 m/s²), collisions via `deplacer`.

- [ ] **Step 1:** Implémenter `carte.js` + `joueur.js`, brancher dans `main.js`, exposer `__jeu.joueur` et `__jeu.carte`.
- [ ] **Step 2:** Étendre la fumée : après démarrage simulé (`__jeu.demarrerPartie()` sans pointer lock en mode test `?test=1`), injecter `__jeu.joueur.position.x += 100` puis une image → vérifier que la position reste dans `[-40, 40]`.
- [ ] **Step 3:** `npm test && npm run fumee` → PASS + `FUMEE OK`. Regarder `capture.png`. Commit.

### Task 7: Zombies et vagues en jeu

**Files:** Create `src/zombies.js` ; Modify `src/main.js`

**Interfaces:**
- `creerGestionnaireZombies(scene, carte, grille) -> { liste, faireApparaitre(point, vague, rng), majZombies(dt, joueur, partie, surCoup), cibles():Object3D[], tuerTous() }`.
- Zombie : groupe three.js corps (capsule verte 1,6 m) + tête (sphère) avec `userData = {zombie, zone:'tete'|'corps'}` ; `{pv, type, vitesse, chemin, prochainCalcul}` ; recalcul A* toutes les 0,5 s décalé par zombie ; si `trouverChemin` → `null` ou joueur visible à < 6 m → déplacement direct ; séparation entre zombies (répulsion à < 0,7 m) ; collisions via `deplacer` ; attaque si distance < 1,3 m toutes les 1,0 s → `surCoup(CONFIG.joueur.degatsZombie)`.
- `main.js` : à chaque image en phase combat, tant que `peutFaireApparaitre` → `choisirPointApparition` (zones débloquées, visibilité = raycast caméra) puis `faireApparaitre`. Mort du joueur → état `'fin'`.

- [ ] **Step 1:** Implémenter.
- [ ] **Step 2:** Fumée : en `?test=1`, `__jeu.accelerer(5)` puis attendre 6 s → `__jeu.zombies.liste.length > 0` et `__jeu.partie.vague === 1`.
- [ ] **Step 3:** `npm run fumee` → `FUMEE OK`. Commit.

### Task 8: Armes, achats, portes, caisse, bonus

**Files:** Create `src/armes.js`, `src/bonus.js` ; Modify `src/main.js`

**Interfaces:**
- `creerArmes(camera, scene, inventaire, cibles:()=>Object3D[], surTouche) -> { majArmes(dt, entrees), modele }` : clic gauche (maintenu pour les automatiques, une fois par clic pour `'semi'`, plafonné à `semiCadenceMax`), raycast depuis le centre écran avec dispersion (`dispersion` × 0,4 en visée clic droit, FOV 75 → 55), `plombs` rayons pour le pompe, `perce` cibles traversées pour la précision, projectile simple pour le lance-grenades (explosion à l'impact via `degatsExplosion`, et `degatsExplosionJoueur` sur le joueur). `R` recharge (durée `rechargement`, arme qui descend/remonte), `1`/`2`/molette changent d'arme, `V` couteau (portée 1,6 m, délai 0,6 s). Recul de caméra + flamme de bouche (sprite + `PointLight` 50 ms). `surTouche(zombie, degats, {tete, couteau})` → main applique PV, points via `gainCoup`, mort → `enregistrerMort`, `tirerBonus`.
- Interaction `E` (rayon 2 m, objet le plus proche) : mur d'arme → `acheterMur` ; porte → `payer` puis `ouvrirPorte` ; caisse → `payer(950)` + `tirageCaisse` + `ajouterArme`. Résultats affichés via `interface.message(texte)` : `'pas-assez'` → « Pas assez de points », `'plein'` → « Munitions déjà pleines ».
- `creerBonus(scene) -> { lacher(position, type), majBonus(dt, joueur, appliquer) }` : types `'munitions'|'doubles'|'explosion'` (tirage uniforme), objet qui tourne et flotte, disparaît après 25 s, clignote les 5 dernières, ramassé à < 1,2 m. `appliquer` : munitions → `remplirTout` ; doubles → minuteur 30 s ; explosion → `tuerTous` + 400 pts (non doublés).

- [ ] **Step 1:** Implémenter `armes.js`, `bonus.js`, interactions dans `main.js`.
- [ ] **Step 2:** Fumée : en `?test=1`, placer un zombie devant la caméra, `__jeu.tirer()` jusqu'à la mort → `__jeu.portefeuille.points > 500` ; placer le joueur devant la porte du hangar avec 0 point, `__jeu.interagir()` → points inchangés, porte fermée.
- [ ] **Step 3:** `npm test && npm run fumee` → PASS. Commit.

### Task 9: Interface, pause, fin de partie, record

**Files:** Create `src/interface.js` ; Modify `index.html`, `style.css`, `src/main.js`

**Interfaces:**
- `creerInterface(dom) -> { majHUD({pv, vieMax, munitions:{chargeur, reserve, nom}, points, vague, doubles:number|0, stamina}), message(texte, duree=2), invite(texte|null), ecranMenu(record), ecranPause(), ecranFin(stats, record, nouveauRecord), masquerEcrans(), flashDegats(intensite), annonceVague(n) }`.
- HUD : viseur central (s'écarte avec la dispersion), vie en bas à gauche + bord rouge selon les dégâts, munitions + nom d'arme en bas à droite, points en haut à droite (animation +N), numéro de vague en bas à gauche en gros chiffres rouges, icône points doubles avec compte à rebours, invite centrale « E — Acheter Mitraillette (1000) » / « E — Ouvrir (750) » / « E — Caisse de ravitaillement (950) ».
- Pause : `pointerlockchange` perdu, `visibilitychange` caché ou `blur` → état `'pause'` (boucle ne met plus à jour la logique) ; clic sur « Reprendre » relock.
- Fin : stats `{vague, kills, killsTete, pointsGagnes, temps}` ; record = meilleure vague dans `localStorage['zoneMorte.record']` (lecture/écriture dans `try/catch`, 0 si indisponible) ; bouton « Rejouer » (réinitialise tout sans recharger la page).

- [ ] **Step 1:** Implémenter.
- [ ] **Step 2:** Fumée : `?test=1` → simuler `document.dispatchEvent(new Event('visibilitychange'))` avec `document.hidden` forcé → `__jeu.etat === 'pause'` et `__jeu.partie.temps` inchangé après 1 s ; forcer `__jeu.joueur.vie.pv = 0` → `__jeu.etat === 'fin'` et écran de fin visible.
- [ ] **Step 3:** `npm test && npm run fumee` → PASS, capture HUD regardée. Commit.

### Task 10: Vérification finale du jalon

**Files:** Create `LISEZMOI.md` (comment lancer, touches), `CREDITS.md` (three.js MIT)

- [ ] **Step 1:** `npm test` (tout PASS) et `npm run fumee` (`FUMEE OK`).
- [ ] **Step 2:** Lancer `Jouer.bat`, vérifier que la page s'ouvre et que le serveur répond.
- [ ] **Step 3:** Commit « Jalon 1 jouable ». Demander à l'utilisateur de faire une partie et de donner son avis (sensations, difficulté, prix).
