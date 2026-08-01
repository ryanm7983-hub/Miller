class_name Player
extends CharacterBody3D
## First-person controller.
##
## The movement model is tuned around one idea: **noise is the currency**. Every
## speed the player can choose trades visibility and pace against how far the
## sound of them carries, and the AI's hearing reads exactly the value published
## here. Sprinting is not just faster, it is a decision to be heard.
##
##   crouch  1.5 m/s   noise 0.10   silent on almost any surface
##   walk    3.3 m/s   noise 0.35   audible at ~20 m in still air
##   sprint  6.0 m/s   noise 0.85   audible across a clearing, costs stamina
##
## Weather scales that down (`WeatherSystem.noise_masking()`), and surface
## scales it up — gravel and shallow water are loud whatever you do.

const WALK_SPEED := 3.3
const SPRINT_SPEED := 6.0
const CROUCH_SPEED := 1.5
const WADE_MULTIPLIER := 0.55
const JUMP_VELOCITY := 5.1
const JUMP_STAMINA_COST := 8.0

const ACCELERATION_GROUND := 11.0
const ACCELERATION_AIR := 2.2
const FRICTION := 13.0

const STAND_HEIGHT := 1.72
const CROUCH_HEIGHT := 1.02
const EYE_OFFSET := -0.16          ## eyes sit below the top of the capsule
const CROUCH_SPEED_LERP := 9.0

const STEP_DISTANCE_WALK := 2.1
const STEP_DISTANCE_SPRINT := 2.7
const STEP_DISTANCE_CROUCH := 2.4

const NOISE_CROUCH := 0.10
const NOISE_WALK := 0.35
const NOISE_SPRINT := 0.85
const NOISE_LAND := 0.6

const BOB_FREQUENCY := 1.9
const BOB_AMPLITUDE := 0.055
const LOOK_PITCH_LIMIT := 1.45

signal hide_state_changed(hidden: bool)

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera
@onready var collider: CollisionShape3D = $Collider
@onready var ceiling_probe: ShapeCast3D = $CeilingProbe

var stats: SurvivalStats
var input: PlayerInput
var flashlight: Flashlight
var interactor: Interactor

var is_crouching: bool = false
var is_sprinting: bool = false
var is_hidden: bool = false
var current_surface: String = "loam"
var wade_depth: float = 0.0

var _world: WorldRoot
var _yaw := 0.0
var _pitch := 0.0
var _bob_phase := 0.0
var _step_accumulator := 0.0
var _target_height := STAND_HEIGHT
var _base_fov := 75.0
var _hide_volumes: int = 0
var _was_on_floor := true
var _fall_speed := 0.0
var _footstep_variant := 0


func _ready() -> void:
	collision_layer = 4    # player
	collision_mask = 1 | 2 | 64  # terrain, static world, props
	add_to_group("player")

	stats = SurvivalStats.new()
	stats.name = "Stats"
	add_child(stats)

	input = PlayerInput.new()
	input.name = "Input"
	add_child(input)

	flashlight = Flashlight.new()
	flashlight.name = "Flashlight"
	head.add_child(flashlight)
	flashlight.setup(stats)

	interactor = Interactor.new()
	interactor.name = "Interactor"
	camera.add_child(interactor)
	interactor.setup(self)

	_base_fov = float(Settings.get_value("field_of_view"))
	camera.fov = _base_fov
	EventBus.settings_changed.connect(_on_settings_changed)
	stats.died.connect(_on_died)


## Called by the game scene once the world exists.
func setup(world: WorldRoot) -> void:
	_world = world


func spawn_at(position: Vector3, yaw: float) -> void:
	global_position = position
	_yaw = yaw
	_pitch = 0.0
	rotation = Vector3(0, _yaw, 0)
	head.rotation = Vector3.ZERO
	velocity = Vector3.ZERO
	EventBus.player_spawned.emit(self)


func restore_from_state() -> void:
	stats.load_from(GameState.player_vitals)
	spawn_at(GameState.player_position, GameState.player_yaw)


func write_to_state() -> void:
	GameState.player_position = global_position
	GameState.player_yaw = _yaw
	GameState.player_vitals = stats.to_dictionary()


# ---------------------------------------------------------------------------
# Frame
# ---------------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	if not stats.is_alive:
		_apply_gravity(delta)
		move_and_slide()
		return

	_apply_look(delta)
	_apply_crouch(delta)
	_apply_movement(delta)
	_apply_footsteps(delta)
	_update_environment()
	_update_actions()
	stats.tick(delta, _night_factor())
	_apply_camera_effects(delta)


func _apply_look(_delta: float) -> void:
	var look := input.consume_look()
	if look == Vector2.ZERO:
		return
	_yaw -= look.x
	_pitch = clampf(_pitch - look.y, -LOOK_PITCH_LIMIT, LOOK_PITCH_LIMIT)
	rotation = Vector3(0, _yaw, 0)
	head.rotation.x = _pitch


func _apply_crouch(delta: float) -> void:
	var wants := input.wants_crouch(is_crouching)
	if is_hidden:
		wants = true
	# Standing up into a low ceiling is refused rather than clipping through it.
	if is_crouching and not wants and _blocked_above():
		wants = true
	is_crouching = wants
	_target_height = CROUCH_HEIGHT if is_crouching else STAND_HEIGHT

	var capsule := collider.shape as CapsuleShape3D
	if capsule != null:
		var height := lerpf(capsule.height, _target_height, CROUCH_SPEED_LERP * delta)
		capsule.height = height
		collider.position.y = height * 0.5
		head.position.y = height + EYE_OFFSET


func _blocked_above() -> bool:
	if ceiling_probe == null:
		return false
	ceiling_probe.force_shapecast_update()
	return ceiling_probe.is_colliding()


func _apply_movement(delta: float) -> void:
	var wish := input.move_vector()
	var wants_sprint := input.wants_sprint(is_sprinting)
	is_sprinting = wants_sprint and wish.y > 0.25 and not is_crouching \
			and stats.can_sprint() and not is_hidden
	stats.is_sprinting = is_sprinting

	if is_hidden:
		# Hiding pins you in place; leaving is an explicit action.
		velocity = Vector3.ZERO
		move_and_slide()
		return

	var speed := CROUCH_SPEED if is_crouching else (SPRINT_SPEED if is_sprinting else WALK_SPEED)
	speed *= lerpf(1.0, WADE_MULTIPLIER, clampf(wade_depth, 0.0, 1.0))
	if stats.is_exhausted:
		speed *= 0.85

	var direction := (global_basis.x * wish.x + -global_basis.z * wish.y)
	direction.y = 0.0
	if direction.length_squared() > 0.0001:
		direction = direction.normalized()

	var on_floor := is_on_floor()
	var acceleration := ACCELERATION_GROUND if on_floor else ACCELERATION_AIR
	var target := direction * speed
	var horizontal := Vector3(velocity.x, 0, velocity.z)
	if direction.length_squared() > 0.0001:
		horizontal = horizontal.move_toward(target, acceleration * speed * delta)
	elif on_floor:
		horizontal = horizontal.move_toward(Vector3.ZERO, FRICTION * delta)
	velocity.x = horizontal.x
	velocity.z = horizontal.z

	if on_floor:
		if not _was_on_floor:
			_on_landed()
		if input.was_pressed("jump") and not is_crouching and stats.can_sprint():
			velocity.y = JUMP_VELOCITY
			stats.stamina = maxf(0.0, stats.stamina - JUMP_STAMINA_COST)
			EventBus.report_noise(global_position, 0.4, self)
		elif velocity.y < 0.0:
			velocity.y = -2.0  # keep the body pinned to slopes
	else:
		_apply_gravity(delta)
	_was_on_floor = on_floor
	_fall_speed = minf(_fall_speed, velocity.y) if not on_floor else 0.0

	move_and_slide()


func _apply_gravity(delta: float) -> void:
	velocity.y -= float(ProjectSettings.get_setting("physics/3d/default_gravity", 18.0)) * delta


func _on_landed() -> void:
	var impact := clampf(absf(_fall_speed) / 14.0, 0.0, 1.4)
	if impact < 0.15:
		return
	AudioDirector.play_3d("step_%s_0" % current_surface, global_position, -2.0, 0.82)
	EventBus.report_noise(global_position, NOISE_LAND * impact, self)
	if impact > 0.85:
		# Falls only hurt from a genuine height; ordinary drops do not.
		stats.damage((impact - 0.85) * 55.0, "fall")
	_fall_speed = 0.0


# ---------------------------------------------------------------------------
# Footsteps and noise
# ---------------------------------------------------------------------------

func _apply_footsteps(delta: float) -> void:
	if not is_on_floor() or is_hidden:
		return
	var horizontal := Vector3(velocity.x, 0, velocity.z).length()
	if horizontal < 0.35:
		_step_accumulator = 0.0
		return
	_step_accumulator += horizontal * delta
	var stride := STEP_DISTANCE_CROUCH if is_crouching \
			else (STEP_DISTANCE_SPRINT if is_sprinting else STEP_DISTANCE_WALK)
	if _step_accumulator < stride:
		return
	_step_accumulator = 0.0
	_emit_footstep()


func _emit_footstep() -> void:
	var loudness := NOISE_CROUCH if is_crouching else (NOISE_SPRINT if is_sprinting else NOISE_WALK)
	loudness *= _surface_loudness(current_surface)

	# Cycle rather than randomise so consecutive steps never repeat a sample.
	_footstep_variant = (_footstep_variant + 1) % AudioDirector.FOOTSTEP_VARIANTS
	var key := "step_%s_%d" % [current_surface, _footstep_variant]
	var volume := linear_to_db(clampf(loudness * 1.1, 0.05, 1.0))
	AudioDirector.play_3d(key, global_position, volume, randf_range(0.92, 1.08))
	if not is_crouching and randf() < 0.35:
		AudioDirector.play_3d("cloth_%d" % (randi() % 2), global_position, volume - 8.0,
				randf_range(0.9, 1.1))

	# Weather masks the player: the AI hears the reduced value, not the raw one.
	var masking := 0.0
	if _world != null and _world.weather != null:
		masking = _world.weather.noise_masking()
	EventBus.report_noise(global_position, loudness * (1.0 - masking), self)


## Surfaces are not equally forgiving. Gravel and water betray you.
func _surface_loudness(surface: String) -> float:
	match surface:
		"gravel": return 1.35
		"water": return 1.5
		"metal": return 1.4
		"stone": return 1.15
		"wood": return 1.1
		"moss": return 0.6
		_: return 1.0


## Work out what the player is standing on from the generator's surface mask
## rather than from a physics material, so it stays correct on terrain that is
## streamed in and out.
func _update_surface() -> void:
	if _world == null or _world.generator == null:
		return
	var x := global_position.x
	var z := global_position.z
	if wade_depth > 0.05:
		current_surface = "water"
		return
	if _world.generator.road_influence_at(x, z) > 0.45:
		current_surface = "gravel"
		return
	var mask := _world.generator.surface_mask(x, z)
	if mask.r > 0.5:
		current_surface = "stone"
	elif mask.b > 0.45:
		current_surface = "water"
	elif mask.g > 0.5:
		current_surface = "moss"
	else:
		current_surface = "loam"


# ---------------------------------------------------------------------------
# Environment sampling
# ---------------------------------------------------------------------------

func _update_environment() -> void:
	if _world == null:
		return
	var water_level := _world.generator.water_level_at(global_position.x, global_position.z)
	wade_depth = clampf((water_level - global_position.y) / 1.2, 0.0, 1.0)
	_update_surface()

	var region := _world.region_name_at(global_position)
	if region != GameState.current_region:
		GameState.current_region = region
		EventBus.player_moved_region.emit(region)

	# Darkness for the sanity model: ambient light, own torch, and shelter.
	var ambient := _world.time_of_day.light_level() if _world.time_of_day != null else 0.5
	var lit := ambient + flashlight.visibility_contribution() * 0.55
	stats.in_darkness = lit < 0.28
	stats.in_shelter = _hide_volumes > 0 or is_hidden

	AudioDirector.set_interior(1.0 if is_hidden else 0.0)
	AudioDirector.set_muffle(0.65 if is_hidden else 0.0)
	_update_ambience()


func _update_ambience() -> void:
	if _world == null or _world.generator == null:
		return
	var biome := _world.generator.biome_at(global_position.x, global_position.z)
	var night := _night_factor()

	# Insects belong to warm nights and stop when the weather turns.
	var rain := _world.weather.rain if _world.weather != null else 0.0
	AudioDirector.set_layer("insects", clampf(night * 0.55 * (1.0 - rain * 1.5), 0.0, 1.0))

	# Running water is louder the closer the player is to a watercourse; the
	# generator already knows where those are.
	var nearest_water := _distance_to_water()
	var water_level := clampf(1.0 - nearest_water / 45.0, 0.0, 1.0)
	AudioDirector.set_layer("water", water_level * 0.8)
	AudioDirector.set_layer_pitch("water", lerpf(1.25, 0.8, water_level))

	AudioDirector.set_layer("room", 1.0 if is_hidden else 0.0)
	# The sub-drone is the basin itself. It rises at night and as sanity falls.
	var dread := (1.0 - stats.sanity_fraction()) * 0.6 + night * 0.35
	AudioDirector.set_layer("drone", clampf(dread, 0.0, 0.9))
	if biome == WorldGenerator.Biome.SWAMP or stats.sanity_fraction() < 0.4:
		AudioDirector.set_layer_stream("drone", "bed_drone_wrong")
	else:
		AudioDirector.set_layer_stream("drone", "bed_drone")


func _distance_to_water() -> float:
	var best := 1000.0
	for lake: Dictionary in _world.generator.lakes():
		var centre: Vector2 = lake["centre"]
		best = minf(best, maxf(0.0,
				Vector2(global_position.x, global_position.z).distance_to(centre) - float(lake["radius"])))
	for river: Dictionary in _world.generator.rivers():
		var path: PackedVector2Array = river["path"]
		# Sampling every fourth point is plenty at these distances and keeps the
		# per-frame cost flat as the river network grows.
		for i in range(0, path.size(), 4):
			best = minf(best, Vector2(global_position.x, global_position.z).distance_to(path[i]))
	return best


func _night_factor() -> float:
	if _world == null or _world.time_of_day == null:
		return 0.0
	return 1.0 - _world.time_of_day.day_factor


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

func _update_actions() -> void:
	if input.was_pressed("flashlight"):
		flashlight.toggle()
	if input.was_pressed("interact"):
		if is_hidden:
			leave_hiding()
		elif not interactor.activate() and _hide_volumes > 0:
			enter_hiding()


func _apply_camera_effects(delta: float) -> void:
	var bob_setting := float(Settings.get_value("head_bob"))
	var horizontal := Vector3(velocity.x, 0, velocity.z).length()
	var moving := is_on_floor() and horizontal > 0.4 and not is_hidden

	if moving and bob_setting > 0.01:
		var rate := BOB_FREQUENCY * (horizontal / WALK_SPEED)
		_bob_phase += delta * rate * TAU
		var amount := BOB_AMPLITUDE * bob_setting * (1.4 if is_sprinting else 1.0)
		camera.position.y = sin(_bob_phase) * amount
		camera.position.x = cos(_bob_phase * 0.5) * amount * 0.7
	else:
		_bob_phase = 0.0
		camera.position.x = lerpf(camera.position.x, 0.0, delta * 8.0)
		camera.position.y = lerpf(camera.position.y, 0.0, delta * 8.0)

	# Sprint widens the view slightly; being hunted narrows it.
	var target_fov := _base_fov
	if is_sprinting:
		target_fov += 6.0
	if is_crouching:
		target_fov -= 3.0
	target_fov -= stats.threat_proximity * 5.0
	camera.fov = lerpf(camera.fov, target_fov, delta * 5.0)


# ---------------------------------------------------------------------------
# Hiding
# ---------------------------------------------------------------------------

func register_hide_volume(entering: bool) -> void:
	_hide_volumes = maxi(0, _hide_volumes + (1 if entering else -1))
	if _hide_volumes == 0 and is_hidden:
		leave_hiding()


func can_hide() -> bool:
	return _hide_volumes > 0 and not is_hidden and stats.is_alive


func enter_hiding() -> void:
	if not can_hide():
		return
	is_hidden = true
	is_crouching = true
	velocity = Vector3.ZERO
	interactor.is_active = false
	AudioDirector.play_2d("cloth_0", -6.0, 0.9)
	hide_state_changed.emit(true)
	EventBus.player_hide_state_changed.emit(true)


func leave_hiding() -> void:
	if not is_hidden:
		return
	is_hidden = false
	interactor.is_active = true
	AudioDirector.play_2d("cloth_1", -6.0, 1.0)
	EventBus.report_noise(global_position, 0.25, self)
	hide_state_changed.emit(false)
	EventBus.player_hide_state_changed.emit(false)


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------

## How easy the player currently is to see, 0..1. Read by enemy perception.
func visibility() -> float:
	var value := 0.55
	if is_crouching:
		value -= 0.22
	if is_sprinting:
		value += 0.2
	value += flashlight.visibility_contribution() * 0.5
	if is_hidden:
		value = 0.02
	if _world != null and _world.time_of_day != null:
		value *= lerpf(0.45, 1.0, _world.time_of_day.light_level())
	if _world != null and _world.weather != null:
		value *= _world.weather.visibility_factor()
	return clampf(value, 0.0, 1.0)


## Eye position, used for line-of-sight tests from the AI's side.
func eye_position() -> Vector3:
	return camera.global_position


func set_input_enabled(value: bool) -> void:
	input.enabled = value
	interactor.is_active = value and not is_hidden
	if not value:
		input.clear()


func _on_died(cause: String) -> void:
	set_input_enabled(false)
	EventBus.game_over.emit(cause)


func _on_settings_changed(key: String, value: Variant) -> void:
	if key == "field_of_view":
		_base_fov = float(value)
