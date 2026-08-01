class_name HorrorDirector
extends Node
## Decides when the basin does something, and what.
##
## A horror game that fires scares on a timer becomes predictable in about
## twenty minutes; one that fires them on triggers becomes a puzzle about
## triggers. This director instead maintains a **tension** value and spends it,
## the way a dungeon master reads a table.
##
## Tension rises with: darkness, low sanity, being hunted, isolation, and how
## much of the archive the player has listened to. It falls with: light,
## shelter, daylight, and simply time passing without incident.
##
## Two rules keep it from becoming noise:
##
##  1. **Relief is mandatory.** After any significant event the director enters
##     a cooldown during which it will not act at all, and that cooldown is
##     longer after a big event. Sustained pressure stops registering as
##     pressure; the quiet after is what makes the next one land.
##  2. **Escalation is earned.** Events are grouped by intensity, and an
##     intensity band only unlocks once tension has been high for a while. The
##     player gets whispers long before they get anything with a face.
##
## The rare loud scares are gated behind a setting (`jump_scares`) that leaves
## everything else intact, because the atmosphere is the game and the shocks
## are garnish.

const TENSION_RISE := 0.055
const TENSION_FALL := 0.09
const EVENT_CHECK_INTERVAL := 3.0
const MIN_COOLDOWN := 14.0
const HALLUCINATION_DURATION := Vector2(5.0, 11.0)

## Event table. `intensity` gates it behind a tension threshold; `weight` is its
## relative likelihood once unlocked; `cooldown` is the quiet it buys.
const EVENTS := [
	{"id": "distant_whisper", "intensity": 0.0, "weight": 3.0, "cooldown": 16.0},
	{"id": "branch_snap", "intensity": 0.0, "weight": 2.5, "cooldown": 14.0},
	{"id": "bird_burst", "intensity": 0.1, "weight": 2.0, "cooldown": 18.0},
	{"id": "tree_groan", "intensity": 0.15, "weight": 2.0, "cooldown": 16.0},
	{"id": "footsteps_behind", "intensity": 0.35, "weight": 2.5, "cooldown": 26.0},
	{"id": "torch_interference", "intensity": 0.40, "weight": 1.8, "cooldown": 22.0},
	{"id": "close_whisper", "intensity": 0.50, "weight": 2.0, "cooldown": 28.0},
	{"id": "watcher", "intensity": 0.55, "weight": 1.6, "cooldown": 34.0},
	{"id": "name_spoken", "intensity": 0.65, "weight": 1.2, "cooldown": 42.0},
	{"id": "hallucination", "intensity": 0.70, "weight": 1.4, "cooldown": 38.0},
	{"id": "distant_scream", "intensity": 0.75, "weight": 1.0, "cooldown": 44.0},
	{"id": "stinger", "intensity": 0.88, "weight": 0.8, "cooldown": 70.0, "jump_scare": true},
]

signal event_fired(event_id: String)

var tension: float = 0.0
var enabled: bool = true

var _player: Player
var _world: WorldRoot
var _rng := RandomNumberGenerator.new()
var _cooldown := 22.0
var _check_timer := 0.0
var _high_tension_time := 0.0
var _watcher: Node3D
var _watcher_timer := 0.0
var _hallucination_timer := 0.0
var _heartbeat_timer := 0.0
var _threat := 0.0


func setup(player: Player, world: WorldRoot) -> void:
	_player = player
	_world = world
	_rng.seed = GameState.world_seed + 8080
	EventBus.chase_started.connect(func(_e: Node3D) -> void: _cooldown = maxf(_cooldown, 25.0))


func _process(delta: float) -> void:
	if not enabled or _player == null or not _player.stats.is_alive:
		return
	_update_threat()
	_update_tension(delta)
	_update_ambient_response(delta)
	_update_watcher(delta)
	_update_heartbeat(delta)

	_cooldown = maxf(0.0, _cooldown - delta)
	_check_timer -= delta
	if _check_timer > 0.0:
		return
	_check_timer = EVENT_CHECK_INTERVAL
	if _cooldown <= 0.0:
		_consider_event()


# ---------------------------------------------------------------------------
# Tension
# ---------------------------------------------------------------------------

func _update_threat() -> void:
	_threat = 0.0
	for node in get_tree().get_nodes_in_group("enemy"):
		var enemy := node as EnemyBase
		if enemy != null:
			_threat = maxf(_threat, enemy.threat_level())
	_player.stats.threat_proximity = _threat


func _update_tension(delta: float) -> void:
	var pressure := 0.0
	var stats := _player.stats

	if stats.in_darkness:
		pressure += 0.45
	if _world.time_of_day != null:
		pressure += (1.0 - _world.time_of_day.day_factor) * 0.4
	pressure += (1.0 - stats.sanity_fraction()) * 0.7
	pressure += _threat * 1.4
	if stats.battery_fraction() < 0.2:
		pressure += 0.25
	# Having listened to the archive is the story's own pressure: the more of
	# the basin you have played back, the more of it is paying attention.
	pressure += clampf(float(GameState.posts_recorded()) * 0.08, 0.0, 0.4)

	var relief := 0.0
	if stats.in_shelter:
		relief += 0.6
	if not stats.in_darkness:
		relief += 0.35
	if _world.time_of_day != null and _world.time_of_day.day_factor > 0.7:
		relief += 0.4

	var target := clampf(pressure - relief, 0.0, 1.0)
	var rate := TENSION_RISE if target > tension else TENSION_FALL
	tension = move_toward(tension, target, rate * delta * 10.0)

	if tension > 0.55:
		_high_tension_time += delta
	else:
		_high_tension_time = maxf(0.0, _high_tension_time - delta * 2.0)

	AudioDirector.set_tension(tension)
	AssetFoundry.set_agitation(tension * 0.7)
	_player.flashlight.interference = clampf((tension - 0.55) * 1.4, 0.0, 1.0)
	EventBus.tension_changed.emit(tension)


## Ambience responds continuously, not only at event time. The forest goes
## quiet before something happens, which is the oldest and best tell there is.
func _update_ambient_response(_delta: float) -> void:
	var hush := clampf((tension - 0.5) * 2.0, 0.0, 1.0)
	AudioDirector.set_layer("insects",
			AudioDirector.layer_level("insects") * (1.0 - hush * 0.85))


func _update_heartbeat(delta: float) -> void:
	if tension < 0.72 and _threat < 0.4:
		return
	_heartbeat_timer -= delta
	if _heartbeat_timer > 0.0:
		return
	var intensity := maxf(tension, _threat)
	_heartbeat_timer = lerpf(1.9, 0.85, intensity)
	AudioDirector.play_2d("heartbeat_fast" if intensity > 0.85 else "heartbeat_slow",
			lerpf(-22.0, -9.0, intensity), lerpf(0.9, 1.15, intensity))


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

func _consider_event() -> void:
	# Below a floor of tension the basin simply leaves the player alone.
	if tension < 0.12:
		return
	# Probability scales with tension, so a calm player is rarely bothered and a
	# frightened one is rarely left alone.
	if _rng.randf() > lerpf(0.08, 0.75, tension):
		return

	var allow_jump_scares := bool(Settings.get_value("jump_scares"))
	var candidates: Array[Dictionary] = []
	var total := 0.0
	for event: Dictionary in EVENTS:
		if float(event["intensity"]) > tension:
			continue
		# The heaviest events also need sustained tension, not just a spike.
		if float(event["intensity"]) > 0.6 and _high_tension_time < 20.0:
			continue
		if bool(event.get("jump_scare", false)) and not allow_jump_scares:
			continue
		candidates.append(event)
		total += float(event["weight"])
	if candidates.is_empty():
		return

	var roll := _rng.randf() * total
	for event: Dictionary in candidates:
		roll -= float(event["weight"])
		if roll > 0.0:
			continue
		_fire(event)
		return


func _fire(event: Dictionary) -> void:
	var id := String(event["id"])
	_cooldown = maxf(MIN_COOLDOWN, float(event["cooldown"]) * _rng.randf_range(0.85, 1.35))
	event_fired.emit(id)
	EventBus.scare_triggered.emit(id, _player.global_position)
	Log.debug("horror", "%s (tension %.2f)" % [id, tension])

	match id:
		"distant_whisper": _distant_whisper()
		"branch_snap": _branch_snap()
		"bird_burst": _bird_burst()
		"tree_groan": _tree_groan()
		"footsteps_behind": _footsteps_behind()
		"torch_interference": _torch_interference()
		"close_whisper": _close_whisper()
		"watcher": _spawn_watcher()
		"name_spoken": _name_spoken()
		"hallucination": _hallucination()
		"distant_scream": _distant_scream()
		"stinger": _stinger()


func _random_point(distance: float, spread: float = 0.0) -> Vector3:
	var angle := _rng.randf() * TAU
	var radius := distance + _rng.randf_range(-spread, spread)
	var point := _player.global_position + Vector3(cos(angle) * radius, 0.0, sin(angle) * radius)
	point.y = _world.ground_height(point.x, point.z) + 1.2
	return point


## Behind the player specifically: the direction they are not looking.
func _behind_point(distance: float) -> Vector3:
	var back := _player.global_basis.z  # +Z is behind a Godot camera
	var jitter := Vector3(_rng.randf_range(-0.5, 0.5), 0.0, _rng.randf_range(-0.5, 0.5))
	var point := _player.global_position + (back + jitter).normalized() * distance
	point.y = _world.ground_height(point.x, point.z) + 1.2
	return point


func _distant_whisper() -> void:
	AudioDirector.play_3d("whisper_%d" % (_rng.randi() % AudioDirector.WHISPER_VARIANTS),
			_random_point(18.0, 6.0), -10.0, _rng.randf_range(0.85, 1.15), "Voice", 40.0)


func _branch_snap() -> void:
	var point := _behind_point(_rng.randf_range(9.0, 18.0))
	AudioDirector.play_3d("creak_wood_%d" % (_rng.randi() % 2), point, -6.0,
			_rng.randf_range(1.3, 1.8))


func _bird_burst() -> void:
	AudioDirector.play_3d("flap_small", _random_point(12.0, 5.0), -4.0, 1.0)
	AudioDirector.play_3d("crow_%d" % (_rng.randi() % 2), _random_point(14.0, 5.0), -6.0, 1.0)
	# Startle the real wildlife too, so the event propagates through the world.
	for node in get_tree().get_nodes_in_group("wildlife"):
		if node.global_position.distance_to(_player.global_position) < 30.0:
			node.startle(_player.global_position)


func _tree_groan() -> void:
	AudioDirector.play_3d("creak_tree_%d" % (_rng.randi() % 2),
			_random_point(11.0, 6.0), -5.0, _rng.randf_range(0.8, 1.0))


## Steps that land in time with the player's own, one beat late, from behind.
func _footsteps_behind() -> void:
	var surface := _player.current_surface
	var point := _behind_point(_rng.randf_range(4.0, 7.0))
	for i in 4:
		await get_tree().create_timer(0.42 + _rng.randf_range(-0.05, 0.05)).timeout
		if _player == null or not _player.stats.is_alive:
			return
		AudioDirector.play_3d("step_%s_%d" % [surface, i % AudioDirector.FOOTSTEP_VARIANTS],
				point, -7.0, _rng.randf_range(0.9, 1.05))
	_player.stats.drain_sanity(3.0)


func _torch_interference() -> void:
	if not _player.flashlight.is_on:
		return
	_player.flashlight.interference = 1.0
	AudioDirector.play_2d("static", -14.0, 1.0)
	await get_tree().create_timer(_rng.randf_range(2.0, 4.5)).timeout
	if _player != null:
		_player.flashlight.interference = 0.0


func _close_whisper() -> void:
	AudioDirector.play_2d("whisper_close", -6.0, _rng.randf_range(0.95, 1.1), "Voice")
	_player.stats.drain_sanity(4.0)


func _name_spoken() -> void:
	# The single most effective thing in the game, so it is used sparingly and
	# only once the player has given the basin something to work with.
	if GameState.posts_recorded() < 1:
		return
	AudioDirector.play_2d("whisper_name", -3.0, 1.0, "Voice")
	EventBus.notification_posted.emit("Something said your name.")
	_player.stats.drain_sanity(7.0)


func _distant_scream() -> void:
	AudioDirector.play_3d("scream_far", _random_point(45.0, 15.0), -8.0, 1.0, "Voice", 120.0)
	_player.stats.drain_sanity(5.0)


func _stinger() -> void:
	AudioDirector.play_2d("stinger_hard", -3.0, 1.0)
	_player.stats.drain_sanity(9.0)


# ---------------------------------------------------------------------------
# The watcher
# ---------------------------------------------------------------------------

## A silhouette placed at the edge of vision that removes itself the moment the
## player looks straight at it — so it is never confirmed, and never resolves
## into something the player can get used to.
func _spawn_watcher() -> void:
	if is_instance_valid(_watcher):
		return
	var point := _random_point(_rng.randf_range(16.0, 26.0), 4.0)
	point.y = _world.ground_height(point.x, point.z)

	_watcher = Node3D.new()
	_watcher.position = point
	_world.add_child(_watcher)

	var material := (AssetFoundry.material("figure") as ShaderMaterial).duplicate()
	material.set_shader_parameter("presence", 0.55)
	material.set_shader_parameter("rim_strength", 0.8)

	for part in [["torso_tall", 1.15], ["head_long", 1.62]]:
		var mesh := MeshInstance3D.new()
		mesh.mesh = AssetFoundry.mesh(String(part[0]))
		mesh.material_override = material
		mesh.position = Vector3(0, float(part[1]), 0)
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_watcher.add_child(mesh)

	_watcher.look_at(Vector3(_player.global_position.x, point.y, _player.global_position.z), Vector3.UP)
	_watcher_timer = _rng.randf_range(6.0, 14.0)
	EventBus.hallucination_started.emit("watcher")


func _update_watcher(delta: float) -> void:
	if not is_instance_valid(_watcher):
		return
	_watcher_timer -= delta
	var to_watcher := (_watcher.global_position - _player.eye_position()).normalized()
	var looking := -_player.camera.global_basis.z.dot(to_watcher)
	# Looked at directly, or waited out: it was never there.
	if looking > 0.965 or _watcher_timer <= 0.0:
		_watcher.queue_free()
		_watcher = null
		EventBus.hallucination_ended.emit("watcher")
		if looking > 0.965:
			_player.stats.drain_sanity(5.0)
			AudioDirector.play_2d("breath", -12.0, 0.9)


# ---------------------------------------------------------------------------
# Hallucination
# ---------------------------------------------------------------------------

## Briefly rewrites the world's ambience so the player cannot trust what they
## are hearing. Deliberately does not move geometry: a hallucination that alters
## the level teaches players to distrust navigation, which is exhausting rather
## than frightening.
func _hallucination() -> void:
	var kind: String = ["reversed", "crowd", "silence"][_rng.randi() % 3]
	EventBus.hallucination_started.emit(kind)
	GameState.set_flag("playback_active", true)
	var duration := _rng.randf_range(HALLUCINATION_DURATION.x, HALLUCINATION_DURATION.y)

	match kind:
		"reversed":
			AudioDirector.set_layer_pitch("wind", 0.55)
			AudioDirector.set_layer_stream("drone", "bed_drone_wrong")
		"crowd":
			for i in 5:
				AudioDirector.play_3d("whisper_%d" % (i % AudioDirector.WHISPER_VARIANTS),
						_random_point(_rng.randf_range(4.0, 12.0)), -9.0,
						_rng.randf_range(0.8, 1.2), "Voice", 30.0)
		"silence":
			for layer in AudioDirector.LAYERS:
				AudioDirector.set_layer(layer, 0.0)

	_player.stats.drain_sanity(6.0)
	await get_tree().create_timer(duration).timeout
	AudioDirector.set_layer_pitch("wind", 1.0)
	GameState.set_flag("playback_active", false)
	EventBus.hallucination_ended.emit(kind)
