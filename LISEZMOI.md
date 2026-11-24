# Zone Morte

FPS de survie en vagues contre des zombies, dans une base militaire abandonnée, de nuit.

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
| Sauter | Espace |
| Recharger | R |
| Acheter / ouvrir | E |
| Couteau | V |
| Grenade | G |
| Changer d'arme | 1, 2 ou molette |
| Pause | Échap |

## Régler le jeu
Tous les chiffres (prix, dégâts, vie, vagues…) sont dans `src/config.js`.

## Pour le développement
- `npm test` : tests des règles
- `npm run fumee` : lance le jeu dans Edge sans fenêtre et vérifie qu'il marche
