"""Memory Dungeon reel shots, rendered headless in Blender 4.3 (EEVEE Next).

  blender -b -P blender_reel.py -- --shot hero  --faces a.png,b.png,c.png,d.png --back back.png --plate plate.png --out dir
  blender -b -P blender_reel.py -- --shot board --faces ... --back ... --plate ... --out dir

hero:  one card floating in the dark, back to camera, flips to reveal its face while the camera
       creeps in. 54 frames.
board: twelve cards lying on a stone slab, the camera sweeps low across them as they flip face up
       in a wave, then two matching cards lift and glow. 66 frames.
Frames are PNG at 1080x1920, 30 fps.
"""
import argparse
import math
import random
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--shot', required=True)
ap.add_argument('--faces', required=True)
ap.add_argument('--back', required=True)
ap.add_argument('--plate', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--samples', type=int, default=64)
ap.add_argument('--frame-step', type=int, default=1)
ap.add_argument('--fps-mult', type=int, default=1, help='render N frames per animation frame via subframes (2 = 60 fps from 30 fps keys)')
args = ap.parse_args(argv)
FACES = args.faces.split(',')

CARD_W, CARD_H = 0.645, 1.0  # the back art is 850x1317

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1080
scene.render.resolution_y = 1920
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.filepath = args.out.rstrip('/\\') + '/f_'
scene.frame_step = args.frame_step
scene.eevee.taa_render_samples = args.samples
scene.eevee.use_shadows = True
scene.eevee.use_raytracing = True
scene.eevee.use_volumetric_shadows = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0
world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.004, 0.004, 0.006, 1)
bg.inputs['Strength'].default_value = 1.0


def load_image(path):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    return img


def card_material(name, image, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    # The gold reads as metal-ish where it is bright: drive specular tint and roughness off luminance.
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[0].color = (0.75, 0.75, 0.75, 1)
    ramp.color_ramp.elements[1].color = (0.18, 0.18, 0.18, 1)
    nt.links.new(tex.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Roughness'])
    bsdf.inputs['Metallic'].default_value = 0.18
    bsdf.inputs['Specular IOR Level'].default_value = 0.6
    if emission > 0:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


def make_card(name, face_img, back_img, glow=0.0):
    """Two planes back to back under one empty; the empty is what gets animated."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    parts = []
    for side, img, nz in (('front', face_img, 1), ('back', back_img, -1)):
        bpy.ops.mesh.primitive_plane_add(size=1)
        ob = bpy.context.active_object
        ob.name = f'{name}_{side}'
        ob.scale = (CARD_W, CARD_H, 1)
        ob.location = (0, 0, nz * 0.0015)
        if nz < 0:
            ob.rotation_euler = (0, math.pi, 0)
        ob.parent = root
        ob.data.materials.append(card_material(f'{name}_{side}_mat', img, glow if side == 'front' else 0.0))
        parts.append(ob)
    # A dark rim so the edge never reads as paper-thin white.
    bpy.ops.mesh.primitive_cube_add(size=1)
    rim = bpy.context.active_object
    rim.name = f'{name}_rim'
    rim.scale = (CARD_W - 0.004, CARD_H - 0.004, 0.0028)
    rim.parent = root
    rim_mat = bpy.data.materials.new(f'{name}_rim_mat')
    rim_mat.diffuse_color = (0.02, 0.015, 0.01, 1)
    rim.data.materials.append(rim_mat)
    return root


def add_light(name, kind, loc, color, energy, size=1.0, target=None):
    data = bpy.data.lights.new(name, kind)
    data.color = color
    data.energy = energy
    if kind == 'AREA':
        data.size = size
        data.shape = 'DISK'
    elif kind == 'POINT':
        data.shadow_soft_size = size
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    bpy.context.collection.objects.link(ob)
    if target is not None:
        con = ob.constraints.new('TRACK_TO')
        con.target = target
        con.track_axis = 'TRACK_NEGATIVE_Z'
        con.up_axis = 'UP_Y'
    return ob


def add_plate(image, distance, width, tilt=0.0):
    """The Z-Image plate as an emissive backdrop far behind the action, so DOF melts it."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    ob = bpy.context.active_object
    ob.name = 'plate'
    aspect = image.size[1] / image.size[0]
    ob.scale = (width, width * aspect, 1)
    ob.location = (0, distance, width * aspect * 0.12)
    ob.rotation_euler = (math.pi / 2 + tilt, 0, 0)
    mat = bpy.data.materials.new('plate_mat')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    em.inputs['Strength'].default_value = 0.42
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    ob.data.materials.append(mat)
    return ob


def add_motes(count, box, seed=7):
    """Tiny warm emissive motes drifting in the dark, for depth under the DOF."""
    rnd = random.Random(seed)
    mat = bpy.data.materials.new('mote_mat')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Emission Color'].default_value = (1.0, 0.72, 0.38, 1)
    bsdf.inputs['Emission Strength'].default_value = 6.0
    for i in range(count):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.0012, 0.0028))
        ob = bpy.context.active_object
        ob.name = f'mote_{i}'
        x = rnd.uniform(box[0][0], box[0][1])
        y = rnd.uniform(box[1][0], box[1][1])
        z = rnd.uniform(box[2][0], box[2][1])
        ob.location = (x, y, z)
        ob.data.materials.append(mat)
        # A slow drift: keyframe start and end positions.
        ob.keyframe_insert('location', frame=1)
        ob.location = (x + rnd.uniform(-0.08, 0.08), y + rnd.uniform(-0.05, 0.05), z + rnd.uniform(0.03, 0.12))
        ob.keyframe_insert('location', frame=scene.frame_end)


def compositor_glare():
    scene.use_nodes = True
    nt = scene.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers')
    glare = nt.nodes.new('CompositorNodeGlare')
    glare.glare_type = 'BLOOM'
    glare.threshold = 0.85
    glare.mix = -0.35
    glare.size = 7
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
    nt.links.new(glare.outputs['Image'], comp.inputs['Image'])


def ease(f, a, b, k=0.5):
    """Set an interpolated keyframe-friendly value; the fcurves use Bezier so easing comes free."""
    return a + (b - a) * f


def make_camera(loc, target, lens=50, fstop=2.8):
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = lens
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.sensor_height = 36
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = fstop
    cam_data.dof.focus_object = target
    cam = bpy.data.objects.new('cam', cam_data)
    cam.location = loc
    bpy.context.collection.objects.link(cam)
    con = cam.constraints.new('TRACK_TO')
    con.target = target
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    scene.camera = cam
    return cam


back_img = load_image(args.back)
face_imgs = [load_image(p) for p in FACES]
plate_img = load_image(args.plate)

# ---------------------------------------------------------------- shots
if args.shot == 'hero':
    scene.frame_start, scene.frame_end = 1, 54
    card = make_card('hero', face_imgs[0], back_img, glow=0.0)
    card.location = (0, 0, 0)
    # The card starts with its back to the camera (camera looks along +Y at the card's -Y side).
    # Stand the plane up (its normal points +Z by default) so it faces the camera on -Y.
    up = math.pi / 2
    card.rotation_euler = (up + 0.10, 0, math.pi)
    card.keyframe_insert('rotation_euler', frame=1)
    card.keyframe_insert('rotation_euler', frame=10)
    card.rotation_euler = (up - 0.04, 0, 2 * math.pi)
    card.keyframe_insert('rotation_euler', frame=34)
    card.rotation_euler = (up - 0.06, 0.02, 2 * math.pi + 0.07)
    card.keyframe_insert('rotation_euler', frame=54)
    # A slow rise as it turns.
    card.location = (0, 0, -0.03)
    card.keyframe_insert('location', frame=1)
    card.location = (0, 0, 0.03)
    card.keyframe_insert('location', frame=54)
    for fc in card.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.easing = 'EASE_IN_OUT'

    focus = bpy.data.objects.new('focus', None)
    bpy.context.collection.objects.link(focus)
    focus.location = (0, 0, 0)
    cam = make_camera((0.05, -2.35, 0.08), focus, lens=55, fstop=2.2)
    cam.keyframe_insert('location', frame=1)
    cam.location = (-0.03, -1.95, 0.04)
    cam.keyframe_insert('location', frame=54)

    add_plate(plate_img, distance=5.0, width=5.2)
    add_light('key', 'AREA', (-1.4, -1.6, 1.5), (1.0, 0.70, 0.40), 210, size=1.4, target=card)
    add_light('rim', 'AREA', (1.6, 1.2, 0.6), (0.45, 0.90, 1.0), 260, size=0.8, target=card)
    add_light('fill', 'AREA', (1.2, -1.8, -0.6), (0.55, 0.60, 0.75), 40, size=2.0, target=card)
    add_motes(45, ((-1.2, 1.2), (-0.6, 1.8), (-1.6, 1.4)), seed=3)

elif args.shot == 'board':
    scene.frame_start, scene.frame_end = 1, 66
    cols, rows = 3, 4
    gap_x, gap_y = 0.72, 1.09
    # A stone slab under the cards.
    bpy.ops.mesh.primitive_plane_add(size=1)
    slab = bpy.context.active_object
    slab.name = 'slab'
    slab.scale = (6, 8, 1)
    slab.location = (0, 0, -0.004)
    smat = bpy.data.materials.new('slab_mat')
    smat.use_nodes = True
    nt = smat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 9.0
    noise.inputs['Detail'].default_value = 8.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.003, 0.003, 0.004, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.018, 0.016, 0.015, 1)
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 0.75
    slab.data.materials.append(smat)

    # Pairs: the twelve cards cycle four faces so every face has a pair on the board.
    order = [1, 2, 3, 2, 0, 3, 1, 0, 3, 1, 2, 1]
    cards = []
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            face = face_imgs[order[i] % len(face_imgs)]
            card = make_card(f'card_{i}', face, back_img)
            x = (c - (cols - 1) / 2) * gap_x
            y = ((rows - 1) / 2 - r) * gap_y
            card.location = (x, y, 0.004)
            # Lying flat, face down: rotate about the row axis.
            delay = int((r * 0.9 + c * 1.6) * 2.2)
            f0 = 8 + delay
            card.rotation_euler = (math.pi, 0, 0)
            card.keyframe_insert('rotation_euler', frame=1)
            card.keyframe_insert('rotation_euler', frame=f0)
            card.rotation_euler = (0, 0, 0)
            card.keyframe_insert('rotation_euler', frame=f0 + 14)
            card.keyframe_insert('location', frame=1)
            card.keyframe_insert('location', frame=f0)
            card.location = (x, y, 0.16)
            card.keyframe_insert('location', frame=f0 + 7)
            card.location = (x, y, 0.004)
            card.keyframe_insert('location', frame=f0 + 14)
            for fc in card.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'BEZIER'
                    kp.easing = 'EASE_IN_OUT'
            cards.append(card)
    # The match: the two chalices (centre column, rows 1 and 2) lift together at the end and glow.
    for i in (4, 7):
        card = cards[i]
        x, y, _ = card.location
        card.location = (x, y, 0.004)
        card.keyframe_insert('location', frame=50)
        card.location = (x, y, 0.36)
        card.keyframe_insert('location', frame=66)
        # Set the value explicitly: after keyframes exist, reading the property gives the animated
        # value at the current frame (frame 1, face down), not the last value assigned.
        card.rotation_euler = (0, 0, 0)
        card.keyframe_insert('rotation_euler', frame=50)
        card.rotation_euler = (-0.22, 0, 0)
        card.keyframe_insert('rotation_euler', frame=66)
        front = bpy.data.objects[f'card_{i}_front']
        bsdf = front.data.materials[0].node_tree.nodes['Principled BSDF']
        bsdf.inputs['Emission Strength'].default_value = 0.0
        bsdf.inputs['Emission Strength'].keyframe_insert('default_value', frame=50)
        bsdf.inputs['Emission Strength'].default_value = 0.85
        bsdf.inputs['Emission Strength'].keyframe_insert('default_value', frame=62)
        tex = [n for n in front.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE'][0]
        front.data.materials[0].node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])

    focus = bpy.data.objects.new('focus', None)
    bpy.context.collection.objects.link(focus)
    focus.location = (0.0, -0.4, 0.05)
    focus.keyframe_insert('location', frame=1)
    focus.location = (0.0, 0.0, 0.18)
    focus.keyframe_insert('location', frame=66)
    cam = make_camera((1.9, -3.6, 1.9), focus, lens=42, fstop=2.0)
    cam.keyframe_insert('location', frame=1)
    cam.location = (-0.85, -2.45, 1.45)
    cam.keyframe_insert('location', frame=66)
    for ob in (cam, focus):
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.easing = 'EASE_IN_OUT'

    add_plate(plate_img, distance=7.5, width=9.0, tilt=0.0)
    add_light('key', 'AREA', (-2.2, -2.6, 3.2), (1.0, 0.70, 0.40), 430, size=2.4, target=focus)
    add_light('rim', 'AREA', (2.4, 2.8, 1.6), (0.45, 0.90, 1.0), 380, size=1.8, target=focus)
    add_light('fill', 'AREA', (2.5, -2.5, 1.2), (0.55, 0.60, 0.75), 40, size=3.0, target=focus)
    add_motes(90, ((-2.0, 2.0), (-2.4, 2.6), (0.05, 1.6)), seed=11)

else:
    raise SystemExit(f'unknown shot {args.shot}')

compositor_glare()
import os
if os.environ.get('REEL_POS'):
    # Screen position (0..1, origin bottom-left) of every card at the frames the sound design needs.
    from bpy_extras.object_utils import world_to_camera_view
    import json
    rows = []
    cam = scene.camera
    names = [o.name for o in bpy.data.objects if o.name.startswith('card_') and o.type == 'EMPTY'] or ['hero']
    for name in names:
        ob = bpy.data.objects[name]
        fc = ob.animation_data.action.fcurves.find('rotation_euler', index=0)
        keys = [int(k.co[0]) for k in fc.keyframe_points]
        for f in sorted(set(keys + [scene.frame_end])):
            scene.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            loc = ob.evaluated_get(dg).matrix_world.translation
            v = world_to_camera_view(scene, cam, loc)
            rows.append({'card': name, 'frame': f, 'x': round(v.x, 3), 'y': round(v.y, 3), 'depth': round(v.z, 3), 'rot': round(ob.evaluated_get(dg).rotation_euler[0], 3), 'z': round(loc.z, 3)})
    print('POS ' + json.dumps(rows))
elif os.environ.get('REEL_DEBUG'):
    ob = bpy.data.objects.get('card_4')
    for fc in ob.animation_data.action.fcurves:
        print('FC', fc.data_path, fc.array_index, [(int(k.co[0]), round(k.co[1], 3)) for k in fc.keyframe_points])
    for f in (30, 40, 45, 50, 58, 66):
        scene.frame_set(f)
        print('EVAL', f, [round(v, 3) for v in ob.rotation_euler], [round(v, 3) for v in ob.location])
elif args.fps_mult > 1:
    # Subframe stepping: the keyframes stay at 30 fps, each animation frame is rendered fps_mult
    # times at fractional subframes, so motion blur-free 60 fps (or more) without touching the timing.
    out_base = scene.render.filepath
    n = 0
    for f in range(scene.frame_start, scene.frame_end + 1):
        for k in range(args.fps_mult):
            if f == scene.frame_end and k > 0:
                break
            scene.frame_set(f, subframe=k / args.fps_mult)
            scene.render.filepath = f'{out_base}{n + 1:04d}'
            bpy.ops.render.render(write_still=True)
            n += 1
    scene.render.filepath = out_base
    print('RENDERED', args.shot, n, 'frames at x', args.fps_mult)
else:
    bpy.ops.render.render(animation=True)
print('RENDERED', args.shot)
