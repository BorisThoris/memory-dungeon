"""Relight the painted dungeon: per-light-group passes rendered in Blender (Cycles).

The painting is projected from the camera onto a plain room (floor, two walls, vault, back wall)
whose proportions were measured from the plate (`scene.json` from `segment_scene.py`), then lit by
real lights standing where the painting shows the rune ring and the six torches. Each light family
is a Cycles light group, so the render gives one image per family of *painting x that light*:
black where the light does not reach, the stones catching it in perspective where it does. Light
adds, so the game composites `base + sum(pass_i * intensity_i(t))` and the floor lights up from the
ring exactly as if the ring were a lamp in the room.

  blender -b -P blender_scene_lights.py -- --plate base.png --scene scene.json --out dir [--prefix ...] [--samples 96]

Writes <prefix>-light-ring.png, <prefix>-light-torches-l.png, <prefix>-light-torches-r.png (RGB, linear
light in a Standard view transform, so the additive maths holds).
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--plate', required=True)
ap.add_argument('--scene', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--prefix', default='bg-gameplay-dungeon-ring-v2')
ap.add_argument('--samples', type=int, default=256)
ap.add_argument('--hfov', type=float, default=75.0, help='camera horizontal field of view, degrees')
ap.add_argument('--eye', type=float, default=1.6, help='camera height above the floor')
args = ap.parse_args(argv)
S = json.load(open(args.scene))
W, H = S['plate']
os.makedirs(args.out, exist_ok=True)

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = False
scene.cycles.use_light_tree = True
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0.0
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_depth = '8'
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    try:
        prefs.preferences.compute_device_type = 'OPTIX'
        prefs.preferences.get_devices()
        for d in prefs.preferences.devices:
            d.use = d.type != 'CPU'
        scene.cycles.device = 'GPU'
    except Exception as exc:  # noqa: BLE001 - CPU is the fallback, just slower
        print('GPU unavailable, CPU render:', exc)

# Camera: level (the painting's horizon sits at mid-height), horizontal FOV as given.
cam_data = bpy.data.cameras.new('cam')
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.sensor_width = 36.0
cam_data.lens = 18.0 / math.tan(math.radians(args.hfov) / 2)
cam_data.clip_end = 200
cam = bpy.data.objects.new('cam', cam_data)
cam.location = (0.0, 0.0, args.eye)
cam.rotation_euler = (math.pi / 2, 0.0, 0.0)   # look down +Y, Z up
scene.collection.objects.link(cam)
scene.camera = cam
f_px = (W / 2) / math.tan(math.radians(args.hfov) / 2)


def ray(px, py):
    """Camera ray direction for a plate pixel (fractions)."""
    return Vector(((px * W - W / 2) / f_px, 1.0, -(py * H - H / 2) / f_px)).normalized()


def on_floor(px, py):
    d = ray(px, py)
    t = -args.eye / d.z
    return cam.location + d * t


def on_wall(px, py, x_wall):
    d = ray(px, py)
    t = x_wall / d.x
    return cam.location + d * t


# Room proportions: the ring's centre fixes the depth scale, the wall bases fix the width.
ring = S['ring']
ring_c = on_floor(ring['cx'], ring['cy'])
ring_r = (on_floor(ring['cx'] + ring['rx'], ring['cy']) - ring_c).length
X_WALL = 3.5 * ring_r / 2.75
Z_VAULT = 2.9 * args.eye
Y_BACK = ring_c.y * 3.2

# Material: the painting projected from the camera (Window coordinates), on rough stone.
plate_img = bpy.data.images.load(args.plate)
mat = bpy.data.materials.new('painting')
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out_n = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = plate_img
tex.extension = 'EXTEND'
coord = nt.nodes.new('ShaderNodeTexCoord')
nt.links.new(coord.outputs['Window'], tex.inputs['Vector'])
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.72
bsdf.inputs['Specular IOR Level'].default_value = 0.35
# The painting's own luminance as bump, so the light rakes across the slabs.
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.35
bump.inputs['Distance'].default_value = 0.08
nt.links.new(tex.outputs['Color'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
nt.links.new(bsdf.outputs['BSDF'], out_n.inputs['Surface'])


def quad(name, verts):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], [(0, 1, 2, 3)])
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    return ob


Y0 = 0.05
# The room is a box with chamfered corners: a wall meeting the floor at a hard 90 degrees leaves a
# straight shading seam that the painting's rubble-strewn wall bases do not have.
C = 0.45 * ring_r / 2.75
quad('floor', [(-X_WALL + C, Y0, 0), (X_WALL - C, Y0, 0), (X_WALL - C, Y_BACK, 0), (-X_WALL + C, Y_BACK, 0)])
quad('skirt_l', [(-X_WALL + C, Y0, 0), (-X_WALL + C, Y_BACK, 0), (-X_WALL, Y_BACK, C), (-X_WALL, Y0, C)])
quad('skirt_r', [(X_WALL - C, Y0, 0), (X_WALL, Y0, C), (X_WALL, Y_BACK, C), (X_WALL - C, Y_BACK, 0)])
quad('wall_l', [(-X_WALL, Y0, C), (-X_WALL, Y_BACK, C), (-X_WALL, Y_BACK, Z_VAULT - C), (-X_WALL, Y0, Z_VAULT - C)])
quad('wall_r', [(X_WALL, Y0, C), (X_WALL, Y0, Z_VAULT - C), (X_WALL, Y_BACK, Z_VAULT - C), (X_WALL, Y_BACK, C)])
quad('cove_l', [(-X_WALL, Y0, Z_VAULT - C), (-X_WALL, Y_BACK, Z_VAULT - C), (-X_WALL + C, Y_BACK, Z_VAULT), (-X_WALL + C, Y0, Z_VAULT)])
quad('cove_r', [(X_WALL, Y0, Z_VAULT - C), (X_WALL - C, Y0, Z_VAULT), (X_WALL - C, Y_BACK, Z_VAULT), (X_WALL, Y_BACK, Z_VAULT - C)])
quad('vault', [(-X_WALL + C, Y0, Z_VAULT), (X_WALL - C, Y0, Z_VAULT), (X_WALL - C, Y_BACK, Z_VAULT), (-X_WALL + C, Y_BACK, Z_VAULT)])
quad('back', [(-X_WALL, Y_BACK, 0), (X_WALL, Y_BACK, 0), (X_WALL, Y_BACK, Z_VAULT), (-X_WALL, Y_BACK, Z_VAULT)])

# Light groups
vl = scene.view_layers[0]
for name in ('ring', 'torches_l', 'torches_r'):
    vl.lightgroups.add(name=name)


def point_light(name, loc, color, power, radius, group):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.color = color
    ld.energy = power
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.lightgroup = group
    scene.collection.objects.link(ob)
    return ob


# The ring: a low, wide violet light hovering over the circle, so the glow spreads across the
# slabs and climbs the lower walls; a dimmer core light lifts the centre.
scale = ring_r / 2.75
point_light('ring', ring_c + Vector((0, 0, 0.9 * scale)), (0.62, 0.50, 1.0), 200 * scale * scale, 2.4 * scale, 'ring')
point_light('ring_core', ring_c + Vector((0, 0, 0.25 * scale)), (0.72, 0.62, 1.0), 40 * scale * scale, 1.2 * scale, 'ring')

# Torches: on the walls where the painting shows them, warm, brighter when nearer.
for i, t in enumerate(S['torches']):
    x_wall = -X_WALL if t['side'] == 'left' else X_WALL
    loc = on_wall(t['x'], t['y'], x_wall)
    loc.x -= 0.25 * scale if t['side'] == 'left' else -0.25 * scale   # stand off the wall
    power = {'near': 1900, 'mid': 1300, 'far': 900}[t['depth']] * scale * scale
    point_light(f'torch_{i}', loc, (1.0, 0.62, 0.30), power, 0.35 * scale, 'torches_l' if t['side'] == 'left' else 'torches_r')

# World: black. Only the grouped lights count.
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
scene.world = world

# Compositor: one file per light group.
scene.use_nodes = True
ct = scene.node_tree
for n in list(ct.nodes):
    ct.nodes.remove(n)
rl = ct.nodes.new('CompositorNodeRLayers')
fo = ct.nodes.new('CompositorNodeOutputFile')
fo.base_path = args.out
fo.format.file_format = 'PNG'
fo.format.color_mode = 'RGB'
fo.format.color_depth = '8'
fo.file_slots.clear()
for name in ('ring', 'torches_l', 'torches_r'):
    slot = fo.file_slots.new(f'{args.prefix}-light-{name}-')
    ct.links.new(rl.outputs[f'Combined_{name}'], fo.inputs[len(fo.inputs) - 1])
comp = ct.nodes.new('CompositorNodeComposite')
ct.links.new(rl.outputs['Image'], comp.inputs['Image'])
scene.render.filepath = os.path.join(args.out, 'combined')
scene.frame_set(1)
bpy.ops.render.render(write_still=True)
# File Output appends the frame number; give the files their final names.
for name in ('ring', 'torches_l', 'torches_r'):
    src = os.path.join(args.out, f'{args.prefix}-light-{name}-0001.png')
    dst = os.path.join(args.out, f'{args.prefix}-light-{name}.png')
    if os.path.exists(dst):
        os.remove(dst)
    os.rename(src, dst)
print('RELIT', json.dumps({'ring_c': list(ring_c), 'ring_r': ring_r, 'x_wall': X_WALL, 'z_vault': Z_VAULT, 'y_back': Y_BACK}))
