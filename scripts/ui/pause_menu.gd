class_name PauseMenu
extends Control
## Pause screen: resume, save, settings, quit.
##
## Runs with `PROCESS_MODE_ALWAYS` so it keeps working while the tree is paused,
## and deliberately does *not* dim the world to black — the basin stays visible
## behind it, which keeps the pause from feeling like an exit.

signal resume_requested()
signal quit_requested()

var _root: PanelContainer
var _settings: SettingsPanel
var _save_list: VBoxContainer
var _status: Label
var _menu_column: VBoxContainer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	_build()


func _build() -> void:
	var backdrop := ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.01, 0.012, 0.015, 0.62)
	add_child(backdrop)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	_root = PanelContainer.new()
	_root.custom_minimum_size = Vector2(360, 0)
	centre.add_child(_root)

	_menu_column = VBoxContainer.new()
	_menu_column.add_theme_constant_override("separation", 10)
	_root.add_child(_menu_column)

	var title := Label.new()
	title.text = "PAUSED"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 24)
	_menu_column.add_child(title)

	var region := Label.new()
	region.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	region.add_theme_color_override("font_color", UITheme.BONE_DIM)
	region.name = "Region"
	_menu_column.add_child(region)

	_menu_column.add_child(_button("Resume", _on_resume))
	_menu_column.add_child(_button("Save game", _on_save_pressed))
	_menu_column.add_child(_button("Settings", _on_settings_pressed))
	_menu_column.add_child(_button("Leave the basin", _on_quit))

	_status = Label.new()
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_color_override("font_color", UITheme.MOSS)
	_menu_column.add_child(_status)

	_settings = SettingsPanel.new()
	_settings.visible = false
	_settings.closed.connect(_on_settings_closed)
	centre.add_child(_settings)

	_save_list = VBoxContainer.new()
	_save_list.visible = false
	_save_list.add_theme_constant_override("separation", 8)
	centre.add_child(_save_list)


func _button(text: String, handler: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 42)
	button.pressed.connect(handler)
	return button


func set_open(open: bool) -> void:
	visible = open
	if open:
		_settings.visible = false
		_save_list.visible = false
		_root.visible = true
		_status.text = ""
		var region: Label = _menu_column.get_node("Region")
		region.text = "%s   %s" % [GameState.current_region, _playtime_text()]
		AudioDirector.play_ui("ui_back")
	else:
		_settings.visible = false
		_save_list.visible = false


func _playtime_text() -> String:
	var total := int(GameState.playtime)
	return "%d:%02d played" % [total / 3600 + (total % 3600) / 60, total % 60]


# ---------------------------------------------------------------------------

func _on_resume() -> void:
	AudioDirector.play_ui("ui_confirm")
	resume_requested.emit()


func _on_quit() -> void:
	AudioDirector.play_ui("ui_back")
	quit_requested.emit()


func _on_settings_pressed() -> void:
	AudioDirector.play_ui("ui_confirm")
	_root.visible = false
	_settings.visible = true
	_settings.refresh()


func _on_settings_closed() -> void:
	_settings.visible = false
	_root.visible = true


func _on_save_pressed() -> void:
	AudioDirector.play_ui("ui_confirm")
	_root.visible = false
	_populate_save_list()
	_save_list.visible = true


func _populate_save_list() -> void:
	for child in _save_list.get_children():
		child.queue_free()

	var header := Label.new()
	header.text = "SAVE TO"
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_save_list.add_child(header)

	for entry: Dictionary in SaveManager.list_slots():
		var slot := int(entry["slot"])
		var button := Button.new()
		button.custom_minimum_size = Vector2(340, 46)
		button.text = _slot_label(entry)
		button.pressed.connect(func() -> void: _save_to(slot))
		_save_list.add_child(button)

	var back := Button.new()
	back.text = "Back"
	back.pressed.connect(func() -> void:
		AudioDirector.play_ui("ui_back")
		_save_list.visible = false
		_root.visible = true)
	_save_list.add_child(back)


func _slot_label(entry: Dictionary) -> String:
	var slot := int(entry["slot"])
	if bool(entry.get("empty", true)):
		return "Slot %d — empty" % (slot + 1)
	var played := int(float(entry.get("playtime", 0.0)))
	return "Slot %d — %s, day %d, %d:%02d" % [
		slot + 1, entry.get("location", "The Basin"), int(entry.get("day", 1)),
		played / 3600 + (played % 3600) / 60, played % 60]


func _save_to(slot: int) -> void:
	var game := get_tree().get_first_node_in_group("game") as Game
	var ok := game.save_to_slot(slot) if game != null else SaveManager.save_game(slot)
	AudioDirector.play_ui("ui_confirm" if ok else "ui_deny")
	_save_list.visible = false
	_root.visible = true
	_status.text = "Saved to slot %d" % (slot + 1) if ok else "Could not save"
