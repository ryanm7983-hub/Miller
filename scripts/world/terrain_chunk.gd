class_name TerrainChunk
extends Node3D
## One 64 m tile of the basin: ground mesh, collision, and all its vegetation.
##
## A chunk is built entirely from `WorldGenerator`, so it is reproducible: the
## same coordinate under the same seed always yields the same trees in the same
## places. That is what makes streaming invisible — the player can walk away
## from a clearing and come back to find it unchanged, without any of it having
## been kept in memory.
##
## Detail follows a *ring* index (Chebyshev distance from the player's chunk):
##
##   ring 0-1  full-resolution ground, LOD 0 trees, undergrowth, collision
##   ring 2    half-resolution ground, LOD 1 trees, sparse undergrowth, collision
##   ring 3+   quarter-resolution ground, LOD 2 impostors, no undergrowth
##
## Vegetation is drawn with MultiMeshInstance3D, so a chunk holding two hundred
## trees is still only a handful of draw calls.

const CHUNK_SIZE := 64.0
const COLLISION_RESOLUTION := 16
const COLLISION_RING := 2
const MAX_TREE_COLLIDERS := 96
const TRUNK_RADIUS := 0.34
const TRUNK_HEIGHT := 6.0

var coord: Vector2i = Vector2i.ZERO
var ring: int = 0
var origin: Vector3 = Vector3.ZERO

var _generator: WorldGenerator
var _rng := RandomNumberGenerator.new()
var _ground: MeshInstance3D
var _body: StaticBody3D
var _tree_collider_shape: RID = RID()
var _tree_collider_count := 0
var _instance_total := 0


func configure(generator: WorldGenerator, chunk_coord: Vector2i, chunk_ring: int) -> void:
	_generator = generator
	coord = chunk_coord
	ring = chunk_ring
	origin = Vector3(float(coord.x) * CHUNK_SIZE, 0.0, float(coord.y) * CHUNK_SIZE)
	position = origin
	# Seeded per chunk so content is stable across unload/reload.
	_rng.seed = hash(Vector3i(coord.x, coord.y, _generator.seed_value))
	name = "Chunk_%d_%d" % [coord.x, coord.y]


## Build everything. Called once, immediately after `configure()`.
func build() -> void:
	_build_ground()
	if ring <= COLLISION_RING:
		_build_collision()
	_build_vegetation()
	_build_props()


func instance_count() -> int:
	return _instance_total


# ---------------------------------------------------------------------------
# Ground
# ---------------------------------------------------------------------------

func _ground_resolution() -> int:
	var base: int = int(PerformanceDirector.get_budget("terrain_resolution", 32))
	if ring <= 1:
		return base
	if ring == 2:
		return maxi(8, base / 2)
	return maxi(4, base / 4)


func _build_ground() -> void:
	var resolution := _ground_resolution()
	var step := CHUNK_SIZE / float(resolution)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	# Cache the corner samples: each interior vertex is shared by four quads and
	# `height_at` is the single most-called function in world building.
	var heights := PackedFloat32Array()
	var masks: Array[Color] = []
	heights.resize((resolution + 1) * (resolution + 1))
	masks.resize((resolution + 1) * (resolution + 1))
	for z in resolution + 1:
		for x in resolution + 1:
			var wx := origin.x + float(x) * step
			var wz := origin.z + float(z) * step
			var index := z * (resolution + 1) + x
			heights[index] = _generator.height_at(wx, wz)
			# The mask is the expensive part (four extra height samples for the
			# slope), so distant chunks approximate it from fewer points.
			masks[index] = _generator.surface_mask(wx, wz) if ring <= 2 \
					else Color(0.0, 0.6, 0.0, 0.0)

	for z in resolution:
		for x in resolution:
			var i00 := z * (resolution + 1) + x
			var i10 := i00 + 1
			var i01 := (z + 1) * (resolution + 1) + x
			var i11 := i01 + 1
			var p00 := Vector3(float(x) * step, heights[i00], float(z) * step)
			var p10 := Vector3(float(x + 1) * step, heights[i10], float(z) * step)
			var p01 := Vector3(float(x) * step, heights[i01], float(z + 1) * step)
			var p11 := Vector3(float(x + 1) * step, heights[i11], float(z + 1) * step)
			_emit_vertex(st, p00, masks[i00])
			_emit_vertex(st, p01, masks[i01])
			_emit_vertex(st, p11, masks[i11])
			_emit_vertex(st, p00, masks[i00])
			_emit_vertex(st, p11, masks[i11])
			_emit_vertex(st, p10, masks[i10])

	st.generate_normals()
	st.index()
	var mesh := st.commit()
	mesh.surface_set_material(0, AssetFoundry.material("terrain"))

	_ground = MeshInstance3D.new()
	_ground.mesh = mesh
	_ground.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if ring > 1 \
			else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(_ground)


func _emit_vertex(st: SurfaceTool, point: Vector3, mask: Color) -> void:
	st.set_color(mask)
	st.set_uv(Vector2(point.x, point.z) / CHUNK_SIZE)
	st.add_vertex(point)


func _build_collision() -> void:
	_body = StaticBody3D.new()
	_body.collision_layer = 1  # terrain
	_body.collision_mask = 0
	add_child(_body)

	var step := CHUNK_SIZE / float(COLLISION_RESOLUTION)
	var faces := PackedVector3Array()
	faces.resize(COLLISION_RESOLUTION * COLLISION_RESOLUTION * 6)
	var cursor := 0
	for z in COLLISION_RESOLUTION:
		for x in COLLISION_RESOLUTION:
			var x0 := float(x) * step
			var z0 := float(z) * step
			var x1 := x0 + step
			var z1 := z0 + step
			var p00 := Vector3(x0, _generator.height_at(origin.x + x0, origin.z + z0), z0)
			var p10 := Vector3(x1, _generator.height_at(origin.x + x1, origin.z + z0), z0)
			var p01 := Vector3(x0, _generator.height_at(origin.x + x0, origin.z + z1), z1)
			var p11 := Vector3(x1, _generator.height_at(origin.x + x1, origin.z + z1), z1)
			# Wound opposite to the visual mesh above, which is not a mistake:
			# `ConcavePolygonShape3D` takes the reverse winding to the renderer
			# for the same facing. Emitting the render order here produces a
			# surface whose front faces point *down*, and Godot culls backfaces
			# in collision — so the ground looks solid, reports a valid shape
			# with the right vertex count in the right place, and everything
			# falls straight through it.
			faces[cursor] = p00; faces[cursor + 1] = p11; faces[cursor + 2] = p01
			faces[cursor + 3] = p00; faces[cursor + 4] = p10; faces[cursor + 5] = p11
			cursor += 6

	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	var collider := CollisionShape3D.new()
	collider.shape = shape
	_body.add_child(collider)


# ---------------------------------------------------------------------------
# Vegetation
# ---------------------------------------------------------------------------

func _tree_lod() -> int:
	if ring <= 1:
		return 0
	if ring == 2:
		return 1
	return 2


func _build_vegetation() -> void:
	var density_scale: float = float(PerformanceDirector.get_budget("tree_density", 1.0))
	var detail_scale: float = float(PerformanceDirector.get_budget("detail_density", 1.0))
	var lod := _tree_lod()

	# Two pine variants per chunk keeps the silhouette varied while holding the
	# chunk to two tree draw calls.
	var variant_a := _rng.randi() % AssetFoundry.PINE_VARIANTS
	var variant_b := (variant_a + 1 + _rng.randi() % (AssetFoundry.PINE_VARIANTS - 1)) \
			% AssetFoundry.PINE_VARIANTS

	var transforms_a: Array[Transform3D] = []
	var transforms_b: Array[Transform3D] = []
	var dead_transforms: Array[Transform3D] = []
	var trunk_points: Array[Vector3] = []

	# Jittered grid sampling: a uniform random scatter clumps badly at these
	# densities and leaves visible holes.
	var cell := 4.0
	var cells := int(CHUNK_SIZE / cell)
	for cz in cells:
		for cx in cells:
			var lx := (float(cx) + _rng.randf()) * cell
			var lz := (float(cz) + _rng.randf()) * cell
			var wx := origin.x + lx
			var wz := origin.z + lz
			var density := _generator.tree_density_at(wx, wz)
			if density <= 0.0:
				continue
			if _rng.randf() > density * cell * cell * density_scale:
				continue
			var height := _generator.height_at(wx, wz)
			if height < _generator.water_level_at(wx, wz) + 0.3:
				continue
			var scale := _rng.randf_range(0.72, 1.28)
			var basis := Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3.ONE * scale)
			var xform := Transform3D(basis, Vector3(lx, height, lz))
			var biome := _generator.biome_at(wx, wz)
			if biome == WorldGenerator.Biome.BURN_SCAR and _rng.randf() < 0.75:
				dead_transforms.append(xform)
			elif _rng.randf() < 0.5:
				transforms_a.append(xform)
			else:
				transforms_b.append(xform)
			if ring <= 1 and trunk_points.size() < MAX_TREE_COLLIDERS:
				trunk_points.append(Vector3(lx, height, lz) * 1.0)

	_add_multimesh(AssetFoundry.pine(variant_a, lod), transforms_a, ring <= 1)
	_add_multimesh(AssetFoundry.pine(variant_b, lod), transforms_b, ring <= 1)
	_add_multimesh(AssetFoundry.mesh("dead_tree_%d" % (_rng.randi() % 3)), dead_transforms, ring <= 1)

	if ring <= 1:
		_build_tree_collision(trunk_points)

	if ring > 2 or detail_scale <= 0.01:
		return
	_build_undergrowth(detail_scale)


func _build_undergrowth(detail_scale: float) -> void:
	var grass_enabled: bool = bool(PerformanceDirector.get_budget("grass_enabled", true))
	var bushes: Array[Transform3D] = []
	var ferns: Array[Transform3D] = []
	var grass: Array[Transform3D] = []

	var cell := 2.6
	var cells := int(CHUNK_SIZE / cell)
	for cz in cells:
		for cx in cells:
			var lx := (float(cx) + _rng.randf()) * cell
			var lz := (float(cz) + _rng.randf()) * cell
			var wx := origin.x + lx
			var wz := origin.z + lz
			var biome := _generator.biome_at(wx, wz)
			var height := _generator.height_at(wx, wz)
			if height < _generator.water_level_at(wx, wz) + 0.15:
				continue
			if _generator.slope_at(wx, wz) > 0.45:
				continue
			if _generator.road_influence_at(wx, wz) > 0.5:
				continue
			var chance := 0.0
			match biome:
				WorldGenerator.Biome.DENSE_WOODS: chance = 0.55
				WorldGenerator.Biome.PINE_WOODS: chance = 0.40
				WorldGenerator.Biome.MEADOW: chance = 0.62
				WorldGenerator.Biome.SWAMP: chance = 0.48
				WorldGenerator.Biome.SHORE: chance = 0.25
				WorldGenerator.Biome.BURN_SCAR: chance = 0.18
				_: chance = 0.05
			if _rng.randf() > chance * detail_scale:
				continue
			var basis := Basis(Vector3.UP, _rng.randf() * TAU) \
					.scaled(Vector3.ONE * _rng.randf_range(0.7, 1.4))
			var xform := Transform3D(basis, Vector3(lx, height, lz))
			var roll := _rng.randf()
			if biome == WorldGenerator.Biome.MEADOW or biome == WorldGenerator.Biome.SHORE:
				if grass_enabled:
					grass.append(xform)
			elif roll < 0.42:
				bushes.append(xform)
			elif roll < 0.78:
				ferns.append(xform)
			elif grass_enabled:
				grass.append(xform)

	_add_multimesh(AssetFoundry.mesh("bush_%d" % (_rng.randi() % AssetFoundry.BUSH_VARIANTS)), bushes, false)
	_add_multimesh(AssetFoundry.mesh("fern_%d" % (_rng.randi() % AssetFoundry.BUSH_VARIANTS)), ferns, false)
	_add_multimesh(AssetFoundry.mesh("grass_%d" % (_rng.randi() % 3)), grass, false)


func _build_props() -> void:
	if ring > 2:
		return
	var rocks: Array[Transform3D] = []
	var logs: Array[Transform3D] = []
	var stumps: Array[Transform3D] = []
	var attempts := 26 if ring <= 1 else 12
	for i in attempts:
		var lx := _rng.randf() * CHUNK_SIZE
		var lz := _rng.randf() * CHUNK_SIZE
		var wx := origin.x + lx
		var wz := origin.z + lz
		var height := _generator.height_at(wx, wz)
		if height < _generator.water_level_at(wx, wz):
			continue
		if _generator.road_influence_at(wx, wz) > 0.6:
			continue
		var slope := _generator.slope_at(wx, wz)
		var normal := _generator.normal_at(wx, wz)
		var yaw := _rng.randf() * TAU
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3.ONE * _rng.randf_range(0.7, 1.5))
		var xform := Transform3D(basis, Vector3(lx, height, lz))
		var roll := _rng.randf()
		if slope > 0.32 or roll < 0.4:
			rocks.append(xform)
		elif roll < 0.72:
			# Fallen timber lies along the slope rather than floating on it.
			var forward := Vector3(cos(yaw), 0, sin(yaw))
			var right := forward.cross(normal).normalized()
			var aligned := Basis(right, normal, right.cross(normal).normalized())
			logs.append(Transform3D(aligned, Vector3(lx, height, lz)))
		else:
			stumps.append(xform)

	var rock_key := "rock_%d" % (_rng.randi() % AssetFoundry.ROCK_VARIANTS) if ring <= 1 \
			else "rock_lod_%d" % (_rng.randi() % AssetFoundry.ROCK_VARIANTS)
	_add_multimesh(AssetFoundry.mesh(rock_key), rocks, false)
	_add_multimesh(AssetFoundry.mesh("log_%d" % (_rng.randi() % 3)), logs, false)
	_add_multimesh(AssetFoundry.mesh("stump_%d" % (_rng.randi() % 3)), stumps, false)


func _add_multimesh(mesh: Mesh, transforms: Array[Transform3D], casts_shadow: bool) -> void:
	if mesh == null or transforms.is_empty():
		return
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = mesh
	multimesh.instance_count = transforms.size()
	for i in transforms.size():
		multimesh.set_instance_transform(i, transforms[i])
	var instance := MultiMeshInstance3D.new()
	instance.multimesh = multimesh
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if casts_shadow \
			else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# A generous AABB stops the whole batch popping when its origin leaves the
	# frustum; MultiMesh bounds are computed from instance transforms only.
	instance.custom_aabb = AABB(Vector3(-8, -20, -8), Vector3(CHUNK_SIZE + 16, 90, CHUNK_SIZE + 16))
	add_child(instance)
	_instance_total += transforms.size()


## Trunk colliders are added straight to the physics server rather than as
## CollisionShape3D nodes: a hundred nodes per chunk costs far more in tree
## overhead than the shapes themselves cost in the broadphase.
func _build_tree_collision(points: Array[Vector3]) -> void:
	if points.is_empty():
		return
	if _body == null:
		_body = StaticBody3D.new()
		_body.collision_layer = 2  # static_world
		_body.collision_mask = 0
		add_child(_body)
	_tree_collider_shape = PhysicsServer3D.cylinder_shape_create()
	PhysicsServer3D.shape_set_data(_tree_collider_shape,
			{"radius": TRUNK_RADIUS, "height": TRUNK_HEIGHT})
	for point in points:
		var xform := Transform3D(Basis.IDENTITY, point + Vector3(0, TRUNK_HEIGHT * 0.5, 0))
		PhysicsServer3D.body_add_shape(_body.get_rid(), _tree_collider_shape, xform)
	_tree_collider_count = points.size()


func _exit_tree() -> void:
	# Shapes created directly on the server are not owned by any node, so they
	# have to be released by hand or the RIDs leak for the session.
	if _tree_collider_shape.is_valid():
		PhysicsServer3D.free_rid(_tree_collider_shape)
		_tree_collider_shape = RID()
