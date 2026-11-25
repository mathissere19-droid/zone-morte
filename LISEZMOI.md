# Zone Morte

FPS de survie en vagues contre des zombies, dans une base militaire abandonnée, de nuit.

## Jouer en ligne
**https://mathissere19-droid.github.io/zone-morte/** — rien à installer, dans Chrome ou Edge sur PC (clavier + souris). Le premier chargement télécharge environ 19 Mo.

## Lancer le jeu
Double-cliquer sur **Jouer.bat**. Une fenêtre noire (le petit serveur local) s'ouvre : **laissez-la ouverte** pendant que vous jouez. Le jeu s'ouvre dans le navigateur. Pour arrêter : fermez l'onglet puis la fenêtre noire.

Python doit être installé (c'est le cas sur ce PC).

## Touches
| Action | Touche |
|---|---|
| Se déplacer | ZQSD (ou WASD / flèches) |
| Viser | clic droit |
| Tirer | clic gauche |
| Sprint | Maj gauche |
| Sauter / grimper | Espace (tenir en sautant pour attraper un rebord) |
| S'accroupir | C |
| Recharger | R |
| Acheter / ouvrir | E |
| Couteau | V |
| Grenade | G |
| Lampe torche | F |
| Changer d'arme | 1, 2 ou molette |
| Pause | Échap |

**Échelles** : avancer face à l'échelle pour monter, reculer pour descendre, Espace pour lâcher. Une chute de plus de 4 m fait mal.

## Se cacher
Les zombies vous **voient** (25 m devant eux, 12 m seulement si vous êtes accroupi dans l'ombre, lampe éteinte) et vous **entendent** : un tir porte à 30 m (l'arbalète à 5 m), le sprint à 10 m, la marche à 5 m, accroupi à 1,5 m. Un zombie qui vous repère prévient ceux qui l'entourent.

Cassez le contact (derrière un mur, sur un toit, accroupi dans un coin sombre) : ils vont voir là où ils vous ont perdu et fouillent autour. Mais **la horde finit toujours par revenir** : au bout de 15 s (10 s en Vétéran, 6 s en Cauchemar), ils sentent votre position. Ils savent aussi grimper : rebords des conteneurs et échelles.

## Zombies
- Les zombies sont de vrais personnages animés : ils se relèvent du sol, marchent, courent, frappent (le coup part quand le bras arrive, on peut l'esquiver en reculant à temps) et s'effondrent en mourant.
- **Tir à la tête** : un tir mortel à la tête fait sauter la tête.
- **Tirs dans les jambes** : un zombie qui encaisse assez de dégâts aux jambes (40 % de sa vie) sans mourir tombe et **rampe** : lent, il ne peut plus grimper, mais il mord encore de près.
- **Le Colosse** : un boss apparaît à la vague 5, puis toutes les 5 vagues (10, 15…). Très résistant (12 fois un zombie de la vague), lent mais il frappe 3 fois plus fort. Sa barre de vie s'affiche en haut de l'écran. Le tuer rapporte 500 points et un bonus.
- Si les modèles 3D ne se chargent pas, le jeu fonctionne quand même avec des zombies simplifiés.

## Difficultés
À choisir sur l'écran d'accueil (un record par niveau) :
- **Recrue** : zombies plus faibles, plus de points et de munitions, coureurs à partir de la vague 8.
- **Soldat** : le jeu normal.
- **Vétéran** : zombies plus résistants, coups plus forts, coureurs dès la vague 3.
- **Cauchemar** : zombies très résistants, coureurs dès la vague 1, **la vie ne remonte pas** (seulement avec la trousse de soin).

## Armes
- Au mur : mitraillette, revolver (cour), fusil à pompe (hangar), fusil d'assaut (bunker), fusil semi-automatique (tour).
- Dans la caisse : pistolet-mitrailleur compact, fusil à pompe automatique, arbalète… et parfois une arme rare : fusil de précision lourd, mitrailleuse lourde, lance-grenades, **lance-flammes**, **fusil électrique**.
- 2 grenades (G), rendues au début de chaque vague.

## Graphismes
Qualité **Basse / Moyenne / Haute** à choisir sur l'écran d'accueil ou en pause (le choix est mémorisé) :
- **Basse** : moins de particules, pas d'ombres — pour les PC modestes.
- **Moyenne** : ombres des projecteurs.
- **Haute** : toutes les ombres (lune comprise), 4 projecteurs, occlusion ambiante.

Si le jeu rame, il propose de baisser la qualité. Textures et ciel : Poly Haven (CC0), voir `CREDITS.md`.

## Régler le jeu
Tous les chiffres (prix, dégâts, vie, vagues…) sont dans `src/config.js`.

## Pour le développement
- `npm test` : tests des règles
- `npm run fumee` : lance le jeu dans Edge sans fenêtre et vérifie qu'il marche (en qualité Basse)
- `node outils/capture.mjs haute <x> <z> <angle> <fichier.png> [lampe] [effets]` : capture d'écran pour juger le rendu
- Zombies : les FBX Mixamo (non versionnés) sont dans `assets/mixamo/` ; pour régénérer `assets/zombies/*.glb` : `"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup -P outils/convertir-zombies.py`
