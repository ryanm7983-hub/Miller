extends Node
## Owns every mesh, texture and material in the game.
##
## Nothing is imported from disk: the whole art pipeline is `MeshFactory` and
## `TextureFactory` running at boot. That keeps the web download tiny and lets
## mesh density follow the quality tier, but it means the generated resources
## must be shared aggressively — a forest of ten thousand trees has to reference
## six ArrayMesh instances, not ten thousand.
##
## Everything is deterministic: the same key always yields the same asset for a
## given world seed, which is what makes the streamed world stable across
## save/load.

const PINE_VARIANTS := 6
const ROCK_VARIANTS := 5
const BUSH_VARIANTS := 4
const LOD_COUNT := 3

signal warm_up_progress(fraction: float, label: String)
signal warm_up_finished()

var is_ready: bool = false

var _textures: Dictionary = {}
var _materials: Dictionary = {}
var _meshes: Dictionary = {}
var _shaders: Dictionary = {}

## Materials that respond to the wind vector, refreshed by WeatherSystem.
var _wind_materials: Array[ShaderMaterial] = []
var _wet_materials: Array[ShaderMaterial] = []


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


# ---------------------------------------------------------------------------
# Warm-up
# ---------------------------------------------------------------------------

## Build everything, yielding between groups so the browser stays responsive
## and the loading bar can move. Safe to call more than once.
func warm_up() -> void:
	if is_ready:
		warm_up_finished.emit()
		return
	var steps: Array[Callable] = [
		func() -> void: _build_shaders(),
		func() -> void: _build_ground_textures(),
		func() -> void: _build_organic_textures(),
		func() -> void: _build_effect_textures(),
		func() -> void: _build_materials(),
		func() -> void: _build_tree_meshes(),
		func() -> void: _build_prop_meshes(),
		func() -> void: _build_creature_meshes(),
	]
	var labels := [
		"Compiling shaders", "Weathering the ground", "Growing needles",
		"Condensing fog", "Mixing materials", "Planting the black pines",
		"Abandoning the camps", "Waking the basin",
	]
	for i in steps.size():
		warm_up_progress.emit(float(i) / float(steps.size()), labels[i])
		steps[i].call()
		await get_tree().process_frame
	is_ready = true
	warm_up_progress.emit(1.0, "Ready")
	warm_up_finished.emit()
	Log.info("foundry", "warm-up complete: %d textures, %d materials, %d meshes"
			% [_textures.size(), _materials.size(), _meshes.size()])


## Synchronous variant for headless tests and tools.
func warm_up_blocking() -> void:
	if is_ready:
		return
	_build_shaders()
	_build_ground_textures()
	_build_organic_textures()
	_build_effect_textures()
	_build_materials()
	_build_tree_meshes()
	_build_prop_meshes()
	_build_creature_meshes()
	is_ready = true


# ---------------------------------------------------------------------------
# Accessors
# ---------------------------------------------------------------------------

func texture(key: String) -> Texture2D:
	if not _textures.has(key):
		Log.warn("foundry", "missing texture '%s'" % key)
		return null
	return _textures[key]


func material(key: String) -> Material:
	if not _materials.has(key):
		Log.warn("foundry", "missing material '%s'" % key)
		return null
	return _materials[key]


func mesh(key: String) -> Mesh:
	if not _meshes.has(key):
		Log.warn("foundry", "missing mesh '%s'" % key)
		return null
	return _meshes[key]


func has_mesh(key: String) -> bool:
	return _meshes.has(key)


func pine(variant: int, lod: int) -> Mesh:
	return mesh("pine_%d_%d" % [variant % PINE_VARIANTS, clampi(lod, 0, LOD_COUNT - 1)])


func pine_height(variant: int) -> float:
	return _pine_heights[variant % PINE_VARIANTS]


var _pine_heights: PackedFloat32Array = []


# ---------------------------------------------------------------------------
# Environment hooks
# ---------------------------------------------------------------------------

## Push the current wind vector into every vegetation material at once.
func set_wind(direction: Vector3, strength: float, speed: float) -> void:
	var dir := Vector2(direction.x, direction.z)
	if dir.length_squared() < 0.0001:
		dir = Vector2(1, 0)
	dir = dir.normalized()
	var enabled := 1.0 if PerformanceDirector.get_budget("vegetation_wind", true) else 0.0
	for mat in _wind_materials:
		mat.set_shader_parameter("wind_direction", dir)
		mat.set_shader_parameter("wind_strength", strength)
		mat.set_shader_parameter("wind_speed", speed)
		mat.set_shader_parameter("wind_enabled", enabled)


## 0 = bone dry, 1 = soaked. Darkens and glosses ground and timber.
func set_wetness(amount: float) -> void:
	for mat in _wet_materials:
		mat.set_shader_parameter("wetness", clampf(amount, 0.0, 1.0))


## Raised while something is stalking the player; the canopy gets restless.
func set_agitation(amount: float) -> void:
	var foliage := _materials.get("foliage") as ShaderMaterial
	if foliage != null:
		foliage.set_shader_parameter("agitation", clampf(amount, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------

func _build_shaders() -> void:
	for name in ["vegetation", "bark", "terrain", "water", "fog_card", "figure",
			"rain_sheet", "sky"]:
		var path := "res://shaders/%s.gdshader" % name
		var shader: Shader = load(path)
		if shader == null:
			Log.error("foundry", "failed to load shader %s" % path)
			continue
		_shaders[name] = shader


func _build_ground_textures() -> void:
	_textures["grass_detail"] = TextureFactory.noise_tile(101, 0.045, 256, 4)
	_textures["dirt_detail"] = TextureFactory.noise_tile(202, 0.030, 256, 5)
	_textures["rock_detail"] = TextureFactory.cellular_tile(303, 0.040, 256)
	_textures["gravel_detail"] = TextureFactory.cellular_tile(404, 0.09, 128)


func _build_organic_textures() -> void:
	_textures["bark_detail"] = TextureFactory.fibre_tile(505, 256, 10.0, 0.06)
	_textures["needles"] = TextureFactory.needle_mask(606, 128)
	_textures["leaves"] = TextureFactory.leaf_mask(707, 128)
	_textures["plank_detail"] = TextureFactory.fibre_tile(808, 256, 22.0, 0.05)
	_textures["metal_detail"] = TextureFactory.noise_tile(909, 0.08, 128, 3)
	_textures["concrete_detail"] = TextureFactory.noise_tile(1010, 0.055, 256, 4)
	_textures["paper"] = TextureFactory.paper(1111, 128)


func _build_effect_textures() -> void:
	_textures["fog_puff"] = TextureFactory.puff(128, 1.7)
	_textures["water_normal"] = TextureFactory.normal_from_noise(1212, 0.055, 128, 5.0)
	_textures["rain_streaks"] = TextureFactory.rain_streaks(1313, 128)
	_textures["light_cookie"] = TextureFactory.light_cookie(128)
	_textures["figure_noise"] = TextureFactory.noise_tile(1414, 0.09, 128, 3)


func _build_materials() -> void:
	# --- terrain -----------------------------------------------------------
	var terrain := ShaderMaterial.new()
	terrain.shader = _shaders["terrain"]
	terrain.set_shader_parameter("grass_tex", _textures["grass_detail"])
	terrain.set_shader_parameter("dirt_tex", _textures["dirt_detail"])
	terrain.set_shader_parameter("rock_tex", _textures["rock_detail"])
	_materials["terrain"] = terrain
	_wet_materials.append(terrain)

	# --- foliage -----------------------------------------------------------
	var foliage := ShaderMaterial.new()
	foliage.shader = _shaders["vegetation"]
	foliage.set_shader_parameter("albedo_tex", _textures["needles"])
	foliage.set_shader_parameter("tint_a", Color(0.13, 0.19, 0.13))
	foliage.set_shader_parameter("tint_b", Color(0.07, 0.12, 0.09))
	_materials["foliage"] = foliage
	_wind_materials.append(foliage)

	var undergrowth := ShaderMaterial.new()
	undergrowth.shader = _shaders["vegetation"]
	undergrowth.set_shader_parameter("albedo_tex", _textures["leaves"])
	undergrowth.set_shader_parameter("tint_a", Color(0.19, 0.24, 0.14))
	undergrowth.set_shader_parameter("tint_b", Color(0.11, 0.16, 0.10))
	undergrowth.set_shader_parameter("alpha_cut", 0.36)
	_materials["undergrowth"] = undergrowth
	_wind_materials.append(undergrowth)

	var dry_grass := ShaderMaterial.new()
	dry_grass.shader = _shaders["vegetation"]
	dry_grass.set_shader_parameter("albedo_tex", _textures["leaves"])
	dry_grass.set_shader_parameter("tint_a", Color(0.30, 0.27, 0.16))
	dry_grass.set_shader_parameter("tint_b", Color(0.19, 0.18, 0.12))
	_materials["dry_grass"] = dry_grass
	_wind_materials.append(dry_grass)

	# --- timber ------------------------------------------------------------
	var bark := ShaderMaterial.new()
	bark.shader = _shaders["bark"]
	bark.set_shader_parameter("albedo_tex", _textures["bark_detail"])
	_materials["bark"] = bark
	_wind_materials.append(bark)
	_wet_materials.append(bark)

	var dead_bark := ShaderMaterial.new()
	dead_bark.shader = _shaders["bark"]
	dead_bark.set_shader_parameter("albedo_tex", _textures["bark_detail"])
	dead_bark.set_shader_parameter("tint_dark", Color(0.09, 0.085, 0.08))
	dead_bark.set_shader_parameter("tint_light", Color(0.22, 0.21, 0.19))
	_materials["dead_bark"] = dead_bark
	_wind_materials.append(dead_bark)
	_wet_materials.append(dead_bark)

	var planks := ShaderMaterial.new()
	planks.shader = _shaders["bark"]
	planks.set_shader_parameter("albedo_tex", _textures["plank_detail"])
	planks.set_shader_parameter("tint_dark", Color(0.15, 0.12, 0.09))
	planks.set_shader_parameter("tint_light", Color(0.38, 0.32, 0.25))
	planks.set_shader_parameter("wind_enabled", 0.0)
	_materials["planks"] = planks
	_wet_materials.append(planks)

	var rot_planks := ShaderMaterial.new()
	rot_planks.shader = _shaders["bark"]
	rot_planks.set_shader_parameter("albedo_tex", _textures["plank_detail"])
	rot_planks.set_shader_parameter("tint_dark", Color(0.075, 0.075, 0.065))
	rot_planks.set_shader_parameter("tint_light", Color(0.21, 0.20, 0.17))
	rot_planks.set_shader_parameter("wind_enabled", 0.0)
	_materials["rot_planks"] = rot_planks
	_wet_materials.append(rot_planks)

	# --- inert surfaces ----------------------------------------------------
	_materials["stone"] = _standard(_textures["rock_detail"], Color(0.24, 0.245, 0.25), 0.95, 0.05)
	_materials["cliff"] = _standard(_textures["rock_detail"], Color(0.19, 0.19, 0.20), 0.98, 0.03)
	_materials["concrete"] = _standard(_textures["concrete_detail"], Color(0.28, 0.28, 0.27), 0.9, 0.05)
	_materials["rust"] = _standard(_textures["metal_detail"], Color(0.28, 0.16, 0.10), 0.75, 0.35)
	_materials["metal"] = _standard(_textures["metal_detail"], Color(0.32, 0.33, 0.35), 0.45, 0.85)
	_materials["fabric"] = _standard(_textures["dirt_detail"], Color(0.22, 0.19, 0.15), 1.0, 0.0)
	_materials["paper"] = _standard(_textures["paper"], Color(1, 1, 1), 0.95, 0.0)
	_materials["marker"] = _standard(_textures["concrete_detail"], Color(0.36, 0.36, 0.34), 0.85, 0.02)

	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.55, 0.62, 0.62, 0.22)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.roughness = 0.08
	glass.metallic = 0.1
	glass.cull_mode = BaseMaterial3D.CULL_DISABLED
	_materials["glass"] = glass

	# --- effects -----------------------------------------------------------
	var water := ShaderMaterial.new()
	water.shader = _shaders["water"]
	water.set_shader_parameter("wave_tex", _textures["water_normal"])
	_materials["water"] = water

	var swamp := ShaderMaterial.new()
	swamp.shader = _shaders["water"]
	swamp.set_shader_parameter("wave_tex", _textures["water_normal"])
	swamp.set_shader_parameter("murk", 0.85)
	swamp.set_shader_parameter("wave_height", 0.012)
	_materials["swamp_water"] = swamp

	var fog := ShaderMaterial.new()
	fog.shader = _shaders["fog_card"]
	fog.set_shader_parameter("fog_tex", _textures["fog_puff"])
	_materials["fog_card"] = fog

	var rain := ShaderMaterial.new()
	rain.shader = _shaders["rain_sheet"]
	rain.set_shader_parameter("streak_tex", _textures["rain_streaks"])
	_materials["rain"] = rain

	var figure := ShaderMaterial.new()
	figure.shader = _shaders["figure"]
	figure.set_shader_parameter("noise_tex", _textures["figure_noise"])
	_materials["figure"] = figure

	var pale := ShaderMaterial.new()
	pale.shader = _shaders["figure"]
	pale.set_shader_parameter("noise_tex", _textures["figure_noise"])
	pale.set_shader_parameter("body_colour", Color(0.10, 0.10, 0.095))
	pale.set_shader_parameter("rim_colour", Color(0.52, 0.50, 0.44))
	_materials["figure_pale"] = pale

	# --- fur / feathers ----------------------------------------------------
	_materials["fur_deer"] = _standard(_textures["dirt_detail"], Color(0.30, 0.22, 0.15), 0.95, 0.0)
	_materials["fur_fox"] = _standard(_textures["dirt_detail"], Color(0.44, 0.20, 0.08), 0.95, 0.0)
	_materials["fur_rabbit"] = _standard(_textures["dirt_detail"], Color(0.34, 0.30, 0.25), 0.95, 0.0)
	_materials["fur_squirrel"] = _standard(_textures["dirt_detail"], Color(0.26, 0.19, 0.13), 0.95, 0.0)
	_materials["feather_crow"] = _standard(_textures["metal_detail"], Color(0.045, 0.045, 0.055), 0.7, 0.05)
	_materials["feather_owl"] = _standard(_textures["dirt_detail"], Color(0.32, 0.27, 0.21), 0.9, 0.0)


func _standard(tex: Texture2D, tint: Color, roughness: float, metallic: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = tex
	mat.albedo_color = tint
	mat.roughness = roughness
	mat.metallic = metallic
	mat.uv1_triplanar = false
	mat.vertex_color_use_as_albedo = false
	# The generated detail textures are greyscale; multiplying keeps them
	# neutral while the albedo colour supplies the hue.
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	return mat


func _build_tree_meshes() -> void:
	var rng := RandomNumberGenerator.new()
	_pine_heights.resize(PINE_VARIANTS)
	for v in PINE_VARIANTS:
		rng.seed = 4400 + v * 17
		var height := 9.5 + float(v) * 2.1 + rng.randf_range(-0.8, 0.8)
		_pine_heights[v] = height
		for lod in LOD_COUNT:
			rng.seed = 4400 + v * 17  # same trunk lean across LODs
			_meshes["pine_%d_%d" % [v, lod]] = MeshFactory.pine_tree(rng, lod, height)
	for v in 3:
		rng.seed = 6600 + v * 23
		_meshes["dead_tree_%d" % v] = MeshFactory.dead_tree(rng, 8.0 + v * 2.4)
	for v in BUSH_VARIANTS:
		rng.seed = 7700 + v * 29
		_meshes["bush_%d" % v] = MeshFactory.bush(rng, 0.7 + v * 0.22)
		rng.seed = 7800 + v * 31
		_meshes["fern_%d" % v] = MeshFactory.fern(rng, 0.5 + v * 0.14)
	for v in 3:
		rng.seed = 7900 + v * 37
		_meshes["grass_%d" % v] = MeshFactory.grass_patch(rng, 6 + v * 3, 0.36 + v * 0.1)


func _build_prop_meshes() -> void:
	var rng := RandomNumberGenerator.new()
	for v in ROCK_VARIANTS:
		rng.seed = 8800 + v * 41
		_meshes["rock_%d" % v] = MeshFactory.rock(rng, 0.5 + v * 0.65, 1)
		rng.seed = 8800 + v * 41
		_meshes["rock_lod_%d" % v] = MeshFactory.rock(rng, 0.5 + v * 0.65, 0)
	for v in 3:
		rng.seed = 9100 + v * 43
		_meshes["log_%d" % v] = MeshFactory.log_prop(rng, 2.4 + v * 0.9, 0.22 + v * 0.06)
		rng.seed = 9200 + v * 47
		_meshes["stump_%d" % v] = MeshFactory.stump(rng, 0.35 + v * 0.12)
		rng.seed = 9300 + v * 53
		_meshes["gravestone_%d" % v] = MeshFactory.gravestone(rng)

	_meshes["crate"] = MeshFactory.crate(0.72)
	_meshes["barrel"] = MeshFactory.barrel(0.34, 0.9)
	_meshes["door"] = MeshFactory.plank_door()
	_meshes["sign"] = MeshFactory.sign_post()
	_meshes["fence"] = MeshFactory.fence_section()
	_meshes["antenna"] = MeshFactory.antenna_mast(9.0)
	_meshes["listening_post"] = MeshFactory.listening_post()
	_meshes["fog_card"] = MeshFactory.billboard(9.0, 4.0)
	_meshes["unit_plane"] = MeshFactory.plane(1.0, 1, 1.0)
	_meshes["water_plane"] = MeshFactory.plane(1.0, 8, 1.0)


func _build_creature_meshes() -> void:
	_meshes["torso_tall"] = MeshFactory.humanoid_torso(1.25, 1.35)
	_meshes["torso_broad"] = MeshFactory.humanoid_torso(1.0, 0.85)
	_meshes["head"] = MeshFactory.humanoid_head(1.0)
	_meshes["head_long"] = MeshFactory.humanoid_head(1.3)
	_meshes["limb_arm"] = MeshFactory.limb(0.72, 0.065)
	_meshes["limb_arm_long"] = MeshFactory.limb(1.02, 0.055)
	_meshes["limb_leg"] = MeshFactory.limb(0.86, 0.085)

	_meshes["body_deer"] = MeshFactory.quadruped_body(1.5, 0.66, 0.46)
	_meshes["body_fox"] = MeshFactory.quadruped_body(0.72, 0.28, 0.22)
	_meshes["body_rabbit"] = MeshFactory.quadruped_body(0.34, 0.20, 0.16)
	_meshes["body_squirrel"] = MeshFactory.quadruped_body(0.26, 0.14, 0.11)
	_meshes["limb_thin"] = MeshFactory.limb(0.42, 0.035)
	_meshes["limb_tiny"] = MeshFactory.limb(0.14, 0.022)
	_meshes["body_crow"] = MeshFactory.bird_body(0.26)
	_meshes["body_owl"] = MeshFactory.bird_body(0.34)
	_meshes["wing_crow"] = MeshFactory.bird_wing(0.34)
	_meshes["wing_owl"] = MeshFactory.bird_wing(0.46)

