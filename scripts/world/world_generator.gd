class_name WorldGenerator
extends RefCounted
## Deterministic generator for the Black Pine Basin.
##
## Given a 32-bit seed this produces the same 1 km² of terrain, the same rivers,
## the same road network and the same landmark placement every time — which is
## what lets a save file store four bytes instead of a heightmap, and what lets
## chunks be unloaded and rebuilt without the world visibly changing.
##
## The shape of the basin is deliberate rather than emergent:
##
##   * A radial term lifts the terrain into ridges past ~420 m, so the play area
##     is bounded by geography instead of an invisible wall.
##   * Rivers are traced by gradient descent from high ground, then *carved*
##     into the heightfield. Trying to get believable drainage out of noise
##     alone does not work; water that flows uphill reads as broken instantly.
##   * Roads and landmark clearings are stamped the same way.
##
## Carving is precomputed once into a coarse influence grid and bilinearly
## sampled by `height_at()`, so the per-vertex cost stays at a handful of noise
## lookups no matter how complex the road network gets.

const WORLD_SIZE := 1024.0
const HALF_WORLD := WORLD_SIZE * 0.5
const WATER_LEVEL := 6.0
const CARVE_RES := 256                     ## cells per side of the influence grid
const CARVE_CELL := WORLD_SIZE / float(CARVE_RES)
const RIDGE_START := 400.0                 ## radius where the valley walls begin
const RIDGE_HEIGHT := 95.0

enum Biome { PINE_WOODS, DENSE_WOODS, MEADOW, SWAMP, CLIFF, SHORE, BURN_SCAR, ROAD }

## Landmarks. `anchor_angle`/`anchor_radius` fix the broad layout so the basin
## always reads the same way; the seed jitters exact positions and the terrain
## search picks the best local spot for the type.
const POI_DEFS := [
	{"id": "trailhead", "name": "Fire Road Trailhead", "type": "trailhead",
		"angle": 1.62, "radius": 360.0, "clearing": 16.0, "prefers": "flat"},
	{"id": "ranger_station", "name": "Vantry Ranger Station", "type": "station",
		"angle": 2.55, "radius": 250.0, "clearing": 22.0, "prefers": "flat"},
	{"id": "fire_tower", "name": "Sorrel Ridge Fire Tower", "type": "tower",
		"angle": 4.10, "radius": 300.0, "clearing": 14.0, "prefers": "high"},
	{"id": "cabin_hollow", "name": "The Hollow Cabin", "type": "cabin",
		"angle": 0.55, "radius": 205.0, "clearing": 13.0, "prefers": "low"},
	{"id": "cabin_ridge", "name": "Upper Cabin", "type": "cabin",
		"angle": 3.35, "radius": 175.0, "clearing": 13.0, "prefers": "high"},
	{"id": "hunting_camp", "name": "Marrow Creek Camp", "type": "camp",
		"angle": 5.30, "radius": 235.0, "clearing": 15.0, "prefers": "water"},
	{"id": "mine", "name": "Vantry No. 3 Adit", "type": "mine",
		"angle": 3.90, "radius": 375.0, "clearing": 12.0, "prefers": "cliff"},
	{"id": "bunker", "name": "Signal Bunker", "type": "bunker",
		"angle": 0.10, "radius": 330.0, "clearing": 12.0, "prefers": "flat"},
	{"id": "cemetery", "name": "Vantry Camp Cemetery", "type": "cemetery",
		"angle": 2.05, "radius": 140.0, "clearing": 17.0, "prefers": "flat"},
	{"id": "ritual_site", "name": "The Standing Ring", "type": "ritual",
		"angle": 4.75, "radius": 120.0, "clearing": 18.0, "prefers": "low"},
	{"id": "relay", "name": "Basin Relay", "type": "relay",
		"angle": 1.10, "radius": 90.0, "clearing": 16.0, "prefers": "high"},
	{"id": "swamp_shack", "name": "Trapper's Shack", "type": "shack",
		"angle": 5.90, "radius": 160.0, "clearing": 11.0, "prefers": "water"},
	{"id": "cave", "name": "Weeping Cave", "type": "cave",
		"angle": 2.90, "radius": 395.0, "clearing": 10.0, "prefers": "cliff"},
	{"id": "waterfall", "name": "Marrow Falls", "type": "waterfall",
		"angle": 4.45, "radius": 215.0, "clearing": 9.0, "prefers": "steep_water"},
]

## Roads laid between landmarks. The first is the spine the player arrives on.
const ROAD_LINKS := [
	["trailhead", "ranger_station"],
	["ranger_station", "cemetery"],
	["cemetery", "ritual_site"],
	["ranger_station", "cabin_hollow"],
	["ranger_station", "fire_tower"],
	["cemetery", "relay"],
	["cabin_hollow", "hunting_camp"],
	["fire_tower", "mine"],
	["relay", "bunker"],
	["hunting_camp", "swamp_shack"],
	["cabin_ridge", "fire_tower"],
]

var seed_value: int = 0

# --- noise stack -----------------------------------------------------------
var _continental: FastNoiseLite
var _hills: FastNoiseLite
var _detail: FastNoiseLite
var _ridge: FastNoiseLite
var _moisture: FastNoiseLite
var _rock: FastNoiseLite
var _forest: FastNoiseLite
var _burn: FastNoiseLite

# --- carve grids -----------------------------------------------------------
var _road_influence: PackedFloat32Array = []
var _road_height: PackedFloat32Array = []
var _river_influence: PackedFloat32Array = []
var _river_height: PackedFloat32Array = []
var _clearing_influence: PackedFloat32Array = []
var _clearing_height: PackedFloat32Array = []

var _pois: Array[Dictionary] = []
var _rivers: Array = []            ## Array[PackedVector2Array] in world XZ
var _roads: Array = []             ## Array[PackedVector2Array]
var _lakes: Array[Dictionary] = [] ## {"centre": Vector2, "radius": float, "level": float}
var _built := false


func _init(world_seed: int = 0) -> void:
	seed_value = world_seed
	_setup_noise()


func _setup_noise() -> void:
	_continental = _make_noise(seed_value + 1, 0.0013, 3, FastNoiseLite.TYPE_SIMPLEX_SMOOTH)
	_hills = _make_noise(seed_value + 2, 0.0062, 4, FastNoiseLite.TYPE_SIMPLEX_SMOOTH)
	_detail = _make_noise(seed_value + 3, 0.021, 3, FastNoiseLite.TYPE_SIMPLEX)
	_ridge = _make_noise(seed_value + 4, 0.0042, 3, FastNoiseLite.TYPE_SIMPLEX)
	_moisture = _make_noise(seed_value + 5, 0.0034, 3, FastNoiseLite.TYPE_SIMPLEX_SMOOTH)
	_rock = _make_noise(seed_value + 6, 0.0090, 2, FastNoiseLite.TYPE_SIMPLEX)
	_forest = _make_noise(seed_value + 7, 0.0055, 3, FastNoiseLite.TYPE_SIMPLEX_SMOOTH)
	_burn = _make_noise(seed_value + 8, 0.0026, 2, FastNoiseLite.TYPE_SIMPLEX_SMOOTH)


static func _make_noise(s: int, frequency: float, octaves: int,
		type: FastNoiseLite.NoiseType) -> FastNoiseLite:
	var n := FastNoiseLite.new()
	n.seed = s
	n.frequency = frequency
	n.noise_type = type
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	n.fractal_octaves = octaves
	return n


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

## Runs the one-off layout pass: landmarks, rivers, lakes, roads, carve grids.
## Costs a few tens of milliseconds and must complete before any chunk builds.
func build() -> void:
	if _built:
		return
	var cells := CARVE_RES * CARVE_RES
	for grid in [_road_influence, _road_height, _river_influence, _river_height,
			_clearing_influence, _clearing_height]:
		grid.resize(cells)
		grid.fill(0.0)

	# Order matters. Water is decided first so landmark siting can avoid it —
	# placing a cabin on the lowest ground it can find and *then* routing a
	# river through the basin puts the cabin underwater.
	_trace_rivers()
	_find_lakes()
	_place_landmarks()
	_lay_roads()
	_built = true
	Log.info("worldgen", "seed %d: %d landmarks, %d rivers, %d roads, %d lakes"
			% [seed_value, _pois.size(), _rivers.size(), _roads.size(), _lakes.size()])


func is_built() -> bool:
	return _built


# ---------------------------------------------------------------------------
# Height field
# ---------------------------------------------------------------------------

## Raw terrain before rivers, roads and clearings are carved into it.
func base_height(x: float, z: float) -> float:
	var h := _continental.get_noise_2d(x, z) * 46.0 + 14.0
	h += _hills.get_noise_2d(x, z) * 16.0

	# Ridged noise for the crags: folding the noise about zero produces sharp
	# crests that plain fBm cannot.
	var ridged := 1.0 - absf(_ridge.get_noise_2d(x, z))
	var rock_mask := clampf(_rock.get_noise_2d(x, z) * 1.4 + 0.15, 0.0, 1.0)
	h += pow(ridged, 3.0) * 34.0 * rock_mask

	h += _detail.get_noise_2d(x, z) * 2.6

	# Valley walls: the basin is enclosed, so the player is bounded by terrain
	# rather than by an invisible collider.
	var radius := sqrt(x * x + z * z)
	if radius > RIDGE_START:
		var t := clampf((radius - RIDGE_START) / (HALF_WORLD - RIDGE_START), 0.0, 1.0)
		h += pow(t, 1.7) * RIDGE_HEIGHT
	return h


## Final terrain height including carved features.
##
## Order is river, then clearing, then road, and each one *replaces* rather than
## clamps the height beneath it. An earlier version took `min(terrain, bed)` for
## the river so that clearings could not fill the channel back in; that left
## natural hollows in the streambed untouched, so the bed was no longer
## monotonically descending and the water surface visibly stepped up out of
## potholes. Blending to the bed grades those out, which is what a real
## streambed looks like, and the two features that could refill a channel are
## handled explicitly instead:
##
##   * clearings are attenuated by river influence — the basin's landmarks are
##     already sited away from watercourses, this only tidies the falloff;
##   * roads deliberately win, as a culvert or a bridge. Without that the fire
##     road drops into every channel it meets, which breaks the one route the
##     player is meant to be able to follow in the dark.
func height_at(x: float, z: float) -> float:
	var h := base_height(x, z)
	if not _built:
		return h

	var river := _sample(_river_influence, x, z)
	if river > 0.001:
		h = lerpf(h, _sample(_river_height, x, z), river)

	var clearing := _sample(_clearing_influence, x, z)
	if clearing > 0.001:
		h = lerpf(h, _sample(_clearing_height, x, z), clearing * (1.0 - river * 0.85))

	var road := _sample(_road_influence, x, z)
	if road > 0.001:
		h = lerpf(h, _sample(_road_height, x, z), road)
	return h


## Surface normal from central differences. Used for slope tests and to align
## props to the ground.
func normal_at(x: float, z: float, epsilon: float = 1.0) -> Vector3:
	var hl := height_at(x - epsilon, z)
	var hr := height_at(x + epsilon, z)
	var hd := height_at(x, z - epsilon)
	var hu := height_at(x, z + epsilon)
	return Vector3(hl - hr, 2.0 * epsilon, hd - hu).normalized()


## 0 = flat, 1 = vertical.
func slope_at(x: float, z: float, epsilon: float = 1.5) -> float:
	return clampf(1.0 - normal_at(x, z, epsilon).y, 0.0, 1.0)


func is_underwater(x: float, z: float) -> bool:
	return height_at(x, z) < water_level_at(x, z)


## Lakes can sit above the global water line, so the level is positional.
func water_level_at(x: float, z: float) -> float:
	var level := WATER_LEVEL
	for lake: Dictionary in _lakes:
		var centre: Vector2 = lake["centre"]
		if Vector2(x, z).distance_to(centre) < float(lake["radius"]):
			level = maxf(level, float(lake["level"]))
	return level


# ---------------------------------------------------------------------------
# Biomes and surface masks
# ---------------------------------------------------------------------------

func biome_at(x: float, z: float) -> Biome:
	if _built and _sample(_road_influence, x, z) > 0.45:
		return Biome.ROAD
	var h := height_at(x, z)
	var slope := slope_at(x, z)
	var water := water_level_at(x, z)
	if h < water + 0.6:
		return Biome.SHORE
	if slope > 0.55:
		return Biome.CLIFF
	var moisture := _moisture.get_noise_2d(x, z) * 0.5 + 0.5
	if h < water + 3.5 and moisture > 0.52:
		return Biome.SWAMP
	if _burn.get_noise_2d(x, z) > 0.42:
		return Biome.BURN_SCAR
	var forest := _forest.get_noise_2d(x, z) * 0.5 + 0.5
	if forest < 0.36 or (moisture < 0.34 and slope < 0.2):
		return Biome.MEADOW
	if forest > 0.62:
		return Biome.DENSE_WOODS
	return Biome.PINE_WOODS


## Vertex-colour mask consumed by `shaders/terrain.gdshader`:
## r = rock, g = grass/moss, b = mud, a = road/gravel.
func surface_mask(x: float, z: float) -> Color:
	var slope := slope_at(x, z)
	var h := height_at(x, z)
	var water := water_level_at(x, z)
	var moisture := _moisture.get_noise_2d(x, z) * 0.5 + 0.5

	var rock := clampf((slope - 0.24) * 2.6, 0.0, 1.0)
	rock = maxf(rock, clampf((h - 78.0) / 40.0, 0.0, 1.0) * 0.8)

	var grass := clampf((moisture - 0.22) * 1.7, 0.0, 1.0) * (1.0 - rock)
	grass *= clampf(1.0 - (slope - 0.18) * 2.2, 0.0, 1.0)

	var depth_above_water := h - water
	var mud := clampf(1.0 - depth_above_water / 2.2, 0.0, 1.0)
	mud = maxf(mud, clampf((moisture - 0.62) * 2.4, 0.0, 1.0) * clampf(1.0 - depth_above_water / 6.0, 0.0, 1.0))
	mud *= (1.0 - rock * 0.7)

	var road := 0.0
	if _built:
		road = clampf(_sample(_road_influence, x, z) * 1.35, 0.0, 1.0)
		grass *= (1.0 - road)
		mud *= (1.0 - road * 0.8)
	return Color(rock, grass, clampf(mud, 0.0, 1.0), road)


## Trees per square metre for this point, before quality scaling.
func tree_density_at(x: float, z: float) -> float:
	var biome := biome_at(x, z)
	var slope := slope_at(x, z)
	if slope > 0.5:
		return 0.0
	var base := 0.0
	match biome:
		Biome.DENSE_WOODS: base = 0.055
		Biome.PINE_WOODS: base = 0.030
		Biome.BURN_SCAR: base = 0.012
		Biome.SWAMP: base = 0.010
		Biome.MEADOW: base = 0.0035
		Biome.SHORE: base = 0.004
		_: base = 0.0
	if _built:
		# Nothing grows in the middle of a road or a cleared landmark.
		base *= (1.0 - clampf(_sample(_road_influence, x, z) * 1.6, 0.0, 1.0))
		base *= (1.0 - clampf(_sample(_clearing_influence, x, z) * 1.3, 0.0, 1.0))
	return base * clampf(1.0 - slope * 1.4, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Landmarks
# ---------------------------------------------------------------------------

func pois() -> Array[Dictionary]:
	return _pois


func poi(poi_id: String) -> Dictionary:
	for entry: Dictionary in _pois:
		if entry["id"] == poi_id:
			return entry
	return {}


func nearest_poi(position: Vector3, max_distance: float = 60.0) -> Dictionary:
	var best := {}
	var best_distance := max_distance
	for entry: Dictionary in _pois:
		var p: Vector3 = entry["position"]
		var d := Vector2(p.x - position.x, p.z - position.z).length()
		if d < best_distance:
			best_distance = d
			best = entry
	return best


func rivers() -> Array:
	return _rivers


func roads() -> Array:
	return _roads


func lakes() -> Array[Dictionary]:
	return _lakes


## Where the player starts: on the fire road at the trailhead, facing the basin.
func spawn_point() -> Vector3:
	var entry := poi("trailhead")
	if entry.is_empty():
		return Vector3(0, height_at(0, 0) + 1.0, 0)
	var p: Vector3 = entry["position"]
	return Vector3(p.x, height_at(p.x, p.z) + 1.2, p.z)


func spawn_yaw() -> float:
	var entry := poi("trailhead")
	if entry.is_empty():
		return 0.0
	var p: Vector3 = entry["position"]
	return atan2(p.x, p.z)


func _place_landmarks() -> void:
	var rng := RandomNumberGenerator.new()
	_pois.clear()
	for i in POI_DEFS.size():
		var def: Dictionary = POI_DEFS[i]
		rng.seed = seed_value * 31 + i * 977
		var angle := float(def["angle"]) + rng.randf_range(-0.28, 0.28)
		var radius := float(def["radius"]) * rng.randf_range(0.88, 1.12)
		var anchor := Vector2(cos(angle) * radius, sin(angle) * radius)
		var chosen := _search_site(anchor, String(def["prefers"]), rng)
		var height := height_at(chosen.x, chosen.y)
		var entry := {
			"id": def["id"],
			"name": def["name"],
			"type": def["type"],
			"position": Vector3(chosen.x, height, chosen.y),
			"clearing": float(def["clearing"]),
			"yaw": rng.randf() * TAU,
		}
		_pois.append(entry)
		_stamp_clearing(chosen, float(def["clearing"]), height)


## Sample candidate positions around an anchor and keep the one that best fits
## what the landmark needs — a fire tower wants a summit, a shack wants a bog.
func _search_site(anchor: Vector2, prefers: String, rng: RandomNumberGenerator) -> Vector2:
	var chosen := _search_pass(anchor, prefers, rng, 24, 55.0)
	# A landmark whose entire neighbourhood is water or river channel has to
	# look further afield rather than settle for the least-flooded spot.
	if _site_score(chosen, prefers) < -1000.0:
		chosen = _search_pass(anchor, prefers, rng, 48, 165.0)
	return chosen


func _search_pass(anchor: Vector2, prefers: String, rng: RandomNumberGenerator,
		attempts: int, spread: float) -> Vector2:
	var best := anchor
	var best_score := -INF
	for attempt in attempts:
		var candidate := anchor
		if attempt > 0:
			candidate += Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * spread
		candidate.x = clampf(candidate.x, -HALF_WORLD + 40.0, HALF_WORLD - 40.0)
		candidate.y = clampf(candidate.y, -HALF_WORLD + 40.0, HALF_WORLD - 40.0)
		var score := _site_score(candidate, prefers)
		if score > best_score:
			best_score = score
			best = candidate
	return best


## How well a point suits a landmark of the given preference. Large negative
## values mean "unusable" (in water, in a river channel, on top of another
## landmark) rather than merely "not ideal".
func _site_score(candidate: Vector2, prefers: String) -> float:
	# `height_at` rather than `base_height`: the rivers are already carved at
	# this point and a site has to be judged against the real ground.
	var h := height_at(candidate.x, candidate.y)
	var slope := _base_slope(candidate.x, candidate.y)
	var moisture := _moisture.get_noise_2d(candidate.x, candidate.y) * 0.5 + 0.5

	var score := 0.0
	match prefers:
		"high":
			score = h * 0.6 - slope * 90.0
		"low":
			score = -h * 0.4 - slope * 70.0
		"flat":
			score = -slope * 180.0 - absf(h - 30.0) * 0.25
		"water":
			score = -absf(h - (WATER_LEVEL + 4.0)) * 1.5 + moisture * 30.0 - slope * 60.0
		"cliff":
			score = slope * 120.0 + h * 0.15
		"steep_water":
			score = slope * 90.0 - absf(h - (WATER_LEVEL + 16.0)) * 0.9
		_:
			score = -slope * 60.0

	# Nothing stands in the water, however much it likes low ground.
	var freeboard := h - water_level_at(candidate.x, candidate.y)
	if freeboard < 1.5:
		score -= 4000.0 + (1.5 - freeboard) * 400.0
	if _sample(_river_influence, candidate.x, candidate.y) > 0.25:
		score -= 3000.0
	# Never stack two landmarks on top of each other.
	for existing: Dictionary in _pois:
		var p: Vector3 = existing["position"]
		var d := candidate.distance_to(Vector2(p.x, p.z))
		if d < 70.0:
			score -= (70.0 - d) * 4.0
	return score


func _base_slope(x: float, z: float) -> float:
	var e := 2.0
	var hl := base_height(x - e, z)
	var hr := base_height(x + e, z)
	var hd := base_height(x, z - e)
	var hu := base_height(x, z + e)
	return Vector3(hl - hr, 2.0 * e, hd - hu).normalized().y * -1.0 + 1.0


# ---------------------------------------------------------------------------
# Hydrology
# ---------------------------------------------------------------------------

## Trace watercourses downhill from high ground until they reach the water line
## or leave the map. Carving these gives believable drainage; noise alone gives
## rivers that run along ridges.
func _trace_rivers() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value * 7 + 13
	_rivers.clear()
	var sources := 5
	for i in sources:
		var start := _find_river_source(rng)
		# The carve radius has to be known while tracing: the path must stop
		# before it doubles back inside its own channel.
		var width := lerpf(3.2, 7.0, float(i) / float(maxi(sources - 1, 1)))
		var path := _descend(start, rng, _river_carve_radius(width) + 4.0)
		path = _trim_at_confluence(path)
		if path.size() < 12:
			continue
		_rivers.append({"path": path, "width": width})
		_stamp_river(path, width)


func _find_river_source(rng: RandomNumberGenerator) -> Vector2:
	var best := Vector2.ZERO
	var best_height := -INF
	for attempt in 40:
		var angle := rng.randf() * TAU
		var radius := rng.randf_range(210.0, 390.0)
		var candidate := Vector2(cos(angle) * radius, sin(angle) * radius)
		var h := base_height(candidate.x, candidate.y)
		if h > best_height:
			best_height = h
			best = candidate
	return best


## Gradient descent with momentum. The momentum term is what stops the path
## oscillating across a shallow gradient and produces meanders instead.
func _descend(start: Vector2, rng: RandomNumberGenerator,
		self_clearance: float) -> PackedVector2Array:
	var path := PackedVector2Array()
	var position := start
	var velocity := Vector2.ZERO
	var step := 6.0
	for i in 260:
		path.append(position)
		var h := base_height(position.x, position.y)
		if h <= WATER_LEVEL + 0.5:
			break
		if position.length() > HALF_WORLD - 30.0:
			break
		# Confluence: once this watercourse runs into one that has already been
		# carved, it has joined it. Continuing would carve a second channel
		# across the first, which reads as a river climbing out of a valley.
		if i > 8 and _sample(_river_influence, position.x, position.y) > 0.2:
			break
		# Meander cutoff: the same argument applies to a river doubling back on
		# itself. Because the carve keeps the lowest bed for a cell, an
		# intersecting loop would punch the downstream depth into the upstream
		# reach and leave the profile climbing out of a hole.
		if i > 16 and _crosses_itself(path, position, self_clearance):
			break
		var e := 4.0
		var gradient := Vector2(
			base_height(position.x + e, position.y) - base_height(position.x - e, position.y),
			base_height(position.x, position.y + e) - base_height(position.x, position.y - e))
		if gradient.length() < 0.0001:
			gradient = Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1))
		var downhill := -gradient.normalized()
		downhill += Vector2(rng.randf_range(-0.25, 0.25), rng.randf_range(-0.25, 0.25))
		velocity = (velocity * 0.62 + downhill.normalized() * 0.38).normalized()
		position += velocity * step
	return path


## Drop the tail of a path that has run into an existing watercourse.
##
## The descent already stops at a confluence, but "stopped here" is not the same
## as "safe to carve here": the last few stamps are wide enough to reach across
## the channel it just joined, and a tributary tracks its own descent, so it can
## be *lower* than the stem it meets. Carving those stamps punches a hole in the
## main river. Trimming back to clear ground leaves the two channels meeting at
## their edges, which is what a confluence looks like anyway.
func _trim_at_confluence(path: PackedVector2Array) -> PackedVector2Array:
	var last := path.size() - 1
	while last > 0 and _sample(_river_influence, path[last].x, path[last].y) > 0.02:
		last -= 1
	if last == path.size() - 1:
		return path
	return path.slice(0, maxi(last, 0) + 1)


## True when `position` comes back within `radius` of a point the path visited
## more than a dozen steps ago.
func _crosses_itself(path: PackedVector2Array, position: Vector2, radius: float) -> bool:
	var cutoff := path.size() - 12
	for i in cutoff:
		if path[i].distance_to(position) < radius:
			return true
	return false


## Standing water forms where a traced river stalls in a depression.
func _find_lakes() -> void:
	_lakes.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value * 17 + 5
	for river: Dictionary in _rivers:
		var path: PackedVector2Array = river["path"]
		if path.size() < 20:
			continue
		var tail: Vector2 = path[path.size() - 1]
		var h := base_height(tail.x, tail.y)
		if h > WATER_LEVEL + 4.0:
			continue
		_lakes.append({
			"centre": tail,
			"radius": rng.randf_range(24.0, 52.0),
			"level": maxf(WATER_LEVEL, h + rng.randf_range(1.2, 2.6)),
		})
	# One larger lake near the middle of the basin, always present: it is the
	# landmark the player orients by.
	var centre := Vector2(cos(seed_value * 0.001) * 60.0, sin(seed_value * 0.0013) * 60.0)
	_lakes.append({"centre": centre, "radius": 78.0, "level": WATER_LEVEL + 1.5})


# ---------------------------------------------------------------------------
# Roads
# ---------------------------------------------------------------------------

func _lay_roads() -> void:
	_roads.clear()
	for link: Array in ROAD_LINKS:
		var a := poi(String(link[0]))
		var b := poi(String(link[1]))
		if a.is_empty() or b.is_empty():
			continue
		var from: Vector3 = a["position"]
		var to: Vector3 = b["position"]
		var path := _route(Vector2(from.x, from.z), Vector2(to.x, to.z))
		if path.size() < 2:
			continue
		_roads.append(path)
		_stamp_road(path, 3.4 if link[0] == "trailhead" else 2.6)


## A road is a chain of short steps that prefers to stay level: at each step it
## samples a fan of headings and picks the one with the least climb while still
## making progress toward the destination. Roads therefore switchback around
## hills instead of climbing straight over them.
func _route(from: Vector2, to: Vector2) -> PackedVector2Array:
	var path := PackedVector2Array()
	var position := from
	var step := 8.0
	var max_steps := int(from.distance_to(to) / step * 2.4) + 20
	for i in max_steps:
		path.append(position)
		if position.distance_to(to) < step:
			break
		var straight := (to - position).normalized()
		var best_direction := straight
		var best_score := -INF
		var current_height := _pre_road_height(position.x, position.y)
		for fan in 9:
			var angle := lerpf(-1.05, 1.05, float(fan) / 8.0)
			var direction := straight.rotated(angle)
			var candidate := position + direction * step
			var climb := absf(_pre_road_height(candidate.x, candidate.y) - current_height)
			var progress := (to - candidate).length()
			var score := -climb * 5.5 - progress * 0.32
			if candidate.length() > HALF_WORLD - 20.0:
				score -= 500.0
			if score > best_score:
				best_score = score
				best_direction = direction
		position += best_direction * step
	path.append(to)
	return path


# ---------------------------------------------------------------------------
# Carve grid
# ---------------------------------------------------------------------------

func _stamp_clearing(centre: Vector2, radius: float, height: float) -> void:
	_stamp_disc(_clearing_influence, _clearing_height, centre, radius, height, 1.0, 0.55)


## Ground as it stands before roads are cut: base terrain plus any landmark
## clearing. Roads have to be graded against this, not against raw noise, or a
## road running into a flattened clearing steps up to meet it.
func _pre_road_height(x: float, z: float) -> float:
	var h := base_height(x, z)
	var clearing := _sample(_clearing_influence, x, z)
	if clearing > 0.001:
		h = lerpf(h, _sample(_clearing_height, x, z), clearing)
	return h


func _stamp_road(path: PackedVector2Array, width: float) -> void:
	# Smooth the profile over a five-sample window. One-sample averaging still
	# leaves visible steps where the underlying terrain is broken.
	var graded := PackedFloat32Array()
	graded.resize(path.size())
	for i in path.size():
		var total := 0.0
		var count := 0
		for offset in range(-2, 3):
			var j := clampi(i + offset, 0, path.size() - 1)
			total += _pre_road_height(path[j].x, path[j].y)
			count += 1
		graded[i] = total / float(count)
	for i in path.size():
		_stamp_disc(_road_influence, _road_height, path[i], width * 2.4, graded[i], 1.0, 0.42)


## Carving a river is not the same as carving a road, in two ways that both
## caused water to run uphill before they were handled:
##
##  1. The bed must be *strictly* descending. Taking a running minimum of the
##     terrain is not enough — a long flat reach leaves the bed level, and the
##     bilinear sampling of the influence grid then lets noise poke back
##     through. A forced drop per step guarantees a gradient.
##  2. Where two stamps along the path cover the same cell with equal
##     influence, the *lower* bed has to win. Plain max-influence blending lets
##     an upstream sample claim a cell before its downstream neighbour reaches
##     it, which dams the channel.
const RIVER_DROP_PER_STEP := 0.035
const RIVER_CARVE_FACTOR := 2.6
## The carve grid has 4 m cells (5.7 m across the diagonal). A narrow creek's
## stamp has to be wide enough that its *core* — the region where influence
## saturates at 1.0 — always contains a cell, or bilinear sampling returns a
## partial carve at the centreline and the bed pokes back through in patches.
const RIVER_MIN_CARVE_RADIUS := 10.0
const RIVER_CORE_FRACTION := 0.68


static func _river_carve_radius(width: float) -> float:
	return maxf(width * RIVER_CARVE_FACTOR, RIVER_MIN_CARVE_RADIUS)


func _stamp_river(path: PackedVector2Array, width: float) -> void:
	var descending := INF
	for i in path.size():
		var point := path[i]
		var height := base_height(point.x, point.y)
		descending = minf(descending, height) - RIVER_DROP_PER_STEP
		var bed := maxf(descending - 1.8, WATER_LEVEL - 4.5)
		# A wide core keeps influence saturated across the channel even at the
		# 4 m resolution of the carve grid.
		_stamp_disc(_river_influence, _river_height, point,
				_river_carve_radius(width), bed, 1.0, RIVER_CORE_FRACTION, true)


## Paint a falloff disc into an influence/value grid pair. Influence uses max
## blending, and the value grid is overwritten wherever this stamp wins, so
## overlapping features do not average into nonsense.
##
## `prefer_lower` breaks influence ties toward the smaller value, which is what
## rivers need so a downstream stamp can deepen a cell an upstream stamp
## already claimed.
func _stamp_disc(influence: PackedFloat32Array, values: PackedFloat32Array,
		centre: Vector2, radius: float, value: float, strength: float,
		core_fraction: float, prefer_lower: bool = false) -> void:
	var min_x := maxi(0, int((centre.x + HALF_WORLD - radius) / CARVE_CELL))
	var max_x := mini(CARVE_RES - 1, int((centre.x + HALF_WORLD + radius) / CARVE_CELL))
	var min_z := maxi(0, int((centre.y + HALF_WORLD - radius) / CARVE_CELL))
	var max_z := mini(CARVE_RES - 1, int((centre.y + HALF_WORLD + radius) / CARVE_CELL))
	var core := radius * core_fraction
	for cz in range(min_z, max_z + 1):
		for cx in range(min_x, max_x + 1):
			var world := Vector2(
				float(cx) * CARVE_CELL - HALF_WORLD,
				float(cz) * CARVE_CELL - HALF_WORLD)
			var distance := world.distance_to(centre)
			if distance > radius:
				continue
			var falloff := 1.0
			if distance > core:
				falloff = 1.0 - smoothstep(core, radius, distance)
			var amount := falloff * strength
			var index := cz * CARVE_RES + cx
			if amount > influence[index]:
				influence[index] = amount
				values[index] = value
			elif prefer_lower and amount >= influence[index] - 0.001 and value < values[index]:
				values[index] = value


## Bilinear sample of a carve grid in world space.
func _sample(grid: PackedFloat32Array, x: float, z: float) -> float:
	if grid.is_empty():
		return 0.0
	var fx := (x + HALF_WORLD) / CARVE_CELL
	var fz := (z + HALF_WORLD) / CARVE_CELL
	var x0 := clampi(int(floor(fx)), 0, CARVE_RES - 1)
	var z0 := clampi(int(floor(fz)), 0, CARVE_RES - 1)
	var x1 := mini(x0 + 1, CARVE_RES - 1)
	var z1 := mini(z0 + 1, CARVE_RES - 1)
	var tx := clampf(fx - float(x0), 0.0, 1.0)
	var tz := clampf(fz - float(z0), 0.0, 1.0)
	var a := grid[z0 * CARVE_RES + x0]
	var b := grid[z0 * CARVE_RES + x1]
	var c := grid[z1 * CARVE_RES + x0]
	var d := grid[z1 * CARVE_RES + x1]
	return lerpf(lerpf(a, b, tx), lerpf(c, d, tx), tz)


## True when the point is inside the walkable basin (not up a valley wall).
func is_in_bounds(x: float, z: float) -> bool:
	return absf(x) < HALF_WORLD - 24.0 and absf(z) < HALF_WORLD - 24.0


## How strongly this point reads as "on a road" — used by the Surveyor's
## patrol logic and by footstep surface selection.
func road_influence_at(x: float, z: float) -> float:
	return _sample(_road_influence, x, z) if _built else 0.0
