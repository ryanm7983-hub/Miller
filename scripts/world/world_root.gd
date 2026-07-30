class_name WorldRoot
extends Node3D
## Assembles the basin and owns its environment.
##
## Everything under here is constructed in code rather than saved in a scene:
## the world is a function of the seed, so a `.tscn` could only ever hold the
## handful of nodes that are the same every time, and keeping those in code too
## means there is exactly one place to look.
##
## Load order matters and is enforced by `build()`:
##   generator layout -> environment -> water -> chunks -> occupants.
## Chunks sample the generator, water needs the carved beds, and anything that
## stands on the ground needs the chunks under it.

const FOG_CARD_RADIUS := 46.0
const RAIN_CYLINDER_RADIUS := 15.0

signal world_built()

var generator: WorldGenerator
var chunks: ChunkManager
var water: WaterManager
var time_of_day: TimeOfDay
var weather: WeatherSystem

var _environment: Environment
var _sky_material: ShaderMaterial
var _rain_material: ShaderMaterial
var _sun: DirectionalLight3D
var _moon: DirectionalLight3D
var _rain_cylinder: MeshInstance3D
var _fog_cards: Array[MeshInstance3D] = []
var _tracked: Node3D = null
var _rng := RandomNumberGenerator.new()


## `tracked` is whatever the world should stream around — the player, or a
## free-flying camera in the preview scene.
func build(tracked: Node3D) -> void:
	_tracked = tracked
	_rng.seed = GameState.world_seed + 99

	generator = WorldGenerator.new(GameState.world_seed)
	generator.build()

	_build_environment()

	water = WaterManager.new()
	water.name = "Water"
	add_child(water)
	water.build(generator)

	chunks = ChunkManager.new()
	chunks.name = "Chunks"
	add_child(chunks)
	chunks.setup(generator, _tracked)

	_build_weather_effects()
	world_built.emit()
	EventBus.world_ready.emit()


## Fill in the terrain around a point before the player can see it.
func prime_around(position: Vector3, on_progress: Callable = Callable()) -> void:
	await chunks.prime_async(position, on_progress)


func _process(delta: float) -> void:
	if _tracked == null or not is_instance_valid(_tracked):
		return
	_update_rain(delta)
	_update_fog_cards(delta)


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

func _build_environment() -> void:
	_sky_material = ShaderMaterial.new()
	_sky_material.shader = load("res://shaders/sky.gdshader")

	var sky := Sky.new()
	sky.sky_material = _sky_material
	# The procedural sky is cheap to evaluate but there is no reason to
	# re-render the radiance cubemap every frame on a phone.
	sky.process_mode = Sky.PROCESS_MODE_REALTIME
	sky.radiance_size = Sky.RADIANCE_SIZE_128

	_environment = Environment.new()
	_environment.background_mode = Environment.BG_SKY
	_environment.sky = sky
	_environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	_environment.ambient_light_color = Color(0.05, 0.06, 0.08)
	_environment.ambient_light_energy = 0.7
	_environment.fog_enabled = true
	_environment.fog_mode = Environment.FOG_MODE_EXPONENTIAL
	_environment.fog_density = 0.008
	_environment.fog_aerial_perspective = 0.35
	_environment.fog_sky_affect = 0.5
	_environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_environment.tonemap_white = 4.0

	var holder := WorldEnvironment.new()
	holder.name = "WorldEnvironment"
	holder.environment = _environment
	add_child(holder)

	_sun = DirectionalLight3D.new()
	_sun.name = "Sun"
	_sun.shadow_enabled = true
	_sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	_sun.directional_shadow_blend_splits = false
	_sun.shadow_bias = 0.04
	_sun.light_specular = 0.4
	add_child(_sun)

	_moon = DirectionalLight3D.new()
	_moon.name = "Moon"
	_moon.shadow_enabled = false
	_moon.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	_moon.light_specular = 0.1
	add_child(_moon)

	time_of_day = TimeOfDay.new()
	time_of_day.name = "TimeOfDay"
	add_child(time_of_day)
	time_of_day.setup(_sun, _moon, _environment, _sky_material)

	_rain_material = AssetFoundry.material("rain") as ShaderMaterial

	weather = WeatherSystem.new()
	weather.name = "Weather"
	add_child(weather)
	weather.setup(_environment, _sky_material, _rain_material, time_of_day)


# ---------------------------------------------------------------------------
# Weather effects that follow the camera
# ---------------------------------------------------------------------------

func _build_weather_effects() -> void:
	# Rain: two nested open cylinders that ride with the player. See
	# shaders/rain_sheet.gdshader for why this beats a particle system here.
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = RAIN_CYLINDER_RADIUS
	cylinder.bottom_radius = RAIN_CYLINDER_RADIUS
	cylinder.height = 22.0
	cylinder.radial_segments = 20
	cylinder.rings = 1
	cylinder.cap_top = false
	cylinder.cap_bottom = false
	cylinder.material = _rain_material

	_rain_cylinder = MeshInstance3D.new()
	_rain_cylinder.name = "Rain"
	_rain_cylinder.mesh = cylinder
	_rain_cylinder.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_rain_cylinder)

	var inner := MeshInstance3D.new()
	inner.mesh = cylinder
	inner.scale = Vector3(0.45, 0.9, 0.45)
	inner.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_rain_cylinder.add_child(inner)

	_rebuild_fog_cards()
	EventBus.quality_tier_changed.connect(func(_tier: int) -> void: _rebuild_fog_cards())


func _rebuild_fog_cards() -> void:
	for card in _fog_cards:
		if is_instance_valid(card):
			card.queue_free()
	_fog_cards.clear()
	var count: int = int(PerformanceDirector.get_budget("fog_cards", 12))
	for i in count:
		var card := MeshInstance3D.new()
		card.mesh = AssetFoundry.mesh("fog_card")
		card.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		card.position = _random_fog_position(Vector3.ZERO)
		add_child(card)
		_fog_cards.append(card)


func _random_fog_position(around: Vector3) -> Vector3:
	var angle := _rng.randf() * TAU
	var distance := _rng.randf_range(8.0, FOG_CARD_RADIUS)
	var x := around.x + cos(angle) * distance
	var z := around.z + sin(angle) * distance
	var ground := generator.height_at(x, z) if generator != null else 0.0
	return Vector3(x, ground - 0.6, z)


func _update_rain(_delta: float) -> void:
	if _rain_cylinder == null:
		return
	var active := weather != null and weather.rain > 0.01
	_rain_cylinder.visible = active
	if active:
		_rain_cylinder.global_position = _tracked.global_position + Vector3(0, 2.0, 0)


## Fog banks drift with the wind and are recycled once they fall behind the
## player, so a fixed number of cards always surrounds them.
func _update_fog_cards(delta: float) -> void:
	if _fog_cards.is_empty() or weather == null:
		return
	var drift := weather.wind_direction * (0.35 + weather.wind_strength * 0.5) * delta
	var centre := _tracked.global_position
	var opacity := clampf(weather.fog * 0.32, 0.0, 1.0)
	for card in _fog_cards:
		card.position += drift
		if Vector2(card.position.x - centre.x, card.position.z - centre.z).length() > FOG_CARD_RADIUS * 1.35:
			card.position = _random_fog_position(centre)
		card.visible = opacity > 0.02
		card.scale = Vector3(1.0, 1.0, 1.0) * (0.8 + weather.fog * 0.5)
	var fog_material := AssetFoundry.material("fog_card") as ShaderMaterial
	if fog_material != null:
		fog_material.set_shader_parameter("density", opacity)


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

## Ground height with props ignored — the cheap way to place things.
func ground_height(x: float, z: float) -> float:
	return generator.height_at(x, z) if generator != null else 0.0


## Snap a position to the terrain surface.
func on_ground(position: Vector3, offset: float = 0.0) -> Vector3:
	return Vector3(position.x, ground_height(position.x, position.z) + offset, position.z)


func region_name_at(position: Vector3) -> String:
	if generator == null:
		return "The Basin"
	var near := generator.nearest_poi(position, 70.0)
	if not near.is_empty():
		return String(near["name"])
	match generator.biome_at(position.x, position.z):
		WorldGenerator.Biome.DENSE_WOODS: return "Deep Woods"
		WorldGenerator.Biome.MEADOW: return "Open Meadow"
		WorldGenerator.Biome.SWAMP: return "The Sink"
		WorldGenerator.Biome.CLIFF: return "Broken Ground"
		WorldGenerator.Biome.SHORE: return "Waterside"
		WorldGenerator.Biome.BURN_SCAR: return "The Burn"
		WorldGenerator.Biome.ROAD: return "Fire Road"
		_: return "Black Pine Woods"
