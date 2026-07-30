extends Node
## Player-facing settings, persisted to `user://settings.json`.
##
## On the web export `user://` is backed by IndexedDB, so writes are flushed
## asynchronously by the engine; we simply avoid writing every frame.

const SETTINGS_PATH := "user://settings.json"
const SAVE_DEBOUNCE := 0.75

## Defaults double as the schema: unknown keys in a stored file are dropped and
## missing keys fall back here, which makes forward/backward compatibility free.
const DEFAULTS := {
	# Audio (linear 0..1, converted to dB by AudioDirector)
	"volume_master": 0.9,
	"volume_music": 0.55,
	"volume_sfx": 1.0,
	"volume_ambience": 0.85,
	"volume_voice": 1.0,
	# Controls
	"mouse_sensitivity": 0.28,
	"touch_sensitivity": 0.30,
	"invert_look_y": false,
	"hold_to_sprint": true,
	"hold_to_crouch": false,
	"touch_controls": "auto",  # auto | on | off
	"left_handed": false,
	"haptics": true,
	# Video
	"quality_tier": -1,  # -1 = automatic
	"auto_quality": true,
	"render_scale": 1.0,
	"view_distance": 1.0,  # multiplier on the streaming radius
	"field_of_view": 75.0,
	"brightness": 1.0,
	"fog_density": 1.0,
	"vsync": true,
	"show_fps": false,
	# Accessibility / comfort
	"head_bob": 1.0,
	"camera_shake": 1.0,
	"subtitles": true,
	"large_text": false,
	"ui_scale": 1.0,
	"reduce_flashing": false,
	"jump_scares": true,
	"crosshair": true,
	# Meta
	"last_slot": 0,
	"seen_intro": false,
}

var _values: Dictionary = {}
var _dirty := false
var _save_timer := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_values = DEFAULTS.duplicate(true)
	load_settings()
	_apply_engine_settings()


func _process(delta: float) -> void:
	if not _dirty:
		return
	_save_timer -= delta
	if _save_timer <= 0.0:
		_flush()


func get_value(key: String) -> Variant:
	return _values.get(key, DEFAULTS.get(key))


func set_value(key: String, value: Variant) -> void:
	if not DEFAULTS.has(key):
		Log.warn("settings", "unknown key '%s' ignored" % key)
		return
	if _values.get(key) == value:
		return
	_values[key] = value
	_dirty = true
	_save_timer = SAVE_DEBOUNCE
	EventBus.settings_changed.emit(key, value)
	_apply_single(key, value)


func reset_to_defaults() -> void:
	for key: String in DEFAULTS:
		set_value(key, DEFAULTS[key])


func all_values() -> Dictionary:
	return _values.duplicate(true)


func load_settings() -> void:
	if not FileAccess.file_exists(SETTINGS_PATH):
		return
	var file := FileAccess.open(SETTINGS_PATH, FileAccess.READ)
	if file == null:
		Log.warn("settings", "could not open settings file")
		return
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		Log.warn("settings", "settings file corrupt, using defaults")
		return
	for key: String in DEFAULTS:
		if parsed.has(key) and typeof(parsed[key]) == typeof(DEFAULTS[key]):
			_values[key] = parsed[key]
	Log.info("settings", "loaded %d values" % _values.size())


## Force an immediate write. Called before navigating away on web builds.
func flush_now() -> void:
	if _dirty:
		_flush()


func _flush() -> void:
	_dirty = false
	_save_timer = 0.0
	var file := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if file == null:
		Log.warn("settings", "could not write settings")
		return
	file.store_string(JSON.stringify(_values, "\t"))
	file.close()


func _apply_engine_settings() -> void:
	for key: String in _values:
		_apply_single(key, _values[key])


func _apply_single(key: String, value: Variant) -> void:
	match key:
		"vsync":
			DisplayServer.window_set_vsync_mode(
				DisplayServer.VSYNC_ENABLED if value else DisplayServer.VSYNC_DISABLED
			)
		"ui_scale", "large_text":
			get_tree().call_group("ui_scalable", "refresh_ui_scale")
