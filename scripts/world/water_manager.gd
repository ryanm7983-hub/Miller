class_name WaterManager
extends Node3D
## Rivers, lakes and waterfalls.
##
## Water is deliberately *not* streamed with the terrain chunks. A per-chunk
## water plane can only ever be flat, which is wrong for a river running down a
## hillside: the seams between chunks become visible steps. Instead each river
## is built once as a continuous ribbon that follows its own carved bed, and
## lakes are discs. The whole basin's water is a few thousand triangles, which
## is cheaper than the per-chunk approach would have been anyway.
##
## Waterfalls are detected rather than authored: wherever a river's surface
## drops sharply between samples, this places mist and a loud water emitter.

const RIVER_DEPTH := 1.15         ## how far the surface sits above the carved bed
const WATERFALL_DROP := 2.4       ## metres of fall per step that counts as a fall
const LAKE_SEGMENTS := 28

var _generator: WorldGenerator
var _waterfalls: Array[Vector3] = []
var _emitters: Array[AudioStreamPlayer3D] = []
var _river_surfaces: Array[MeshInstance3D] = []


func build(generator: WorldGenerator) -> void:
	_generator = generator
	for river: Dictionary in generator.rivers():
		_build_river(river["path"], float(river["width"]))
	for lake: Dictionary in generator.lakes():
		_build_lake(lake)
	_build_waterfall_effects()
	Log.info("water", "%d rivers, %d lakes, %d waterfalls"
			% [generator.rivers().size(), generator.lakes().size(), _waterfalls.size()])


func waterfalls() -> Array[Vector3]:
	return _waterfalls


## True when the point is over open water — used by the player for wading and
## by the AI to avoid drowning itself.
func is_water(world_position: Vector3) -> bool:
	if _generator == null:
		return false
	return world_position.y < _generator.water_level_at(world_position.x, world_position.z)


# ---------------------------------------------------------------------------

func _build_river(path: PackedVector2Array, width: float) -> void:
	if path.size() < 3:
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	var surface_heights := PackedFloat32Array()
	surface_heights.resize(path.size())
	for i in path.size():
		var p := path[i]
		surface_heights[i] = _generator.height_at(p.x, p.y) + RIVER_DEPTH

	var previous_left := Vector3.ZERO
	var previous_right := Vector3.ZERO
	var has_previous := false
	for i in path.size():
		var p := path[i]
		# Direction from neighbours so the ribbon is smooth around meanders.
		var ahead: Vector2 = path[mini(i + 1, path.size() - 1)]
		var behind: Vector2 = path[maxi(i - 1, 0)]
		var direction := (ahead - behind)
		if direction.length_squared() < 0.0001:
			direction = Vector2(1, 0)
		direction = direction.normalized()
		var side := Vector2(-direction.y, direction.x)
		# Rivers widen downstream.
		var half := width * lerpf(0.55, 1.0, float(i) / float(path.size() - 1)) * 0.9
		var y := surface_heights[i]
		var left := Vector3(p.x - side.x * half, y, p.y - side.y * half)
		var right := Vector3(p.x + side.x * half, y, p.y + side.y * half)

		if has_previous:
			_quad(st, previous_left, previous_right, right, left)
			if surface_heights[maxi(i - 1, 0)] - y > WATERFALL_DROP:
				_waterfalls.append((left + right) * 0.5)
		previous_left = left
		previous_right = right
		has_previous = true

	st.generate_normals()
	st.index()
	var mesh := st.commit()
	mesh.surface_set_material(0, AssetFoundry.material("water"))
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(instance)
	_river_surfaces.append(instance)


func _build_lake(lake: Dictionary) -> void:
	var centre: Vector2 = lake["centre"]
	var radius: float = float(lake["radius"])
	var level: float = float(lake["level"])
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Irregular outline: a perfect circle of water reads as a bug.
	var rng := RandomNumberGenerator.new()
	rng.seed = int(centre.x * 131.0 + centre.y * 977.0)
	var offsets := PackedFloat32Array()
	for i in LAKE_SEGMENTS:
		offsets.append(rng.randf_range(0.72, 1.15))
	for i in LAKE_SEGMENTS:
		var a0 := TAU * float(i) / float(LAKE_SEGMENTS)
		var a1 := TAU * float(i + 1) / float(LAKE_SEGMENTS)
		var r0 := radius * offsets[i]
		var r1 := radius * offsets[(i + 1) % LAKE_SEGMENTS]
		var p0 := Vector3(centre.x + cos(a0) * r0, level, centre.y + sin(a0) * r0)
		var p1 := Vector3(centre.x + cos(a1) * r1, level, centre.y + sin(a1) * r1)
		var mid := Vector3(centre.x, level, centre.y)
		st.set_color(Color.WHITE)
		st.set_uv(Vector2(0.5, 0.5)); st.add_vertex(mid)
		st.set_uv(Vector2(p0.x, p0.z) * 0.05); st.add_vertex(p0)
		st.set_uv(Vector2(p1.x, p1.z) * 0.05); st.add_vertex(p1)
	st.generate_normals()
	st.index()
	var mesh := st.commit()
	var is_swamp := radius < 40.0
	mesh.surface_set_material(0, AssetFoundry.material("swamp_water" if is_swamp else "water"))
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(instance)


func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> void:
	st.set_color(Color.WHITE)
	st.set_uv(Vector2(a.x, a.z) * 0.1); st.add_vertex(a)
	st.set_uv(Vector2(b.x, b.z) * 0.1); st.add_vertex(b)
	st.set_uv(Vector2(c.x, c.z) * 0.1); st.add_vertex(c)
	st.set_uv(Vector2(a.x, a.z) * 0.1); st.add_vertex(a)
	st.set_uv(Vector2(c.x, c.z) * 0.1); st.add_vertex(c)
	st.set_uv(Vector2(d.x, d.z) * 0.1); st.add_vertex(d)


## Waterfalls get a mist card and a permanently running water emitter. They are
## the loudest thing in the basin, which matters: the AI cannot hear the player
## near one, and neither can the player hear the AI.
func _build_waterfall_effects() -> void:
	# Collapse clusters — one drop produces several consecutive samples.
	var merged: Array[Vector3] = []
	for point in _waterfalls:
		var duplicate := false
		for existing in merged:
			if existing.distance_to(point) < 14.0:
				duplicate = true
				break
		if not duplicate:
			merged.append(point)
	_waterfalls = merged

	for point in _waterfalls:
		var emitter := AudioStreamPlayer3D.new()
		emitter.stream = AudioDirector.stream("bed_water")
		emitter.bus = "Ambience"
		emitter.unit_size = 14.0
		emitter.max_distance = 90.0
		emitter.pitch_scale = 0.78
		emitter.volume_db = -4.0
		emitter.position = point
		emitter.autoplay = true
		add_child(emitter)
		_emitters.append(emitter)

		var mist := MeshInstance3D.new()
		mist.mesh = AssetFoundry.mesh("fog_card")
		mist.position = point + Vector3(0, -1.0, 0)
		mist.scale = Vector3(0.8, 1.1, 0.8)
		mist.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mist)
