extends TestCase
## Covers the procedural art and audio pipeline.
##
## These are the tests that catch the failure mode this project is most exposed
## to: a mesh or sound builder that silently produces an empty resource. A tree
## with zero surfaces still "works" — it just renders nothing, everywhere.


func before_all() -> void:
	AssetFoundry.warm_up_blocking()
	AudioDirector.warm_up_blocking()


func test_foundry_reports_ready() -> void:
	assert_true(AssetFoundry.is_ready, "foundry should be ready after warm-up")
	assert_true(AudioDirector.is_ready, "audio library should be ready after warm-up")


func test_every_pine_lod_has_geometry() -> void:
	for variant in AssetFoundry.PINE_VARIANTS:
		for lod in AssetFoundry.LOD_COUNT:
			var mesh := AssetFoundry.pine(variant, lod)
			assert_not_null(mesh, "pine %d lod %d missing" % [variant, lod])
			if mesh == null:
				continue
			assert_true(mesh.get_surface_count() >= 1,
					"pine %d lod %d has no surfaces" % [variant, lod])
			var arrays := mesh.surface_get_arrays(0)
			var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			assert_true(verts.size() > 6, "pine %d lod %d has %d vertices" % [variant, lod, verts.size()])


func test_pine_lods_reduce_triangle_count() -> void:
	# The whole point of the LOD chain is that it gets cheaper. If a refactor
	# inverts this, distant forest cost silently explodes.
	for variant in AssetFoundry.PINE_VARIANTS:
		var counts: Array[int] = []
		for lod in AssetFoundry.LOD_COUNT:
			counts.append(_vertex_count(AssetFoundry.pine(variant, lod)))
		assert_true(counts[1] < counts[0],
				"variant %d: lod1 (%d) should be cheaper than lod0 (%d)" % [variant, counts[1], counts[0]])
		assert_true(counts[2] < counts[1],
				"variant %d: lod2 (%d) should be cheaper than lod1 (%d)" % [variant, counts[2], counts[1]])


func test_meshes_have_normals_and_uvs() -> void:
	for key in ["rock_0", "crate", "barrel", "door", "fence", "antenna", "listening_post",
			"body_deer", "body_crow", "torso_tall", "head"]:
		var mesh := AssetFoundry.mesh(key)
		assert_not_null(mesh, "mesh '%s' missing" % key)
		if mesh == null:
			continue
		var arrays := mesh.surface_get_arrays(0)
		var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var uvs: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
		assert_true(normals.size() > 0, "mesh '%s' has no normals" % key)
		assert_true(uvs.size() > 0, "mesh '%s' has no UVs" % key)


func test_generated_textures_are_non_degenerate() -> void:
	for key in ["grass_detail", "dirt_detail", "rock_detail", "bark_detail", "needles",
			"leaves", "fog_puff", "water_normal", "rain_streaks", "light_cookie", "paper"]:
		var tex := AssetFoundry.texture(key)
		assert_not_null(tex, "texture '%s' missing" % key)
		if tex == null:
			continue
		assert_true(tex.get_width() >= 32 and tex.get_height() >= 32,
				"texture '%s' is %dx%d" % [key, tex.get_width(), tex.get_height()])
		# A constant image means the generator silently produced nothing useful.
		var image := tex.get_image()
		assert_true(_image_has_variation(image), "texture '%s' is a flat fill" % key)


func test_materials_exist_and_are_shared() -> void:
	for key in ["terrain", "foliage", "undergrowth", "bark", "planks", "stone", "water",
			"fog_card", "rain", "figure", "glass", "fur_deer"]:
		assert_not_null(AssetFoundry.material(key), "material '%s' missing" % key)
	# Shared instances matter: a per-tree material would defeat MultiMesh batching.
	assert_true(AssetFoundry.material("foliage") == AssetFoundry.material("foliage"),
			"materials must be shared instances")


func test_wind_uniforms_propagate() -> void:
	AssetFoundry.set_wind(Vector3(0.6, 0.0, -0.8), 1.7, 2.2)
	var foliage := AssetFoundry.material("foliage") as ShaderMaterial
	assert_not_null(foliage)
	var strength: float = foliage.get_shader_parameter("wind_strength")
	assert_almost(strength, 1.7, 0.0001, "wind strength should reach the material")
	var direction: Vector2 = foliage.get_shader_parameter("wind_direction")
	assert_almost(direction.length(), 1.0, 0.001, "wind direction should be normalised")


func test_wetness_uniform_propagates() -> void:
	AssetFoundry.set_wetness(0.8)
	var terrain := AssetFoundry.material("terrain") as ShaderMaterial
	assert_almost(float(terrain.get_shader_parameter("wetness")), 0.8, 0.0001)
	AssetFoundry.set_wetness(0.0)


func test_audio_library_covers_every_referenced_key() -> void:
	var required := [
		"bed_wind", "bed_rain_light", "bed_rain_heavy",
		"bed_water", "bed_insects", "bed_drone", "bed_drone_wrong", "bed_room",
		"thunder_near", "thunder_far", "static", "whisper_0", "whisper_close",
		"stinger_soft", "stinger_hard", "heartbeat_slow", "heartbeat_fast",
		"owl_0", "crow_0", "deer_0", "scurry_0", "flap_small", "flap_large",
		"ui_move", "ui_confirm", "ui_back", "ui_deny",
		"music_calm", "music_unease", "music_dread", "music_chase",
	]
	for key in required:
		assert_true(AudioDirector.has(key), "sound '%s' missing from library" % key)
	for surface in ["loam", "gravel", "wood", "stone", "water", "metal", "moss"]:
		for v in AudioDirector.FOOTSTEP_VARIANTS:
			assert_true(AudioDirector.has("step_%s_%d" % [surface, v]),
					"footstep variant step_%s_%d missing" % [surface, v])


func test_generated_audio_is_audible_and_bounded() -> void:
	for key in ["bed_wind", "step_gravel_0", "thunder_near", "whisper_0", "music_dread"]:
		var stream := AudioDirector.stream(key) as AudioStreamWAV
		assert_not_null(stream, "stream '%s' missing" % key)
		if stream == null:
			continue
		assert_true(stream.data.size() > 1000, "stream '%s' is suspiciously short" % key)
		var stats := _pcm_stats(stream)
		assert_true(stats["peak"] > 0.02, "stream '%s' is effectively silent" % key)
		assert_true(stats["peak"] <= 1.0, "stream '%s' clips (peak %f)" % [key, stats["peak"]])
		assert_true(stats["rms"] > 0.001, "stream '%s' has no energy" % key)


func test_looping_beds_are_marked_as_loops() -> void:
	for key in ["bed_wind", "bed_rain_heavy", "bed_water", "bed_insects", "bed_drone",
			"music_calm", "music_chase"]:
		var stream := AudioDirector.stream(key) as AudioStreamWAV
		assert_eq(stream.loop_mode, AudioStreamWAV.LOOP_FORWARD, "'%s' should loop" % key)


func test_one_shots_do_not_loop() -> void:
	for key in ["step_loam_0", "thunder_far", "owl_0", "stinger_hard", "ui_confirm"]:
		var stream := AudioDirector.stream(key) as AudioStreamWAV
		assert_eq(stream.loop_mode, AudioStreamWAV.LOOP_DISABLED, "'%s' should not loop" % key)


func test_tension_crossfade_always_has_a_voice() -> void:
	# At no point in the tension range should the score go completely silent.
	var t := 0.0
	while t <= 1.0001:
		AudioDirector.set_tension(t)
		var total := 0.0
		for stem in AudioDirector.STEMS:
			total += AudioDirector._stem_targets[stem]
		assert_true(total > 0.15, "tension %.2f leaves the music silent (sum %.3f)" % [t, total])
		t += 0.05


# --- helpers ---------------------------------------------------------------

func _vertex_count(mesh: Mesh) -> int:
	if mesh == null:
		return 0
	var total := 0
	for surface in mesh.get_surface_count():
		var arrays := mesh.surface_get_arrays(surface)
		total += (arrays[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	return total


func _image_has_variation(image: Image) -> bool:
	if image == null:
		return false
	var first := image.get_pixel(0, 0)
	var step := maxi(1, image.get_width() / 16)
	for y in range(0, image.get_height(), step):
		for x in range(0, image.get_width(), step):
			var c := image.get_pixel(x, y)
			var delta := absf(c.r - first.r) + absf(c.g - first.g) \
					+ absf(c.b - first.b) + absf(c.a - first.a)
			if delta > 0.02:
				return true
	return false


func _pcm_stats(stream: AudioStreamWAV) -> Dictionary:
	var data := stream.data
	var frames := data.size() / 2
	var peak := 0.0
	var sum_squares := 0.0
	var step := maxi(1, frames / 4000)
	var counted := 0
	var i := 0
	while i < frames:
		var value := float(data.decode_s16(i * 2)) / 32768.0
		peak = maxf(peak, absf(value))
		sum_squares += value * value
		counted += 1
		i += step
	return {
		"peak": peak,
		"rms": sqrt(sum_squares / maxf(float(counted), 1.0)),
	}


# ---------------------------------------------------------------------------
# Collision winding
# ---------------------------------------------------------------------------

## The asymmetry that cost this project its ground: the vertex order that makes
## a surface render facing up makes it *collide* facing down. Pinned with a
## physics query rather than an assertion about vertex order, because the vertex
## order is only interesting for what the physics server does with it.
func test_collision_faces_are_wound_the_way_physics_reads_them() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# A quad that renders facing upwards, wound exactly as the terrain is.
	var a := Vector3(-5, 0, -5)
	var b := Vector3(-5, 0, 5)
	var c := Vector3(5, 0, 5)
	var d := Vector3(5, 0, -5)
	for point in [a, b, c, a, c, d]:
		st.add_vertex(point)
	st.generate_normals()
	var mesh := st.commit()

	var raw_hits: bool = await _ray_hits_from_above(mesh.get_faces())
	var wound_hits: bool = await _ray_hits_from_above(MeshFactory.collision_faces(mesh))
	assert_false(raw_hits,
			"raw mesh winding already collides from above, so collision_faces() "
			+ "is now flipping correct data")
	assert_true(wound_hits,
			"collision_faces() does not produce a surface you can stand on")


func _ray_hits_from_above(faces: PackedVector3Array) -> bool:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	var collider := CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	tree.root.add_child(body)
	body.global_position = Vector3(0, 0, 0)
	await tree.physics_frame
	await tree.physics_frame
	var query := PhysicsRayQueryParameters3D.create(Vector3(0, 20, 0), Vector3(0, -20, 0))
	query.collision_mask = 1
	var hit := tree.root.world_3d.direct_space_state.intersect_ray(query)
	body.free()
	return not hit.is_empty()
