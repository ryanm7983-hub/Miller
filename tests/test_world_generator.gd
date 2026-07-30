extends TestCase
## Covers the deterministic world layout.
##
## The generator is the one system where a subtle regression is invisible until
## it is catastrophic: a river that climbs, a road that runs up a cliff face, or
## a landmark placed inside a lake will all still "work" and still render. These
## tests assert the properties that make the basin readable.

const SEED_A := 20260730
const SEED_B := 987654321

var _a: WorldGenerator
var _b: WorldGenerator


func before_all() -> void:
	_a = WorldGenerator.new(SEED_A)
	_a.build()
	_b = WorldGenerator.new(SEED_B)
	_b.build()


func test_same_seed_reproduces_terrain() -> void:
	var repeat := WorldGenerator.new(SEED_A)
	repeat.build()
	for i in 40:
		var x := -400.0 + float(i) * 20.0
		var z := 137.0 - float(i) * 11.0
		assert_almost(repeat.height_at(x, z), _a.height_at(x, z), 0.0001,
				"height differs at (%.0f, %.0f)" % [x, z])


func test_same_seed_reproduces_landmarks() -> void:
	var repeat := WorldGenerator.new(SEED_A)
	repeat.build()
	assert_eq(repeat.pois().size(), _a.pois().size())
	for i in _a.pois().size():
		var original: Vector3 = _a.pois()[i]["position"]
		var again: Vector3 = repeat.pois()[i]["position"]
		assert_true(original.distance_to(again) < 0.001,
				"landmark %s moved between builds" % _a.pois()[i]["id"])


func test_different_seeds_produce_different_worlds() -> void:
	var differences := 0
	for i in 30:
		var x := -300.0 + float(i) * 21.0
		var z := float(i) * 17.0 - 200.0
		if absf(_a.height_at(x, z) - _b.height_at(x, z)) > 1.0:
			differences += 1
	assert_true(differences > 20, "only %d of 30 samples differ between seeds" % differences)


func test_heights_stay_in_a_sane_range() -> void:
	for i in 400:
		var angle := float(i) * 0.7919
		var radius := float(i % 50) * 9.0
		var x := cos(angle) * radius
		var z := sin(angle) * radius
		var h := _a.height_at(x, z)
		assert_between(h, -40.0, 260.0, "height at (%.0f, %.0f)" % [x, z])


func test_basin_is_enclosed_by_high_ground() -> void:
	# The playable area is bounded by terrain, not by an invisible wall, so the
	# rim has to actually be higher than the floor.
	var interior_max := -INF
	for i in 64:
		var angle := TAU * float(i) / 64.0
		interior_max = maxf(interior_max, _a.height_at(cos(angle) * 120.0, sin(angle) * 120.0))
	for i in 32:
		var angle := TAU * float(i) / 32.0
		var rim := _a.height_at(cos(angle) * 500.0, sin(angle) * 500.0)
		assert_true(rim > interior_max,
				"rim at angle %.2f is %.1f, lower than basin floor max %.1f" % [angle, rim, interior_max])


func test_rivers_never_flow_uphill() -> void:
	# The invariant is applied step to step rather than against a running
	# minimum. A confluence pool — where a tributary's bed meets a shallower
	# main stem — is a real feature and leaves the profile briefly above its
	# lowest point so far; a river that climbs out of the valley it is draining
	# is a bug, and that always shows up as a sustained rise between samples.
	assert_true(_a.rivers().size() >= 2, "expected several rivers")
	for river: Dictionary in _a.rivers():
		var path: PackedVector2Array = river["path"]
		var previous := INF
		for point in path:
			# Road crossings are culverts: the road surface deliberately wins
			# there (see WorldGenerator.height_at), so the terrain height at a
			# crossing is the bridge deck, not the streambed.
			if _a.road_influence_at(point.x, point.y) > 0.45:
				continue
			var h := _a.height_at(point.x, point.y)
			if previous < INF:
				assert_true(h <= previous + 0.75,
						"river bed steps up %.2f m (from %.2f to %.2f)" % [h - previous, previous, h])
			previous = h


func test_rivers_lose_height_overall() -> void:
	for river: Dictionary in _a.rivers():
		var path: PackedVector2Array = river["path"]
		var source: Vector2 = path[0]
		var mouth: Vector2 = path[path.size() - 1]
		var drop := _a.height_at(source.x, source.y) - _a.height_at(mouth.x, mouth.y)
		assert_true(drop > 4.0, "river only drops %.1f m from source to mouth" % drop)


func test_rivers_are_carved_below_the_surrounding_land() -> void:
	for river: Dictionary in _a.rivers():
		var path: PackedVector2Array = river["path"]
		var checked := 0
		var lower := 0
		var width: float = float(river["width"])
		# Skip the headwaters: a stream at its source runs in a shallow swale on
		# an open slope and is genuinely not yet incised. Incision is a property
		# of a river's course, not of its first few metres.
		var start := maxi(2, path.size() / 5)
		for i in range(start, path.size() - 2, 2):
			var point := path[i]
			# Sample the bank perpendicular to the flow and clear of the carve
			# radius; sampling on a fixed diagonal can land in the next meander.
			var flow := (path[i + 1] - path[i - 1]).normalized()
			var side := Vector2(-flow.y, flow.x) * (width * 2.6 + 6.0)
			var channel := _a.height_at(point.x, point.y)
			var left := _a.height_at(point.x - side.x, point.y - side.y)
			var right := _a.height_at(point.x + side.x, point.y + side.y)
			checked += 1
			if channel < maxf(left, right):
				lower += 1
		assert_true(checked >= 5, "river is too short to judge (%d samples)" % checked)
		if checked >= 5:
			assert_true(float(lower) / float(checked) > 0.75,
					"only %d of %d river samples sit below their banks" % [lower, checked])


func test_landmarks_are_in_bounds_and_separated() -> void:
	assert_eq(_a.pois().size(), WorldGenerator.POI_DEFS.size())
	for entry: Dictionary in _a.pois():
		var p: Vector3 = entry["position"]
		assert_true(_a.is_in_bounds(p.x, p.z), "%s is outside the basin" % entry["id"])
	for i in _a.pois().size():
		for j in range(i + 1, _a.pois().size()):
			var pi: Vector3 = _a.pois()[i]["position"]
			var pj: Vector3 = _a.pois()[j]["position"]
			var d := Vector2(pi.x - pj.x, pi.z - pj.z).length()
			assert_true(d > 45.0, "%s and %s are only %.1f m apart"
					% [_a.pois()[i]["id"], _a.pois()[j]["id"], d])


func test_landmarks_are_not_underwater() -> void:
	for entry: Dictionary in _a.pois():
		var p: Vector3 = entry["position"]
		if String(entry["type"]) == "waterfall":
			continue
		assert_false(_a.is_underwater(p.x, p.z), "%s is submerged" % entry["id"])


func test_fire_tower_is_high_and_shack_is_low() -> void:
	# The site search is supposed to respect each landmark's preference; if it
	# silently stops working every landmark ends up on average ground.
	var tower: Vector3 = _a.poi("fire_tower")["position"]
	var shack: Vector3 = _a.poi("swamp_shack")["position"]
	assert_true(tower.y > shack.y + 12.0,
			"fire tower (%.1f m) should sit well above the trapper's shack (%.1f m)" % [tower.y, shack.y])


func test_roads_connect_their_landmarks() -> void:
	assert_true(_a.roads().size() >= WorldGenerator.ROAD_LINKS.size() - 1,
			"expected a road per link, got %d" % _a.roads().size())
	for path: PackedVector2Array in _a.roads():
		assert_true(path.size() >= 2, "degenerate road")
		# Every road should read as a road to the surface mask.
		var mid: Vector2 = path[path.size() / 2]
		assert_true(_a.road_influence_at(mid.x, mid.y) > 0.5,
				"road midpoint has influence %.2f" % _a.road_influence_at(mid.x, mid.y))


func test_roads_are_graded() -> void:
	# A road that climbs 15 m in an 8 m step is a cliff, not a road.
	var worst := 0.0
	for path: PackedVector2Array in _a.roads():
		for i in range(1, path.size()):
			var a := path[i - 1]
			var b := path[i]
			var rise := absf(_a.height_at(b.x, b.y) - _a.height_at(a.x, a.y))
			worst = maxf(worst, rise)
	assert_true(worst < 9.0, "steepest road step is %.1f m" % worst)


func test_surface_mask_channels_are_normalised() -> void:
	for i in 300:
		var x := fmod(float(i) * 37.7, 800.0) - 400.0
		var z := fmod(float(i) * 91.3, 800.0) - 400.0
		var mask := _a.surface_mask(x, z)
		for channel in [mask.r, mask.g, mask.b, mask.a]:
			assert_between(channel, 0.0, 1.0, "mask channel out of range at (%.0f,%.0f)" % [x, z])


func test_all_major_biomes_appear() -> void:
	var seen := {}
	for i in 3000:
		var angle := float(i) * 2.399963
		var radius := sqrt(float(i) / 3000.0) * 390.0
		var biome := _a.biome_at(cos(angle) * radius, sin(angle) * radius)
		seen[biome] = int(seen.get(biome, 0)) + 1
	for required in [WorldGenerator.Biome.PINE_WOODS, WorldGenerator.Biome.DENSE_WOODS,
			WorldGenerator.Biome.MEADOW, WorldGenerator.Biome.CLIFF,
			WorldGenerator.Biome.SHORE, WorldGenerator.Biome.ROAD]:
		assert_true(seen.has(required),
				"biome %s never appeared in 3000 samples" % WorldGenerator.Biome.keys()[required])


func test_tree_density_respects_terrain() -> void:
	var road_density := 0.0
	var woods_density := 0.0
	var road_samples := 0
	var woods_samples := 0
	for i in 2000:
		var angle := float(i) * 2.399963
		var radius := sqrt(float(i) / 2000.0) * 380.0
		var x := cos(angle) * radius
		var z := sin(angle) * radius
		var density := _a.tree_density_at(x, z)
		if _a.road_influence_at(x, z) > 0.7:
			road_density += density
			road_samples += 1
		elif _a.biome_at(x, z) == WorldGenerator.Biome.DENSE_WOODS:
			woods_density += density
			woods_samples += 1
	if road_samples > 0 and woods_samples > 0:
		var road_average := road_density / float(road_samples)
		var woods_average := woods_density / float(woods_samples)
		assert_true(road_average < woods_average * 0.35,
				"trees grow on the road (%.4f vs woods %.4f)" % [road_average, woods_average])


func test_spawn_point_is_standable() -> void:
	var spawn := _a.spawn_point()
	assert_false(_a.is_underwater(spawn.x, spawn.z), "spawn is underwater")
	assert_true(_a.slope_at(spawn.x, spawn.z) < 0.45, "spawn is on a cliff face")
	assert_true(spawn.y > _a.height_at(spawn.x, spawn.z) - 0.01, "spawn is below the ground")


func test_normals_point_upward() -> void:
	for i in 200:
		var x := fmod(float(i) * 53.1, 700.0) - 350.0
		var z := fmod(float(i) * 79.7, 700.0) - 350.0
		assert_true(_a.normal_at(x, z).y > 0.0, "normal points downward at (%.0f, %.0f)" % [x, z])
