# Zone Morte — Design (v1)

Date : 2026-11-13
Statut : en attente de validation

## 1. Intention

- **Quoi** : un FPS de survie en vagues contre des zombies, dans l'esprit des modes zombies des FPS modernes, mais **original** (carte, armes, noms, éléments propres au projet — aucune reprise de contenu d'un jeu existant).
- **Pour qui** : l'utilisateur, pour jouer sur son PC (Windows 11).
- **Succès** : une partie complète jouable (de la vague 1 jusqu'à la mort), nerveuse, avec un rendu **semi-réaliste** (« pas du carton ») et fluide sur le PC de l'utilisateur.
- **Méthode** : on livre une v1 solide, puis l'utilisateur demande des modifications au fil de l'eau.

Ce que l'utilisateur a dit : jeu PC, combat, « comme un mode zombies de Call of », vue FPS, base militaire de nuit, rendu minimum réaliste.
Hypothèses (non dites, à corriger si besoin) : solo uniquement, clavier/souris, français dans l'interface.

## 2. Boucle de jeu

### Début
Le joueur apparaît dans la **cour centrale** de la base avec un pistolet (8 balles + 32 en réserve) et 500 points.

### Vagues
- Nombre de zombies par vague : `n(v) = round(6 + 4·v + 0,15·v²)`, plafonné à 24 zombies vivants simultanément (les autres attendent leur tour).
- PV des zombies : `150` en vague 1, `+100` par vague jusqu'à la vague 9, puis `×1,1` par vague.
- Vitesse : marche uniquement en vagues 1–4 ; à partir de la vague 5, une part `min(0,1·(v−4), 0,8)` court ; 0 marcheur lent garanti au-delà de la vague 12 (alors marche rapide minimum).
- Pause de **10 s** entre deux vagues (annoncée à l'écran, musique de transition).
- Apparition aux points d'apparition des **zones débloquées** uniquement, hors champ de vision et à plus de 8 m du joueur quand c'est possible.

### Points
| Action | Points |
|---|---|
| Balle qui touche (non mortelle) | +10 |
| Kill | +60 |
| Kill à la tête | +100 |
| Kill au couteau | +130 |

Le bonus *Points doubles* multiplie tous les gains par 2.

### Achats
- **Armes au mur** (silhouette dessinée sur le mur, `E` pour acheter) :
  - Mitraillette — 1 000 pts
  - Fusil à pompe — 1 500 pts
  - Fusil d'assaut — 2 000 pts
  - Racheter au même mur = recharge complète des munitions pour la moitié du prix.
- **Portes / barrières** : 3 zones
  - Hangar — 750 pts
  - Bunker — 1 000 pts
  - Tour radio — 1 250 pts (accessible depuis le hangar ou le bunker)
- **Caisse de ravitaillement** (950 pts) : arme aléatoire parmi la liste ci-dessous, pondérée ; une arme rare (fusil de précision lourd, mitrailleuse lourde, lance-grenades) a 10 % de chances.
- Le joueur porte **2 armes** maximum ; acheter une 3ᵉ remplace l'arme en main.

### Armes (v1)
| Arme | Dégâts | Cadence | Chargeur / réserve | Notes |
|---|---|---|---|---|
| Pistolet | 40 | semi | 8 / 32 | arme de départ |
| Mitraillette | 35 | 800 c/min | 30 / 150 | |
| Fusil à pompe | 8 × 30 | 70 c/min | 6 / 36 | dispersion, chute avec la distance |
| Fusil d'assaut | 50 | 600 c/min | 30 / 180 | |
| Fusil de précision lourd (rare) | 400 | semi | 5 / 30 | perce 3 zombies |
| Mitrailleuse lourde (rare) | 60 | 650 c/min | 100 / 300 | lente à recharger |
| Lance-grenades (rare) | 300 de zone | semi | 1 / 20 | rayon 4 m, peut blesser le joueur |

Tête = dégâts ×3 (×2 pour le fusil à pompe). Couteau (`V`) : 150 dégâts, au corps à corps.

### Bonus lâchés
5 % de chance par kill (max 4 par vague), disparaissent après 25 s (clignotent les 5 dernières) :
- **Munitions max** : toutes les armes pleines.
- **Points doubles** : 30 s.
- **Explosion** : tue tous les zombies présents, +400 pts.

### Joueur
- ZQSD (et WASD), souris, `Maj` sprint (stamina 4 s), `Espace` saut, `R` recharger, `E` interagir, `V` couteau, clic droit visée (zoom + précision), molette / `1` `2` changer d'arme, `Échap` pause.
- **Vie** : 100 PV ; un coup de zombie = 40 ; régénération complète après 4 s sans coup. Écran qui rougit selon les dégâts.
- **Mort** : fin de partie → écran de score (vague atteinte, kills, tirs à la tête, points gagnés, temps). Record (meilleure vague) sauvegardé dans le navigateur (`localStorage`).

### Hors v1
Boissons d'amélioration, amélioration d'armes, boss, multijoueur, manette, plusieurs cartes.

## 3. Carte : base militaire abandonnée, de nuit

Environ 80 × 80 m jouables, entourée de grillages et de miradors infranchissables.

- **Cour centrale** (départ) : asphalte fissuré, sacs de sable, camion bâché renversé, projecteur sur mât. Pistolet de départ, mitraillette au mur. 4 points d'apparition (brèches dans le grillage).
- **Hangar** : grand volume en tôle, avions/véhicules sous bâche, passerelle métallique. Fusil à pompe au mur, **caisse de ravitaillement**. 3 points d'apparition.
- **Bunker** : couloirs en béton bas de plafond, lumières qui grésillent, salle de commandement. Fusil d'assaut au mur. 3 points d'apparition (bouches d'aération).
- **Tour radio** : petite plateforme surélevée avec une vue sur la base, escaliers étroits. 2 points d'apparition.

Toutes les zones sont reliées en boucle pour pouvoir « tourner » avec les zombies (technique de survie classique du genre).

## 4. Rendu « minimum réaliste »

Objectif honnête : un rendu de **jeu indé sombre et crédible**, pas un AAA.

- **Matériaux PBR** (Poly Haven, CC0) : béton, tôle rouillée, asphalte mouillé, sable, bois, grillage (alpha). Cartes couleur + normale + rugosité (+ AO quand dispo), en 1K/2K.
- **Modèles décor** (Poly Haven CC0, et Sketchfab sous licence CC0/CC-BY avec crédits dans `CREDITS.md`) : barils, caisses, sacs de sable, barrières, véhicules, projecteurs.
- **Ciel** : HDRI de nuit Poly Haven (éclairage d'ambiance + fond), brouillard exponentiel bleuté.
- **Lumières** : projecteurs avec ombres (nombre d'ombres limité selon la qualité), lampe torche du joueur (`F`), néons qui grésillent dans le bunker.
- **Post-traitement** (`EffectComposer`) : bloom, SSAO, grain de film, vignette, correction colorimétrique ; flou de mouvement léger optionnel.
- **Zombies** : personnages humains réalistes **Mixamo** (gratuits, utilisables dans un jeu), avec animations marche / course / attaque / mort / réaction aux coups. L'utilisateur télécharge les fichiers avec son compte Adobe (guide fourni) ; conversion FBX → GLB faite par moi (Blender en ligne de commande). Variantes : 3 à 4 modèles, teintes différentes.
  - **Repli** si Mixamo bloque : modèles CC0/CC-BY trouvés sur Sketchfab, ou génération Higgsfield (sur accord de l'utilisateur).
- **Armes** : modèles vue FPS (Sketchfab, licence libre), flamme de bouche, douilles éjectées, recul, balancement à la marche, animation de rechargement procédurale (l'arme descend et revient).
- **Impacts** : étincelles (métal), poussière (béton), sang (zombies), décalcomanies de trous de balle (limitées à 64, les plus anciennes disparaissent).
- **Qualité** (menu) : Basse / Moyenne / Haute → résolution de rendu, ombres, SSAO, nombre de lumières, densité des particules.
- Objectif : **60 i/s en Moyenne** sur le PC de l'utilisateur.

## 5. Son
- Tirs, rechargements, douilles, pas (sol béton / métal), grognements et cris de zombies **spatialisés** (Web Audio, `PositionalAudio`).
- Ambiance de nuit (vent, grésillement), musique tendue de début/fin de vague.
- Sources : packs CC0 (freesound.org CC0, Kenney, Sonniss GDC) ; crédits dans `CREDITS.md`.

## 6. Architecture technique

- **Technologie** : JavaScript (modules ES) + **three.js** copié en local (`vendor/`), aucune étape de compilation.
- **Lancement** : `Jouer.bat` démarre un mini-serveur local (Python, déjà installé : `python -m http.server`) et ouvre le navigateur sur le jeu. (Les modules ES ne se chargent pas depuis `file://`, d'où le serveur.)
- **Emplacement** : `C:\Users\steel\Desktop\claude\zone-morte\`, dépôt git local.

```
zone-morte/
  index.html, Jouer.bat, CREDITS.md
  vendor/three/        three.js + addons (GLTFLoader, EffectComposer, …)
  assets/              textures/, models/, hdri/, sounds/
  src/
    main.js            boucle de jeu, états (menu, partie, pause, fin)
    config.js          toutes les valeurs d'équilibrage (armes, vagues, prix)
    regles/            logique pure, sans three.js — testable
      vagues.js        n(v), PV, vitesse, part de coureurs
      economie.js      points, achats, portes, caisse (aléatoire injectable)
      combat.js        dégâts, tête, couteau, explosion
    joueur.js          contrôles, collisions, vie, stamina
    armes.js           tir (raycast), recul, munitions, effets
    zombies.js         modèles, animations, IA, attaque
    navigation.js      grille de navigation + A* (contourner les murs)
    carte.js           construction de la base, zones, collisions, lumières
    bonus.js           apparition / ramassage des bonus
    rendu.js           renderer, post-traitement, réglages de qualité
    audio.js           sons et spatialisation
    interface.js       HUD (viseur, vie, munitions, points, vague), menus, messages « E pour acheter »
    assets.js          chargement des modèles/textures avec écran de chargement
  tests/               tests node:test sur src/regles/*
```

- **Principe** : toute règle chiffrée vit dans `config.js` + `regles/` (pur, testable). Les modules visuels lisent ces règles mais ne les recalculent pas.
- **IA zombies** : grille de navigation calculée depuis la carte (cases de 0,5 m), chemin A* recalculé toutes les 0,5 s par zombie (étalé sur plusieurs images), séparation entre zombies pour éviter qu'ils se superposent. Si le joueur est en ligne de vue directe à moins de 6 m, déplacement direct.
- **Collisions** : boîtes (AABB) pour le joueur et les zombies contre le décor ; tir par raycast contre des volumes de touche par zombie (tête / corps).

## 7. Gestion des erreurs
- Écran de chargement avec progression ; si un fichier manque → message clair indiquant lequel, et le jeu remplace par une forme simple au lieu de planter.
- Si WebGL2 indisponible → message expliquant comment l'activer.
- Perte du verrouillage souris → pause automatique.
- Onglet en arrière-plan → pause automatique (pas de mort pendant qu'on est ailleurs).

## 8. Vérification
- **Tests automatiques** (`node --test`) sur `src/regles/` : formules de vagues, gains de points (dont points doubles), achats refusés sans assez de points, caisse (tirage avec aléatoire injecté), dégâts tête/corps/couteau.
- **Test du jeu lancé** : navigateur automatisé (Playwright, Chromium) — chargement sans erreur console, capture d'écran de la cour, simulation de quelques secondes de partie (apparition de zombies, tir, gain de points).
- **Parties réelles** par l'utilisateur, retours au fil de l'eau.

## 9. Ordre de fabrication (aperçu, détaillé dans le plan)
1. Squelette : page, serveur, three.js, boucle, joueur qui se déplace dans une zone test.
2. Règles pures + tests.
3. Armes (pistolet), zombies basiques (capsules) avec IA, vagues, points, mort → **jeu jouable laid**.
4. Carte complète avec zones, portes, armes au mur, caisse, bonus.
5. Rendu réaliste : textures, HDRI, lumières, post-traitement, qualité.
6. Zombies Mixamo et armes réalistes, impacts.
7. Son, menus, écran de fin, finitions, réglages d'équilibrage.
