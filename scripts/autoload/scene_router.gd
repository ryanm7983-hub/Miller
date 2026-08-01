extends CanvasLayer
## Scene transitions with a fade and a real progress bar.
##
## Web builds are usually single-threaded, so a blocking `load()` would freeze
## the browser tab (and on iOS, get the page killed). Every transition goes
## through `ResourceLoader.load_threaded_*`, which degrades gracefully to
## incremental loading on the main thread when threads are unavailable.

const FADE_TIME := 0.45

const SCENES := {
	"boot": "res://scenes/main/bootstrap.tscn",
	"menu": "res://scenes/main/main_menu.tscn",
	"game": "res://scenes/main/game.tscn",
	"ending": "res://scenes/main/ending.tscn",
}

signal transition_started(target: String)
signal transition_finished(target: String)

var is_transitioning: bool = false

var _fade: ColorRect
var _label: Label
var _bar: ProgressBar
var _tip: Label
var _pending_path: String = ""
var _pending_key: String = ""

const LOADING_TIPS := [
	"Sound carries further at night. So does yours.",
	"The recorder only hears what is already there.",
	"Batteries last longer when the beam is narrow.",
	"Crouching halves the noise you make on gravel.",
	"Not everything that follows you means you harm.",
	"Rain hides your footsteps. It hides other things too.",
	"If a door was open when you left it, notice.",
]


func _ready() -> void:
	layer = 128
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_ui()


func _build_ui() -> void:
	_fade = ColorRect.new()
	_fade.color = Color(0.015, 0.018, 0.021, 1.0)
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	# The cover absorbs input rather than passing it through. A transition leaves
	# the outgoing scene alive underneath for the length of two fades plus a
	# scene instantiate, and a click landing there goes to a menu that is about
	# to be replaced — where `change_scene` drops it, because a transition is
	# already in flight. The button reads as broken. It is worst on a slow
	# machine, where the tail is longest and a player is most likely to click
	# again, which is precisely the wrong lesson to teach them. Only ever
	# visible during a transition, so this blocks nothing else.
	_fade.mouse_filter = Control.MOUSE_FILTER_STOP
	_fade.modulate.a = 0.0
	_fade.visible = false
	add_child(_fade)

	var column := VBoxContainer.new()
	column.set_anchors_preset(Control.PRESET_CENTER)
	column.anchor_left = 0.5
	column.anchor_right = 0.5
	column.anchor_top = 0.5
	column.anchor_bottom = 0.5
	column.offset_left = -220
	column.offset_right = 220
	column.offset_top = -60
	column.offset_bottom = 60
	column.add_theme_constant_override("separation", 14)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.add_child(column)

	_label = Label.new()
	_label.text = "THE BLACK PINE"
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.add_theme_color_override("font_color", Color(0.72, 0.74, 0.70))
	column.add_child(_label)

	_bar = ProgressBar.new()
	_bar.custom_minimum_size = Vector2(0, 6)
	_bar.show_percentage = false
	_bar.max_value = 1.0
	column.add_child(_bar)

	_tip = Label.new()
	_tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tip.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_tip.add_theme_color_override("font_color", Color(0.45, 0.47, 0.44))
	column.add_child(_tip)


## Change to one of the named SCENES entries.
func go_to(key: String, message: String = "") -> void:
	if not SCENES.has(key):
		Log.error("router", "unknown scene key '%s'" % key)
		return
	change_scene(SCENES[key], message, key)


func change_scene(path: String, message: String = "", key: String = "") -> void:
	if is_transitioning:
		Log.warn("router", "transition already in flight, ignoring '%s'" % path)
		return
	is_transitioning = true
	_pending_path = path
	_pending_key = key if key != "" else path
	transition_started.emit(_pending_key)
	_run_transition(message)


func _run_transition(message: String) -> void:
	_label.text = message if message != "" else "THE BLACK PINE"
	_tip.text = LOADING_TIPS[randi() % LOADING_TIPS.size()]
	_bar.value = 0.0
	_fade.visible = true

	var tween := create_tween()
	tween.tween_property(_fade, "modulate:a", 1.0, FADE_TIME)
	await tween.finished

	# Unpause before swapping so the incoming scene starts in a clean state.
	get_tree().paused = false

	var err := ResourceLoader.load_threaded_request(_pending_path, "PackedScene")
	if err != OK:
		Log.error("router", "load request failed for %s (%d)" % [_pending_path, err])
		_finish_failure()
		return

	var progress: Array = []
	while true:
		var status := ResourceLoader.load_threaded_get_status(_pending_path, progress)
		match status:
			ResourceLoader.THREAD_LOAD_IN_PROGRESS:
				_bar.value = progress[0] if not progress.is_empty() else 0.0
				await get_tree().process_frame
			ResourceLoader.THREAD_LOAD_LOADED:
				_bar.value = 1.0
				break
			_:
				Log.error("router", "load failed for %s (status %d)" % [_pending_path, status])
				_finish_failure()
				return

	var packed: PackedScene = ResourceLoader.load_threaded_get(_pending_path)
	if packed == null:
		_finish_failure()
		return

	# Give the browser a frame to breathe before the (expensive) instantiate.
	await get_tree().process_frame
	get_tree().change_scene_to_packed(packed)
	await get_tree().process_frame
	await get_tree().process_frame

	var out := create_tween()
	out.tween_property(_fade, "modulate:a", 0.0, FADE_TIME)
	await out.finished
	_fade.visible = false
	is_transitioning = false
	transition_finished.emit(_pending_key)


func _finish_failure() -> void:
	_label.text = "Could not load. Returning to the menu."
	await get_tree().create_timer(1.5).timeout
	is_transitioning = false
	_fade.visible = false
	_fade.modulate.a = 0.0
	if _pending_key != "menu":
		go_to("menu")


## Fade the screen without changing scene (used by the death and ending flows).
func fade_out(duration: float = FADE_TIME, tint: Color = Color(0.015, 0.018, 0.021, 1.0)) -> void:
	_fade.color = tint
	_fade.visible = true
	var tween := create_tween()
	tween.tween_property(_fade, "modulate:a", 1.0, duration)
	await tween.finished


func fade_in(duration: float = FADE_TIME) -> void:
	var tween := create_tween()
	tween.tween_property(_fade, "modulate:a", 0.0, duration)
	await tween.finished
	_fade.visible = false
