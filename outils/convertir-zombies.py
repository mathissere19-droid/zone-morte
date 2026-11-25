# Convertit les FBX Mixamo (assets/mixamo/) en GLB animés (assets/zombies/).
# Lancement (depuis la racine du projet) :
#   "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup -P outils/convertir-zombies.py
import os
import sys

import bpy

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SOURCE = os.path.join(RACINE, 'assets', 'mixamo')
CIBLE = os.path.join(RACINE, 'assets', 'zombies')
PERSONNAGES = ['zombie1', 'zombie2', 'boss']
ANIMATIONS = ['marche', 'course', 'attaque', 'mort1', 'mort2', 'ramper', 'sortie', 'attente']
OS_REQUIS = ['Head', 'Spine', 'Spine1', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg']
TAILLE_TEXTURE = 1024


def echouer(message):
    print('ERREUR :', message)
    sys.exit(1)


def vider_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def importer_fbx(chemin):
    if not os.path.isfile(chemin):
        echouer('fichier manquant : ' + chemin)
    avant = set(bpy.data.objects)
    actions_avant = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=chemin, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in avant], [a for a in bpy.data.actions if a not in actions_avant]


def courbes(action):
    """F-courbes d'une action (actions en couches de Blender 4.4+ ou anciennes)."""
    if getattr(action, 'layers', None):
        for couche in action.layers:
            for bande in couche.strips:
                for sac in bande.channelbags:
                    yield from sac.fcurves
    elif hasattr(action, 'fcurves'):
        yield from action.fcurves


def nom_os(armature, suffixe):
    for b in armature.data.bones:
        if b.name == suffixe or b.name.endswith(':' + suffixe):
            return b.name
    return None


def convertir(nom):
    vider_scene()
    objets, _ = importer_fbx(os.path.join(SOURCE, nom + '.fbx'))
    armatures = [o for o in objets if o.type == 'ARMATURE']
    if len(armatures) != 1:
        echouer(f'{nom} : {len(armatures)} armatures trouvées (1 attendue)')
    arm = armatures[0]
    manquants = [s for s in OS_REQUIS if not nom_os(arm, s)]
    if manquants:
        echouer(f'{nom} : os manquants {manquants}')
    hanches = nom_os(arm, 'Hips')
    ad = arm.animation_data_create()
    ad.action = None
    for piste in list(ad.nla_tracks):
        ad.nla_tracks.remove(piste)

    durees = {}
    for anim in ANIMATIONS:
        nouveaux, actions = importer_fbx(os.path.join(SOURCE, anim + '.fbx'))
        arm_anim = next((o for o in nouveaux if o.type == 'ARMATURE'), None)
        action = arm_anim.animation_data.action if arm_anim and arm_anim.animation_data else None
        if action is None:
            echouer(f'{anim}.fbx : aucune animation')
        action.name = anim
        action.use_fake_user = True
        # Supprime le déplacement horizontal de la racine (axes locaux x et z de l'os des hanches).
        chemin_hanches = f'pose.bones["{hanches}"].location'
        for fc in courbes(action):
            if fc.data_path == chemin_hanches and fc.array_index in (0, 2):
                v0 = 0.0  # position de repos : le zombie reste centré sur son origine
                for k in fc.keyframe_points:
                    k.co[1] = v0
                    k.handle_left[1] = v0
                    k.handle_right[1] = v0
        for o in nouveaux:
            bpy.data.objects.remove(o, do_unlink=True)
        for a in actions:
            if a is not action:
                bpy.data.actions.remove(a)
        debut, fin = action.frame_range
        piste = ad.nla_tracks.new()
        piste.name = anim
        bande = piste.strips.new(anim, int(debut), action)
        if hasattr(bande, 'action_slot') and bande.action_slot is None and len(action.slots):
            bande.action_slot = action.slots[0]
        piste.mute = False
        durees[anim] = (fin - debut) / bpy.context.scene.render.fps

    # Textures réduites à 1024 px.
    for img in bpy.data.images:
        if img.size[0] > TAILLE_TEXTURE or img.size[1] > TAILLE_TEXTURE:
            l, h = img.size
            f = TAILLE_TEXTURE / max(l, h)
            img.scale(max(1, int(l * f)), max(1, int(h * f)))
            img.pack()

    # Infos : hauteur et faces.
    bpy.context.view_layer.update()
    maillages = [o for o in bpy.data.objects if o.type == 'MESH']
    zs = []
    faces = 0
    for m in maillages:
        faces += len(m.data.polygons)
        for c in m.bound_box:
            zs.append((m.matrix_world @ __import__('mathutils').Vector(c)).z)
    hauteur = max(zs) - min(zs) if zs else 0

    os.makedirs(CIBLE, exist_ok=True)
    sortie = os.path.join(CIBLE, nom + '.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=sortie,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_image_format='JPEG',
        export_skins=True,
        export_yup=True,
    )
    taille = os.path.getsize(sortie) / 1024 / 1024
    print(f'== {nom} : hauteur {hauteur:.2f} m, {faces} faces, {taille:.1f} Mo, os tête "{nom_os(arm, "Head")}"')
    for anim, d in durees.items():
        print(f'   {anim:8s} {d:.2f} s')


for p in PERSONNAGES:
    convertir(p)
print('CONVERSION OK')
