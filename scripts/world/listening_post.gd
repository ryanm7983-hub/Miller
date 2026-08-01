class_name ListeningPost
extends StaticBody3D
## One of the eleven stations, and the game's central interaction.
##
## Using a post has two steps, and the gap between them is the whole design:
##
##   1. **Bring it online.** Costs a dry cell. Safe, and progress toward the
##      story's requirements.
##   2. **Play it back.** Free, and irreversible — it is what teaches the basin
##      your voice. Every playback permanently raises the population budget and
##      unlocks heavier horror events, and the game never says so directly. It
##      tells you through Rill's journal, which the player may not have found.
##
## Offering a strictly optional action that makes the game harder, with the
## warning buried in a collectible, is a risk. It is the point: the story is
## about the cost of listening, and a mechanic that only *describes* that cost
## would be decoration.

const ACTIVATION_COST := "battery_cell"

signal activated(post_id: String)
signal recorded(post_id: String)

var post_id: String = ""
var index: int = 0
var is_online: bool = false
var was_played: bool = false

var _light: OmniLight3D
var _hum: AudioStreamPlayer3D
var _mesh: MeshInstance3D
var _busy := false


func _ready() -> void:
	collision_layer = 2 | 32   # static world + interactable
	collision_mask = 0
	add_to_group("listening_post")


func configure(new_id: String, new_index: int) -> void:
	post_id = new_id
	index = new_index
	if not is_inside_tree():
		await ready
	_build()
	_restore_state()


func _build() -> void:
	_mesh = MeshInstance3D.new()
	_mesh.mesh = AssetFoundry.mesh("listening_post")
	_mesh.material_override = AssetFoundry.material("rust")
	add_child(_mesh)

	var collider := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.45
	shape.height = 2.0
	collider.shape = shape
	collider.position = Vector3(0, 1.0, 0)
	add_child(collider)

	# A single dim indicator. Eleven of these across the basin become the
	# player's map of their own progress, visible from a long way off at night.
	_light = OmniLight3D.new()
	_light.light_color = UITheme.COLD
	_light.light_energy = 0.0
	_light.omni_range = 6.0
	_light.shadow_enabled = false
	_light.position = Vector3(0, 1.7, 0)
	add_child(_light)

	_hum = AudioStreamPlayer3D.new()
	_hum.stream = AudioDirector.stream("static")
	_hum.bus = "Ambience"
	_hum.unit_size = 3.5
	_hum.max_distance = 22.0
	_hum.volume_db = -18.0
	_hum.position = Vector3(0, 1.6, 0)
	add_child(_hum)


func _restore_state() -> void:
	var record: Dictionary = GameState.listening_posts.get(post_id, {})
	is_online = bool(record.get("activated", false))
	was_played = bool(record.get("recorded", false))
	_apply_visual_state()


func _apply_visual_state() -> void:
	if _light == null:
		return
	_light.light_energy = 0.9 if is_online else 0.0
	if is_online and not _hum.playing:
		_hum.play()
	elif not is_online and _hum.playing:
		_hum.stop()


# ---------------------------------------------------------------------------
# Interaction
# ---------------------------------------------------------------------------

func interaction_prompt() -> String:
	if _busy:
		return "…"
	if not is_online:
		return "Fit a dry cell  (%s)" % ("have one" if _has_cell() else "none carried")
	if not was_played:
		return "Play back what it has"
	return "Nothing more on this one"


func can_interact(_player: Node3D) -> bool:
	return not _busy and (not is_online or not was_played)


func interact(player: Node3D) -> void:
	if _busy:
		return
	if not is_online:
		_activate(player)
	elif not was_played:
		_play_back(player)


func _has_cell() -> bool:
	var game := get_tree().get_first_node_in_group("game") as Game
	return game != null and game.inventory != null and game.inventory.has(ACTIVATION_COST, 1)


func _activate(player: Node3D) -> void:
	var game := get_tree().get_first_node_in_group("game") as Game
	if game == null or game.inventory == null:
		return
	if not game.inventory.has(ACTIVATION_COST, 1):
		AudioDirector.play_2d("ui_deny", -8.0)
		EventBus.notification_posted.emit("It needs a dry cell.")
		return

	game.inventory.remove(ACTIVATION_COST, 1)
	is_online = true
	_apply_visual_state()
	AudioDirector.play_3d("switch", global_position, -4.0)
	AudioDirector.play_3d("static", global_position, -8.0)
	GameState.mark_post(post_id, true, was_played)
	activated.emit(post_id)
	EventBus.notification_posted.emit("Station %d is live. %d online."
			% [index + 1, GameState.posts_activated()])


## Playing a post back is the irreversible half. It costs nothing and it is the
## most expensive thing in the game.
func _play_back(player: Node3D) -> void:
	_busy = true
	GameState.set_flag("playback_active", true)
	AudioDirector.play_3d("static", global_position, -4.0, 1.0)

	var transcript := _transcript_id()
	if transcript != "":
		GameState.collect_document(transcript)

	# The playback itself: the basin, in the player's ears, for eight seconds.
	for i in 4:
		await get_tree().create_timer(1.6).timeout
		if not is_inside_tree():
			return
		AudioDirector.play_3d("whisper_%d" % (i % AudioDirector.WHISPER_VARIANTS),
				global_position, -5.0, 0.9 + float(i) * 0.05, "Voice", 26.0)
	await get_tree().create_timer(1.4).timeout

	was_played = true
	_busy = false
	GameState.set_flag("playback_active", false)
	GameState.mark_post(post_id, true, true)
	recorded.emit(post_id)

	if player is Player:
		player.stats.drain_sanity(8.0)
	# Everything in earshot now knows exactly where this happened.
	EventBus.report_noise(global_position, 0.9, self)
	EventBus.notification_posted.emit(
			"Something answered." if GameState.posts_recorded() > 1
			else "The tape was not blank.")
	if transcript != "":
		EventBus.document_opened.emit(transcript)


## The first three posts played back yield the three real transcripts; after
## that there is nothing new to find, only the cost.
func _transcript_id() -> String:
	match GameState.posts_recorded():
		0: return "tape_a"
		1: return "tape_b"
		2: return "tape_c"
		_: return ""
