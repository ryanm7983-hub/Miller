class_name Wildlife
extends CharacterBody3D
## Deer, foxes, rabbits, squirrels, crows and owls.
##
## Wildlife is not decoration here — it is the game's most honest information
## channel. Animals flee from things, and the player learns very quickly that a
## deer bolting past for no visible reason means something is behind them. That
## makes the forest feel inhabited *and* does a job no UI element could do
## without breaking the fiction.
##
## Everything is one script with a species table. Six near-identical scripts
## would have been six places to fix the same bug.

enum Species { DEER, FOX, RABBIT, SQUIRREL, CROW, OWL }
enum Mode { IDLE, GRAZE, ROAM, ALERT, FLEE, PERCH }

const SPECIES_DEFS := {
	Species.DEER: {
		"body": "body_deer", "limb": "limb_thin", "legs": 4, "material": "fur_deer",
		"scale": 1.0, "flee_distance": 22.0, "walk": 1.4, "flee_speed": 8.5,
		"call": "deer", "calls": 2, "call_chance": 0.05, "flying": false,
		"nocturnal": false, "height": 1.05, "startle_noise": 0.45,
	},
	Species.FOX: {
		"body": "body_fox", "limb": "limb_tiny", "legs": 4, "material": "fur_fox",
		"scale": 1.0, "flee_distance": 16.0, "walk": 1.9, "flee_speed": 7.0,
		"call": "scurry", "calls": 2, "call_chance": 0.03, "flying": false,
		"nocturnal": true, "height": 0.4, "startle_noise": 0.2,
	},
	Species.RABBIT: {
		"body": "body_rabbit", "limb": "limb_tiny", "legs": 4, "material": "fur_rabbit",
		"scale": 1.0, "flee_distance": 11.0, "walk": 0.8, "flee_speed": 6.5,
		"call": "scurry", "calls": 2, "call_chance": 0.02, "flying": false,
		"nocturnal": false, "height": 0.26, "startle_noise": 0.12,
	},
	Species.SQUIRREL: {
		"body": "body_squirrel", "limb": "limb_tiny", "legs": 4, "material": "fur_squirrel",
		"scale": 1.0, "flee_distance": 8.0, "walk": 1.1, "flee_speed": 5.0,
		"call": "scurry", "calls": 2, "call_chance": 0.06, "flying": false,
		"nocturnal": false, "height": 0.18, "startle_noise": 0.1,
	},
	Species.CROW: {
		"body": "body_crow", "wing": "wing_crow", "legs": 0, "material": "feather_crow",
		"scale": 1.0, "flee_distance": 15.0, "walk": 0.0, "flee_speed": 11.0,
		"call": "crow", "calls": 2, "call_chance": 0.09, "flying": true,
		"nocturnal": false, "height": 0.3, "startle_noise": 0.55,
	},
	Species.OWL: {
		"body": "body_owl", "wing": "wing_owl", "legs": 0, "material": "feather_owl",
		"scale": 1.0, "flee_distance": 13.0, "walk": 0.0, "flee_speed": 9.0,
		"call": "owl", "calls": 2, "call_chance": 0.07, "flying": true,
		"nocturnal": true, "height": 0.34, "startle_noise": 0.4,
	},
}

const DESPAWN_DISTANCE := 95.0
const PERCH_HEIGHT := Vector2(4.5, 9.0)

var species: Species = Species.DEER
var mode: Mode = Mode.IDLE

var _def: Dictionary = {}
var _world: WorldRoot
var _player: Player
var _rng := RandomNumberGenerator.new()
var _goal := Vector3.ZERO
var _timer := 0.0
var _limbs: Array[Node3D] = []
var _wings: Array[Node3D] = []
var _phase := 0.0
var _home := Vector3.ZERO
var _startled_by: Vector3 = Vector3.ZERO
var _flee_time := 0.0


func _ready() -> void:
	collision_layer = 16   # wildlife
	collision_mask = 1 | 2
	add_to_group("wildlife")
	_rng.randomize()


func setup(kind: Species, player: Player, world: WorldRoot, spawn: Vector3) -> void:
	species = kind
	_def = SPECIES_DEFS[kind]
	_player = player
	_world = world
	_home = spawn
	global_position = spawn
	_build()
	mode = Mode.PERCH if bool(_def["flying"]) else Mode.GRAZE
	EventBus.noise_emitted.connect(_on_noise)


func _build() -> void:
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = maxf(0.12, float(_def["height"]) * 0.35)
	capsule.height = maxf(0.3, float(_def["height"]))
	shape.shape = capsule
	shape.position = Vector3(0, float(_def["height"]) * 0.5, 0)
	add_child(shape)

	var material := AssetFoundry.material(String(_def["material"]))

	var body := MeshInstance3D.new()
	body.mesh = AssetFoundry.mesh(String(_def["body"]))
	body.material_override = material
	body.position = Vector3(0, float(_def["height"]), 0)
	body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(body)

	if bool(_def["flying"]):
		for side in [-1.0, 1.0]:
			var wing := Node3D.new()
			wing.position = Vector3(0.02 * side, float(_def["height"]), 0)
			wing.rotation.y = 0.0 if side > 0.0 else PI
			add_child(wing)
			var mesh := MeshInstance3D.new()
			mesh.mesh = AssetFoundry.mesh(String(_def["wing"]))
			mesh.material_override = material
			mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			wing.add_child(mesh)
			_wings.append(wing)
	else:
		for i in int(_def["legs"]):
			var leg := Node3D.new()
			var forward := 1.0 if i < 2 else -1.0
			var side := 1.0 if i % 2 == 0 else -1.0
			leg.position = Vector3(0.12 * side, float(_def["height"]) * 0.7,
					0.3 * forward * float(_def["height"]))
			add_child(leg)
			var mesh := MeshInstance3D.new()
			mesh.mesh = AssetFoundry.mesh(String(_def["limb"]))
			mesh.material_override = material
			mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			leg.add_child(mesh)
			_limbs.append(leg)


# ---------------------------------------------------------------------------
# Frame
# ---------------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	if _player == null or _world == null:
		return
	if global_position.distance_to(_player.global_position) > DESPAWN_DISTANCE:
		queue_free()
		return

	_timer -= delta
	_check_player_proximity()

	match mode:
		Mode.IDLE, Mode.GRAZE: _tick_graze(delta)
		Mode.ROAM: _tick_roam(delta)
		Mode.ALERT: _tick_alert(delta)
		Mode.FLEE: _tick_flee(delta)
		Mode.PERCH: _tick_perch(delta)

	if not bool(_def["flying"]):
		if is_on_floor():
			velocity.y = -1.0
		else:
			velocity.y -= 18.0 * delta
	move_and_slide()
	_animate(delta)
	_maybe_call(delta)


## The flee radius is the whole behavioural contract: get inside it and the
## animal leaves, loudly. That is what makes wildlife a warning system.
func _check_player_proximity() -> void:
	var distance := global_position.distance_to(_player.global_position)
	var trigger := float(_def["flee_distance"])
	# A crouching player gets much closer before anything bolts, which rewards
	# moving carefully with something other than safety.
	if _player.is_crouching:
		trigger *= 0.45
	elif _player.is_sprinting:
		trigger *= 1.5
	if distance < trigger and mode != Mode.FLEE:
		startle(_player.global_position)
	elif distance < trigger * 1.9 and mode in [Mode.GRAZE, Mode.IDLE, Mode.ROAM]:
		mode = Mode.ALERT
		_timer = 3.0


func startle(from: Vector3) -> void:
	if mode == Mode.FLEE:
		return
	mode = Mode.FLEE
	_startled_by = from
	_flee_time = _rng.randf_range(3.5, 7.0)
	AudioDirector.play_3d("%s_%d" % [_def["call"], _rng.randi() % int(_def["calls"])],
			global_position, -6.0, _rng.randf_range(0.9, 1.15))
	if bool(_def["flying"]):
		AudioDirector.play_3d("flap_small" if species == Species.CROW else "flap_large",
				global_position, -8.0, _rng.randf_range(0.9, 1.1))
	# A bolting animal is a real sound in the world, loud enough that the things
	# hunting the player can hear it too.
	EventBus.report_noise(global_position, float(_def["startle_noise"]), self)


func _tick_graze(delta: float) -> void:
	velocity.x = move_toward(velocity.x, 0.0, delta * 6.0)
	velocity.z = move_toward(velocity.z, 0.0, delta * 6.0)
	if _timer <= 0.0:
		_timer = _rng.randf_range(4.0, 14.0)
		mode = Mode.ROAM
		_goal = Steering.wander_target(_home, 18.0, _world, _rng)


func _tick_roam(delta: float) -> void:
	if global_position.distance_to(_goal) < 1.2 or _timer <= 0.0:
		mode = Mode.GRAZE
		_timer = _rng.randf_range(3.0, 11.0)
		return
	_move(_goal, float(_def["walk"]), delta)


func _tick_alert(delta: float) -> void:
	velocity.x = move_toward(velocity.x, 0.0, delta * 8.0)
	velocity.z = move_toward(velocity.z, 0.0, delta * 8.0)
	_face(_player.global_position, delta * 3.0)
	if _timer <= 0.0:
		mode = Mode.GRAZE
		_timer = _rng.randf_range(3.0, 9.0)


func _tick_flee(delta: float) -> void:
	_flee_time -= delta
	var away := global_position - _startled_by
	away.y = 0.0
	if away.length_squared() < 0.01:
		away = Vector3.FORWARD
	var target := global_position + away.normalized() * 22.0
	_move(target, float(_def["flee_speed"]), delta)
	if bool(_def["flying"]):
		# Birds climb as they go.
		global_position.y = move_toward(global_position.y,
				_world.ground_height(global_position.x, global_position.z) + PERCH_HEIGHT.y,
				delta * 6.0)
	if _flee_time <= 0.0:
		mode = Mode.PERCH if bool(_def["flying"]) else Mode.GRAZE
		_home = global_position
		_timer = _rng.randf_range(5.0, 14.0)


## Birds sit above the canopy line and are mostly heard rather than seen.
func _tick_perch(delta: float) -> void:
	velocity = Vector3.ZERO
	var ground := _world.ground_height(global_position.x, global_position.z)
	var wanted := ground + _rng.randf_range(PERCH_HEIGHT.x, PERCH_HEIGHT.y)
	global_position.y = lerpf(global_position.y, wanted, delta * 1.5)
	if _timer <= 0.0:
		_timer = _rng.randf_range(9.0, 26.0)
		if _rng.randf() < 0.4:
			mode = Mode.FLEE
			_startled_by = global_position - Vector3(_rng.randf_range(-1, 1), 0, _rng.randf_range(-1, 1))
			_flee_time = _rng.randf_range(2.0, 4.0)


func _move(goal: Vector3, speed: float, delta: float) -> void:
	var direction := Steering.direction_to(self, goal, not bool(_def["flying"]), _world)
	if direction == Vector3.ZERO:
		return
	velocity.x = move_toward(velocity.x, direction.x * speed, delta * 14.0)
	velocity.z = move_toward(velocity.z, direction.z * speed, delta * 14.0)
	_face(global_position + direction, delta * 4.0)


func _face(target: Vector3, delta: float) -> void:
	var offset := target - global_position
	offset.y = 0.0
	if offset.length_squared() < 0.0001:
		return
	rotation.y = lerp_angle(rotation.y, atan2(offset.x, offset.z), clampf(delta * 3.0, 0.0, 1.0))


func _animate(delta: float) -> void:
	var speed := Vector3(velocity.x, 0, velocity.z).length()
	_phase += delta * (3.0 + speed * 2.4)
	for i in _limbs.size():
		_limbs[i].rotation.x = sin(_phase + PI * float(i % 2)) * clampf(speed * 0.3, 0.0, 0.7)
	for i in _wings.size():
		var flapping := mode == Mode.FLEE
		var target := sin(_phase * 3.0) * 0.9 if flapping else -0.15
		_wings[i].rotation.z = lerpf(_wings[i].rotation.z, target * (1.0 if i == 0 else -1.0),
				delta * 12.0)


## Ambient calls, weighted by whether this species belongs to the current hour.
func _maybe_call(delta: float) -> void:
	if mode == Mode.FLEE:
		return
	var active := 1.0
	if _world.time_of_day != null:
		var night := 1.0 - _world.time_of_day.day_factor
		active = night if bool(_def["nocturnal"]) else (1.0 - night * 0.75)
	if _rng.randf() > float(_def["call_chance"]) * active * delta:
		return
	AudioDirector.play_3d("%s_%d" % [_def["call"], _rng.randi() % int(_def["calls"])],
			global_position, -12.0, _rng.randf_range(0.9, 1.1), "Ambience", 70.0)


## Anything loud nearby scares wildlife — including the things hunting the
## player, which is how a chase announces itself before it arrives.
func _on_noise(position: Vector3, loudness: float, source: Node) -> void:
	if source == self or loudness < 0.3:
		return
	var distance := global_position.distance_to(position)
	if distance < 26.0 * loudness:
		startle(position)


static func species_for_time(is_night: bool, rng: RandomNumberGenerator) -> Species:
	var pool: Array = []
	for kind: Species in SPECIES_DEFS:
		var nocturnal := bool(SPECIES_DEFS[kind]["nocturnal"])
		var weight := 3 if nocturnal == is_night else 1
		for i in weight:
			pool.append(kind)
	return pool[rng.randi() % pool.size()]
