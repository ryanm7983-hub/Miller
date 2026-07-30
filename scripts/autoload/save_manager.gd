extends Node
## Slot-based persistence.
##
## Everything is JSON under `user://saves/`. On the web export Godot maps
## `user://` onto IndexedDB and flushes it asynchronously, which is exactly the
## "browser local storage" requirement: no bespoke JavaScript bridge is needed
## and the same code path runs on desktop.
##
## Save data is versioned. `migrate()` upgrades older payloads in place so an
## existing browser save survives a redeploy instead of being silently dropped.

const SAVE_DIR := "user://saves"
const SLOT_COUNT := 3
const AUTOSAVE_SLOT := -1  ## stored separately so it never overwrites a manual save
const SAVE_VERSION := 3

signal save_completed(slot: int, success: bool)
signal load_completed(slot: int, success: bool)

var _last_error := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	DirAccess.make_dir_recursive_absolute(SAVE_DIR)


func slot_path(slot: int) -> String:
	if slot == AUTOSAVE_SLOT:
		return "%s/autosave.json" % SAVE_DIR
	return "%s/slot_%d.json" % [SAVE_DIR, slot]


func has_save(slot: int) -> bool:
	return FileAccess.file_exists(slot_path(slot))


func any_save_exists() -> bool:
	if has_save(AUTOSAVE_SLOT):
		return true
	for i in SLOT_COUNT:
		if has_save(i):
			return true
	return false


## Lightweight header used by the load menu so it does not have to parse and
## instantiate the full payload for every slot.
func peek(slot: int) -> Dictionary:
	if not has_save(slot):
		return {}
	var payload := _read(slot)
	if payload.is_empty():
		return {}
	return {
		"slot": slot,
		"version": payload.get("version", 0),
		"saved_at": payload.get("saved_at", 0),
		"playtime": payload.get("playtime", 0.0),
		"chapter": payload.get("chapter", "Unknown"),
		"location": payload.get("location", "The Basin"),
		"day": payload.get("day", 1),
		"hour": payload.get("hour", 0.0),
		"sanity": payload.get("sanity", 100.0),
	}


func list_slots() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for i in SLOT_COUNT:
		var header := peek(i)
		if header.is_empty():
			out.append({"slot": i, "empty": true})
		else:
			header["empty"] = false
			out.append(header)
	return out


func save_game(slot: int) -> bool:
	var payload := GameState.serialize()
	payload["version"] = SAVE_VERSION
	payload["saved_at"] = int(Time.get_unix_time_from_system())
	var text := JSON.stringify(payload)
	var file := FileAccess.open(slot_path(slot), FileAccess.WRITE)
	if file == null:
		_last_error = "cannot open %s for writing" % slot_path(slot)
		Log.error("save", _last_error)
		save_completed.emit(slot, false)
		return false
	file.store_string(text)
	file.close()
	if slot >= 0:
		Settings.set_value("last_slot", slot)
		Settings.flush_now()
	Log.info("save", "wrote slot %d (%d bytes)" % [slot, text.length()])
	save_completed.emit(slot, true)
	EventBus.game_saved.emit(slot)
	return true


func load_game(slot: int) -> bool:
	var payload := _read(slot)
	if payload.is_empty():
		load_completed.emit(slot, false)
		return false
	payload = migrate(payload)
	if not GameState.deserialize(payload):
		_last_error = "payload rejected by GameState"
		Log.error("save", _last_error)
		load_completed.emit(slot, false)
		return false
	Log.info("save", "loaded slot %d" % slot)
	load_completed.emit(slot, true)
	return true


func delete_save(slot: int) -> void:
	var path := slot_path(slot)
	if FileAccess.file_exists(path):
		# DirAccess understands the `user://` prefix directly, no globalising.
		DirAccess.remove_absolute(path)
		Log.info("save", "deleted slot %d" % slot)


func last_error() -> String:
	return _last_error


## Upgrade an older payload to the current schema.
func migrate(payload: Dictionary) -> Dictionary:
	var version := int(payload.get("version", 1))
	if version >= SAVE_VERSION:
		return payload
	Log.info("save", "migrating save v%d -> v%d" % [version, SAVE_VERSION])
	if version < 2:
		# v1 stored a flat sanity float on the root; v2 moved player vitals into
		# their own dictionary.
		var player: Dictionary = payload.get("player", {})
		if payload.has("sanity") and not player.has("sanity"):
			player["sanity"] = payload["sanity"]
		payload["player"] = player
		payload["choices"] = payload.get("choices", {})
	if version < 3:
		# v3 introduced per-post activation records for the listening network.
		payload["listening_posts"] = payload.get("listening_posts", {})
		payload["documents"] = payload.get("documents", [])
	payload["version"] = SAVE_VERSION
	return payload


func _read(slot: int) -> Dictionary:
	var path := slot_path(slot)
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		_last_error = "cannot read %s" % path
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		_last_error = "slot %d is corrupt" % slot
		Log.warn("save", _last_error)
		return {}
	return parsed
