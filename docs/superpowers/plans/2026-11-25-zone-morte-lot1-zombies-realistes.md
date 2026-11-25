# Zone Morte — Jalon 3, Lot 1 « Zombies réalistes » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer les zombies en boîtes par les personnages Mixamo animés (marche, course, attaque, morts, sortie, attente, ramper), avec démembrement, rampeurs, flaques de sang et un boss toutes les 5 vagues.

**Architecture :** un outil Blender convertit les FBX en GLB (un par personnage, 8 animations). `src/modeles-zombies.js` charge les GLB et fabrique des instances animées qui exposent la **même interface de modèle** que les boîtes actuelles (repli). Les choix (quelle animation, démembrement, boss) sont des règles pures testées dans `src/regles/`.

**Tech Stack :** JavaScript ES modules, three.js 0.170 (`GLTFLoader`, `SkeletonUtils`, `AnimationMixer`), Blender 5.3 en ligne de commande (Python), `node --test`, Playwright (Edge, SwiftShader).

**Spec :** `docs/superpowers/specs/2026-11-25-zone-morte-jalon3-design.md`, section 2.

## Global Constraints

- Valeurs chiffrées dans `src/config.js` ; règles pures (sans three.js) dans `src/regles/`, testées.
- Noms de code en français.
- Fins de ligne : garder celles du fichier (CRLF : `armes.js`, `config.js`, `zombies.js`, `carte.js`, `scenarios.mjs`, `LISEZMOI.md` ; LF : `main.js`, `joueur.js`, `effets.js`, `interface.js`). **Jamais `sed -i`** ni Python en mode texte : modifier par l'outil Edit ou par node en conservant `\r\n`.
- Tests de fumée : attendre une condition (`page.waitForFunction`), jamais une durée fixe.
- `assets/mixamo/` n'est pas versionné ; les GLB de `assets/zombies/` le sont. Mixamo cité dans `CREDITS.md`.
- Blender : `"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup -P outils/convertir-zombies.py`.
- Valeurs de la spec : variation d'échelle 0,92–1,08 (boss : 1) ; fondus 0,2 s ; marche ×1, marche rapide ×1,6 ; corps 4 s puis s'enfonce ; rampeur dès 40 % des PV max cumulés aux jambes, vitesse ×0,35, portée 1 m, ne grimpe plus ; flaques 24 max, 20 s ; mixer une image sur deux au-delà de 25 m ; ombres des zombies en Haute seulement ; boss vague 5, 10, 15…, PV 12 × zombie de la vague, 1,8 m/s, coups ×3, escalade ×1,5 plus lente, 500 points, bonus garanti, nom « Le Colosse ».

## Review Focus

1. Un GLB absent ou corrompu ne doit rien casser : zombies en boîtes, aucune erreur console. → scénario fumée `?sansModeles=1` (Tâche 3).
2. Le coup du zombie doit partir au moment de l'impact, une seule fois par animation, même si le joueur s'éloigne pendant l'élan (pas de coup « à distance »). → test unitaire `momentImpact` (Tâche 2) + fumée attaque (Tâche 4).
3. Un rampeur ou un boss ne doit jamais bloquer la fin de vague (rampeur sous un îlot, boss lent). → fumée « vague 5 Cauchemar » conservée + boss tué termine la vague (Tâche 6).
4. Tirer sur un zombie qui sort du sol, meurt ou grimpe ne doit pas lever d'erreur (boîtes de zone attachées à des os animés). → fumée tir pendant `sortie` et pendant `mort` (Tâche 4).
5. 24 zombies animés ne doivent pas faire tomber les images : mise à jour réduite au loin. → test unitaire `doitAnimer` (Tâche 2) + mesure en Haute notée au journal (Tâche 7).

---

### Task 1 : Conversion Blender des FBX Mixamo en GLB

**Files :**
- Create : `outils/convertir-zombies.py`, `assets/zombies/zombie1.glb`, `assets/zombies/zombie2.glb`, `assets/zombies/boss.glb`, `tests/modeles.test.js`
- Modify : `CREDITS.md`, `LISEZMOI.md` (section développement : commande de conversion)

**Interfaces :**
- Produces : GLB avec 1 armature (os préfixés `mixamorig:` ou sans préfixe selon l'export — **noter le nom exact de l'os de tête** dans le journal), maillages à l'échelle mètres (hauteur ≈ 1,7–1,9 m ; boss plus grand), 8 animations nommées exactement `marche`, `course`, `attaque`, `mort1`, `mort2`, `ramper`, `sortie`, `attente`, sans déplacement de la racine sur x/z, textures ≤ 1024 px.

- [ ] **Step 1 : test qui échoue** `tests/modeles.test.js` : lit l'en-tête JSON de chaque GLB (format binaire glTF : magic, longueur, bloc JSON) sans three.js ; vérifie pour `zombie1`, `zombie2`, `boss` : 8 animations aux noms ci-dessus, au moins une `skin`, un nœud dont le nom contient `Head`, taille du fichier < 12 Mo.
- [ ] **Step 2 :** `node --test tests/modeles.test.js` → FAIL (fichiers absents).
- [ ] **Step 3 : écrire `outils/convertir-zombies.py`** : pour chaque personnage (`zombie1`, `zombie2`, `boss`) : usine vide, import FBX, import des 8 FBX d'animation, renommer chaque action importée en nom de fichier et la stocker en piste NLA de l'armature du personnage, supprimer les armatures d'animation, mettre à zéro les courbes `location` x/z de l'os racine (`Hips`) dans chaque action, appliquer l'échelle (cm → m), réduire les images à 1024 px, export glTF binaire (`export_animations=True`, `export_animation_mode='NLA_TRACKS'`). Erreur explicite et code de sortie ≠ 0 si un fichier manque. Affiche par personnage : hauteur, nombre de faces, animations et durées, taille du GLB.
- [ ] **Step 4 :** lancer la conversion, puis `node --test tests/modeles.test.js` → PASS. Ouvrir un GLB dans un mini-script node (lecture JSON) pour noter dans le journal : nom de l'os de tête, des cuisses (`LeftUpLeg`, `RightUpLeg`), des mollets (`LeftLeg`, `RightLeg`), du buste (`Spine1`).
- [ ] **Step 5 :** `CREDITS.md` : personnages et animations Mixamo (Adobe), utilisés dans le jeu, fichiers bruts non redistribués. LISEZMOI : commande de conversion.
- [ ] **Step 6 :** commit `Conversion des zombies Mixamo en GLB`.

---

### Task 2 : Règles pures — animation, démembrement, boss, flaques

**Files :**
- Create : `src/regles/animation-zombie.js`, `tests/animation-zombie.test.js`
- Modify : `src/regles/vagues.js`, `src/config.js`, `tests/vagues.test.js`

**Interfaces :**
- Config : `zombie.rampe: { seuil: 0.4, vitesse: 0.35, portee: 1 }`, `zombie.animation: { fondu: 0.2, distanceReduite: 25, marcheRapide: 1.6, corps: 4, impact: 0.45 }` (impact = fraction de l'animation `attaque` où le coup part), `sang: { flaques: 24, duree: 20 }`, `boss: { premiereVague: 5, intervalle: 5, multiplicateurPv: 12, vitesse: 1.8, degats: 3, escalade: 1.5, points: 500, nom: 'Le Colosse' }`.
- Produces :
  - `choisirAnimation({ emergence, mort, escalade, attaque, rampe, vitesse, type }) -> { nom, vitesse }` : `mort` → `null` (gérée à part) ; `emergence > 0` → `sortie` ; `escalade` montée → `{ nom: 'attaque', vitesse: 0.6 }` ; `escalade` descente → `{ nom: 'course', vitesse: 0 }` ; `attaque` → `attaque` ×1 ; `rampe` → `ramper` (×1 si `vitesse > 0`, sinon ×0) ; `vitesse < 0.05` → `attente` ; `type === 'course'` → `course` ×1 ; `marcheRapide` → `marche` ×1,6 ; sinon `marche` ×1.
  - `momentImpact(tPrecedent, t, duree) -> bool` : vrai une seule fois quand `impact × duree` est franchi entre les deux temps.
  - `doitAnimer(distance, image) -> bool` : toujours vrai ≤ 25 m, sinon une image sur deux (`image % 2 === 0`).
  - `toucheJambes(z, degats, pvMax) -> bool` : cumule `z.degatsJambes` ; vrai (passe en rampeur) quand le cumul ≥ 40 % de `pvMax`, que le zombie survit, n'est pas déjà rampeur et n'est pas un boss.
  - `teteArrachee({ tete, mortel, boss }) -> bool` : `tete && mortel && !boss`.
  - Dans `vagues.js` : `estVagueBoss(v) -> bool` (5, 10, 15…), `pvBoss(pvZombieVague) -> number` (×12).
- [ ] **Step 1 : tests qui échouent** pour chaque fonction, avec les valeurs ci-dessus (dont : `momentImpact(0.5, 0.7, 1.4)` vrai pour impact 0,45 × 1,4 = 0,63 ; `momentImpact(0.7, 0.9, 1.4)` faux ; `toucheJambes` ne déclenche pas deux fois ; boss jamais rampeur ; `estVagueBoss` : 4 faux, 5 vrai, 6 faux, 10 vrai ; `pvBoss(950) === 11400`).
- [ ] **Step 2 :** `npm test` → FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test` → PASS.
- [ ] **Step 5 :** commit `Règles d'animation, démembrement et boss`.

---

### Task 3 : Chargement des modèles et instances animées (avec repli)

**Files :**
- Create : `src/modeles-zombies.js`, `vendor/three/addons/loaders/GLTFLoader.js`, `vendor/three/addons/utils/SkeletonUtils.js`, `vendor/three/addons/utils/BufferGeometryUtils.js` (copiés de `node_modules/three/examples/jsm/`, mêmes chemins relatifs ; vérifier les imports de chacun)
- Modify : `src/zombies.js` (le modèle en boîtes devient `creerModeleBoites(rng)` avec l'interface ci-dessous), `src/main.js` (chargement, `jeu.pret`), `tests/fumee/scenarios.mjs`

**Interfaces :**
- Interface de modèle commune (boîtes et GLB) : `{ g: THREE.Group, touchables: Mesh[], feu: Mesh, animer(anim: {nom, vitesse}|null, dt), jouerMort(rng) , dureeAnimation(nom) -> s, tempsAnimation() -> s, retirerTete(), passerRampeur() }`. `touchables[i].userData.zone ∈ 'tete'|'corps'|'jambes'` et `userData.zombie`. Pour les boîtes, `animer` reprend l'animation procédurale actuelle (marche, course, frappe, escalade) ; `dureeAnimation('attaque')` = 0,7 s.
- Produces : `chargerModelesZombies(url = 'assets/zombies/') -> Promise<{ zombies: Gltf[], boss: Gltf|null } | null>` (null si aucun ne charge ; jamais de rejet) ; `creerModeleZombie(modeles, { boss, rng }) -> modèle` (GLB si disponible, sinon boîtes).
- Instance GLB : `SkeletonUtils.clone`, `AnimationMixer`, une action par animation (fondus `CONFIG.zombie.animation.fondu`), morts en `LoopOnce` + `clampWhenFinished` ; matériau cloné avec teinte de peau variée (×0,85–1,1) ; échelle 0,92–1,08 (boss 1) ; boîtes de zone invisibles (`visible = false` mais raycastables : `material.visible = false`) attachées aux os : tête (sphère r 0,13 sur l'os tête), buste (boîte 0,45 × 0,6 × 0,3 sur `Spine1`), 4 boîtes de jambe (cuisses et mollets). `castShadow` selon la qualité (Tâche 4).
- `main.js` : `jeu.pret = false` jusqu'à la fin de `chargerModelesZombies` ; paramètre d'URL `sansModeles` → ne charge rien (repli).
- [ ] **Step 1 : scénarios de fumée qui échouent** : « modèles GLB chargés » (`__jeu.zombies.modelesCharges === true`, un zombie apparu contient un `SkinnedMesh`, ses touchables ont les zones `tete`, `corps`, `jambes`) ; « tir à la tête d'un zombie animé » (zombie à 6 m immobile, `j.camera.lookAt` vers sa boîte de tête, `j.tirer()` → `pv` baisse plus que pour un tir au corps) ; « repli sans modèles » : nouvelle page `?test=1&sansModeles=1`, un zombie apparaît, aucun `SkinnedMesh`, aucune erreur console.
- [ ] **Step 2 :** `npm run fumee` → ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run fumee` → PASS / `FUMEE OK`.
- [ ] **Step 5 :** commit `Zombies Mixamo animés (repli en boîtes)`.

---

### Task 4 : Animations branchées sur l'IA, coup à l'impact, morts, performance

**Files :**
- Modify : `src/zombies.js`, `src/main.js` (qualité → ombres des zombies), `tests/fumee/scenarios.mjs`

**Interfaces :**
- Consumes : `choisirAnimation`, `momentImpact`, `doitAnimer` (Tâche 2) ; interface de modèle (Tâche 3).
- Produces : `majZombies` appelle `z.modele.animer(choisirAnimation({...}), dtAnim)` chaque image (dt cumulé si `doitAnimer` saute une image) ; l'attaque démarre quand le joueur est à portée et que l'animation `attaque` n'est pas en cours ; `surCoup` est appelé quand `momentImpact` franchit l'impact **et** que le joueur est encore à portée × 1,3 ; mort : `jouerMort(rng)`, le corps reste `CONFIG.zombie.animation.corps` s puis s'enfonce de 1 m en 1 s avant retrait ; `zombies.ombres(bool)` appelé par `changerQualite` (vrai en Haute seulement).
- [ ] **Step 1 : scénarios qui échouent** : « le coup part à l'impact » (zombie collé au joueur : `pv` intact juste après le début de l'attaque, puis baisse ; un seul coup par cycle) ; « mort animée » (zombie tué → encore dans la scène après 2 s de jeu, retiré après `corps + 1` s ; `__jeu.accelerer(3)`) ; « tirer pendant la sortie du sol et pendant la mort » ne lève aucune erreur.
- [ ] **Step 2 :** ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run fumee` → PASS (dont « vague 5 en Cauchemar »).
- [ ] **Step 5 :** commit `Animations des zombies : marche, course, attaque, morts`.

---

### Task 5 : Démembrement, rampeurs et flaques de sang

**Files :**
- Modify : `src/zombies.js`, `src/main.js` (`toucherZombie` reçoit la zone), `src/armes.js` (transmettre `zone` en plus de `tete`), `src/effets.js` (`flaque(position)`, `morceauTete(position, direction)`), `tests/fumee/scenarios.mjs`

**Interfaces :**
- Consumes : `toucheJambes`, `teteArrachee` (Tâche 2) ; `retirerTete()`, `passerRampeur()` (Tâche 3).
- Produces : `surTouche(z, degats, { tete, zone, couteau })` ; `zombies.infliger(z, degats, zone)` ; `z.rampe: bool` → vitesse × 0,35, `porteeAttaque` 1 m, pas d'escalade (s'il doit grimper, il attend au pied) ; `effets.flaque(pos)` : décalque rouge sombre au sol (tampon borné 24, fondu sur les 5 dernières des 20 s) ; `effets.morceauTete(pos, dir)` : petite sphère qui part en l'air + gerbe de sang.
- [ ] **Step 1 : scénarios qui échouent** : « tête qui saute » (zombie tué d'un tir à la tête au pistolet en Recrue vague 1 → `modele.teteRetiree === true`) ; « rampeur » (tirs dans une boîte `jambes` jusqu'à 40 % des PV sans le tuer → `z.rampe === true`, animation `ramper`) ; « flaques bornées » (30 morts → 24 flaques au plus).
- [ ] **Step 2 :** ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run fumee` → PASS.
- [ ] **Step 5 :** commit `Démembrement, rampeurs et flaques de sang`.

---

### Task 6 : Boss « Le Colosse »

**Files :**
- Modify : `src/regles/partie.js` (le boss compte dans la vague), `src/zombies.js`, `src/main.js`, `src/interface.js` + `index.html` + `style.css` (barre de vie du boss), `tests/partie.test.js`, `tests/fumee/scenarios.mjs`

**Interfaces :**
- Consumes : `estVagueBoss`, `pvBoss`, `CONFIG.boss` (Tâche 2) ; `creerModeleZombie(modeles, { boss: true })` (Tâche 3).
- Produces : `creerPartie` / `majPartie` : en vague de boss, `p.bossARestant = true` et `restants` inclut le boss (+1) ; `zombies.faireApparaitre(point, vague, rng, { boss })` ; la première apparition d'une vague de boss est le boss ; boss : `z.boss = true`, PV `pvBoss(pvZombieActif(v))`, vitesse 1,8, coups `degatsZombie × 3`, durée des liens d'escalade × 1,5, jamais rampeur ni tête arrachée ; kill → `CONFIG.boss.points` (au lieu du gain normal, doublé si points doubles) et `bonus.lacher` garanti ; `ui.barreBoss({ nom, pv, pvMax } | null)`.
- [ ] **Step 1 : tests qui échouent** : unitaire `partie` (vague 5 : `restants === nombreZombies(5) + 1`) ; fumée « boss à la vague 5 » (partie mise en vague 4 terminée → à la vague 5, un zombie `boss` apparaît, `#barre-boss` visible avec « Le Colosse », le tuer (`pv = 1`, tir) → +500 points, un bonus au sol, barre cachée) ; « vague 5 en Cauchemar » toujours vers la vague 6.
- [ ] **Step 2 :** ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run fumee` → PASS.
- [ ] **Step 5 :** commit `Boss toutes les 5 vagues : Le Colosse`.

---

### Task 7 : Vérification finale et documentation

**Files :** `LISEZMOI.md`, `outils/capture.mjs` (option : faire apparaître des zombies devant la caméra si besoin)

- [ ] **Step 1 :** `npm test && npm run fumee` → PASS / `FUMEE OK` ; `FUMEE_QUALITE=haute` sur les scénarios zombies → PASS.
- [ ] **Step 2 :** captures en Haute d'un groupe de 6 zombies (dont un rampeur) et du boss ; les regarder ; noter la cadence mesurée (navigateur normal avec GPU si possible, sinon SwiftShader, en le disant).
- [ ] **Step 3 :** LISEZMOI : section « Zombies » (tête qui saute, rampeurs, boss toutes les 5 vagues).
- [ ] **Step 4 :** commit `Lot 1 du jalon 3 terminé : vérification et LISEZMOI`.
