class_name TheWretch
extends EnemyBase
## Territorial. Lives underground and does not leave.
##
## The Wretch exists to make the caves, the adit and the bunker mean something.
## Everywhere else in the basin, danger wanders; here it is *sited*. You can see
## where it lives on the map and choose not to go there — and the things you
## need are in there.
##
## It is the only enemy that is genuinely faster than the player over a short
## distance, and the only one that will not follow you into open ground. Getting
## out is the counter, and it works reliably, which is what makes going in a
## calculated risk rather than a coin flip.

const LEASH_RADIUS := 30.0
const AMBUSH_RANGE := 9.0

var _lunging := false
var _lunge_cooldown := 0.0


func configure() -> void:
	display_name = "something in the dark"
	walk_speed = 0.7           # barely moves when undisturbed
	investigate_speed = 3.4
	chase_speed = 6.6          # briefly faster than a sprint
	attack_range = 1.6
	attack_damage = 46.0
	attack_cooldown = 1.5
	search_duration = 14.0     # short: it goes back to its hole
	investigate_duration = 9.0
	wander_radius = 9.0
	can_open_ground = false
	avoids_light = 0.75
	dread_weight = 1.15

	perception.sight_weight = 0.75
	perception.hearing_weight = 1.1
	perception.sight_range = 16.0
	perception.sight_angle = 1.5   # near-hemispherical: it does not need to face you
	perception.hearing_range = 26.0
	perception.gain = 2.4          # commits almost instantly
	perception.decay = 0.55
	perception.memory_time = 9.0

	if _figure_material != null:
		_figure_material.set_shader_parameter("body_colour", Color(0.035, 0.028, 0.022))
		_figure_material.set_shader_parameter("rim_colour", Color(0.42, 0.30, 0.16))
		_figure_material.set_shader_parameter("emissive_eyes", 1.4)
	_crouch_posture()


## Held low to the ground, which is both how it reads in a beam and why it fits
## in the tunnels the player has to crawl through.
func _crouch_posture() -> void:
	if _body_root != null:
		_body_root.scale = Vector3(1.15, 0.72, 1.15)
		_body_root.rotation.x = deg_to_rad(16.0)


func attack_id() -> String:
	return "the_wretch"


func on_chase_started() -> void:
	AudioDirector.play_3d("stinger_hard", global_position, -5.0, randf_range(0.9, 1.05))


func _physics_process(delta: float) -> void:
	_lunge_cooldown = maxf(0.0, _lunge_cooldown - delta)
	super._physics_process(delta)


## It will not leave its territory. Chasing past the leash makes it break off,
## which is the promise the player is allowed to rely on.
func _tick_chase(delta: float) -> void:
	if home.distance_to(global_position) > LEASH_RADIUS:
		set_state(State.RETREAT)
		return
	super._tick_chase(delta)


func _tick_retreat(delta: float) -> void:
	# Retreat means going home, not just away from the player.
	_move_toward(home, investigate_speed, delta)
	if global_position.distance_to(home) < ARRIVE_DISTANCE * 2.0 or _state_timer > 12.0:
		perception.forget()
		set_state(State.DORMANT)


## Sits perfectly still until something comes close, then commits. This is the
## only scripted-feeling behaviour in the game and it is confined to one enemy
## in one kind of place, where being ambushed is the point.
func _tick_dormant(delta: float) -> void:
	velocity.x = 0.0
	velocity.z = 0.0
	if _player == null:
		return
	var distance := global_position.distance_to(_player.global_position)
	if distance < AMBUSH_RANGE and _lunge_cooldown <= 0.0:
		# A torch beam held on it delays the lunge rather than preventing it.
		if _player.flashlight.is_on and _is_lit_by_player():
			return
		_lunge_cooldown = 8.0
		perception.alert(_player.global_position, 1.0)
		set_state(State.CHASE)
	elif _state_timer > 25.0:
		set_state(State.WANDER)


func _is_lit_by_player() -> bool:
	var beam := -_player.flashlight.global_basis.z
	var to_self := (global_position - _player.global_position).normalized()
	return beam.dot(to_self) > 0.86
