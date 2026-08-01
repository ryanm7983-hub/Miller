class_name TouchControls
extends Control
## On-screen controls for phones and tablets.
##
## All touch handling lives here, in one `_input` handler that owns every active
## finger. That is deliberate: the alternative — eight overlapping `_gui_input`
## handlers plus a joystick region plus a look region — gets multi-touch subtly
## wrong in ways that only show up when a player is moving, looking and pressing
## a button at once, which is exactly when it matters.
##
## Layout rules, in order of importance:
##
##  1. **Nothing important lives under a thumb.** The stick and the button
##     cluster sit in the bottom corners; the middle of the screen is clear.
##  2. **The stick floats.** It appears wherever the left thumb lands rather
##     than at a fixed spot, because a fixed stick requires the player to look
##     at their thumb.
##  3. **Everything scales with the shortest screen edge**, clamped so buttons
##     stay thumb-sized on a small phone and do not become absurd on a tablet.
##  4. **Left-handed mode mirrors the whole layout**, not just the stick.

const STICK_RADIUS_FRACTION := 0.11    ## of the shortest screen edge
const STICK_DEAD_ZONE := 0.14
const BUTTON_SIZE_FRACTION := 0.085
const BUTTON_MIN := 48.0
const BUTTON_MAX := 92.0
const EDGE_MARGIN_FRACTION := 0.045
const LOOK_SPLIT := 0.5                ## fraction of width belonging to the stick side

## Buttons, in cluster order (nearest the thumb first).
const BUTTON_DEFS := [
	{"action": "interact", "glyph": "E", "label": "USE", "toggle": false, "colour": "amber"},
	{"action": "sprint", "glyph": "»", "label": "RUN", "toggle": false, "colour": "bone"},
	{"action": "crouch", "glyph": "_", "label": "CROUCH", "toggle": true, "colour": "bone"},
	{"action": "flashlight", "glyph": "*", "label": "LIGHT", "toggle": true, "colour": "amber"},
	{"action": "listen", "glyph": "(", "label": "LISTEN", "toggle": false, "colour": "cold"},
	{"action": "jump", "glyph": "^", "label": "JUMP", "toggle": false, "colour": "bone"},
]

## Buttons pinned to the top edge rather than the thumb cluster.
const TOP_BUTTON_DEFS := [
	{"action": "inventory", "glyph": "#", "label": "BAG", "toggle": false, "colour": "bone"},
	{"action": "journal", "glyph": "J", "label": "JOURNAL", "toggle": false, "colour": "bone"},
	{"action": "pause", "glyph": "=", "label": "", "toggle": false, "colour": "bone"},
]

## Actions that behave as taps rather than holds.
const TAP_ACTIONS := ["interact", "inventory", "journal", "pause", "jump"]

var _buttons: Array[TouchButton] = []
var _stick_origin := Vector2.ZERO
var _stick_position := Vector2.ZERO
var _stick_touch := -1
var _look_touch := -1
var _look_last := Vector2.ZERO
var _button_touches: Dictionary = {}   ## touch index -> TouchButton
var _stick_radius := 70.0
var _left_handed := false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_to_group("ui_scalable")
	process_mode = Node.PROCESS_MODE_PAUSABLE
	EventBus.settings_changed.connect(_on_settings_changed)
	get_viewport().size_changed.connect(refresh_ui_scale)
	refresh_ui_scale()


## Rebuild the layout. Called on rotation, resize, UI-scale change and
## handedness change — all of which are the same operation.
func refresh_ui_scale() -> void:
	_left_handed = bool(Settings.get_value("left_handed"))
	for button in _buttons:
		button.queue_free()
	_buttons.clear()
	_button_touches.clear()

	var view := get_viewport_rect().size
	var shortest := minf(view.x, view.y)
	var ui_scale := float(Settings.get_value("ui_scale"))
	_stick_radius = shortest * STICK_RADIUS_FRACTION * ui_scale
	var button_size := clampf(shortest * BUTTON_SIZE_FRACTION * ui_scale, BUTTON_MIN, BUTTON_MAX)
	var margin := shortest * EDGE_MARGIN_FRACTION

	_build_cluster(view, button_size, margin)
	_build_top_row(view, button_size * 0.8, margin)
	queue_redraw()


## The action cluster is an arc around the thumb, not a grid: a grid puts the
## far corner out of reach on a large phone held one-handed.
func _build_cluster(view: Vector2, button_size: float, margin: float) -> void:
	var pivot := Vector2(view.x - margin - button_size * 0.6, view.y - margin - button_size * 0.6)
	if _left_handed:
		pivot.x = margin + button_size * 0.6

	var arc_radius := button_size * 1.55
	for i in BUTTON_DEFS.size():
		var def: Dictionary = BUTTON_DEFS[i]
		# Sweep upward and inward from the corner.
		var angle := lerpf(PI * 1.02, PI * 1.52, float(i) / float(BUTTON_DEFS.size() - 1))
		var ring := 1.0 + float(i % 2) * 0.62
		var offset := Vector2(cos(angle), sin(angle)) * arc_radius * ring
		if _left_handed:
			offset.x = -offset.x
		_add_button(def, pivot + offset, button_size)


func _build_top_row(view: Vector2, button_size: float, margin: float) -> void:
	for i in TOP_BUTTON_DEFS.size():
		var def: Dictionary = TOP_BUTTON_DEFS[i]
		var x := view.x - margin - button_size * 0.5 - float(i) * (button_size * 1.35)
		if _left_handed:
			x = margin + button_size * 0.5 + float(i) * (button_size * 1.35)
		_add_button(def, Vector2(x, margin + button_size * 0.5), button_size)


func _add_button(def: Dictionary, centre: Vector2, button_size: float) -> void:
	var button := TouchButton.new()
	add_child(button)
	button.size = Vector2(button_size, button_size)
	button.position = centre - button.size * 0.5
	button.configure(String(def["action"]), String(def["glyph"]), String(def["label"]),
			bool(def["toggle"]), _colour(String(def["colour"])))
	_buttons.append(button)


func _colour(name: String) -> Color:
	match name:
		"amber": return UITheme.AMBER
		"cold": return UITheme.COLD
		"moss": return UITheme.MOSS
		_: return UITheme.BONE


# ---------------------------------------------------------------------------
# Touch handling
# ---------------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventScreenTouch:
		_handle_touch(event)
	elif event is InputEventScreenDrag:
		_handle_drag(event)


func _handle_touch(event: InputEventScreenTouch) -> void:
	if event.pressed:
		var button := _button_at(event.position)
		if button != null:
			_button_touches[event.index] = button
			_press_button(button)
			get_viewport().set_input_as_handled()
			return
		if _is_stick_side(event.position) and _stick_touch == -1:
			_stick_touch = event.index
			_stick_origin = event.position
			_stick_position = event.position
			queue_redraw()
			get_viewport().set_input_as_handled()
		elif _look_touch == -1:
			_look_touch = event.index
			_look_last = event.position
			get_viewport().set_input_as_handled()
	else:
		if _button_touches.has(event.index):
			var button: TouchButton = _button_touches[event.index]
			_release_button(button)
			_button_touches.erase(event.index)
		elif event.index == _stick_touch:
			_stick_touch = -1
			_send_move(Vector2.ZERO)
			queue_redraw()
		elif event.index == _look_touch:
			_look_touch = -1


func _handle_drag(event: InputEventScreenDrag) -> void:
	if event.index == _stick_touch:
		_stick_position = event.position
		var offset := _stick_position - _stick_origin
		# Dragging beyond the ring pulls the ring along, so a thumb that walks
		# up the screen does not silently stop steering.
		if offset.length() > _stick_radius:
			_stick_origin = _stick_position - offset.normalized() * _stick_radius
			offset = offset.normalized() * _stick_radius
		var normalised := offset / _stick_radius
		if normalised.length() < STICK_DEAD_ZONE:
			normalised = Vector2.ZERO
		# Screen Y is down; forward is -Y.
		_send_move(Vector2(normalised.x, -normalised.y))
		queue_redraw()
	elif event.index == _look_touch:
		var delta := event.position - _look_last
		_look_last = event.position
		get_tree().call_group("player_input", "add_touch_look", delta)
	elif _button_touches.has(event.index):
		# Sliding off a button releases it, the same as a physical one.
		var button: TouchButton = _button_touches[event.index]
		if not button.contains(event.position):
			_release_button(button)
			_button_touches.erase(event.index)


func _is_stick_side(point: Vector2) -> bool:
	var split := get_viewport_rect().size.x * LOOK_SPLIT
	return (point.x > split) if _left_handed else (point.x < split)


func _button_at(point: Vector2) -> TouchButton:
	for button in _buttons:
		if button.contains(point):
			return button
	return null


func _press_button(button: TouchButton) -> void:
	button.set_held(true)
	if bool(Settings.get_value("haptics")) and Input.get_connected_joypads().is_empty():
		Input.vibrate_handheld(12)
	if TAP_ACTIONS.has(button.action):
		get_tree().call_group("player_input", "tap_touch_action", button.action)
	else:
		get_tree().call_group("player_input", "set_touch_action", button.action, true)
	if button.is_toggle:
		button.set_active(not button.is_active)
		if not TAP_ACTIONS.has(button.action):
			# A toggle button holds the action down until it is pressed again.
			get_tree().call_group("player_input", "set_touch_action",
					button.action, button.is_active)


func _release_button(button: TouchButton) -> void:
	button.set_held(false)
	if TAP_ACTIONS.has(button.action):
		return
	if button.is_toggle:
		return  # latched; released on the next press
	get_tree().call_group("player_input", "set_touch_action", button.action, false)


func _send_move(vector: Vector2) -> void:
	get_tree().call_group("player_input", "set_touch_move", vector)


## Reflect real state back into the toggle buttons, so the torch button matches
## the torch even when it was switched off by a dead battery.
func sync_toggle(action: String, active: bool) -> void:
	for button in _buttons:
		if button.action == action and button.is_toggle:
			button.set_active(active)
			get_tree().call_group("player_input", "set_touch_action", action, active)


func _draw() -> void:
	if _stick_touch == -1:
		return
	var ring := UITheme.BONE
	ring.a = 0.30
	draw_arc(_stick_origin, _stick_radius, 0.0, TAU, 44, ring, 2.0, true)
	draw_circle(_stick_origin, _stick_radius, Color(0.03, 0.035, 0.04, 0.18))

	var knob := _stick_position
	var offset := knob - _stick_origin
	if offset.length() > _stick_radius:
		knob = _stick_origin + offset.normalized() * _stick_radius
	var knob_colour := UITheme.BONE
	knob_colour.a = 0.55
	draw_circle(knob, _stick_radius * 0.36, knob_colour)


func _on_settings_changed(key: String, _value: Variant) -> void:
	if key == "ui_scale" or key == "left_handed" or key == "touch_controls":
		refresh_ui_scale()
