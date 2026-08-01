class_name SettingsPanel
extends PanelContainer
## Settings, built from a declarative table.
##
## Every control is generated from `SPEC`, which names the `Settings` key it
## edits. Adding an option is one row here, not a scene edit plus a signal plus
## a save call — and because the key names are the same ones `Settings.DEFAULTS`
## validates, a typo fails loudly at startup instead of silently doing nothing.
##
## The panel is used unchanged by the main menu and the pause menu.

const SPEC := {
	"Audio": [
		{"key": "volume_master", "label": "Master", "type": "slider", "min": 0.0, "max": 1.0},
		{"key": "volume_ambience", "label": "Ambience", "type": "slider", "min": 0.0, "max": 1.0},
		{"key": "volume_sfx", "label": "Effects", "type": "slider", "min": 0.0, "max": 1.0},
		{"key": "volume_music", "label": "Score", "type": "slider", "min": 0.0, "max": 1.0},
		{"key": "volume_voice", "label": "Voices", "type": "slider", "min": 0.0, "max": 1.0},
	],
	"Video": [
		{"key": "quality_tier", "label": "Quality", "type": "option",
			"options": ["Automatic", "Potato", "Low", "Medium", "High"], "offset": -1},
		{"key": "auto_quality", "label": "Adapt to framerate", "type": "toggle",
			"hint": "Steps quality down when the framerate drops. Recommended on mobile."},
		{"key": "render_scale", "label": "Render scale", "type": "slider",
			"min": 0.5, "max": 1.0},
		{"key": "view_distance", "label": "View distance", "type": "slider",
			"min": 0.5, "max": 1.5},
		{"key": "fog_density", "label": "Fog", "type": "slider", "min": 0.4, "max": 1.6},
		{"key": "brightness", "label": "Brightness", "type": "slider", "min": 0.6, "max": 1.6},
		{"key": "field_of_view", "label": "Field of view", "type": "slider",
			"min": 60.0, "max": 100.0, "step": 1.0},
		{"key": "vsync", "label": "Vertical sync", "type": "toggle"},
		{"key": "show_fps", "label": "Show framerate", "type": "toggle"},
	],
	"Controls": [
		{"key": "touch_controls", "label": "On-screen controls", "type": "option",
			"options": ["Automatic", "Always on", "Always off"],
			"values": ["auto", "on", "off"]},
		{"key": "mouse_sensitivity", "label": "Mouse sensitivity", "type": "slider",
			"min": 0.05, "max": 1.0},
		{"key": "touch_sensitivity", "label": "Touch sensitivity", "type": "slider",
			"min": 0.05, "max": 1.0},
		{"key": "invert_look_y", "label": "Invert look", "type": "toggle"},
		{"key": "hold_to_sprint", "label": "Hold to sprint", "type": "toggle"},
		{"key": "hold_to_crouch", "label": "Hold to crouch", "type": "toggle"},
		{"key": "left_handed", "label": "Left-handed layout", "type": "toggle"},
		{"key": "haptics", "label": "Vibration", "type": "toggle"},
	],
	"Comfort": [
		{"key": "ui_scale", "label": "Interface size", "type": "slider", "min": 0.7, "max": 1.6},
		{"key": "large_text", "label": "Larger text", "type": "toggle"},
		{"key": "head_bob", "label": "Head movement", "type": "slider", "min": 0.0, "max": 1.0,
			"hint": "Set to zero if head movement makes you unwell."},
		{"key": "camera_shake", "label": "Camera shake", "type": "slider", "min": 0.0, "max": 1.0},
		{"key": "reduce_flashing", "label": "Reduce flashing", "type": "toggle",
			"hint": "Removes lightning flashes and torch stutter."},
		{"key": "jump_scares", "label": "Sudden scares", "type": "toggle",
			"hint": "Off keeps the atmosphere and removes the rare loud shocks."},
		{"key": "subtitles", "label": "Subtitles", "type": "toggle"},
		{"key": "crosshair", "label": "Crosshair", "type": "toggle"},
	],
}

signal closed()

var _tabs: TabContainer
var _controls: Dictionary = {}   ## settings key -> Control
var _suppress := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	custom_minimum_size = Vector2(520, 460)
	_build()
	EventBus.settings_changed.connect(_on_external_change)


func _build() -> void:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	add_child(column)

	var title := Label.new()
	title.text = "SETTINGS"
	title.add_theme_font_size_override("font_size", 22)
	column.add_child(title)

	_tabs = TabContainer.new()
	_tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_tabs)

	for page_name: String in SPEC:
		_tabs.add_child(_build_page(page_name, SPEC[page_name]))

	var footer := HBoxContainer.new()
	footer.alignment = BoxContainer.ALIGNMENT_END
	footer.add_theme_constant_override("separation", 10)
	column.add_child(footer)

	var reset := Button.new()
	reset.text = "Reset to defaults"
	reset.pressed.connect(_on_reset)
	footer.add_child(reset)

	var close := Button.new()
	close.text = "Close"
	close.pressed.connect(func() -> void:
		AudioDirector.play_ui("ui_back")
		closed.emit())
	footer.add_child(close)


func _build_page(page_name: String, rows: Array) -> Control:
	var scroll := ScrollContainer.new()
	scroll.name = page_name
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED

	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 10)
	scroll.add_child(list)

	for row: Dictionary in rows:
		list.add_child(_build_row(row))
	return scroll


func _build_row(row: Dictionary) -> Control:
	var container := VBoxContainer.new()
	container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	container.add_theme_constant_override("separation", 2)

	var line := HBoxContainer.new()
	line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	container.add_child(line)

	var label := Label.new()
	label.text = String(row["label"])
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.custom_minimum_size.x = 210
	line.add_child(label)

	var key := String(row["key"])
	var control := _build_control(row, key)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(control)
	_controls[key] = control

	if row.has("hint"):
		var hint := Label.new()
		hint.text = String(row["hint"])
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hint.add_theme_color_override("font_color", UITheme.BONE_DIM)
		hint.add_theme_font_size_override("font_size", 13)
		container.add_child(hint)
	return container


func _build_control(row: Dictionary, key: String) -> Control:
	match String(row["type"]):
		"slider":
			var slider := HSlider.new()
			slider.min_value = float(row.get("min", 0.0))
			slider.max_value = float(row.get("max", 1.0))
			slider.step = float(row.get("step", 0.01))
			slider.value = float(Settings.get_value(key))
			slider.custom_minimum_size = Vector2(220, 24)
			slider.value_changed.connect(func(value: float) -> void:
				if not _suppress:
					Settings.set_value(key, value))
			return slider
		"toggle":
			var check := CheckButton.new()
			check.button_pressed = bool(Settings.get_value(key))
			check.toggled.connect(func(pressed: bool) -> void:
				if not _suppress:
					AudioDirector.play_ui("ui_move")
					Settings.set_value(key, pressed))
			return check
		"option":
			var option := OptionButton.new()
			var labels: Array = row.get("options", [])
			for i in labels.size():
				option.add_item(String(labels[i]), i)
			option.selected = _index_for(row, key)
			option.item_selected.connect(func(index: int) -> void:
				if _suppress:
					return
				AudioDirector.play_ui("ui_move")
				Settings.set_value(key, _value_for(row, index)))
			return option
	return Control.new()


## Options are either an enum of strings (`values`) or an integer with an offset
## (quality tier, where index 0 means "automatic" = -1).
func _value_for(row: Dictionary, index: int) -> Variant:
	if row.has("values"):
		var values: Array = row["values"]
		return values[clampi(index, 0, values.size() - 1)]
	return index + int(row.get("offset", 0))


func _index_for(row: Dictionary, key: String) -> int:
	var current: Variant = Settings.get_value(key)
	if row.has("values"):
		var values: Array = row["values"]
		var found := values.find(current)
		return maxi(found, 0)
	return clampi(int(current) - int(row.get("offset", 0)), 0,
			int(row.get("options", []).size()) - 1)


func refresh() -> void:
	_suppress = true
	for page_name: String in SPEC:
		for row: Dictionary in SPEC[page_name]:
			var key := String(row["key"])
			var control: Control = _controls.get(key)
			if control == null:
				continue
			match String(row["type"]):
				"slider":
					(control as HSlider).value = float(Settings.get_value(key))
				"toggle":
					(control as CheckButton).button_pressed = bool(Settings.get_value(key))
				"option":
					(control as OptionButton).selected = _index_for(row, key)
	_suppress = false


func _on_reset() -> void:
	AudioDirector.play_ui("ui_deny")
	Settings.reset_to_defaults()
	refresh()


func _on_external_change(_key: String, _value: Variant) -> void:
	# Another system (the quality director stepping the tier down, say) can move
	# a setting while this panel is open.
	if not _suppress and visible:
		refresh()
