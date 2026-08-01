class_name TheSurveyor
extends EnemyBase
## Walks the fire roads with a lantern, and calls out.
##
## The Surveyor is the one that looks like a person, behaves like a person
## looking for someone, and is therefore the one players trust. It hails —
## using phrases a lost ranger would use — and waits for an answer. Answering,
## in this game, means making noise near it.
##
## Mechanically it is the sight-based hunter and the only enemy that carries its
## own light, which cuts both ways: you can see it coming a long way off, and it
## can see you a long way off.
##
## It patrols the road network the generator already produced, so its route is
## real geography rather than a scripted path.

const HAIL_INTERVAL := Vector2(14.0, 34.0)
const LANTERN_ENERGY := 2.1

var _lantern: OmniLight3D
var _route: PackedVector2Array = []
var _route_index := 0
var _hail_timer := 0.0
var _reverse := false


func configure() -> void:
	display_name = "the surveyor"
	walk_speed = 1.9
	investigate_speed = 3.1
	chase_speed = 4.9          # faster than the player's walk, slower than a sprint
	attack_range = 1.9
	attack_damage = 30.0
	attack_cooldown = 1.6
	search_duration = 30.0
	investigate_duration = 16.0
	avoids_light = 0.0
	dread_weight = 0.85

	perception.sight_weight = 1.35
	perception.hearing_weight = 0.55
	perception.sight_range = 38.0
	perception.sight_angle = 1.05
	perception.gain = 1.5
	perception.decay = 0.3
	perception.memory_time = 18.0

	_build_lantern()
	if _figure_material != null:
		_figure_material.set_shader_parameter("body_colour", Color(0.09, 0.085, 0.075))
		_figure_material.set_shader_parameter("rim_colour", Color(0.55, 0.45, 0.28))
		_figure_material.set_shader_parameter("emissive_eyes", 0.0)
	_hail_timer = randf_range(HAIL_INTERVAL.x, HAIL_INTERVAL.y)


func _build_lantern() -> void:
	var arm := Node3D.new()
	arm.position = Vector3(0.34, 1.25, 0.22)
	add_child(arm)

	var glass := MeshInstance3D.new()
	glass.mesh = AssetFoundry.item_mesh("tincture")
	glass.material_override = AssetFoundry.material("rust")
	arm.add_child(glass)

	_lantern = OmniLight3D.new()
	_lantern.light_color = Color(1.0, 0.78, 0.42)
	_lantern.light_energy = LANTERN_ENERGY
	_lantern.omni_range = 13.0
	_lantern.omni_attenuation = 1.4
	# Its lantern never casts shadows: on a mid-range phone a second shadow
	# caster next to the player's torch is the single most expensive thing on
	# screen, and it buys nothing the falloff does not already sell.
	_lantern.shadow_enabled = false
	arm.add_child(_lantern)


## The road network is the patrol route. Nearest road at spawn time wins.
func setup(player: Player, world: WorldRoot, spawn: Vector3) -> void:
	super.setup(player, world, spawn)
	_pick_route(world, spawn)


func _pick_route(world: WorldRoot, spawn: Vector3) -> void:
	if world == null or world.generator == null:
		return
	var best_distance := INF
	for path: PackedVector2Array in world.generator.roads():
		for i in path.size():
			var d := Vector2(spawn.x, spawn.z).distance_to(path[i])
			if d < best_distance:
				best_distance = d
				_route = path
				_route_index = i
	if best_distance > 90.0:
		_route = PackedVector2Array()


func has_patrol_route() -> bool:
	return _route.size() > 2


func _tick_patrol(delta: float) -> void:
	if not has_patrol_route():
		_tick_wander(delta)
		return
	var point := _route[_route_index]
	var target := Vector3(point.x, _world.ground_height(point.x, point.y), point.y)
	if global_position.distance_to(target) < ARRIVE_DISTANCE * 1.5:
		_advance_route()
	_move_toward(target, walk_speed, delta)
	_tick_hail(delta)


func _advance_route() -> void:
	_route_index += -1 if _reverse else 1
	if _route_index >= _route.size():
		_route_index = _route.size() - 2
		_reverse = true
	elif _route_index < 0:
		_route_index = 1
		_reverse = false


## The hail is the trap. It is a human sound in a place where a human sound is
## the most reassuring thing you could possibly hear.
func _tick_hail(delta: float) -> void:
	_hail_timer -= delta
	if _hail_timer > 0.0:
		return
	_hail_timer = randf_range(HAIL_INTERVAL.x, HAIL_INTERVAL.y)
	AudioDirector.play_3d("whisper_name", global_position, -2.0,
			randf_range(0.92, 1.05), "Voice", 80.0)
	if global_position.distance_to(_player.global_position) < 55.0:
		EventBus.notification_posted.emit("Somebody is calling out.")


func attack_id() -> String:
	return "the_surveyor"


func on_chase_started() -> void:
	AudioDirector.play_3d("whisper_name", global_position, 0.0, 1.15, "Voice", 90.0)
	if _lantern != null:
		# It raises the lantern.
		_lantern.light_energy = LANTERN_ENERGY * 1.6
		_lantern.omni_range = 17.0


func _return_to_ambient() -> void:
	if _lantern != null:
		_lantern.light_energy = LANTERN_ENERGY
		_lantern.omni_range = 13.0
	super._return_to_ambient()
