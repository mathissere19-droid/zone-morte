# Zone Morte — Lot 2 « Se cacher et grimper » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le joueur peut s'accroupir, grimper sur les décors (rebords, échelles), se cacher des zombies ; les zombies le perdent de vue, le cherchent, finissent par le retrouver et grimpent pour le rejoindre.

**Architecture :** trois modules purs testés (`regles/surfaces.js` hauteurs/rebords/échelles/liens, `regles/perception.js` états traque/recherche/flair, extension de `regles/collisions.js` pour la hauteur du corps) ; `carte.js` déclare surfaces, échelles, liens et sources de lumière ; `joueur.js` et `zombies.js` les consomment ; `main.js` assemble (bruit, ombre).

**Tech Stack :** JavaScript ES modules, three.js 0.170, `node --test`, Playwright (Edge, SwiftShader) pour `npm run fumee`.

**Spec :** `docs/superpowers/specs/2026-11-24-zone-morte-jalon2-design.md`, section 3 (et 5, 6, 7).

## Global Constraints

- Toute valeur chiffrée dans `src/config.js` ; les règles dans `src/regles/` (pur, sans three.js, testé) ; les modules visuels ne recalculent pas une règle.
- Noms de code en français, comme le reste du projet.
- Fins de ligne : garder celles du fichier modifié (`armes.js`, `config.js`, `scenarios.mjs`, `LISEZMOI.md` sont en CRLF ; `main.js`, `carte.js`, `joueur.js`, `zombies.js` en LF). Ne jamais réécrire un fichier par un script en mode texte.
- Tests de fumée : toujours attendre une condition (`page.waitForFunction`), jamais une durée fixe (SwiftShader : ~0,2 s/image en Basse, ~1 s en Haute).
- Valeurs de la spec : yeux accroupi 1,0 m ; vitesse ×0,5 ; dispersion ×0,7 ; pas de sprint accroupi ; hauteur du corps accroupi 1,2 m (debout 1,8) ; rebord entre 0,9 et 2,2 m au-dessus des pieds, à moins de 0,8 m ; hisse 0,6 s ; échelle 2,5 m/s ; marche 0,35 m ; chute : 0 dégât jusqu'à 4 m, puis 10 PV par mètre au-delà ; vue 25 m (12 m accroupi dans l'ombre), cône 120° ; bruit tir 30 m (arbalète 5), sprint 10, marche 5, accroupi 1,5 ; contact 2 m ; alerte 8 m ; fouille 6 m ; flair 15 s (Vétéran 10, Cauchemar 6) ; liens : rebord 1,5 s, échelle 2,5 s ; saut vers le bas 0,4 s.
- Écart assumé à la spec : **accroupi sur `C` seulement**, pas `Ctrl` (Ctrl+W ferme l'onglet en pleine partie et ne peut pas être bloqué). La fouille dure jusqu'au flair (pas de phase « inactive » entre 8 s et le flair).

## Review Focus

1. Un zombie en `recherche` ou sur un îlot ne doit jamais rester figé indéfiniment : la vague doit toujours se terminer (flair + anti-blocage). → scénario fumée « vague 5 Cauchemar » conservé (Tâche 6) et test unitaire flair (Tâche 4).
2. Le joueur ne doit jamais rester coincé : se relever sous le conduit, lâcher une échelle, sortir d'un rebord en hauteur. → tests `peutSeRelever` (Tâche 1) et scénario fumée conduit (Tâche 3).
3. `hauteurSol` ne doit pas placer un zombie qui apparaît dans le bunker sur le toit du bunker. → test `hauteurSurfaces` avec y = 0 sous un toit (Tâche 1).
4. Le pied de chaque lien d'escalade et de chaque échelle doit être atteignable au sol. → test d'accessibilité (Tâche 2).
5. Une grenade qui tombe sur un conteneur doit exploser dessus, pas au sol en dessous. → scénario fumée (Tâche 3).

---

### Task 1 : Règles pures — surfaces, rebords, échelles, chute, hauteur du corps

**Files :**
- Create : `src/regles/surfaces.js`
- Modify : `src/regles/collisions.js` (hauteur du corps), `src/config.js` (`joueur.accroupi`, `escalade`)
- Test : `tests/surfaces.test.js`, `tests/regles.test.js` (collisions)

**Interfaces :**
- Produces (`regles/surfaces.js`) :
  - Surface : `{ id, minX, maxX, minZ, maxZ, h, ilot, liensAuto, pente? }` ; `pente = { axe: 'x'|'z', de, a, h0, h1 }` (rampe : hauteur linéaire de `h0` en `de` à `h1` en `a`).
  - `hauteurSurfaces(surfaces, x, z, y = 0) -> { h, surface }` : la plus haute surface sous (x, z) dont la hauteur ≤ `y + 0,35` ; `{ h: 0, surface: null }` sinon.
  - `trouverRebord(surfaces, pos, dir, yPieds) -> { x, z, h, surface } | null` : sonde à 0,1 / 0,4 / 0,8 m devant `pos` selon `dir` (unitaire, plan xz) ; retient la première surface touchée dont `h − yPieds ∈ [0,9 ; 2,2]` et dont le point n'est pas déjà sous les pieds ; renvoie le point d'arrivée à 0,4 m à l'intérieur du bord.
  - Échelle : `{ minX, maxX, minZ, maxZ, bas, haut, face: {x,z}, sortie: {x,z} }` (`face` = normale vers le joueur).
  - `echelleDevant(echelles, pos, dirMouvement) -> echelle | null` : pos dans le volume et `dirMouvement · (−face) > 0,5`.
  - Lien : `{ bas: {x,z}, haut: {x,z,h}, duree, surface }`.
  - `liensAuto(surface, duree) -> Lien[]` : un lien au milieu de chaque côté, `bas` à 0,6 m à l'extérieur, `haut` à 0,4 m à l'intérieur.
  - `choisirLien(liens, idSurface, pos) -> Lien | null` : le plus proche de `pos` (distance à `bas`) parmi ceux dont `surface === idSurface`.
  - `bordLePlusProche(surface, pos) -> {x,z}` : point du sol à 0,6 m hors du bord le plus proche.
  - `degatsChute(hauteur) -> entier` : `0` si ≤ 4, sinon `Math.round((hauteur − 4) × 10)`.
- Produces (`regles/collisions.js`) : `deplacer(pos, dx, dz, rayon, aabbs, y = 0, hauteur = 1.8)` (le `1.8` codé en dur de `bloquant` devient `hauteur`) ; `peutSeRelever(aabbs, pos, rayon, y) -> bool` (aucune AABB recouvrant le cercle avec `minY` dans `[y + 1,2 ; y + 1,8[`).
- Config : `joueur.accroupi: { hauteurYeux: 1.0, hauteurCorps: 1.2, vitesse: 0.5, dispersion: 0.7 }`, `joueur.hauteurCorps: 1.8`, `escalade: { rebordMin: 0.9, rebordMax: 2.2, portee: 0.8, dureeHisse: 0.6, vitesseEchelle: 2.5, chuteSansDegats: 4, degatsParMetre: 10, lienRebord: 1.5, lienEchelle: 2.5, sautBas: 0.4, hauteurIlot: 1.2 }`.

- [ ] **Step 1 : tests qui échouent** — `tests/surfaces.test.js` :
  - `hauteurSurfaces` : conteneur `h 2.6` → `(x,z)` dessus avec `y = 0` → `h 0` ; avec `y = 2.6` → `2.6` ; toit `h 2.9` au-dessus d'un point avec `y = 0` → `0` (Review Focus 3) ; rampe `{axe:'x', de:20, a:25, h0:0, h1:3}` en x = 22,5 → `1.5`.
  - `trouverRebord` : pieds à 0, face à une caisse `h 1.2` à 0,5 m → rebord `h 1.2` ; caisse `h 2.6` → `null` ; pieds à 0,8 (saut) face au conteneur 2,6 → rebord ; muret `h 0.5` → `null` ; caisse à 1,5 m → `null`.
  - `echelleDevant` : dans le volume en avançant vers le mur → l'échelle ; en reculant → `null`.
  - `liensAuto` : boîte 4×2 → 4 liens, `bas` hors de la boîte, `haut` dedans ; `choisirLien` renvoie le plus proche de la bonne surface, `null` pour une surface sans lien.
  - `degatsChute(3) === 0`, `degatsChute(4) === 0`, `degatsChute(6) === 20`.
  - `tests/regles.test.js` : `deplacer` avec `hauteur 1.2` passe sous une AABB `minY 1.2` que `hauteur 1.8` bloque ; `peutSeRelever` faux sous cette AABB, vrai à côté.
- [ ] **Step 2 :** `node --test tests/surfaces.test.js tests/regles.test.js` → FAIL (module absent).
- [ ] **Step 3 :** implémenter `surfaces.js`, l'extension de `collisions.js`, la config.
- [ ] **Step 4 :** `npm test` → PASS (les appels existants de `deplacer` ne changent pas).
- [ ] **Step 5 :** commit `Règles des surfaces, rebords, échelles et chute`.

---

### Task 2 : Carte — surfaces, échelles, conduit, toit du bunker, liens d'escalade, lumières

**Files :**
- Modify : `src/carte.js`, `src/decors.js` (modèle `echelle`, `conduit`)
- Test : `tests/decors.test.js` (accessibilité), `tests/surfaces-carte.test.js`

**Interfaces :**
- Consumes : `hauteurSurfaces`, `liensAuto` (Tâche 1).
- Produces (`carte`) : `carte.surfaces: Surface[]`, `carte.echelles: Echelle[]`, `carte.liens: Lien[]`, `carte.sourcesLumiere: [{x, z, rayon}]` ; `hauteurSol(x, z, y = 0)` (export, garde son nom ; s'appuie sur les surfaces de la dernière carte construite via une variable de module).
- Règles de construction :
  - `boite()` (avec collision) et `decor()` ajoutent une surface au sommet ; `ilot = h ≥ escalade.hauteurIlot`, `liensAuto = ilot` par défaut ; `mur()` et piliers n'en ajoutent pas.
  - Remplacer `PLATEFORME`/`RAMPE` par deux surfaces (`ilot: false`, rampe avec `pente`).
  - Passerelle du hangar : surface `x −17.5..7.5, z −35.5..−34, h 3.2`, `ilot: true, liensAuto: false` ; 2 échelles (x −12..−11 et x 5..6, z −34..−33.4, face +z, bas 0, haut 3.2, sortie z −34.8).
  - Toit du bunker : surface `x 14..36, z −12..18, h 2.9`, `liensAuto: false` ; le mur x = 14 est coupé en deux : `z −12..8` à 4 m (avec l'ouverture `[2,5]`), `z 8..18` à 2,9 m ; échelle côté cour `x 13.2..13.8, z 12..13`, face −x, haut 2.9, sortie `{x: 14.6, z: 12.5}`.
  - Guérite : `liensAuto: false` + échelle face sud (`x 33..34, z −17..−16.4`, face +z, haut 2.5, sortie `{x: 33.5, z: −17.6}`).
  - Chaque échelle ajoute un lien (`duree: escalade.lienEchelle`, `bas` = centre du volume, `haut` = sortie).
  - Conduit du bunker : ouverture `[−9.6, −8.6]` dans le mur x = 22 ; AABB joueur `x 21..23, minY 1.2, maxY 2.6` (on passe accroupi) ; AABB pleine hauteur dans `aabbsZombies` et `navObstacles` (les zombies font le tour) ; modèle `D.conduit` (gaine métallique).
  - `lumiere()` et `projecteur()` poussent `{x, z, rayon}` dans `sourcesLumiere` (lumière : rayon = portée × 0,5 ; projecteur : point visé, rayon 7).
  - Les liens dont le `bas` tombe dans un `navObstacle` (marge 0,35) ou hors de la grille sont retirés.

- [ ] **Step 1 : tests qui échouent** — `tests/surfaces-carte.test.js` (`construireCarte(new THREE.Scene())`) :
  - le dessus du conteneur `(−13.8, 9)` vaut 2,6 avec `y = 2.6` et 0 avec `y = 0` ;
  - un point d'apparition du bunker donne `hauteurSol === 0` ;
  - 3 échelles ; chaque îlot (`ilot && h ≥ 1.2`) a au moins un lien ;
  - `carte.sourcesLumiere.length ≥ 10`.
  - `tests/decors.test.js` : ajouter aux cibles d'accessibilité `carte.liens.map(l => l.bas)` (Review Focus 4).
- [ ] **Step 2 :** `npm test` → FAIL.
- [ ] **Step 3 :** implémenter dans `carte.js` / `decors.js`.
- [ ] **Step 4 :** `npm test` → PASS ; `npm run fumee` → `FUMEE OK` (le scénario « tour radio » existant prouve que la rampe marche toujours).
- [ ] **Step 5 :** commit `Surfaces, échelles, conduit, toit du bunker et liens d'escalade`.

---

### Task 3 : Joueur — accroupi, hisse, échelles, chute

**Files :**
- Modify : `src/joueur.js`, `src/armes.js` (dispersion ×0,7 accroupi, pas de tir si `joueur.occupe`), `src/main.js` (dégâts de chute, `carte` passée au joueur), `index.html` (ligne des touches), `tests/fumee/scenarios.mjs`

**Interfaces :**
- Consumes : `deplacer(…, hauteur)`, `peutSeRelever`, `trouverRebord`, `echelleDevant`, `degatsChute` (Tâche 1) ; `carte.surfaces`, `carte.echelles`, `hauteurSol(x, z, y)` (Tâche 2).
- Produces (`joueur`) : `accroupi: bool`, `occupe: bool` (hisse ou échelle), `surface: Surface|null`, `majJoueur(dt, carte)` (reçoit la carte au lieu de `aabbs`), callback `joueur.surChute = (degats) => {}`.
- Comportement :
  - `C` bascule accroupi ; se relever refusé si `!peutSeRelever` ; yeux lissés vers 1,0 / 1,7 m (≈ 0,15 s) ; pas de sprint, vitesse ×0,5.
  - `Espace` : si `trouverRebord` (avec `yPieds` = position actuelle, au sol ou en l'air) → hisse 0,6 s (la caméra monte puis avance jusqu'au point d'arrivée), `occupe = true` ; sinon saut normal si au sol. Tenir `Espace` en l'air déclenche aussi la hisse (on attrape le conteneur en sautant).
  - Échelle : `echelleDevant` + avancer → monte à 2,5 m/s, reculer → descend ; arrivé en haut → placé sur `sortie` à `haut` ; `Espace` lâche ; en bas, reculer quitte l'échelle.
  - Chute : hauteur max en l'air − sol à l'atterrissage → `surChute(degatsChute(h))` si > 0 (dégâts bruts, comme les explosions).

- [ ] **Step 1 : scénarios de fumée qui échouent** (chacun commence par `demarrerPartie('soldat')`, `partie.chrono = 1e9`, `zombies.vider()`) :
  - « accroupi » : `appuis.add('KeyC')` → `joueur.accroupi === true` et `camera.position.y − joueur.position.y` tend vers 1,0.
  - « conduit du bunker » : portes ouvertes, joueur debout en `(20.5, −9.1)` regardant +x et avançant 1,5 s → bloqué (`x < 21`) ; accroupi → passe (`x > 23`) ; se relever dans le conduit refusé (`accroupi` reste vrai).
  - « grimper sur un conteneur » : joueur en `(−12, 9)` regardant −x ; `Space` (saut) puis `Space` tenu → attendre `joueur.position.y > 2.5` ; puis `joueur.surface.h === 2.6`.
  - « échelle du toit du bunker » : joueur en `(13, 12.5)` regardant +x, `KeyW` tenu → attendre `position.y > 2.8` et `x > 14`.
  - « grenade sur un conteneur » : joueur sur le conteneur (placé à y 2,6), grenade lâchée à ses pieds → `derniereExplosion.y > 2` (Review Focus 5).
- [ ] **Step 2 :** `npm run fumee` → ECHEC sur « accroupi ».
- [ ] **Step 3 :** implémenter dans `joueur.js`, `armes.js`, `main.js` ; ligne des touches : `<b>C</b> s'accroupir · <b>Espace</b> sauter / grimper`.
- [ ] **Step 4 :** `npm test && npm run fumee` → PASS / `FUMEE OK`.
- [ ] **Step 5 :** commit `Accroupi, escalade, échelles et chute`.

---

### Task 4 : Règles de perception (pur)

**Files :**
- Create : `src/regles/perception.js`
- Modify : `src/config.js` (`perception`, `difficultes.*.delaiFlair`)
- Test : `tests/perception.test.js`

**Interfaces :**
- Config : `perception: { vue: 25, vueOmbre: 12, cone: 120, contact: 2, alerte: 8, fouille: 6, intervalle: 0.2, bruit: { tir: 30, sprint: 10, marche: 5, accroupi: 1.5 } }` ; `delaiFlair` : recrue 15, soldat 15, veteran 10, cauchemar 6.
- Produces :
  - `creerPerception(pos) -> { etat: 'traque', derniere: {x,z}, sansContact: 0, cible: null }`.
  - `rayonBruit({ tir, armeId, sprint, mouvement, accroupi }) -> mètres` : `tir` → `CONFIG.armes[armeId].bruit ?? bruit.tir` ; sinon sprint 10, marche (accroupi 1,5 sinon 5), immobile 0.
  - `voit({ zombie: {x,z}, orientation, joueur: {x,z}, ligneLibre, cacheDansOmbre }) -> bool` (distance ≤ vue ou vueOmbre, angle ≤ cone/2 ; `orientation` en radians comme `atan2(dx, dz)`).
  - `dansOmbre(pos, sources, lampeAllumee) -> bool`.
  - `majPerception(p, { repere, joueur, alerte }, dt, delaiFlair, rng) -> 'traque'|'recherche'|'flair'` :
    - `repere || alerte` → `traque`, `derniere = joueur`, `sansContact = 0` ;
    - en `traque` sans repérage → `recherche`, `cible = derniere` ;
    - en `recherche` : `sansContact += dt` ; quand le zombie a atteint `cible` (l'appelant met `cible = null`), nouvelle cible au hasard dans un rayon de 6 m autour de `derniere` ; `sansContact ≥ delaiFlair` → `traque` avec `derniere = joueur` et renvoie `'flair'` pour cette mise à jour (l'appelant l'affiche/compte, puis l'état est `traque`).
  - `repere` est calculé par l'appelant : `voit(…) || distance ≤ rayonBruit || distance ≤ contact`.
- [ ] **Step 1 : tests qui échouent** — vue (devant à 20 m → oui ; derrière → non ; à 15 m caché dans l'ombre → non ; mur → non) ; `rayonBruit` (tir 30, arbalète 5, sprint 10, marche 5, accroupi 1,5, immobile 0) ; `dansOmbre` (lampe allumée → faux ; près d'une source → faux) ; transitions : traque → recherche → (cible tirée à ≤ 6 m de `derniere`) → flair après 15 s en Soldat, 6 s en Cauchemar ; alerte → traque.
- [ ] **Step 2 :** `node --test tests/perception.test.js` → FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test` → PASS.
- [ ] **Step 5 :** commit `Règles de perception des zombies`.

---

### Task 5 : Zombies — perception et escalade

**Files :**
- Modify : `src/zombies.js`, `src/main.js` (calcule `joueur.bruit`, `joueur.dansOmbre`), `src/armes.js` (expose `aTire` : vrai l'image d'un tir), `tests/fumee/scenarios.mjs`

**Interfaces :**
- Consumes : Tâche 4 (`creerPerception`, `majPerception`, `voit`, `rayonBruit`, `dansOmbre`) ; Tâche 1 (`choisirLien`, `bordLePlusProche`, `hauteurSurfaces`) ; Tâche 2 (`carte.liens`, `carte.sourcesLumiere`) ; Tâche 3 (`joueur.surface`, `joueur.accroupi`).
- Produces : zombie `z.perception`, `z.surface` (îlot où il se trouve ou `null`), `z.escalade: { lien, t, sens: 'monte'|'descend' } | null`.
- Comportement :
  - Perception mise à jour toutes les `perception.intervalle` s par zombie (décalées comme `prochainCalcul`) ; un zombie qui passe en traque alerte les vivants à ≤ 8 m ; apparition en `traque`.
  - Destination : `traque` → joueur (logique actuelle) ; `recherche` → `perception.cible` (A* au sol), `cible = null` quand atteinte à < 0,8 m.
  - Îlots : si le joueur (en traque) est sur un îlot (`joueur.surface?.ilot && h ≥ 1.2`) différent de `z.surface` → si `z.surface` → saut vers `bordLePlusProche` (0,4 s) ; sinon aller à `choisirLien(…).bas`, puis montée en ligne droite vers `haut` pendant `duree`. Sur un îlot : déplacement direct vers le joueur, `deplacer` à `y = h`, position bornée au rectangle de la surface moins le rayon. Joueur redescendu → saut vers le bas.
  - Pas de détection de blocage pendant `escalade`.
  - `z.position.y = hauteurSol(x, z, z.position.y)` partout.
- [ ] **Step 1 : scénarios de fumée qui échouent** :
  - « un zombie rejoint le joueur sur un conteneur » : joueur placé sur le conteneur `(−13.8, 9)` à y 2,6, invulnérable ; zombie en `(−9, 2)` ; `accelerer(3)` → attendre `z.position.y > 2.5` (60 s max) puis `distance < 2`.
  - « échelle : un zombie rejoint le joueur sur le toit du bunker » : idem, joueur en `(20, 12)` à y 2,9.
  - « caché puis retrouvé par flair » (Soldat) : joueur accroupi immobile, lampe éteinte, en `(−16, −10)` (vérifier `dansOmbre` dans le test, sinon choisir un coin sombre et le noter) ; zombie en `(10, 15)`, orienté à l'opposé, forcé en `recherche` avec `derniere = (10, 15)` → `etat` reste `recherche` tant que `sansContact < 15` ; puis attendre `etat === 'traque'` (accélérer ×5, 60 s max).
- [ ] **Step 2 :** `npm run fumee` → ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run fumee` → PASS / `FUMEE OK` (y compris « vague 5 en Cauchemar », Review Focus 1).
- [ ] **Step 5 :** commit `Zombies : perception, recherche, flair et escalade`.

---

### Task 6 : Vérification finale et documentation

**Files :** `LISEZMOI.md`, `index.html`, `outils/capture.mjs` (rien à changer s'il suffit)

- [ ] **Step 1 :** `npm test && npm run fumee` → PASS / `FUMEE OK`.
- [ ] **Step 2 :** captures en Haute : `node outils/capture.mjs haute -13.8 9 90 <scratch>/conteneur.png` (le joueur placé en hauteur — ajouter un argument `y` à l'outil si nécessaire) et depuis le toit du bunker ; les regarder.
- [ ] **Step 3 :** LISEZMOI : touches `C` (s'accroupir), `Espace` (sauter / grimper, tenir en sautant pour attraper un rebord), échelles ; section « Se cacher » (vue, bruit, ombre, la horde finit toujours par revenir).
- [ ] **Step 4 :** commit `Lot 2 terminé : vérification et LISEZMOI`.
