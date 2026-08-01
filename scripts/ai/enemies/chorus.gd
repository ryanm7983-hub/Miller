class_name TheChorus
extends EnemyBase
## The Hollow Chorus: figures that crowd, but never touch.
##
## The design problem this solves is that a horror game's threats all
## eventually become "a thing that reduces your health bar", and once the player
## works that out the fear becomes arithmetic. The Chorus cannot kill you. It
## drains sanity by *being near*, and it moves toward noise and stops in
## silence.
##
## That inverts the usual instinct. Every other threat in the basin is escaped
## by moving; this one is escaped by being still, and then by walking — never
## running — out of the middle of it.
##
## It is also the game's honest answer to "monster closet" horror: a Chorus
## member seen from a distance is a smudge of rim light between trunks that may
## or may not be there, and there is no jump-scare payoff waiting.

const CROWD_DISTANCE := 3.2
const SANITY_DRAIN := 5.5
const FREEZE_THRESHOLD := 0.06   ## player speed below which the Chorus stops

var _drift_offset := Vector3.ZERO
var _frozen := false
var _whisper_timer := 0.0


func configure() -> void:
	display_name = "the chorus"
	walk_speed = 0.9
	investigate_speed = 2.0
	chase_speed = 2.9
	attack_range = CROWD_DISTANCE
	attack_damage = 0.0        # it does no physical harm at all
	attack_cooldown = 0.4
	search_duration = 18.0
	investigate_duration = 20.0
	wander_radius = 18.0
	avoids_light = 0.55        # keeps to the edge of the torch beam
	dread_weight = 0.7

	perception.sight_weight = 0.35
	perception.hearing_weight = 1.2
	perception.hearing_range = 40.0
	perception.gain = 1.4
	perception.decay = 0.5     # forgets quickly once you are quiet
	perception.memory_time = 10.0

	if _figure_material != null:
		_figure_material.set_shader_parameter("body_colour", Color(0.015, 0.016, 0.020))
		_figure_material.set_shader_parameter("rim_colour", Color(0.40, 0.42, 0.48))
		_figure_material.set_shader_parameter("rim_power", 4.2)
		_figure_material.set_shader_parameter("dissolve", 0.18)
	# Members of a crowd should not stand in a neat ring around the player.
	_drift_offset = Vector3(randf_range(-1.0, 1.0), 0.0, randf_range(-1.0, 1.0)).normalized() * 2.4
	_whisper_timer = randf_range(2.0, 9.0)


func attack_id() -> String:
	return "the_chorus"


func on_chase_started() -> void:
	AudioDirector.play_3d("whisper_%d" % (randi() % AudioDirector.WHISPER_VARIANTS),
			global_position, -8.0, randf_range(0.9, 1.15), "Voice")


func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	_tick_whispers(delta)


## They advance on sound and hold in silence. Standing still is the counter,
## and the whispers are the tell that lets a player discover that.
func _tick_chase(delta: float) -> void:
	if _player == null:
		return
	var player_speed := Vector3(_player.velocity.x, 0, _player.velocity.z).length()
	_frozen = player_speed < FREEZE_THRESHOLD and not _player.is_sprinting

	if _frozen:
		velocity.x = move_toward(velocity.x, 0.0, delta * 6.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 6.0)
		_face(_player.global_position, delta * 0.4)
	else:
		var target := _player.global_position + _drift_offset
		if global_position.distance_to(_player.global_position) < CROWD_DISTANCE:
			velocity.x = move_toward(velocity.x, 0.0, delta * 4.0)
			velocity.z = move_toward(velocity.z, 0.0, delta * 4.0)
			_face(_player.global_position, delta)
		else:
			_move_toward(target, chase_speed * clampf(player_speed / 3.0, 0.4, 1.3), delta)

	_apply_crowding(delta)
	if not perception.has_target:
		set_state(State.RETREAT)


## Being crowded costs sanity, and the cost scales with how many of them are
## close — which is what makes a group meaningfully worse than one.
func _apply_crowding(delta: float) -> void:
	var distance := global_position.distance_to(_player.global_position)
	if distance > CROWD_DISTANCE * 2.2:
		return
	var closeness := clampf(1.0 - distance / (CROWD_DISTANCE * 2.2), 0.0, 1.0)
	_player.stats.drain_sanity(SANITY_DRAIN * closeness * delta)
	_player.stats.threat_proximity = maxf(_player.stats.threat_proximity, closeness * 0.7)


func _tick_whispers(delta: float) -> void:
	_whisper_timer -= delta
	if _whisper_timer > 0.0:
		return
	_whisper_timer = randf_range(4.0, 13.0)
	if _player == null or global_position.distance_to(_player.global_position) > 26.0:
		return
	# Closer members whisper more clearly. It is the only distance cue the
	# player gets when they cannot see them.
	var closeness := clampf(1.0 - global_position.distance_to(_player.global_position) / 26.0, 0.0, 1.0)
	var key := "whisper_close" if closeness > 0.7 \
			else "whisper_%d" % (randi() % AudioDirector.WHISPER_VARIANTS)
	AudioDirector.play_3d(key, global_position, lerpf(-16.0, -3.0, closeness),
			randf_range(0.88, 1.12), "Voice", 34.0)


## The Chorus does not attack. Reaching the player is the whole of its threat,
## and it is handled continuously by `_apply_crowding` instead.
func perform_attack() -> void:
	pass


func _tick_attack(delta: float) -> void:
	_tick_chase(delta)
