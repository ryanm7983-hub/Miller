class_name TheListener
extends EnemyBase
## "The Quiet One" — blind, and hunts entirely by ear.
##
## The Listener is the game's teacher. It is slow enough to walk away from and
## completely uninterested in what you look like, which means every encounter
## with it is a lesson in the one mechanic the whole game runs on: how much
## noise you are making. Players who learn to crouch on gravel learn it here.
##
## It never gives up quickly. Losing it means going quiet and *staying* quiet,
## not breaking line of sight — there is no line of sight to break.

func configure() -> void:
	display_name = "the quiet one"
	walk_speed = 1.1
	investigate_speed = 2.7
	chase_speed = 3.9          # slower than a sprinting player, faster than a walk
	attack_range = 1.8
	attack_damage = 42.0
	attack_cooldown = 2.2
	search_duration = 40.0     # it is patient in a way the others are not
	investigate_duration = 18.0
	wander_radius = 34.0
	avoids_light = 0.0         # light means nothing to it
	dread_weight = 1.0

	perception.sight_weight = 0.0
	perception.hearing_weight = 1.45
	perception.hearing_range = 46.0
	perception.gain = 2.1
	perception.decay = 0.14    # very slow to lose interest
	perception.memory_time = 26.0

	_make_it_look_blind()


## Reads as eyeless at a glance: a head with no face band lit, and a posture
## that leads with the side of the head rather than the front.
func _make_it_look_blind() -> void:
	if _figure_material != null:
		_figure_material.set_shader_parameter("emissive_eyes", 0.0)
		_figure_material.set_shader_parameter("rim_colour", Color(0.20, 0.22, 0.24))
		_figure_material.set_shader_parameter("rim_strength", 0.75)
	if _body_root != null and _body_root.get_child_count() > 1:
		var head := _body_root.get_child(1) as Node3D
		if head != null:
			head.rotation.y = deg_to_rad(38.0)
			head.rotation.z = deg_to_rad(-12.0)


func attack_id() -> String:
	return "the_listener"


## It does not roar when it finds you. It stops, which is worse.
func on_chase_started() -> void:
	velocity = Vector3.ZERO
	AudioDirector.play_3d("breath", global_position, -3.0, 0.75)


func _tick_chase(delta: float) -> void:
	# The Listener tracks the last *sound*, never the player's actual position,
	# even when the player is standing in front of it. Standing still works.
	var target := perception.last_known_position
	var distance := global_position.distance_to(_player.global_position)
	if distance <= attack_range:
		set_state(State.ATTACK)
		return
	if not perception.has_target:
		set_state(State.SEARCH)
		return
	_move_toward(target, chase_speed, delta)
