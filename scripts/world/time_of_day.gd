class_name TimeOfDay
extends Node
## Day/night cycle: sun, moon, sky, ambient light and fog colour.
##
## The clock is authoritative in `GameState.time_of_day` (hours, 0..24) so it
## survives save/load without this node existing. Everything visual is derived
## from it each frame; nothing is animated or tweened, which means scrubbing the
## clock (for testing, or for a story beat that skips to dusk) is instant and
## consistent.
##
## Night is the game's default state and the dangerous one. The cycle is
## therefore weighted: dusk and night together occupy more of the loop than a
## real day would give them, and the "safe" window around noon is short.

const PHASES := ["deep_night", "dawn", "morning", "day", "dusk", "night"]

## Real seconds per in-game hour at the default speed.
const SECONDS_PER_HOUR := 55.0

## Sun elevation curve control points: hour -> elevation in degrees. The sun
## rises late and sets early, giving the basin long shadows for most of the day.
const SUNRISE := 6.4
const SUNSET := 18.6

signal phase_changed(phase: String)

var time_scale: float = 1.0
var paused: bool = false

var day_factor: float = 0.0        ## 0 fully night, 1 fully day
var sunset_factor: float = 0.0     ## peaks at the terminator
var sun_direction: Vector3 = Vector3.UP
var moon_direction: Vector3 = Vector3.DOWN
var moon_phase: float = 0.85

var _sun: DirectionalLight3D
var _moon: DirectionalLight3D
var _environment: Environment
var _sky_material: ShaderMaterial
var _phase := ""
var _last_hour := -1


func setup(sun: DirectionalLight3D, moon: DirectionalLight3D, environment: Environment,
		sky_material: ShaderMaterial) -> void:
	_sun = sun
	_moon = moon
	_environment = environment
	_sky_material = sky_material
	moon_phase = fmod(float(GameState.world_seed) * 0.000173, 1.0)
	_apply(true)


func _process(delta: float) -> void:
	if not paused:
		advance(delta / SECONDS_PER_HOUR * time_scale)
	_apply(false)


## Move the clock forward by `hours`, rolling the day counter.
func advance(hours: float) -> void:
	GameState.time_of_day += hours
	while GameState.time_of_day >= 24.0:
		GameState.time_of_day -= 24.0
		GameState.day += 1


## Jump straight to an hour. Used by story beats and the debug overlay.
func set_hour(hour: float) -> void:
	GameState.time_of_day = fposmod(hour, 24.0)
	_apply(true)


func hour() -> float:
	return GameState.time_of_day


func phase() -> String:
	return _phase


func is_night() -> bool:
	return day_factor < 0.25


## 0..1, how much the AI's sight benefits from ambient light right now.
func light_level() -> float:
	return clampf(day_factor * 0.85 + (1.0 - day_factor) * moon_phase * 0.15, 0.03, 1.0)


func formatted() -> String:
	var h := int(GameState.time_of_day)
	var m := int((GameState.time_of_day - float(h)) * 60.0)
	return "%02d:%02d" % [h, m]


# ---------------------------------------------------------------------------

func _apply(force: bool) -> void:
	var hours := GameState.time_of_day
	_update_factors(hours)
	_update_lights()
	_update_sky()
	_update_environment()

	var current_hour := int(hours)
	if current_hour != _last_hour:
		_last_hour = current_hour
		EventBus.hour_changed.emit(current_hour)

	var new_phase := _phase_for(hours)
	if new_phase != _phase or force:
		_phase = new_phase
		phase_changed.emit(_phase)
		EventBus.time_phase_changed.emit(_phase)


func _update_factors(hours: float) -> void:
	# Sun elevation: a sine arc between sunrise and sunset, below the horizon
	# outside that window.
	var elevation: float
	if hours >= SUNRISE and hours <= SUNSET:
		var t := (hours - SUNRISE) / (SUNSET - SUNRISE)
		elevation = sin(t * PI) * 68.0
	else:
		var night_span := 24.0 - (SUNSET - SUNRISE)
		var t := fposmod(hours - SUNSET, 24.0) / night_span
		elevation = -sin(t * PI) * 52.0

	var azimuth := deg_to_rad((hours / 24.0) * 360.0 - 90.0)
	var elev_rad := deg_to_rad(elevation)
	sun_direction = Vector3(
		cos(elev_rad) * cos(azimuth),
		sin(elev_rad),
		cos(elev_rad) * sin(azimuth)).normalized()
	moon_direction = -sun_direction

	# Daylight fades out below the horizon rather than snapping off, which is
	# what produces usable twilight.
	day_factor = clampf(smoothstep(-0.10, 0.16, sun_direction.y), 0.0, 1.0)
	# Warm band peaks when the sun is right at the horizon.
	sunset_factor = clampf(1.0 - absf(sun_direction.y) * 5.0, 0.0, 1.0)


func _update_lights() -> void:
	if _sun != null:
		# Point the light *along* -sun_direction: a DirectionalLight3D shines
		# down its local -Z.
		_sun.look_at_from_position(Vector3.ZERO, -sun_direction, Vector3.UP)
		_sun.light_energy = day_factor * 1.15
		_sun.visible = day_factor > 0.01
		_sun.light_color = Color(1.0, 0.96, 0.90).lerp(
				Color(1.0, 0.55, 0.32), sunset_factor)
		_sun.shadow_enabled = bool(PerformanceDirector.get_budget("shadows_enabled", true)) \
				and day_factor > 0.06
		_sun.directional_shadow_max_distance = float(
				PerformanceDirector.get_budget("shadow_distance", 80.0))

	if _moon != null:
		_moon.look_at_from_position(Vector3.ZERO, -moon_direction, Vector3.UP)
		var moon_up := clampf(moon_direction.y, 0.0, 1.0)
		_moon.light_energy = (1.0 - day_factor) * moon_up * 0.26 * (0.4 + moon_phase * 0.6)
		_moon.visible = _moon.light_energy > 0.005
		_moon.light_color = Color(0.62, 0.70, 0.88)
		# Moon shadows are a luxury; they are the first thing to go.
		_moon.shadow_enabled = bool(PerformanceDirector.get_budget("shadows_enabled", true)) \
				and PerformanceDirector.current_tier >= PerformanceDirector.Tier.MEDIUM


func _update_sky() -> void:
	if _sky_material == null:
		return
	_sky_material.set_shader_parameter("day_factor", day_factor)
	_sky_material.set_shader_parameter("sunset_factor", sunset_factor)
	_sky_material.set_shader_parameter("sun_direction", sun_direction)
	_sky_material.set_shader_parameter("moon_direction", moon_direction)
	_sky_material.set_shader_parameter("moon_phase", moon_phase)
	_sky_material.set_shader_parameter("star_intensity", 1.0 - day_factor)


func _update_environment() -> void:
	if _environment == null:
		return
	var brightness := float(Settings.get_value("brightness"))
	var night_ambient := Color(0.030, 0.036, 0.052)
	var day_ambient := Color(0.34, 0.37, 0.40)
	var dusk_ambient := Color(0.24, 0.15, 0.11)
	var ambient := night_ambient.lerp(day_ambient, day_factor).lerp(dusk_ambient, sunset_factor * 0.6)
	_environment.ambient_light_color = ambient
	_environment.ambient_light_energy = lerpf(0.55, 1.05, day_factor) * brightness

	var fog_night := Color(0.040, 0.046, 0.058)
	var fog_day := Color(0.55, 0.58, 0.60)
	var fog_dusk := Color(0.40, 0.24, 0.17)
	_environment.fog_light_color = fog_night.lerp(fog_day, day_factor).lerp(fog_dusk, sunset_factor * 0.7)
	_environment.fog_light_energy = lerpf(0.45, 1.0, day_factor)


func _phase_for(hours: float) -> String:
	if hours < 4.6:
		return "deep_night"
	if hours < SUNRISE + 1.2:
		return "dawn"
	if hours < 10.5:
		return "morning"
	if hours < 16.4:
		return "day"
	if hours < SUNSET + 1.4:
		return "dusk"
	return "night"
