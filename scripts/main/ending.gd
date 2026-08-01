extends Control
## Ending / death screen.
##
## Deaths and endings share this screen deliberately. Dying in the basin is not
## a failure state with a retry button — it is one of the ways the run finishes,
## and it is written like one. What differs is that a death offers to reload and
## an ending offers the menu.

var _title: Label
var _body: RichTextLabel
var _buttons: HBoxContainer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = false
	_build()
	_populate()
	_set_ambience()


func _build() -> void:
	var backdrop := ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.012, 0.014, 0.017)
	add_child(backdrop)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(620, 0)
	column.add_theme_constant_override("separation", 18)
	centre.add_child(column)

	_title = Label.new()
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.add_theme_font_size_override("font_size", 40)
	_title.add_theme_color_override("font_color", Color(0.78, 0.77, 0.72))
	column.add_child(_title)

	_body = RichTextLabel.new()
	_body.bbcode_enabled = true
	_body.fit_content = true
	_body.custom_minimum_size = Vector2(620, 260)
	_body.add_theme_color_override("default_color", Color(0.58, 0.59, 0.55))
	_body.add_theme_font_size_override("normal_font_size", 17)
	column.add_child(_body)

	_buttons = HBoxContainer.new()
	_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	_buttons.add_theme_constant_override("separation", 12)
	column.add_child(_buttons)


func _populate() -> void:
	var ending_id := String(GameState.get_flag("ending", ""))
	if ending_id != "":
		_populate_ending(ending_id)
	else:
		_populate_death(String(GameState.get_flag("last_death_cause", "unknown")))


func _populate_ending(ending_id: String) -> void:
	var entry := StoryDirector.ending_entry(ending_id)
	_title.text = String(entry["title"])
	_body.text = String(entry["body"])
	_add_button("Return to the menu", func() -> void:
		GameState.is_in_run = false
		SceneRouter.go_to("menu"))
	var found := GameState.endings_unlocked.size()
	var progress := Label.new()
	progress.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	progress.add_theme_color_override("font_color", Color(0.34, 0.36, 0.33))
	progress.text = "%d of %d endings found" % [found, StoryDirector.ENDING_COUNT]
	_body.get_parent().add_child(progress)


const DEATH_LINES := {
	"the_listener": "It never once looked at you. It did not need to.",
	"the_surveyor": "He called out first, the way a person would, and you answered
the way a person would.",
	"the_chorus": "They did not touch you. They only came close, and stayed, and
went on being close.",
	"fall": "The basin is steeper than the map admits.",
	"unknown": "The basin keeps what it is given.",
}


func _populate_death(cause: String) -> void:
	_title.text = "THE BASIN KEEPS"
	var line := String(DEATH_LINES.get(cause, DEATH_LINES["unknown"]))
	_body.text = "[i]%s[/i]\n\nYou got as far as %s, on day %d.\n\nWhatever is left of you is
in the wood now, laid down thin, waiting for somebody with a drill and a
reason." % [line, GameState.current_region, GameState.day]

	if SaveManager.has_save(SaveManager.AUTOSAVE_SLOT) or SaveManager.has_save(GameState.slot):
		_add_button("Load last save", func() -> void:
			var slot := GameState.slot if SaveManager.has_save(GameState.slot) \
					else SaveManager.AUTOSAVE_SLOT
			if SaveManager.load_game(slot):
				SceneRouter.go_to("game", "Walking in")
			else:
				SceneRouter.go_to("menu"))
	_add_button("Return to the menu", func() -> void:
		GameState.is_in_run = false
		SceneRouter.go_to("menu"))


func _add_button(text: String, handler: Callable) -> void:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(220, 44)
	button.pressed.connect(handler)
	_buttons.add_child(button)


func _set_ambience() -> void:
	for layer in AudioDirector.LAYERS:
		AudioDirector.set_layer(layer, 0.0)
	AudioDirector.set_layer("drone", 0.5)
	AudioDirector.set_layer("wind", 0.2)
	AudioDirector.set_tension(0.35)
