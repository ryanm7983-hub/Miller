extends TestCase
## Covers chunk construction and the streaming manager.
##
## Streaming bugs are the expensive kind: a chunk that never unloads leaks a few
## megabytes every sixty-four metres the player walks, and a ring calculation
## that is off by one silently doubles the number of full-detail chunks.

const SEED := 424242

var _generator: WorldGenerator
var _manager: ChunkManager
var _tracker: Node3D


func before_all() -> void:
	AssetFoundry.warm_up_blocking()
	_generator = WorldGenerator.new(SEED)
	_generator.build()


func before_each() -> void:
	_tracker = Node3D.new()
	tree.root.add_child(_tracker)
	_tracker.global_position = _generator.spawn_point()

	_manager = ChunkManager.new()
	tree.root.add_child(_manager)
	_manager.setup(_generator, _tracker)


func after_each() -> void:
	if is_instance_valid(_manager):
		_manager.free()
	if is_instance_valid(_tracker):
		_tracker.free()


# ---------------------------------------------------------------------------
# Chunk contents
# ---------------------------------------------------------------------------

func test_chunk_builds_ground_geometry() -> void:
	var chunk := _build_chunk(Vector2i(0, 0), 0)
	var ground := _find_child_of_type(chunk, "MeshInstance3D") as MeshInstance3D
	assert_not_null(ground, "chunk has no ground mesh")
	if ground == null:
		chunk.free()
		return
	var arrays := ground.mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	assert_true(verts.size() > 100, "ground mesh has only %d vertices" % verts.size())
	assert_not_null(ground.mesh.surface_get_material(0), "ground mesh has no material")
	chunk.free()


func test_ground_vertices_follow_the_generator() -> void:
	var chunk := _build_chunk(Vector2i(1, -2), 0)
	var ground := _find_child_of_type(chunk, "MeshInstance3D") as MeshInstance3D
	var arrays := ground.mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var checked := 0
	for i in range(0, verts.size(), maxi(1, verts.size() / 40)):
		var local := verts[i]
		var world := chunk.origin + local
		assert_almost(local.y, _generator.height_at(world.x, world.z), 0.05,
				"vertex does not sit on the generated surface")
		checked += 1
	assert_true(checked > 10, "did not sample enough vertices")
	chunk.free()


func test_near_chunks_get_collision_and_far_chunks_do_not() -> void:
	var near := _build_chunk(Vector2i(0, 0), 0)
	assert_not_null(_find_child_of_type(near, "StaticBody3D"), "near chunk has no collision")
	near.free()

	var far := _build_chunk(Vector2i(0, 0), TerrainChunk.COLLISION_RING + 2)
	assert_true(_find_child_of_type(far, "StaticBody3D") == null,
			"far chunk should not build collision")
	far.free()


func test_chunk_detail_falls_off_with_distance() -> void:
	var near := _build_chunk(Vector2i(3, 3), 0)
	var mid := _build_chunk(Vector2i(3, 3), 2)
	var far := _build_chunk(Vector2i(3, 3), 4)
	var near_verts := _ground_vertex_count(near)
	var mid_verts := _ground_vertex_count(mid)
	var far_verts := _ground_vertex_count(far)
	assert_true(mid_verts < near_verts,
			"ring 2 ground (%d) should be cheaper than ring 0 (%d)" % [mid_verts, near_verts])
	assert_true(far_verts < mid_verts,
			"ring 4 ground (%d) should be cheaper than ring 2 (%d)" % [far_verts, mid_verts])
	assert_true(near.instance_count() >= far.instance_count(),
			"distant chunks should not carry more vegetation than near ones")
	near.free()
	mid.free()
	far.free()


func test_chunks_are_reproducible() -> void:
	var first := _build_chunk(Vector2i(-2, 5), 0)
	var second := _build_chunk(Vector2i(-2, 5), 0)
	assert_eq(second.instance_count(), first.instance_count(),
			"rebuilding a chunk produced different vegetation")
	first.free()
	second.free()


func test_vegetation_is_batched_not_per_instance() -> void:
	# The whole point of MultiMesh here: a chunk with hundreds of trees must
	# still only add a handful of nodes.
	var chunk := _build_chunk(Vector2i(0, 1), 0)
	var multimeshes := 0
	for child in chunk.get_children():
		if child is MultiMeshInstance3D:
			multimeshes += 1
	assert_true(multimeshes <= 10, "chunk uses %d MultiMeshInstance3D nodes" % multimeshes)
	if chunk.instance_count() > 0:
		assert_true(multimeshes > 0, "chunk has instances but no MultiMesh")
	chunk.free()


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

func test_priming_fills_the_visible_radius() -> void:
	_manager.prime(_tracker.global_position)
	assert_eq(_manager.pending_count(), 0, "priming left chunks queued")
	# Chebyshev radius r covers (2r+1)^2 chunks.
	var expected_min := 25  # radius 2 (the lowest quality tier) as a floor
	assert_true(_manager.loaded_count() >= expected_min,
			"only %d chunks loaded" % _manager.loaded_count())


func test_walking_loads_ahead_and_unloads_behind() -> void:
	_manager.prime(_tracker.global_position)
	var start_coords := _loaded_coords()

	# Walk eight chunks east, priming at each step the way the game would.
	_tracker.global_position += Vector3(TerrainChunk.CHUNK_SIZE * 8.0, 0, 0)
	_manager.prime(_tracker.global_position)
	var end_coords := _loaded_coords()

	assert_true(end_coords.size() > 0, "no chunks after walking")
	# Chunks that overlap the new radius are legitimately kept; the assertion is
	# that nothing beyond the radius plus its hysteresis survives.
	var centre := Vector2i(int(floor(_tracker.global_position.x / TerrainChunk.CHUNK_SIZE)),
			int(floor(_tracker.global_position.z / TerrainChunk.CHUNK_SIZE)))
	var stragglers := 0
	for coord: Vector2i in end_coords:
		if maxi(absi(coord.x - centre.x), absi(coord.y - centre.y)) > _kept_radius():
			stragglers += 1
	assert_eq(stragglers, 0, "chunks left resident outside the streaming radius")
	var dropped := 0
	for coord in start_coords:
		if not end_coords.has(coord):
			dropped += 1
	assert_true(dropped > 0, "walking 512 m unloaded nothing")
	assert_true(end_coords.size() <= _residency_ceiling(),
			"resident chunk count %d exceeds the ceiling %d"
			% [end_coords.size(), _residency_ceiling()])


func test_chunk_count_is_bounded_after_a_long_walk() -> void:
	# The bound that matters is the streaming radius plus its unload hysteresis;
	# anything above that is a leak, however slow.
	_manager.prime(_tracker.global_position)
	for step in 12:
		_tracker.global_position += Vector3(TerrainChunk.CHUNK_SIZE, 0, TerrainChunk.CHUNK_SIZE * 0.5)
		_manager.prime(_tracker.global_position)
	assert_true(_manager.loaded_count() <= _residency_ceiling(),
			"chunk residency reached %d after a long walk, ceiling is %d"
			% [_manager.loaded_count(), _residency_ceiling()])
	var orphans := 0
	for child in _manager.get_children():
		if child is TerrainChunk:
			orphans += 1
	assert_true(orphans <= _residency_ceiling(),
			"%d chunk nodes are still in the tree" % orphans)


func test_view_distance_setting_changes_residency() -> void:
	_manager.prime(_tracker.global_position)
	var normal := _manager.loaded_count()
	Settings.set_value("view_distance", 0.5)
	_manager.rebuild_all()
	_manager.prime(_tracker.global_position)
	var reduced := _manager.loaded_count()
	Settings.set_value("view_distance", 1.0)
	assert_true(reduced < normal,
			"halving view distance kept %d of %d chunks" % [reduced, normal])


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

func _build_chunk(coord: Vector2i, ring: int) -> TerrainChunk:
	var chunk := TerrainChunk.new()
	chunk.configure(_generator, coord, ring)
	tree.root.add_child(chunk)
	chunk.build()
	return chunk


func _ground_vertex_count(chunk: TerrainChunk) -> int:
	var ground := _find_child_of_type(chunk, "MeshInstance3D") as MeshInstance3D
	if ground == null or ground.mesh == null:
		return 0
	return (ground.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()


func _find_child_of_type(node: Node, type_name: String) -> Node:
	for child in node.get_children():
		if child.is_class(type_name):
			return child
	return null


## Streaming radius plus the extra rings kept as unload hysteresis.
func _kept_radius() -> int:
	var radius: int = int(PerformanceDirector.get_budget("stream_radius", 4))
	radius = int(round(float(radius) * float(Settings.get_value("view_distance"))))
	return clampi(radius, 2, 7) + ChunkManager.UNLOAD_MARGIN


## Largest legitimate resident-chunk count.
func _residency_ceiling() -> int:
	var radius := _kept_radius()
	return (2 * radius + 1) * (2 * radius + 1)


func _loaded_coords() -> Array:
	var coords: Array = []
	for child in _manager.get_children():
		if child is TerrainChunk:
			coords.append(child.coord)
	return coords


# ---------------------------------------------------------------------------
# Collision
#
# Reported from a real session: "I fall through the ground every time I load
# in." The terrain collider was built by handing the ground mesh's winding
# straight to `ConcavePolygonShape3D`, which takes the opposite winding to the
# renderer for the same facing. The shape existed, sat at the right position,
# held the right number of triangles and raised no error — its front faces
# simply pointed downwards, and Godot culls backfaces in collision, so
# everything fell through a world that looked completely solid.
#
# The lesson for these tests: asserting that a collider *exists* proves nothing.
# The only thing that proves ground is ground is a physics query hitting it.
# ---------------------------------------------------------------------------

func test_terrain_is_solid_from_above() -> void:
	var spawn := _generator.spawn_point()
	var manager := ChunkManager.new()
	var tracker := Node3D.new()
	tree.root.add_child(tracker)
	tracker.global_position = spawn
	tree.root.add_child(manager)
	manager.setup(_generator, tracker)
	manager.prime(spawn)
	await tree.physics_frame
	await tree.physics_frame

	var space := tree.root.world_3d.direct_space_state
	# The spawn itself, plus points spread across neighbouring chunks so a single
	# lucky triangle cannot carry the test.
	var samples: Array[Vector2] = [Vector2(spawn.x, spawn.z)]
	for i in 12:
		var angle := float(i) * 0.9
		var radius := 12.0 + float(i) * 9.0
		samples.append(Vector2(spawn.x + cos(angle) * radius, spawn.z + sin(angle) * radius))

	for point: Vector2 in samples:
		var expected := _generator.height_at(point.x, point.y)
		var query := PhysicsRayQueryParameters3D.create(
				Vector3(point.x, expected + 60.0, point.y),
				Vector3(point.x, expected - 60.0, point.y))
		query.collision_mask = 1
		var hit := space.intersect_ray(query)
		assert_false(hit.is_empty(),
				"nothing to stand on at (%.0f, %.0f) — a ray straight down passed "
				% [point.x, point.y] + "through terrain that renders as solid")
		if not hit.is_empty():
			# Collision is a coarser grid than the visible mesh, so it is allowed
			# to differ — but only by a step of that grid, not by a storey.
			var surface: float = (hit["position"] as Vector3).y
			assert_true(absf(surface - expected) < 4.0,
					"collision at (%.0f, %.0f) sits %.1f m from the visible ground"
					% [point.x, point.y, surface - expected])

	manager.free()
	tracker.free()


func test_the_spawn_point_has_ground_under_it() -> void:
	# The specific case the player meets first, and the one that was broken.
	var spawn := _generator.spawn_point()
	var manager := ChunkManager.new()
	var tracker := Node3D.new()
	tree.root.add_child(tracker)
	tracker.global_position = spawn
	tree.root.add_child(manager)
	manager.setup(_generator, tracker)
	manager.prime(spawn)
	await tree.physics_frame
	await tree.physics_frame

	var query := PhysicsRayQueryParameters3D.create(spawn, spawn + Vector3.DOWN * 400.0)
	query.collision_mask = 1
	var hit := tree.root.world_3d.direct_space_state.intersect_ray(query)
	assert_false(hit.is_empty(), "the player spawns over a hole")
	if not hit.is_empty():
		var drop: float = spawn.y - (hit["position"] as Vector3).y
		assert_true(drop < 6.0,
				"the spawn point is %.1f m above the ground it lands on" % drop)

	manager.free()
	tracker.free()
