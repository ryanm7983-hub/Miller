class_name WeatherSystem
extends Node
## Dynamic weather, and everything that hangs off it.
##
## Weather in a horror game is not decoration — it is a difficulty dial. Rain
## masks the player's footsteps *and* the creature's. Fog cuts sight for both.
## Wind moves the whole forest, which makes real movement harder to pick out.
## Every one of those effects is published here so the AI, the audio bed and the
## materials all read the same numbers.
##
## States never snap: a `Blend` interpolates all parameters toward the target
## profile, so a storm arrives over half a minute rather than between frames.

const STATES := {
	"clear": {
		"name": "Clear", "cloud": 0.12, "rain": 0.0, "fog": 0.55, "wind": 0.35,
		"thunder": 0.0, "weight_day": 3.0, "weight_night": 2.0, "min_minutes": 4.0,
	},
	"cloudy": {
		"name": "Overcast", "cloud": 0.62, "rain": 0.0, "fog": 0.85, "wind": 0.55,
		"thunder": 0.0, "weight_day": 3.0, "weight_night": 3.0, "min_minutes": 3.5,
	},
	"drizzle": {
		"name": "Light rain", "cloud": 0.75, "rain": 0.35, "fog": 1.05, "wind": 0.5,
		"thunder": 0.0, "weight_day": 2.0, "weight_night": 2.0, "min_minutes": 3.0,
	},
	"rain": {
		"name": "Rain", "cloud": 0.88, "rain": 0.8, "fog": 1.25, "wind": 0.9,
		"thunder": 0.05, "weight_day": 1.5, "weight_night": 2.0, "min_minutes": 3.0,
	},
	"storm": {
		"name": "Storm", "cloud": 1.0, "rain": 1.0, "fog": 1.4, "wind": 1.8,
		"thunder": 0.9, "weight_day": 0.6, "weight_night": 1.4, "min_minutes": 2.5,
	},
	"fog": {
		"name": "Heavy fog", "cloud": 0.5, "rain": 0.0, "fog": 2.6, "wind": 0.12,
		"thunder": 0.0, "weight_day": 1.0, "weight_night": 2.6, "min_minutes": 4.0,
	},
	"gale": {
		"name": "Gale", "cloud": 0.7, "rain": 0.12, "fog": 0.7, "wind": 2.4,
		"thunder": 0.0, "weight_day": 1.0, "weight_night": 1.2, "min_minutes": 2.5,
	},
}

const BLEND_SPEED := 0.045        ## fraction per second; ~22 s for a full change
const WIND_TURN_SPEED := 0.06

signal weather_changed(state_id: String, display_name: String)

## Current blended values. Read by AI, audio and materials.
var cloud: float = 0.12
var rain: float = 0.0
var fog: float = 0.55
var wind_strength: float = 0.35
var thunder_chance: float = 0.0
var wetness: float = 0.0
var wind_direction: Vector3 = Vector3(1, 0, 0.2).normalized()

var state_id: String = "clear"
var locked: bool = false          ## story beats can pin the weather

var _target: Dictionary = STATES["clear"]
var _time_in_state := 0.0
var _next_change := 240.0
var _thunder_timer := 0.0
var _lightning := 0.0
var _wind_target_angle := 0.0
var _rng := RandomNumberGenerator.new()

var _environment: Environment
var _sky_material: ShaderMaterial
var _rain_material: ShaderMaterial
var _time_of_day: TimeOfDay


func setup(environment: Environment, sky_material: ShaderMaterial,
		rain_material: ShaderMaterial, time_of_day: TimeOfDay) -> void:
	_environment = environment
	_sky_material = sky_material
	_rain_material = rain_material
	_time_of_day = time_of_day
	_rng.seed = GameState.world_seed + 4242
	_wind_target_angle = _rng.randf() * TAU
	set_state(GameState.weather_id, true)


func _process(delta: float) -> void:
	_time_in_state += delta
	if not locked and _time_in_state > _next_change:
		set_state(_pick_next(), false)
	_blend(delta)
	_update_wind(delta)
	_update_thunder(delta)
	_push_to_systems()


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

func set_state(new_state: String, immediate: bool) -> void:
	if not STATES.has(new_state):
		new_state = "clear"
	state_id = new_state
	GameState.weather_id = new_state
	_target = STATES[new_state]
	_time_in_state = 0.0
	_next_change = float(_target["min_minutes"]) * 60.0 * _rng.randf_range(0.8, 1.6)
	if immediate:
		cloud = float(_target["cloud"])
		rain = float(_target["rain"])
		fog = float(_target["fog"])
		wind_strength = float(_target["wind"])
		thunder_chance = float(_target["thunder"])
		wetness = clampf(rain, 0.0, 1.0)
	weather_changed.emit(state_id, String(_target["name"]))
	EventBus.weather_changed.emit(state_id)
	Log.info("weather", "-> %s" % _target["name"])


## Pin the weather for a scripted sequence, then release it.
func lock_to(new_state: String) -> void:
	set_state(new_state, false)
	locked = true


func unlock() -> void:
	locked = false
	_next_change = 60.0


func display_name() -> String:
	return String(_target.get("name", "Clear"))


func _pick_next() -> String:
	var is_night: bool = _time_of_day != null and _time_of_day.is_night()
	var key := "weight_night" if is_night else "weight_day"
	var total := 0.0
	var candidates: Array[String] = []
	var weights: Array[float] = []
	for id: String in STATES:
		if id == state_id:
			continue  # never repeat; a change should be noticeable
		var weight := float(STATES[id][key])
		# Weather has inertia: it is far more likely to step one level of
		# severity than to jump from clear to storm.
		weight *= _adjacency(state_id, id)
		candidates.append(id)
		weights.append(weight)
		total += weight
	var roll := _rng.randf() * total
	for i in candidates.size():
		roll -= weights[i]
		if roll <= 0.0:
			return candidates[i]
	return "cloudy"


## Severity ladder used to keep transitions plausible.
const SEVERITY := {
	"clear": 0, "fog": 1, "cloudy": 1, "gale": 2, "drizzle": 2, "rain": 3, "storm": 4,
}


func _adjacency(from_state: String, to_state: String) -> float:
	var gap: int = absi(int(SEVERITY.get(from_state, 0)) - int(SEVERITY.get(to_state, 0)))
	match gap:
		0: return 1.0
		1: return 1.4
		2: return 0.5
		_: return 0.12


func _blend(delta: float) -> void:
	var t := clampf(BLEND_SPEED * delta * 60.0, 0.0, 1.0)
	cloud = lerpf(cloud, float(_target["cloud"]), t)
	rain = lerpf(rain, float(_target["rain"]), t)
	fog = lerpf(fog, float(_target["fog"]), t)
	wind_strength = lerpf(wind_strength, float(_target["wind"]), t)
	thunder_chance = lerpf(thunder_chance, float(_target["thunder"]), t)
	# Ground dries far more slowly than it wets.
	var dry_rate := 0.012 if rain < 0.05 else 0.0
	wetness = clampf(maxf(wetness - dry_rate * delta, 0.0) + rain * delta * 0.09, 0.0, 1.0)
	if rain > 0.02:
		wetness = maxf(wetness, rain * 0.75)


func _update_wind(delta: float) -> void:
	# The wind wanders rather than jumping, and gusts harder in a storm.
	if _rng.randf() < delta * 0.05:
		_wind_target_angle += _rng.randf_range(-0.9, 0.9)
	var current := atan2(wind_direction.z, wind_direction.x)
	var next := lerp_angle(current, _wind_target_angle, WIND_TURN_SPEED * delta)
	wind_direction = Vector3(cos(next), 0.0, sin(next))
	EventBus.wind_changed.emit(wind_direction, wind_strength)


func _update_thunder(delta: float) -> void:
	_lightning = maxf(0.0, _lightning - delta * 4.0)
	if thunder_chance <= 0.001:
		return
	_thunder_timer -= delta
	if _thunder_timer > 0.0:
		return
	_thunder_timer = _rng.randf_range(6.0, 26.0) / maxf(thunder_chance, 0.05)
	var near := _rng.randf() < thunder_chance * 0.45
	if not bool(Settings.get_value("reduce_flashing")):
		_lightning = 2.2 if near else 0.7
	AudioDirector.play_2d("thunder_near" if near else "thunder_far",
			-3.0 if near else -10.0, _rng.randf_range(0.9, 1.1), "Ambience")
	# Distant thunder is a legitimate sound source: it startles wildlife and
	# briefly deafens everything that hunts by ear.
	EventBus.report_noise(Vector3.ZERO, 1.0 if near else 0.4, self)


func _push_to_systems() -> void:
	AssetFoundry.set_wind(wind_direction, wind_strength, 1.0 + wind_strength * 0.5)
	AssetFoundry.set_wetness(wetness)

	if _sky_material != null:
		_sky_material.set_shader_parameter("cloud_coverage", clampf(cloud, 0.0, 1.0))
		_sky_material.set_shader_parameter("cloud_darkness", clampf(rain * 0.8 + cloud * 0.2, 0.0, 1.0))
		_sky_material.set_shader_parameter("cloud_speed", 0.004 + wind_strength * 0.010)
		_sky_material.set_shader_parameter("haze", clampf(fog * 0.35, 0.0, 1.0))
		_sky_material.set_shader_parameter("lightning_flash", _lightning)

	if _environment != null:
		var user_fog := float(Settings.get_value("fog_density"))
		var night_bonus := 0.0
		if _time_of_day != null:
			night_bonus = (1.0 - _time_of_day.day_factor) * 0.35
		_environment.fog_density = clampf((0.0055 + fog * 0.011 + night_bonus * 0.006) * user_fog,
				0.0, 0.2)

	if _rain_material != null:
		_rain_material.set_shader_parameter("intensity", clampf(rain, 0.0, 1.0))
		_rain_material.set_shader_parameter("slant", wind_direction.x * wind_strength * 0.16)
		_rain_material.set_shader_parameter("fall_speed", 2.6 + rain * 2.4)

	var water := AssetFoundry.material("water") as ShaderMaterial
	if water != null:
		water.set_shader_parameter("rain_ripples", clampf(rain, 0.0, 1.0))

	_update_ambience()


func _update_ambience() -> void:
	# Wind bed: level and pitch both track strength, so a gale is not just a
	# louder breeze.
	AudioDirector.set_layer("wind", clampf(0.12 + wind_strength * 0.42, 0.0, 1.0))
	AudioDirector.set_layer_pitch("wind", clampf(0.82 + wind_strength * 0.22, 0.6, 1.5))

	AudioDirector.set_layer("rain", clampf(rain * 1.1, 0.0, 1.0))
	AudioDirector.set_layer_pitch("rain", clampf(0.9 + rain * 0.25, 0.7, 1.4))
	if rain > 0.55:
		AudioDirector.set_layer_stream("rain", "bed_rain_heavy")
	elif rain > 0.02 and rain < 0.4:
		AudioDirector.set_layer_stream("rain", "bed_rain_light")


# ---------------------------------------------------------------------------
# Queries used by other systems
# ---------------------------------------------------------------------------

## Multiplier on how far anything can see, 0..1. Combines fog and rain.
func visibility_factor() -> float:
	var from_fog := clampf(1.0 - (fog - 0.5) * 0.34, 0.25, 1.0)
	var from_rain := clampf(1.0 - rain * 0.35, 0.5, 1.0)
	return clampf(from_fog * from_rain, 0.15, 1.0)


## Multiplier on how far a sound carries to a listener, 0..1. Heavy rain and
## strong wind bury quiet sounds.
func hearing_factor() -> float:
	return clampf(1.0 - rain * 0.45 - wind_strength * 0.18, 0.25, 1.0)


## Extra noise the player is allowed to make before anything notices.
func noise_masking() -> float:
	return clampf(rain * 0.5 + wind_strength * 0.2, 0.0, 0.75)


func lightning_intensity() -> float:
	return _lightning
