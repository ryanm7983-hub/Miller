extends Node
## Adaptive graphics scaling.
##
## The browser gives us no reliable way to know what hardware we landed on, so
## the game starts at a guess (Platform.initial_hardware_class) and then
## *measures*. A rolling frame-time window drives a hysteretic ladder: sustained
## slowness steps the tier down quickly, sustained headroom steps it up slowly.
## Dropping frames is far worse for a horror game than looking slightly worse,
## so the asymmetry is deliberate.
##
## Every visual system reads its budget from `profile()` and reacts to
## EventBus.quality_tier_changed. Nothing else is allowed to guess.

enum Tier { POTATO, LOW, MEDIUM, HIGH }

## Static per-tier budgets. Values are deliberately conservative on the low end
## because a phone browser also has to run compositing and a video decoder.
const PROFILES := {
	Tier.POTATO: {
		"name": "Potato",
		"stream_radius": 2,
		"tree_density": 0.30,
		"detail_density": 0.10,
		"grass_enabled": false,
		"shadows_enabled": false,
		"shadow_distance": 0.0,
		"render_scale": 0.65,
		"terrain_resolution": 24,
		"max_wildlife": 4,
		"max_enemies": 2,
		"rain_particles": 250,
		"fog_cards": 0,
		"water_reflections": false,
		"flashlight_shadows": false,
		"max_dynamic_lights": 2,
		"vegetation_wind": false,
	},
	Tier.LOW: {
		"name": "Low",
		"stream_radius": 3,
		"tree_density": 0.50,
		"detail_density": 0.25,
		"grass_enabled": true,
		"shadows_enabled": true,
		"shadow_distance": 45.0,
		"render_scale": 0.8,
		"terrain_resolution": 32,
		"max_wildlife": 8,
		"max_enemies": 3,
		"rain_particles": 600,
		"fog_cards": 6,
		"water_reflections": false,
		"flashlight_shadows": false,
		"max_dynamic_lights": 3,
		"vegetation_wind": true,
	},
	Tier.MEDIUM: {
		"name": "Medium",
		"stream_radius": 4,
		"tree_density": 0.75,
		"detail_density": 0.55,
		"grass_enabled": true,
		"shadows_enabled": true,
		"shadow_distance": 80.0,
		"render_scale": 1.0,
		"terrain_resolution": 48,
		"max_wildlife": 14,
		"max_enemies": 4,
		"rain_particles": 1200,
		"fog_cards": 12,
		"water_reflections": true,
		"flashlight_shadows": true,
		"max_dynamic_lights": 4,
		"vegetation_wind": true,
	},
	Tier.HIGH: {
		"name": "High",
		"stream_radius": 5,
		"tree_density": 1.0,
		"detail_density": 1.0,
		"grass_enabled": true,
		"shadows_enabled": true,
		"shadow_distance": 130.0,
		"render_scale": 1.0,
		"terrain_resolution": 64,
		"max_wildlife": 22,
		"max_enemies": 5,
		"rain_particles": 2200,
		"fog_cards": 20,
		"water_reflections": true,
		"flashlight_shadows": true,
		"max_dynamic_lights": 6,
		"vegetation_wind": true,
	},
}

const TARGET_FPS := 60.0
const DOWNGRADE_FPS := 42.0   ## below this for SUSTAIN_DOWN seconds -> step down
const UPGRADE_FPS := 57.0     ## above this for SUSTAIN_UP seconds -> step up
const SUSTAIN_DOWN := 2.5
const SUSTAIN_UP := 14.0
const COOLDOWN_AFTER_CHANGE := 4.0
const SAMPLE_WINDOW := 90

var current_tier: Tier = Tier.MEDIUM

var _samples: PackedFloat32Array = []
var _sample_head := 0
var _slow_time := 0.0
var _fast_time := 0.0
var _cooldown := 0.0
var _viewport: Viewport = null
var _smoothed_fps := 60.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_samples.resize(SAMPLE_WINDOW)
	_samples.fill(1.0 / TARGET_FPS)
	current_tier = _tier_from_settings()
	EventBus.settings_changed.connect(_on_settings_changed)
	call_deferred("_late_init")


func _late_init() -> void:
	_viewport = get_viewport()
	_apply_tier(current_tier)
	# Systems that spawned before us still need the opening tier broadcast.
	EventBus.quality_tier_changed.emit(int(current_tier))


func _process(delta: float) -> void:
	if delta <= 0.0:
		return
	_samples[_sample_head] = delta
	_sample_head = (_sample_head + 1) % SAMPLE_WINDOW
	var total := 0.0
	for s in _samples:
		total += s
	var avg := total / float(SAMPLE_WINDOW)
	_smoothed_fps = 1.0 / maxf(avg, 0.0001)

	if _cooldown > 0.0:
		_cooldown -= delta
		return
	if not Settings.get_value("auto_quality"):
		return

	if _smoothed_fps < DOWNGRADE_FPS:
		_slow_time += delta
		_fast_time = 0.0
	elif _smoothed_fps > UPGRADE_FPS:
		_fast_time += delta
		_slow_time = 0.0
	else:
		_slow_time = maxf(0.0, _slow_time - delta)
		_fast_time = maxf(0.0, _fast_time - delta)

	if _slow_time >= SUSTAIN_DOWN and current_tier > Tier.POTATO:
		_slow_time = 0.0
		set_tier((current_tier - 1) as Tier)
	elif _fast_time >= SUSTAIN_UP and current_tier < Tier.HIGH:
		_fast_time = 0.0
		set_tier((current_tier + 1) as Tier)


## The active budget dictionary. Callers must not mutate it.
func profile() -> Dictionary:
	return PROFILES[current_tier]


func get_budget(key: String, fallback: Variant = null) -> Variant:
	return PROFILES[current_tier].get(key, fallback)


func fps() -> float:
	return _smoothed_fps


func set_tier(tier: Tier) -> void:
	tier = clampi(tier, Tier.POTATO, Tier.HIGH) as Tier
	if tier == current_tier:
		return
	Log.info("perf", "quality %s -> %s (%.1f fps)" % [
		PROFILES[current_tier]["name"], PROFILES[tier]["name"], _smoothed_fps,
	])
	current_tier = tier
	_cooldown = COOLDOWN_AFTER_CHANGE
	_apply_tier(tier)
	EventBus.quality_tier_changed.emit(int(tier))


func tier_name() -> String:
	return PROFILES[current_tier]["name"]


func _tier_from_settings() -> Tier:
	var forced: int = Settings.get_value("quality_tier")
	if forced >= 0:
		return clampi(forced, 0, 3) as Tier
	match Platform.initial_hardware_class:
		0: return Tier.POTATO
		1: return Tier.LOW
		3: return Tier.HIGH
		_: return Tier.MEDIUM


func _apply_tier(tier: Tier) -> void:
	var p: Dictionary = PROFILES[tier]
	if _viewport != null:
		var scale: float = float(p["render_scale"]) * float(Settings.get_value("render_scale"))
		_viewport.scaling_3d_scale = clampf(scale, 0.5, 1.0)
		# Bilinear is the only 3D scaling mode that is cheap enough for WebGL2.
		_viewport.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	RenderingServer.directional_shadow_atlas_set_size(
		2048 if tier >= Tier.MEDIUM else 1024, tier >= Tier.LOW
	)


func _on_settings_changed(key: String, value: Variant) -> void:
	match key:
		"quality_tier":
			if int(value) >= 0:
				set_tier(clampi(int(value), 0, 3) as Tier)
			else:
				set_tier(_tier_from_settings())
		"render_scale":
			_apply_tier(current_tier)
		"auto_quality":
			_slow_time = 0.0
			_fast_time = 0.0
