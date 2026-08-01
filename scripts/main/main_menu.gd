class_name MainMenu
extends Control
## Title screen.
##
## The background is a live, slowly drifting view of the basin rather than a
## still: the same generator that builds the playable world runs here at a
## reduced streaming radius, so the menu already tells you what kind of place
## this is. On the lowest quality tier it falls back to a static gradient — a
## title screen is not worth a frame budget the game itself needs.

const CAMERA_DRIFT := 0.035

signal started()

var _world: WorldRoot
var _camera_pivot: Node3D
var _camera: Camera3D
var _settings: SettingsPanel
var _slot_panel: VBoxContainer
var _buttons: VBoxContainer
var _endings_label: Label
var _live_background := false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	GameState.load_meta_progress()
	get_window().theme = UITheme.build(
		Platform.recommended_ui_scale() * float(Settings.get_value("ui_scale")),
		bool(Settings.get_value("large_text")))
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_build_background()
	_build_ui()
	_start_menu_ambience()


func _build_background() -> void:
	var gradient := ColorRect.new()
	gradient.set_anchors_preset(Control.PRESET_FULL_RECT)
	gradient.color = Color(0.016, 0.020, 0.024)
	add_child(gradient)

	_live_background = PerformanceDirector.current_tier > PerformanceDirector.Tier.POTATO \
			and AssetFoundry.is_ready
	if not _live_background:
		return

	# The menu world uses its own seed so the title screen does not spoil the
	# layout of the run the player is about to start.
	var previous_seed := GameState.world_seed
	if previous_seed == 0:
		GameState.world_seed = 991117

	_camera_pivot = Node3D.new()
	add_child(_camera_pivot)
	_camera = Camera3D.new()
	_camera.fov = 62.0
	_camera.far = 500.0
	_camera_pivot.add_child(_camera)

	_world = WorldRoot.new()
	_world.name = "MenuWorld"
	add_child(_world)
	_world.build(_camera_pivot)

	var spawn := _world.generator.poi("fire_tower")
	var origin: Vector3 = spawn["position"] if not spawn.is_empty() else Vector3.ZERO
	_camera_pivot.global_position = Vector3(origin.x, _world.ground_height(origin.x, origin.z) + 26.0, origin.z)
	_camera.rotation_degrees = Vector3(-9, 0, 0)
	_world.time_of_day.set_hour(19.1)
	_world.time_of_day.time_scale = 0.25
	_world.weather.lock_to("fog")
	_world.chunks.prime(_camera_pivot.global_position)
	GameState.world_seed = previous_seed


func _build_ui() -> void:
	var vignette := ColorRect.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	vignette.color = Color(0.0, 0.0, 0.0, 0.35)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(vignette)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 72)
	margin.add_theme_constant_override("margin_bottom", 64)
	margin.add_theme_constant_override("margin_top", 64)
	add_child(margin)

	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.custom_minimum_size = Vector2(320, 0)
	column.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	column.add_theme_constant_override("separation", 8)
	margin.add_child(column)

	var title := Label.new()
	title.text = "THE BLACK PINE"
	title.add_theme_font_size_override("font_size", 46)
	title.add_theme_color_override("font_color", Color(0.82, 0.81, 0.76))
	title.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	title.add_theme_constant_override("shadow_offset_y", 2)
	column.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "the basin remembers every sound it has ever heard"
	subtitle.add_theme_color_override("font_color", Color(0.42, 0.45, 0.41))
	column.add_child(subtitle)

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 28)
	column.add_child(spacer)

	_buttons = VBoxContainer.new()
	_buttons.add_theme_constant_override("separation", 6)
	column.add_child(_buttons)

	if SaveManager.any_save_exists():
		_buttons.add_child(_button("Continue", _on_continue))
	_buttons.add_child(_button("New game", _on_new_game))
	if SaveManager.any_save_exists():
		_buttons.add_child(_button("Load game", _on_load_pressed))
	_buttons.add_child(_button("Settings", _on_settings_pressed))
	if not Platform.is_web:
		_buttons.add_child(_button("Quit", func() -> void: get_tree().quit()))

	_endings_label = Label.new()
	_endings_label.add_theme_color_override("font_color", Color(0.36, 0.38, 0.35))
	_endings_label.add_theme_font_size_override("font_size", 14)
	_endings_label.text = _endings_text()
	column.add_child(_endings_label)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	_settings = SettingsPanel.new()
	_settings.visible = false
	_settings.closed.connect(func() -> void:
		_settings.visible = false
		_buttons.visible = true)
	centre.add_child(_settings)

	_slot_panel = VBoxContainer.new()
	_slot_panel.visible = false
	_slot_panel.add_theme_constant_override("separation", 8)
	centre.add_child(_slot_panel)


func _button(text: String, handler: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(280, 44)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.pressed.connect(handler)
	button.mouse_entered.connect(func() -> void: AudioDirector.play_ui("ui_move"))
	return button


func _endings_text() -> String:
	var found := GameState.endings_unlocked.size()
	if found == 0:
		return ""
	return "%d of %d endings found" % [found, StoryDirector.ENDING_COUNT]


func _start_menu_ambience() -> void:
	AudioDirector.set_layer("wind", 0.45)
	AudioDirector.set_layer("drone", 0.35)
	AudioDirector.set_layer("insects", 0.12)
	AudioDirector.set_tension(0.2)


func _process(delta: float) -> void:
	if _camera_pivot != null:
		_camera_pivot.rotate_y(delta * CAMERA_DRIFT)


# ---------------------------------------------------------------------------

func _on_continue() -> void:
	AudioDirector.play_ui("ui_confirm")
	var slot := int(Settings.get_value("last_slot"))
	if not SaveManager.has_save(slot):
		slot = SaveManager.AUTOSAVE_SLOT
	if SaveManager.load_game(slot):
		_enter_game()
	else:
		AudioDirector.play_ui("ui_deny")


func _on_new_game() -> void:
	AudioDirector.play_ui("ui_confirm")
	GameState.new_game(int(Settings.get_value("last_slot")), 0)
	_enter_game()


func _on_settings_pressed() -> void:
	AudioDirector.play_ui("ui_confirm")
	_buttons.visible = false
	_settings.visible = true
	_settings.refresh()


func _on_load_pressed() -> void:
	AudioDirector.play_ui("ui_confirm")
	_buttons.visible = false
	_populate_slots()
	_slot_panel.visible = true


func _populate_slots() -> void:
	for child in _slot_panel.get_children():
		child.queue_free()

	var header := Label.new()
	header.text = "LOAD"
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_slot_panel.add_child(header)

	var entries := SaveManager.list_slots()
	if SaveManager.has_save(SaveManager.AUTOSAVE_SLOT):
		var auto := SaveManager.peek(SaveManager.AUTOSAVE_SLOT)
		auto["empty"] = false
		auto["slot"] = SaveManager.AUTOSAVE_SLOT
		entries.push_front(auto)

	for entry: Dictionary in entries:
		var slot := int(entry["slot"])
		var button := Button.new()
		button.custom_minimum_size = Vector2(360, 46)
		button.disabled = bool(entry.get("empty", true))
		button.text = _slot_text(entry)
		button.pressed.connect(func() -> void:
			if SaveManager.load_game(slot):
				_enter_game()
			else:
				AudioDirector.play_ui("ui_deny"))
		_slot_panel.add_child(button)

	var back := Button.new()
	back.text = "Back"
	back.pressed.connect(func() -> void:
		AudioDirector.play_ui("ui_back")
		_slot_panel.visible = false
		_buttons.visible = true)
	_slot_panel.add_child(back)


func _slot_text(entry: Dictionary) -> String:
	var slot := int(entry["slot"])
	var label := "Autosave" if slot == SaveManager.AUTOSAVE_SLOT else "Slot %d" % (slot + 1)
	if bool(entry.get("empty", true)):
		return "%s — empty" % label
	var played := int(float(entry.get("playtime", 0.0)))
	return "%s — %s, day %d, %d:%02d" % [
		label, entry.get("location", "The Basin"), int(entry.get("day", 1)),
		played / 3600 + (played % 3600) / 60, played % 60]


func _enter_game() -> void:
	started.emit()
	SceneRouter.go_to("game", "Walking in")
