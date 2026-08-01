class_name HUD
extends Control
## The in-game heads-up display.
##
## Minimal by design. There is no health bar in the corner and no minimap: the
## player reads their condition from the screen effects and from how the
## character behaves, and reads the world from the world. What is left is what
## cannot be conveyed any other way — what you are about to interact with, what
## you are meant to be doing, and the two resources that have hard failure
## states (stamina and battery), which appear only when they matter.
##
## Everything here fades rather than pops, and everything scales with the
## screen: the same layout has to work on a 1440p monitor and a 5-inch phone.

const VITAL_FADE_SPEED := 2.2
const TOAST_DURATION := 3.2
const PROMPT_FADE := 6.0

var _player: Player
var _world: WorldRoot

var _crosshair: Control
var _prompt: Label
var _objective: Label
var _region: Label
var _toast: Label
var _clock: Label
var _stamina: ProgressBar
var _battery: ProgressBar
var _loading: Control
var _loading_bar: ProgressBar
var _loading_label: Label
var _fps: Label

var _prompt_alpha := 0.0
var _toast_timer := 0.0
var _region_timer := 0.0
var _vital_alpha := {"stamina": 0.0, "battery": 0.0}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_to_group("ui_scalable")
	_build()
	_connect_signals()


func bind(player: Player, world: WorldRoot) -> void:
	_player = player
	_world = world


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------

func _build() -> void:
	_crosshair = _make_crosshair()
	add_child(_crosshair)

	_prompt = _make_label(HORIZONTAL_ALIGNMENT_CENTER, UITheme.AMBER)
	_prompt.set_anchors_preset(Control.PRESET_CENTER)
	_prompt.anchor_left = 0.0
	_prompt.anchor_right = 1.0
	_prompt.anchor_top = 0.5
	_prompt.anchor_bottom = 0.5
	_prompt.offset_top = 46
	_prompt.offset_bottom = 78
	_prompt.modulate.a = 0.0
	add_child(_prompt)

	_objective = _make_label(HORIZONTAL_ALIGNMENT_LEFT, UITheme.BONE_DIM)
	_objective.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_objective.offset_left = 26
	_objective.offset_top = 22
	_objective.offset_right = 480
	_objective.offset_bottom = 60
	_objective.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_objective)

	_region = _make_label(HORIZONTAL_ALIGNMENT_CENTER, UITheme.BONE)
	_region.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_region.anchor_left = 0.0
	_region.anchor_right = 1.0
	_region.offset_top = 96
	_region.offset_bottom = 130
	_region.modulate.a = 0.0
	_region.add_theme_font_size_override("font_size", 24)
	add_child(_region)

	_toast = _make_label(HORIZONTAL_ALIGNMENT_CENTER, UITheme.MOSS)
	_toast.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_toast.anchor_left = 0.0
	_toast.anchor_right = 1.0
	_toast.offset_top = -128
	_toast.offset_bottom = -96
	_toast.modulate.a = 0.0
	add_child(_toast)

	_clock = _make_label(HORIZONTAL_ALIGNMENT_RIGHT, UITheme.BONE_DIM)
	_clock.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_clock.offset_left = -220
	_clock.offset_right = -26
	_clock.offset_top = 22
	_clock.offset_bottom = 50
	add_child(_clock)

	_stamina = _make_meter(UITheme.MOSS)
	_stamina.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_stamina.anchor_left = 0.5
	_stamina.anchor_right = 0.5
	_stamina.offset_left = -110
	_stamina.offset_right = 110
	_stamina.offset_top = -58
	_stamina.offset_bottom = -52
	add_child(_stamina)

	_battery = _make_meter(UITheme.AMBER)
	_battery.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_battery.anchor_left = 0.5
	_battery.anchor_right = 0.5
	_battery.offset_left = -110
	_battery.offset_right = 110
	_battery.offset_top = -44
	_battery.offset_bottom = -38
	add_child(_battery)

	_fps = _make_label(HORIZONTAL_ALIGNMENT_RIGHT, UITheme.BONE_DIM)
	_fps.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_fps.offset_left = -180
	_fps.offset_right = -18
	_fps.offset_top = -34
	_fps.offset_bottom = -12
	_fps.visible = bool(Settings.get_value("show_fps"))
	add_child(_fps)

	_build_loading_panel()
	refresh_ui_scale()


func _build_loading_panel() -> void:
	_loading = Control.new()
	_loading.set_anchors_preset(Control.PRESET_FULL_RECT)
	_loading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_loading)

	var backdrop := ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.015, 0.018, 0.021, 1.0)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_loading.add_child(backdrop)

	var column := VBoxContainer.new()
	column.set_anchors_preset(Control.PRESET_CENTER)
	column.anchor_left = 0.5
	column.anchor_right = 0.5
	column.anchor_top = 0.5
	column.anchor_bottom = 0.5
	column.offset_left = -200
	column.offset_right = 200
	column.offset_top = -40
	column.offset_bottom = 40
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_loading.add_child(column)

	_loading_label = _make_label(HORIZONTAL_ALIGNMENT_CENTER, UITheme.BONE)
	_loading_label.text = "Walking in"
	column.add_child(_loading_label)

	_loading_bar = ProgressBar.new()
	_loading_bar.custom_minimum_size = Vector2(0, 5)
	_loading_bar.max_value = 1.0
	_loading_bar.step = 0.001
	_loading_bar.show_percentage = false
	column.add_child(_loading_bar)


func _make_crosshair() -> Control:
	var dot := Control.new()
	dot.set_anchors_preset(Control.PRESET_CENTER)
	dot.custom_minimum_size = Vector2(6, 6)
	dot.size = Vector2(6, 6)
	dot.anchor_left = 0.5
	dot.anchor_right = 0.5
	dot.anchor_top = 0.5
	dot.anchor_bottom = 0.5
	dot.offset_left = -3
	dot.offset_right = 3
	dot.offset_top = -3
	dot.offset_bottom = 3
	dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fill := ColorRect.new()
	fill.set_anchors_preset(Control.PRESET_FULL_RECT)
	fill.color = Color(0.85, 0.85, 0.80, 0.45)
	fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dot.add_child(fill)
	return dot


func _make_label(alignment: int, colour: Color) -> Label:
	var label := Label.new()
	label.horizontal_alignment = alignment
	label.add_theme_color_override("font_color", colour)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	label.add_theme_constant_override("shadow_offset_y", 1)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _make_meter(colour: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.max_value = 1.0
	bar.step = 0.001
	bar.show_percentage = false
	bar.modulate = Color(colour.r, colour.g, colour.b, 0.0)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return bar


func _connect_signals() -> void:
	EventBus.interactable_focused.connect(_on_interactable_focused)
	EventBus.interactable_unfocused.connect(_on_interactable_unfocused)
	EventBus.objective_changed.connect(_on_objective_changed)
	EventBus.objective_completed.connect(_on_objective_completed)
	EventBus.notification_posted.connect(show_toast)
	EventBus.player_moved_region.connect(_on_region_changed)
	EventBus.poi_discovered.connect(func(_id: String, display: String) -> void:
		show_toast("Found: %s" % display))
	EventBus.item_added.connect(func(item_id: String, count: int) -> void:
		show_toast("Picked up %s%s" % [ItemDatabase.display_name(item_id),
				"" if count <= 1 else " x%d" % count]))
	EventBus.settings_changed.connect(_on_settings_changed)


# ---------------------------------------------------------------------------
# Frame
# ---------------------------------------------------------------------------

func _process(delta: float) -> void:
	_update_prompt(delta)
	_update_toast(delta)
	_update_region(delta)
	if _player == null:
		return
	_update_vitals(delta)
	_update_clock()
	if _fps.visible:
		_fps.text = "%.0f fps  %s" % [PerformanceDirector.fps(), PerformanceDirector.tier_name()]


func _update_prompt(delta: float) -> void:
	var target := 1.0 if _prompt.text != "" else 0.0
	_prompt_alpha = move_toward(_prompt_alpha, target, PROMPT_FADE * delta)
	_prompt.modulate.a = _prompt_alpha
	_crosshair.modulate.a = 1.0 if bool(Settings.get_value("crosshair")) else 0.0
	# The crosshair brightens when there is something under it.
	_crosshair.scale = Vector2.ONE * lerpf(1.0, 1.6, _prompt_alpha)


func _update_toast(delta: float) -> void:
	if _toast_timer <= 0.0:
		_toast.modulate.a = move_toward(_toast.modulate.a, 0.0, delta * 2.0)
		return
	_toast_timer -= delta
	_toast.modulate.a = minf(1.0, _toast.modulate.a + delta * 5.0)


func _update_region(delta: float) -> void:
	if _region_timer <= 0.0:
		_region.modulate.a = move_toward(_region.modulate.a, 0.0, delta * 0.6)
		return
	_region_timer -= delta
	_region.modulate.a = minf(1.0, _region.modulate.a + delta * 1.4)


## Stamina and battery meters are invisible until they are worth worrying
## about, then fade in. A permanently visible bar stops being information.
func _update_vitals(delta: float) -> void:
	var stats := _player.stats
	_stamina.value = stats.stamina_fraction()
	_battery.value = stats.battery_fraction()

	var stamina_target := 0.0
	if stats.stamina_fraction() < 0.92 or stats.is_exhausted:
		stamina_target = 1.0
	var battery_target := 0.0
	if _player.flashlight.is_on or stats.battery_fraction() < 0.3:
		battery_target = 1.0

	_vital_alpha["stamina"] = move_toward(_vital_alpha["stamina"], stamina_target,
			VITAL_FADE_SPEED * delta)
	_vital_alpha["battery"] = move_toward(_vital_alpha["battery"], battery_target,
			VITAL_FADE_SPEED * delta)
	_stamina.modulate.a = _vital_alpha["stamina"] * (0.45 if not stats.is_exhausted else 0.9)
	_battery.modulate.a = _vital_alpha["battery"] * 0.6


func _update_clock() -> void:
	if _world == null or _world.time_of_day == null:
		return
	_clock.text = "%s   day %d" % [_world.time_of_day.formatted(), GameState.day]


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

func _on_interactable_focused(target: Node) -> void:
	_prompt.text = target.interaction_prompt() if target != null else ""


func _on_interactable_unfocused() -> void:
	_prompt.text = ""


func _on_objective_changed(_id: String, text: String) -> void:
	_objective.text = text
	_objective.modulate = Color(1, 1, 1, 1)


func _on_objective_completed(_id: String) -> void:
	_objective.modulate = Color(0.55, 0.65, 0.5, 0.8)


func _on_region_changed(region: String) -> void:
	_region.text = region
	_region_timer = 3.0


func show_toast(text: String) -> void:
	_toast.text = text
	_toast_timer = TOAST_DURATION


func _on_settings_changed(key: String, value: Variant) -> void:
	if key == "show_fps":
		_fps.visible = bool(value)
	elif key == "ui_scale" or key == "large_text":
		refresh_ui_scale()


func refresh_ui_scale() -> void:
	var scale := Platform.recommended_ui_scale() * float(Settings.get_value("ui_scale"))
	var base := 17 if not bool(Settings.get_value("large_text")) else 21
	for label in [_prompt, _objective, _toast, _clock, _fps, _loading_label]:
		if label != null:
			label.add_theme_font_size_override("font_size", int(base * scale))
	if _region != null:
		_region.add_theme_font_size_override("font_size", int(24 * scale))


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

func set_loading_progress(fraction: float) -> void:
	_loading_bar.value = clampf(fraction, 0.0, 1.0)


func finish_loading() -> void:
	var tween := create_tween()
	tween.tween_property(_loading, "modulate:a", 0.0, 0.7)
	await tween.finished
	_loading.visible = false
