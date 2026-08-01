extends Node
## Authoritative model of a single playthrough.
##
## Nothing in here touches the scene tree. The world, the UI and the AI all read
## from it and write to it through small accessors, which means a save file is
## simply `serialize()` and loading a game is `deserialize()` followed by a
## scene reload. It also makes the story systems testable headlessly.

const WORLD_SIZE := 1024.0  ## metres, side length of the playable basin

signal chapter_changed(chapter_id: String)

## --- Run identity ---------------------------------------------------------
var world_seed: int = 0
var slot: int = 0
var playtime: float = 0.0
var chapter_id: String = "arrival"

## --- Player snapshot (owned by the player node while it exists) ------------
var player_position: Vector3 = Vector3.ZERO
var player_yaw: float = 0.0
var player_vitals: Dictionary = {
	"health": 100.0,
	"stamina": 100.0,
	"sanity": 100.0,
	"battery": 100.0,
}

## --- World clock ----------------------------------------------------------
var day: int = 1
## The run opens at dusk rather than in the dark. Night is the game's default
## and dangerous state, but arriving into pitch black gives a new player nothing
## to orient by; starting an hour before sunset lets them see the basin once,
## and then lose it.
const OPENING_HOUR := 17.4

var time_of_day: float = OPENING_HOUR  ## hours, 0..24
var weather_id: String = "clear"

## --- Progression ----------------------------------------------------------
var flags: Dictionary = {}
var objectives: Array[String] = []
var completed_objectives: Array[String] = []
var active_objective: String = ""
var choices: Dictionary = {}
var listening_posts: Dictionary = {}  ## post_id -> {"activated": bool, "recorded": bool}
var discovered_pois: Array[String] = []
var documents: Array[String] = []
var inventory_payload: Dictionary = {}
var puzzle_states: Dictionary = {}
var endings_unlocked: Array[String] = []

## --- Derived / volatile ---------------------------------------------------
var current_region: String = "The Basin"
var is_in_run: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func _process(delta: float) -> void:
	if is_in_run and not get_tree().paused:
		playtime += delta


## Start a fresh playthrough. A seed of 0 means "pick one".
func new_game(save_slot: int, seed_value: int = 0) -> void:
	slot = save_slot
	world_seed = seed_value if seed_value != 0 else _random_seed()
	playtime = 0.0
	chapter_id = "arrival"
	day = 1
	time_of_day = OPENING_HOUR
	weather_id = "clear"
	player_position = Vector3.ZERO
	player_yaw = 0.0
	player_vitals = {"health": 100.0, "stamina": 100.0, "sanity": 100.0, "battery": 100.0}
	flags.clear()
	objectives.clear()
	completed_objectives.clear()
	choices.clear()
	listening_posts.clear()
	discovered_pois.clear()
	documents.clear()
	puzzle_states.clear()
	inventory_payload.clear()
	active_objective = ""
	current_region = "Fire Road"
	is_in_run = true
	Log.info("state", "new game slot=%d seed=%d" % [slot, world_seed])


# --- Flags ----------------------------------------------------------------

func set_flag(flag: String, value: Variant = true) -> void:
	if flags.get(flag) == value:
		return
	flags[flag] = value
	EventBus.flag_set.emit(flag, value)


func get_flag(flag: String, fallback: Variant = false) -> Variant:
	return flags.get(flag, fallback)


func has_flag(flag: String) -> bool:
	return bool(flags.get(flag, false))


# --- Objectives -----------------------------------------------------------

func push_objective(objective_id: String, text: String) -> void:
	if completed_objectives.has(objective_id):
		return
	if not objectives.has(objective_id):
		objectives.append(objective_id)
	active_objective = objective_id
	EventBus.objective_changed.emit(objective_id, text)


func complete_objective(objective_id: String) -> void:
	if completed_objectives.has(objective_id):
		return
	completed_objectives.append(objective_id)
	objectives.erase(objective_id)
	if active_objective == objective_id:
		active_objective = objectives.back() if not objectives.is_empty() else ""
	EventBus.objective_completed.emit(objective_id)


# --- Story bookkeeping ----------------------------------------------------

func record_choice(choice_id: String, option_id: String) -> void:
	choices[choice_id] = option_id
	EventBus.choice_made.emit(choice_id, option_id)


func choice(choice_id: String, fallback: String = "") -> String:
	return String(choices.get(choice_id, fallback))


func mark_post(post_id: String, activated: bool, recorded: bool) -> void:
	listening_posts[post_id] = {"activated": activated, "recorded": recorded}
	if activated:
		EventBus.listening_post_activated.emit(post_id)


func posts_activated() -> int:
	var count := 0
	for id: String in listening_posts:
		if bool(listening_posts[id].get("activated", false)):
			count += 1
	return count


func posts_recorded() -> int:
	var count := 0
	for id: String in listening_posts:
		if bool(listening_posts[id].get("recorded", false)):
			count += 1
	return count


func discover_poi(poi_id: String, display_name: String) -> void:
	if discovered_pois.has(poi_id):
		return
	discovered_pois.append(poi_id)
	EventBus.poi_discovered.emit(poi_id, display_name)


func collect_document(document_id: String) -> void:
	if documents.has(document_id):
		return
	documents.append(document_id)
	EventBus.document_collected.emit(document_id)


func set_chapter(new_chapter: String) -> void:
	if chapter_id == new_chapter:
		return
	chapter_id = new_chapter
	chapter_changed.emit(new_chapter)


func unlock_ending(ending_id: String) -> void:
	if not endings_unlocked.has(ending_id):
		endings_unlocked.append(ending_id)
	_write_meta_progress()


func set_puzzle_state(puzzle_id: String, state: Dictionary) -> void:
	puzzle_states[puzzle_id] = state


func puzzle_state(puzzle_id: String) -> Dictionary:
	return puzzle_states.get(puzzle_id, {})


# --- Serialisation --------------------------------------------------------

func serialize() -> Dictionary:
	return {
		"seed": world_seed,
		"slot": slot,
		"playtime": playtime,
		"chapter": chapter_id,
		"day": day,
		"hour": time_of_day,
		"weather": weather_id,
		"location": current_region,
		"sanity": player_vitals.get("sanity", 100.0),
		"player": {
			"position": [player_position.x, player_position.y, player_position.z],
			"yaw": player_yaw,
			"vitals": player_vitals.duplicate(),
		},
		"flags": flags.duplicate(true),
		"objectives": objectives.duplicate(),
		"completed_objectives": completed_objectives.duplicate(),
		"active_objective": active_objective,
		"choices": choices.duplicate(),
		"listening_posts": listening_posts.duplicate(true),
		"discovered_pois": discovered_pois.duplicate(),
		"documents": documents.duplicate(),
		"inventory": inventory_payload.duplicate(true),
		"puzzles": puzzle_states.duplicate(true),
		"endings": endings_unlocked.duplicate(),
	}


func deserialize(payload: Dictionary) -> bool:
	if not payload.has("seed") or not payload.has("player"):
		return false
	world_seed = int(payload.get("seed", 0))
	slot = int(payload.get("slot", 0))
	playtime = float(payload.get("playtime", 0.0))
	chapter_id = String(payload.get("chapter", "arrival"))
	day = int(payload.get("day", 1))
	time_of_day = float(payload.get("hour", OPENING_HOUR))
	weather_id = String(payload.get("weather", "clear"))
	current_region = String(payload.get("location", "The Basin"))

	var player: Dictionary = payload.get("player", {})
	var pos: Array = player.get("position", [0, 0, 0])
	player_position = Vector3(float(pos[0]), float(pos[1]), float(pos[2])) if pos.size() == 3 else Vector3.ZERO
	player_yaw = float(player.get("yaw", 0.0))
	player_vitals = _to_float_dict(player.get("vitals", {}), {
		"health": 100.0, "stamina": 100.0, "sanity": 100.0, "battery": 100.0,
	})

	flags = payload.get("flags", {}).duplicate(true)
	objectives = _to_string_array(payload.get("objectives", []))
	completed_objectives = _to_string_array(payload.get("completed_objectives", []))
	active_objective = String(payload.get("active_objective", ""))
	choices = payload.get("choices", {}).duplicate()
	listening_posts = payload.get("listening_posts", {}).duplicate(true)
	discovered_pois = _to_string_array(payload.get("discovered_pois", []))
	documents = _to_string_array(payload.get("documents", []))
	inventory_payload = payload.get("inventory", {}).duplicate(true)
	puzzle_states = payload.get("puzzles", {}).duplicate(true)
	endings_unlocked = _to_string_array(payload.get("endings", []))
	is_in_run = true
	return true


## Endings and "seen the intro" survive across save slots; they describe the
## player, not the run.
const META_PATH := "user://meta.json"


func _write_meta_progress() -> void:
	var file := FileAccess.open(META_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({"endings": endings_unlocked}))
	file.close()


func load_meta_progress() -> void:
	if not FileAccess.file_exists(META_PATH):
		return
	var file := FileAccess.open(META_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) == TYPE_DICTIONARY:
		endings_unlocked = _to_string_array(parsed.get("endings", []))


func _random_seed() -> int:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	return rng.randi() & 0x7FFFFFFF


func _to_string_array(source: Variant) -> Array[String]:
	var out: Array[String] = []
	if typeof(source) != TYPE_ARRAY:
		return out
	for value: Variant in source:
		out.append(String(value))
	return out


func _to_float_dict(source: Variant, fallback: Dictionary) -> Dictionary:
	var out := fallback.duplicate()
	if typeof(source) != TYPE_DICTIONARY:
		return out
	for key: String in fallback:
		if source.has(key):
			out[key] = float(source[key])
	return out
