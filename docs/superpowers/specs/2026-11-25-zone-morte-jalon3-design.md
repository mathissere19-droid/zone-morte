# Zone Morte — Jalon 3 : rendu « vrai jeu de zombies »

Date : 2026-11-25
Statut : Lot 1 validé à l'oral, spec en relecture
Base : branche `master`, commit 1c3955c (jalon 2 terminé).

## 1. Intention

Ce que l'utilisateur a dit : « se rapprocher le plus d'un vrai jeu de zombies » ; **pas de son pour l'instant** (on joue surtout en cours, sans le son) ; priorité au **graphisme**, « de tout » (zombies, armes, effets, carte). Les PC de jeu sont des portables récents avec carte RTX.

Hypothèses (non dites, à corriger si fausses) : le rendu de la base (Lot 3 du jalon 2) est jugé correct ; ce qui casse l'illusion, ce sont les zombies en boîtes, puis les armes. Contenu original : on reprend les mécaniques et le style du genre, pas les noms, personnages ni cartes d'un jeu existant.

Succès : en jouant, l'utilisateur trouve que les zombies ressemblent à de vrais zombies animés (et plus tard que les armes, l'interface et la carte font « vrai jeu »), en restant fluide (≥ 60 i/s en Haute sur RTX, jouable en Basse).

Le travail est livré en **4 lots**, dans l'ordre, chacun jouable et testé par l'utilisateur avant le suivant :
1. **Zombies réalistes** (ce document, détaillé).
2. **Armes en main** : modèles d'armes libres de droits, bras, animations codées (tir, rechargement, changement).
3. **Interface et effets** : écran qui rougit et traces de sang aux dégâts, points qui s'affichent à chaque touche, HUD du genre, annonce de vague stylisée.
4. **Carte plus riche** : débris, végétation, épaves, sang au sol, brouillard rasant, éclairage plus dramatique.

Les lots 2 à 4 auront chacun leur propre conception (questions, puis spec) au moment de les commencer. Hors jalon 3 : sons, barricades, atouts, machine d'amélioration, coop.

## 2. Lot 1 — Zombies réalistes

### 2.1 Ressources (Mixamo, téléchargées par l'utilisateur)
Dans `assets/mixamo/` (FBX bruts, **non versionnés** : `.gitignore`) :
- 2 ou 3 personnages zombies humains, T-pose, avec peau : `zombie1.fbx`, `zombie2.fbx`, `zombie3.fbx` (facultatif).
- 8 animations sans peau, 30 i/s, « In Place » pour les déplacements : `marche`, `course`, `attaque`, `mort1`, `mort2`, `ramper`, `sortie`, `attente`.

Licence Mixamo : utilisation libre dans un jeu, pas de redistribution des fichiers bruts seuls. On versionne les GLB convertis (intégrés au jeu) et on cite Mixamo dans `CREDITS.md`.

### 2.2 Conversion (outil, une fois)
`outils/convertir-zombies.py`, lancé par Blender en ligne de commande (`blender -b -P outils/convertir-zombies.py`) :
- importe chaque personnage, y attache les 8 animations (actions nommées comme les fichiers), supprime le déplacement racine résiduel ;
- réduit les textures à 1024 px, exporte `assets/zombies/zombieN.glb` (un fichier par personnage, toutes les animations dedans) ;
- affiche un résumé (os trouvés, durées des animations, taille des fichiers). Échoue clairement s'il manque un fichier ou un os attendu (`Head`, `Spine`, `LeftUpLeg`, `RightUpLeg`).

Commande documentée dans le LISEZMOI (section développement), avec le chemin de Blender de l'utilisateur : `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`.

### 2.3 Dans le jeu
Nouveau module `src/modeles-zombies.js` (chargement et animation, three.js) et module pur `src/regles/animation-zombie.js` (choix de l'animation, testé).

- **Chargement** : `GLTFLoader` + `SkeletonUtils.clone` (à recopier de `node_modules/three` vers `vendor/three/addons/`). Chargés au démarrage en parallèle des textures ; l'écran d'accueil attend la fin.
- **Repli** : si un GLB manque ou ne charge pas, les zombies actuels en boîtes sont utilisés, sans erreur console. Les tests de fumée tournent dans les deux cas.
- **Variété** : personnage tiré au hasard, échelle 0,92 à 1,08, teinte de peau légèrement variée, vitesse d'animation calée sur la vitesse réelle (pas de pieds qui glissent).
- **Animations** (`AnimationMixer` par zombie, fondus de 0,2 s), choisies par `choisirAnimation(etat)` :
  - sortie du sol → `sortie` ; à l'arrêt (fouille, attente sous le joueur) → `attente` ;
  - marche / marche rapide → `marche` (vitesse ×1 / ×1,6) ; course → `course` ;
  - à portée → `attaque` (le coup part au moment de l'impact de l'animation, pas au début) ;
  - montée (escalade) → `attaque` ralentie et bras levés (pose d'escalade) ; saut vers le bas → `course` figée ;
  - mort → `mort1` ou `mort2` au hasard, le corps reste 4 s puis s'enfonce dans le sol.
- **Zones touchées** : boîtes invisibles attachées aux os (`Head` → tête ; `Spine`/bassin → corps ; cuisses/mollets → jambes). Les tirs les visent comme aujourd'hui (`userData.zone`) ; nouvelle zone `jambes` = dégâts du corps.
- **Démembrement** (règles pures, testées) :
  - tir à la tête qui tue → os `Head` mis à l'échelle 0, morceau de tête qui part en l'air, giclée de sang ;
  - dégâts cumulés aux jambes ≥ 40 % des PV max, sans mourir → le zombie tombe et **rampe** (`ramper`, vitesse ×0,35, portée d'attaque 1 m, ne grimpe plus) ; zone `jambes` désactivée.
- **Sang au sol** : flaque (décalque) sous chaque mort, 24 au maximum, s'efface en 20 s.
- **Performance** : au-delà de 25 m, mixer mis à jour une image sur deux ; ombres portées des zombies seulement en Haute ; objectif ≥ 60 i/s avec 24 zombies en Haute sur RTX.

### 2.4 Ce qui ne change pas
IA, perception, escalade, vagues, points et difficultés du jalon 2 : identiques. Seuls l'apparence, l'animation et la zone `jambes` (et donc le rampeur) sont nouvelles.

### 2.5 Tests
- Unitaires : `choisirAnimation` (chaque état), règles de démembrement (seuil jambes, tête), borne des flaques.
- Fumée (avec et sans GLB) : apparition, marche, attaque qui blesse, tir à la tête → tête retirée, tir dans les jambes → rampe, mort → corps retiré, aucune erreur console, vague 5 Cauchemar toujours terminée.
- Capture en Haute d'un groupe de zombies, regardée avant la livraison.
