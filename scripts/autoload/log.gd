extends Node
## Central logging facility.
##
## Browser consoles are noisy and `print()` calls are surprisingly expensive in
## a WebAssembly build, so every subsystem funnels through here. Verbosity is a
## runtime setting; on release web builds only warnings and errors survive.

enum Level { TRACE, DEBUG, INFO, WARN, ERROR }

## Messages below this level are discarded before any string is built.
var level: Level = Level.INFO

## Ring buffer of recent lines, surfaced by the in-game debug overlay.
const HISTORY_LIMIT := 240
var _history: PackedStringArray = []

var _channel_mutes: Dictionary = {}


func _ready() -> void:
	if OS.is_debug_build():
		level = Level.DEBUG
	elif OS.has_feature("web"):
		level = Level.WARN


func trace(channel: String, message: String) -> void:
	_emit(Level.TRACE, channel, message)


func debug(channel: String, message: String) -> void:
	_emit(Level.DEBUG, channel, message)


func info(channel: String, message: String) -> void:
	_emit(Level.INFO, channel, message)


func warn(channel: String, message: String) -> void:
	_emit(Level.WARN, channel, message)


func error(channel: String, message: String) -> void:
	_emit(Level.ERROR, channel, message)


## Silence a chatty channel without changing the global level.
func mute(channel: String, muted: bool = true) -> void:
	_channel_mutes[channel] = muted


func history() -> PackedStringArray:
	return _history.duplicate()


func _emit(msg_level: Level, channel: String, message: String) -> void:
	if msg_level < level:
		return
	if _channel_mutes.get(channel, false):
		return
	var line := "[%s][%s] %s" % [_level_name(msg_level), channel, message]
	_history.append(line)
	if _history.size() > HISTORY_LIMIT:
		_history.remove_at(0)
	match msg_level:
		Level.ERROR:
			push_error(line)
		Level.WARN:
			push_warning(line)
		_:
			print(line)


func _level_name(msg_level: Level) -> String:
	match msg_level:
		Level.TRACE: return "trace"
		Level.DEBUG: return "debug"
		Level.INFO: return "info"
		Level.WARN: return "warn"
		_: return "error"
