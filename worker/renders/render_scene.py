"""usage: render.py out.png hdri model rot_deg cam_h dist sofa_yaw focal W H samples [lookx] [sofa_x] [sofa_y] [look_z]"""
import sys,math,bpy
a=sys.argv[1:]; out,hdri,model=a[0],a[1],a[2]
rot,cam_h,dist,yaw,focal=map(float,a[3:8]); W,H,spp=map(int,a[8:11])
look_x=float(a[11]) if len(a)>11 else 0; sx=float(a[12]) if len(a)>12 else 0; sy=float(a[13]) if len(a)>13 else 0; look_z=float(a[14]) if len(a)>14 else 0.55
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; sc.render.engine='CYCLES'
try:
    p=bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type='METAL'; p.get_devices()
    for d in p.devices: d.use=True
    sc.cycles.device='GPU'
except Exception as e: print('cpu',e)
sc.cycles.samples=spp; sc.cycles.use_denoising=True
sc.render.resolution_x,sc.render.resolution_y=W,H; sc.render.filepath=out
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; n=w.node_tree
e=n.nodes.new('ShaderNodeTexEnvironment'); e.image=bpy.data.images.load(hdri)
m=n.nodes.new('ShaderNodeMapping'); t=n.nodes.new('ShaderNodeTexCoord'); m.inputs['Rotation'].default_value[2]=math.radians(rot)
n.links.new(t.outputs['Generated'],m.inputs['Vector']); n.links.new(m.outputs[0],e.inputs[0]); n.links.new(e.outputs[0],n.nodes['Background'].inputs[0])
has_model=model!='none'
if has_model: bpy.ops.import_scene.gltf(filepath=model)
objs=[o for o in bpy.context.selected_objects] if has_model else []
meshes=[o for o in objs if o.type=='MESH']
root=bpy.data.objects.new('root',None); sc.collection.objects.link(root)
bpy.context.view_layer.update()
from mathutils import Vector
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box] or [Vector((0,0,0))]
mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts))); mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
print('DIMS',mx-mn)
for o in objs:
    if o.parent is None: o.parent=root
    if o.parent is root: o.location-=Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
root.location=(sx,dist+sy,0); root.rotation_euler=(0,0,math.radians(yaw))
import os
if os.environ.get('SUN'):
    az,el,st=map(float,os.environ['SUN'].split(','))
    l=bpy.data.lights.new('sun','SUN'); l.energy=st; l.angle=math.radians(18)
    lo=bpy.data.objects.new('sun',l); sc.collection.objects.link(lo)
    lo.rotation_euler=(math.radians(90-el),0,math.radians(az))
bpy.ops.mesh.primitive_plane_add(size=40,location=(0,0,0)); fl=bpy.context.object; fl.is_shadow_catcher=True
c=bpy.data.cameras.new('c'); c.lens=focal; c.sensor_width=36
co=bpy.data.objects.new('c',c); sc.collection.objects.link(co); sc.camera=co
co.location=(0,0,cam_h); d=Vector((look_x,dist,look_z))-co.location; co.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
if os.environ.get('LAYER')=='object':
    sc.render.film_transparent=True; sc.render.image_settings.color_mode='RGBA'
if os.environ.get('LAYER')=='room':
    fl.hide_render=True; root.hide_render=True
    for o in objs: o.hide_render=True
bpy.ops.render.render(write_still=True)
