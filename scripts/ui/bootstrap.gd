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
@onready var _start_button: Button = $StartButton

var _started := false
var _elapsed := 0.0
var _bar_target := 0.0


func _ready() -> void:
	get_window().theme = UITheme.build(
		Platform.recommended_ui_scale() * float(Settings.get_value("ui_scale")),
		bool(Settings.get_value("large_text")))
	GameState.load_meta_progress()
	_bar.visible = false
	_status.text = ""
	_prompt.text = "TAP TO BEGIN" if Platform.has_touch else "CLICK OR PRESS ANY KEY"
	_start_button.pressed.connect(_begin)
	_animate_prompt()
	Log.info("boot", "bootstrap ready on %s" % Platform.user_agent())
	Platform.report_stage("title card")


func _process(delta: float) -> void:
	_elapsed += delta
	# The foundry only reports between its eight stages, and one stage can run
	# for a couple of seconds on a phone. Drifting towards where the next stage
	# will start keeps the bar moving throughout, so a slow device does not read
	# as a frozen one — the floor rate is what guarantees visible movement, the
	# proportional term is what lets a fast machine catch up without a jump.
	if _bar.visible and _bar.value < _bar_target:
		var gap := _bar_target - _bar.value
		_bar.value += minf(gap, delta * maxf(0.05, gap * 3.0))


## Uses `_input` rather than `_unhandled_input`: a Control with the default
## mouse filter consumes mouse and touch events as GUI input before they ever
## reach the unhandled stage. That made the title card start on a key press but
## not on a tap — which is to say, not at all on the platform this game is
## primarily for.
##
## `$StartButton` covers the whole card and does the same job through the normal
## GUI path. The redundancy is deliberate: this screen is the one place where a
## missed input means the game is simply unplayable, with nothing on screen to
## suggest why.
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
	# Reachable from three places — a raw gesture, the button, and a key — so the
	# guard belongs here rather than at each call site.
	if _started:
		return
	_started = true
	_prompt.visible = false
	_start_button.disabled = true
	_bar.visible = true
	AudioDirector.unlock_audio()
	# Now that there has been a gesture, the page is allowed to ask for landscape.
	Platform.run_js("window.blackPineRequestLandscape && window.blackPineRequestLandscape()")

	AssetFoundry.warm_up_progress.connect(_on_foundry_progress)
	await AssetFoundry.warm_up()
	AssetFoundry.warm_up_progress.disconnect(_on_foundry_progress)

	_set_stage(0.88, 0.97, "Tuning the recorders")
	await AudioDirector.warm_up()

	_set_stage(1.0, 1.0, "Ready")
	# Never flash past the title card, even on a fast desktop.
	if _elapsed < MIN_DISPLAY_TIME:
		await get_tree().create_timer(MIN_DISPLAY_TIME - _elapsed).timeout
	Platform.report_stage("menu")
	SceneRouter.go_to("menu")


func _on_foundry_progress(fraction: float, label: String) -> void:
	# The signal fires as a stage begins, so `reached` is where the bar is and
	# the drift target is roughly where the next stage will pick up.
	_set_stage(fraction * 0.85, fraction * 0.85 + 0.10, label)


func _set_stage(reached: float, drift_to: float, label: String) -> void:
	_bar.value = maxf(_bar.value, reached)
	_bar_target = maxf(_bar_target, drift_to)
	_status.text = label
	Platform.report_stage(label)
