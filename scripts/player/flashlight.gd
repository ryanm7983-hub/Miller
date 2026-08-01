class_name Flashlight
extends SpotLight3D
## The torch: the player's only reliable light, and their loudest tell.
##
## Two design notes worth keeping:
##
##  * The beam is *narrow*. A wide beam turns a forest at night into a lit room
##    and removes the game. A narrow one means you choose what to look at, and
##    what you are not looking at is where things happen.
##  * Flicker is not random decoration. It is driven by battery level, by sanity
##    and by the horror director's proximity value, so a stuttering torch always
##    means something — either "change your battery" or "it is close".

const BASE_ENERGY := 3.4
const BASE_ANGLE := 21.0
const DRAIN_PER_SECOND := 0.62
const LOW_BATTERY_THRESHOLD := 0.22
const CRITICAL_BATTERY_THRESHOLD := 0.08

signal toggled(on: bool)

var is_on: bool = false

## 0..1, raised by the horror director. High values make the torch misbehave.
var interference: float = 0.0

var _stats: SurvivalStats
var _flicker := 1.0
var _flicker_timer := 0.0
var _dying_phase := 0.0
var _rng := RandomNumberGenerator.new()


func setup(stats: SurvivalStats) -> void:
	_stats = stats
	_rng.randomize()
	light_color = Color(0.98, 0.94, 0.83)
	light_energy = 0.0
	spot_angle = BASE_ANGLE
	spot_angle_attenuation = 1.35
	spot_range = 34.0
	spot_attenuation = 1.2
	light_projector = AssetFoundry.texture("light_cookie")
	shadow_enabled = bool(PerformanceDirector.get_budget("flashlight_shadows", true))
	visible = false
	EventBus.quality_tier_changed.connect(_on_quality_changed)


func toggle() -> void:
	set_on(not is_on)


func set_on(value: bool) -> void:
	if is_on == value:
		return
	if value and _stats != null and _stats.battery <= 0.0:
		# A dead torch still clicks. The player should hear that it did nothing.
		AudioDirector.play_2d("switch", -14.0, 0.8)
		return
	is_on = value
	visible = value
	AudioDirector.play_2d("switch", -9.0, 1.0 if value else 0.85)
	# A torch click is a small but real noise, and it is a light source the
	# things out there can see.
	EventBus.report_noise(global_position, 0.18, self)
	toggled.emit(is_on)
	EventBus.flashlight_toggled.emit(is_on)


func _process(delta: float) -> void:
	if _stats == null:
		return
	if is_on:
		_stats.consume_battery(DRAIN_PER_SECOND * delta)
		if _stats.battery <= 0.0:
			set_on(false)
			return
	_update_flicker(delta)
	light_energy = BASE_ENERGY * _flicker if is_on else 0.0


func _update_flicker(delta: float) -> void:
	if not is_on:
		_flicker = 1.0
		return

	var charge := _stats.battery_fraction()
	var target := 1.0

	# Dimming as the cell runs down: continuous, not a cliff.
	target *= lerpf(0.45, 1.0, clampf(charge / LOW_BATTERY_THRESHOLD, 0.0, 1.0))

	# Stutter frequency rises as the battery dies and as something approaches.
	var instability := 0.0
	if charge < LOW_BATTERY_THRESHOLD:
		instability += (1.0 - charge / LOW_BATTERY_THRESHOLD) * 0.6
	if charge < CRITICAL_BATTERY_THRESHOLD:
		instability += 0.5
	instability += interference
	if _stats.sanity_fraction() < 0.35:
		instability += (0.35 - _stats.sanity_fraction()) * 1.2

	if instability > 0.02 and not bool(Settings.get_value("reduce_flashing")):
		_flicker_timer -= delta
		if _flicker_timer <= 0.0:
			_flicker_timer = _rng.randf_range(0.04, 0.9) / maxf(instability, 0.05)
			_dying_phase = _rng.randf()
			if _dying_phase < 0.55:
				EventBus.flashlight_flickered.emit(instability)
		# A short hard drop reads as a fault; a slow sine reads as a dying cell.
		if _dying_phase < 0.55:
			target *= lerpf(1.0, 0.08, clampf(_flicker_timer * 6.0, 0.0, 1.0))
		else:
			target *= 0.75 + 0.25 * sin(Time.get_ticks_msec() * 0.03)

	_flicker = lerpf(_flicker, clampf(target, 0.0, 1.0), delta * 22.0)


## How visible the player is because of the torch, 0..1. Read by enemy sight.
func visibility_contribution() -> float:
	return _flicker * 0.9 if is_on else 0.0


func _on_quality_changed(_tier: int) -> void:
	shadow_enabled = bool(PerformanceDirector.get_budget("flashlight_shadows", true))
