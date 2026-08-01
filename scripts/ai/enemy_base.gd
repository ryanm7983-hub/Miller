class_name EnemyBase
extends CharacterBody3D
## Shared behaviour for everything that hunts the player.
##
## One state machine, four archetypes. The differences between them are almost
## entirely *tuning* — which sense they use, how fast they give up, what they do
## when they lose you — rather than different code, which is what keeps them
## feeling like inhabitants of the same place rather than four separate games.
##
## The states form a deliberate ladder, and the important property is that
## coming *down* it is slow:
##
##   PATROL/WANDER  ambient movement, no idea you exist
##   INVESTIGATE    heard or half-saw something, goes to look
##   SEARCH         was certain, lost you, sweeps the area it last knew
##   CHASE          certain and closing
##   ATTACK         in reach
##   RETREAT        disengaging (used by the Chorus, and after a kill)
##
## An enemy that snaps back to patrol the instant you break line of sight is not
## frightening. These spend up to half a minute searching, and while searching
## they are still dangerous.

enum State { DORMANT, PATROL, WANDER, INVESTIGATE, SEARCH, CHASE, ATTACK, RETREAT }

const GRAVITY := 18.0
const TURN_SPEED := 5.0
const ARRIVE_DISTANCE := 1.6
const DESPAWN_DISTANCE := 140.0

signal state_changed(state: int)

# --- tuning, overridden per archetype --------------------------------------
@export var display_name := "Something"
@export var walk_speed := 1.5
@export var investigate_speed := 2.4
@export var chase_speed := 4.4
@export var attack_range := 1.7
@export var attack_damage := 34.0
@export var attack_cooldown := 1.9
@export var search_duration := 26.0
@export var investigate_duration := 12.0
@export var wander_radius := 26.0
@export var can_open_ground := true      ## false = clings to cover, avoids clearings
@export var avoids_light := 0.0          ## 0..1, how much the torch repels it
@export var dread_weight := 1.0          ## contribution to the horror director

var state: State = State.WANDER
var perception: Perception
var home: Vector3 = Vector3.ZERO

var _world: WorldRoot
var _player: Player
var _rng := RandomNumberGenerator.new()
var _state_timer := 0.0
var _attack_timer := 0.0
var _goal: Vector3 = Vector3.ZERO
var _has_goal := false
var _stuck := Steering.StuckDetector.new()
var _body_root: Node3D
var _limbs: Array[Node3D] = []
var _step_phase := 0.0
var _figure_material: ShaderMaterial
var _presence := 1.0
var _step_accumulator := 0.0


func _ready() -> void:
	collision_layer = 8    # enemy
	collision_mask = 1 | 2 | 64
	add_to_group("enemy")
	add_to_group("noise_source")
	_rng.randomize()
	_build_collision()
	_build_body()
	_build_perception()
	configure()
	EventBus.enemy_spawned.emit(self)


## Archetypes override this to set their tuning and appearance.
func configure() -> void:
	pass


func setup(player: Player, world: WorldRoot, spawn: Vector3) -> void:
	_player = player
	_world = world
	home = spawn
	global_position = spawn
	perception.setup(player, world)


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------

func _build_collision() -> void:
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.36
	capsule.height = 1.9
	shape.shape = capsule
	shape.position = Vector3(0, 0.95, 0)
	add_child(shape)


## Bodies are assembled from foundry parts and animated by rotating nodes. No
## skeletons and no imported animation: at the distance and light level these
## are seen, a swinging limb hierarchy reads identically and costs nothing.
func _build_body() -> void:
	_body_root = Node3D.new()
	_body_root.name = "Body"
	add_child(_body_root)

	_figure_material = (AssetFoundry.material("figure") as ShaderMaterial).duplicate()

	var torso := MeshInstance3D.new()
	torso.mesh = AssetFoundry.mesh("torso_tall")
	torso.material_override = _figure_material
	torso.position = Vector3(0, 1.15, 0)
	_body_root.add_child(torso)

	var head := MeshInstance3D.new()
	head.mesh = AssetFoundry.mesh("head_long")
	head.material_override = _figure_material
	head.position = Vector3(0, 1.62, 0)
	_body_root.add_child(head)

	for side in [-1.0, 1.0]:
		var arm := Node3D.new()
		arm.position = Vector3(0.26 * side, 1.42, 0)
		_body_root.add_child(arm)
		var arm_mesh := MeshInstance3D.new()
		arm_mesh.mesh = AssetFoundry.mesh("limb_arm_long")
		arm_mesh.material_override = _figure_material
		arm.add_child(arm_mesh)
		_limbs.append(arm)

		var leg := Node3D.new()
		leg.position = Vector3(0.14 * side, 0.88, 0)
		_body_root.add_child(leg)
		var leg_mesh := MeshInstance3D.new()
		leg_mesh.mesh = AssetFoundry.mesh("limb_leg")
		leg_mesh.material_override = _figure_material
		leg.add_child(leg_mesh)
		_limbs.append(leg)


func _build_perception() -> void:
	perception = Perception.new()
	perception.name = "Perception"
	perception.position = Vector3(0, 1.6, 0)
	add_child(perception)
	perception.became_suspicious.connect(_on_suspicious)
	perception.became_certain.connect(_on_certain)
	perception.lost_track.connect(_on_lost_track)


# ---------------------------------------------------------------------------
# Frame
# ---------------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	if _player == null or _world == null:
		return
	_state_timer += delta
	_attack_timer = maxf(0.0, _attack_timer - delta)

	if _should_despawn():
		_despawn()
		return

	match state:
		State.DORMANT: _tick_dormant(delta)
		State.PATROL: _tick_patrol(delta)
		State.WANDER: _tick_wander(delta)
		State.INVESTIGATE: _tick_investigate(delta)
		State.SEARCH: _tick_search(delta)
		State.CHASE: _tick_chase(delta)
		State.ATTACK: _tick_attack(delta)
		State.RETREAT: _tick_retreat(delta)

	_apply_gravity(delta)
	move_and_slide()
	_animate(delta)
	_update_presence(delta)


func _apply_gravity(delta: float) -> void:
	if is_on_floor():
		velocity.y = -1.5
	else:
		velocity.y -= GRAVITY * delta


# ---------------------------------------------------------------------------
# States
# ---------------------------------------------------------------------------

func set_state(new_state: State) -> void:
	if state == new_state:
		return
	state = new_state
	_state_timer = 0.0
	_stuck.reset()
	_has_goal = false
	state_changed.emit(int(new_state))
	EventBus.enemy_state_changed.emit(self, State.keys()[new_state])
	if new_state == State.CHASE:
		EventBus.chase_started.emit(self)
		on_chase_started()
	elif new_state in [State.WANDER, State.PATROL, State.DORMANT]:
		EventBus.chase_ended.emit(self)


func _tick_dormant(_delta: float) -> void:
	velocity.x = 0.0
	velocity.z = 0.0


func _tick_wander(delta: float) -> void:
	if not _has_goal or global_position.distance_to(_goal) < ARRIVE_DISTANCE \
			or _stuck.update(global_position, delta):
		_goal = Steering.wander_target(home, wander_radius, _world, _rng)
		_has_goal = true
	_move_toward(_goal, walk_speed, delta)
	# Long pauses while wandering: something standing still in the trees is
	# worse than something moving through them.
	if _state_timer > _rng.randf_range(14.0, 30.0):
		_state_timer = 0.0
		_has_goal = false


## Overridden by archetypes that follow a route (the Surveyor walks the roads).
func _tick_patrol(delta: float) -> void:
	_tick_wander(delta)


func _tick_investigate(delta: float) -> void:
	var target := perception.last_known_position
	if global_position.distance_to(target) < ARRIVE_DISTANCE * 1.6:
		# Arrived and found nothing: look around before giving up.
		if _state_timer > 4.0:
			_return_to_ambient()
		velocity.x = move_toward(velocity.x, 0.0, delta * 8.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 8.0)
		_look_around(delta)
		return
	if _stuck.update(global_position, delta):
		_return_to_ambient()
		return
	_move_toward(target, investigate_speed, delta)
	if _state_timer > investigate_duration:
		_return_to_ambient()


func _tick_search(delta: float) -> void:
	if not _has_goal or global_position.distance_to(_goal) < ARRIVE_DISTANCE \
			or _stuck.update(global_position, delta):
		# Sweep outward from where the player was last known, so the search
		# widens rather than circling one spot.
		var spread := lerpf(6.0, 22.0, clampf(_state_timer / search_duration, 0.0, 1.0))
		_goal = Steering.wander_target(perception.last_known_position, spread, _world, _rng)
		_has_goal = true
	_move_toward(_goal, investigate_speed, delta)
	if _state_timer > search_duration:
		perception.forget()
		_return_to_ambient()


func _tick_chase(delta: float) -> void:
	var target := _player.global_position
	if not perception.can_see_now:
		target = perception.last_known_position
	var distance := global_position.distance_to(_player.global_position)
	if distance <= attack_range and perception.can_see_now:
		set_state(State.ATTACK)
		return
	if not perception.has_target:
		set_state(State.SEARCH)
		return
	_move_toward(target, chase_speed, delta)
	# A chase is loud. That matters: it draws the other things in the basin.
	_step_accumulator += Vector3(velocity.x, 0, velocity.z).length() * delta
	if _step_accumulator > 2.0:
		_step_accumulator = 0.0
		EventBus.report_noise(global_position, 0.5, self)


func _tick_attack(delta: float) -> void:
	velocity.x = move_toward(velocity.x, 0.0, delta * 10.0)
	velocity.z = move_toward(velocity.z, 0.0, delta * 10.0)
	_face(_player.global_position, delta * 2.0)
	if global_position.distance_to(_player.global_position) > attack_range * 1.5:
		set_state(State.CHASE)
		return
	if _attack_timer <= 0.0:
		_attack_timer = attack_cooldown
		perform_attack()


func _tick_retreat(delta: float) -> void:
	var away := global_position - _player.global_position
	away.y = 0.0
	if away.length_squared() < 0.001:
		away = Vector3.FORWARD
	_move_toward(global_position + away.normalized() * 14.0, chase_speed * 0.8, delta)
	if _state_timer > 6.0:
		perception.forget()
		_return_to_ambient()


func _return_to_ambient() -> void:
	set_state(State.PATROL if has_patrol_route() else State.WANDER)


## Archetypes with a route override this.
func has_patrol_route() -> bool:
	return false


# ---------------------------------------------------------------------------
# Movement helpers
# ---------------------------------------------------------------------------

func _move_toward(goal: Vector3, speed: float, delta: float) -> void:
	var direction := Steering.direction_to(self, goal, true, _world)
	if direction == Vector3.ZERO:
		velocity.x = move_toward(velocity.x, 0.0, delta * 10.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 10.0)
		return
	# Things that shun light steer away from the player's beam even while
	# closing on them, which produces a circling approach rather than a charge.
	if avoids_light > 0.01 and _player.flashlight.is_on:
		var beam := -_player.flashlight.global_basis.z
		var to_self := (global_position - _player.global_position).normalized()
		if beam.dot(to_self) > 0.82:
			var sidestep := to_self.cross(Vector3.UP).normalized()
			direction = (direction + sidestep * avoids_light * 1.6).normalized()

	velocity.x = move_toward(velocity.x, direction.x * speed, delta * 9.0)
	velocity.z = move_toward(velocity.z, direction.z * speed, delta * 9.0)
	_face(global_position + direction, delta)


func _face(target: Vector3, delta: float) -> void:
	var offset := target - global_position
	offset.y = 0.0
	if offset.length_squared() < 0.0001:
		return
	var wanted := atan2(offset.x, offset.z)
	rotation.y = lerp_angle(rotation.y, wanted, clampf(TURN_SPEED * delta, 0.0, 1.0))


func _look_around(delta: float) -> void:
	rotation.y += delta * 0.9 * (1.0 if int(_state_timer) % 2 == 0 else -1.0)


func _should_despawn() -> bool:
	return global_position.distance_to(_player.global_position) > DESPAWN_DISTANCE


func _despawn() -> void:
	EventBus.enemy_despawned.emit(self)
	queue_free()


# ---------------------------------------------------------------------------
# Presentation
# ---------------------------------------------------------------------------

func _animate(delta: float) -> void:
	var speed := Vector3(velocity.x, 0, velocity.z).length()
	_step_phase += delta * (2.0 + speed * 1.6)
	for i in _limbs.size():
		var swing := sin(_step_phase + PI * float(i % 2)) * clampf(speed * 0.22, 0.05, 0.55)
		_limbs[i].rotation.x = swing
	if _body_root != null:
		_body_root.position.y = sin(_step_phase * 2.0) * 0.02 * clampf(speed, 0.0, 2.0)


## `presence` is how solid the thing looks. It rises as it closes and drops when
## it is far off or disengaging, so the same mesh reads as a distant suggestion
## or a solid body without any extra assets.
func _update_presence(delta: float) -> void:
	var target := 1.0
	var distance := global_position.distance_to(_player.global_position)
	if state in [State.WANDER, State.PATROL, State.DORMANT]:
		target = clampf(1.0 - distance / 60.0, 0.25, 0.8)
	elif state == State.RETREAT:
		target = 0.3
	_presence = lerpf(_presence, target, delta * 2.0)
	if _figure_material != null:
		_figure_material.set_shader_parameter("presence", _presence)
		_figure_material.set_shader_parameter("shimmer",
				clampf(1.0 - _presence, 0.0, 1.0) * 0.8)


# ---------------------------------------------------------------------------
# Combat
# ---------------------------------------------------------------------------

func perform_attack() -> void:
	if _player == null or not _player.stats.is_alive:
		return
	if global_position.distance_to(_player.global_position) > attack_range * 1.3:
		return
	AudioDirector.play_3d("stinger_soft", global_position, -4.0, _rng.randf_range(0.85, 1.1))
	_player.stats.damage(attack_damage, attack_id())


## Identifier used by the death screen to pick its line.
func attack_id() -> String:
	return "unknown"


## Hook for archetypes that do something on first sighting the player.
func on_chase_started() -> void:
	AudioDirector.play_3d("whisper_close", global_position, -6.0, 1.0)


# ---------------------------------------------------------------------------
# Perception callbacks
# ---------------------------------------------------------------------------

func _on_suspicious(_position: Vector3) -> void:
	if state in [State.WANDER, State.PATROL, State.DORMANT]:
		set_state(State.INVESTIGATE)


func _on_certain(_position: Vector3) -> void:
	if state != State.ATTACK:
		set_state(State.CHASE)


func _on_lost_track() -> void:
	if state in [State.CHASE, State.ATTACK]:
		set_state(State.SEARCH)


# ---------------------------------------------------------------------------
# Queries used by the horror director
# ---------------------------------------------------------------------------

## 0..1 threat contribution — how much this thing should be raising the music,
## the player's heart rate and the screen effects right now.
func threat_level() -> float:
	if _player == null:
		return 0.0
	var distance := global_position.distance_to(_player.global_position)
	var proximity := clampf(1.0 - distance / 30.0, 0.0, 1.0)
	var by_state := 0.0
	match state:
		State.CHASE: by_state = 1.0
		State.ATTACK: by_state = 1.0
		State.SEARCH: by_state = 0.6
		State.INVESTIGATE: by_state = 0.35
		_: by_state = 0.1
	return clampf(proximity * by_state * dread_weight, 0.0, 1.0)


func is_hunting() -> bool:
	return state in [State.CHASE, State.ATTACK, State.SEARCH]


func state_name() -> String:
	return State.keys()[state]
