extends Control
## First scene. Unlocks browser audio, warms the procedural asset and audio
## libraries, then hands over to the main menu.
##
## The "press to begin" gate is not decoration: every browser blocks the audio
## context until a real user gesture, and iOS Safari additionally throttles
## WebGL work on a tab that has never been touched. Building the world's assets
## *after* that gesture also means the heavy loop runs while the player is
## looking at an intentional screen rather than a frozen one.

const MIN_DISPLAY_TIME := 1.2

@onready var _title: Label = $Layout/Title
@onready var _subtitle: Label = $Layout/Subtitle
@onready var _status: Label = $Layout/Status
@onready var _bar: ProgressBar = $Layout/Progress
@onready var _prompt: Label = $Layout/Prompt

var _started := false
var _elapsed := 0.0


func _ready() -> void:
	get_window().theme = UITheme.build(
		Platform.recommended_ui_scale() * float(Settings.get_value("ui_scale")),
		bool(Settings.get_value("large_text")))
	GameState.load_meta_progress()
	_bar.visible = false
	_status.text = ""
	_prompt.text = "TAP TO BEGIN" if Platform.has_touch else "CLICK OR PRESS ANY KEY"
	_animate_prompt()
	Log.info("boot", "bootstrap ready on %s" % Platform.user_agent())


func _process(delta: float) -> void:
	_elapsed += delta


## Uses `_input` rather than `_unhandled_input`: a Control with the default
## mouse filter consumes mouse and touch events as GUI input before they ever
## reach the unhandled stage. That made the title card start on a key press but
## not on a tap — which is to say, not at all on the platform this game is
## primarily for.
func _input(event: InputEvent) -> void:
	if _started:
		return
	var is_gesture: bool = (
		(event is InputEventMouseButton and event.pressed)
		or (event is InputEventScreenTouch and event.pressed)
		or (event is InputEventKey and event.pressed and not event.echo))
	if is_gesture:
		get_viewport().set_input_as_handled()
		_begin()


func _animate_prompt() -> void:
	var tween := create_tween().set_loops()
	tween.tween_property(_prompt, "modulate:a", 0.25, 1.1).set_trans(Tween.TRANS_SINE)
	tween.tween_property(_prompt, "modulate:a", 1.0, 1.1).set_trans(Tween.TRANS_SINE)


func _begin() -> void:
	_started = true
	_prompt.visible = false
	_bar.visible = true
	AudioDirector.unlock_audio()

	AssetFoundry.warm_up_progress.connect(_on_foundry_progress)
	await AssetFoundry.warm_up()
	AssetFoundry.warm_up_progress.disconnect(_on_foundry_progress)

	_status.text = "Tuning the recorders"
	_bar.value = 0.88
	await AudioDirector.warm_up()

	_status.text = "Ready"
	_bar.value = 1.0
	# Never flash past the title card, even on a fast desktop.
	if _elapsed < MIN_DISPLAY_TIME:
		await get_tree().create_timer(MIN_DISPLAY_TIME - _elapsed).timeout
	SceneRouter.go_to("menu")


func _on_foundry_progress(fraction: float, label: String) -> void:
	_bar.value = fraction * 0.85
	_status.text = label
