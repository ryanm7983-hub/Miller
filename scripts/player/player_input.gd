class_name PlayerInput
extends Node
## Unified input for the player controller.
##
## The controller never asks "is this a phone?" — it asks this node for a move
## vector, a look delta and a set of action states. Keyboard/mouse, gamepad and
## the on-screen touch layer all feed the same three things.
##
## Touch input arrives through the `player_input` group rather than a direct
## reference, so `TouchControls` can be created, destroyed and re-created (which
## it is, on every screen resize and control-scheme change) without the player
## caring.
##
## Look input is *accumulated and consumed*: mouse motion arrives in `_input` at
## whatever rate the OS delivers it, and the camera applies it once per frame.
## Reading it as a rate instead would make sensitivity frame-rate dependent.

const ACTIONS := [
	"sprint", "crouch", "jump", "interact", "flashlight",
	"inventory", "journal", "listen", "pause",
]

## Touch look is in pixels; mouse look is too, but the two want different
## scaling because a thumb travels much less far than a mouse.
const MOUSE_LOOK_SCALE := 0.0022
const TOUCH_LOOK_SCALE := 0.0034

var enabled: bool = true

var _look_accumulator := Vector2.ZERO
var _touch_move := Vector2.ZERO
var _touch_actions: Dictionary = {}
var _touch_just_pressed: Dictionary = {}
var _touch_just_released: Dictionary = {}
var _using_touch := false


func _ready() -> void:
	add_to_group("player_input")
	for action in ACTIONS:
		_touch_actions[action] = false


func _input(event: InputEvent) -> void:
	if not enabled:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_look_accumulator += event.relative * MOUSE_LOOK_SCALE
		_using_touch = false


func _process(_delta: float) -> void:
	# Latches are single-frame; clearing them at the end of the frame in which
	# they were read is what makes `was_pressed()` behave like Godot's own
	# `is_action_just_pressed()`.
	if not _touch_just_pressed.is_empty():
		_touch_just_pressed.clear()
	if not _touch_just_released.is_empty():
		_touch_just_released.clear()


# ---------------------------------------------------------------------------
# Queries used by the controller
# ---------------------------------------------------------------------------

## Desired movement in local space: x = strafe, y = forward.
func move_vector() -> Vector2:
	if not enabled:
		return Vector2.ZERO
	var keyboard := Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	if keyboard.length_squared() > 0.001:
		_using_touch = false
		return keyboard.limit_length(1.0)
	return _touch_move.limit_length(1.0)


## Accumulated look delta in radians, cleared by reading it.
func consume_look() -> Vector2:
	if not enabled:
		_look_accumulator = Vector2.ZERO
		return Vector2.ZERO
	var value := _look_accumulator
	_look_accumulator = Vector2.ZERO
	if bool(Settings.get_value("invert_look_y")):
		value.y = -value.y
	var sensitivity := float(Settings.get_value(
			"touch_sensitivity" if _using_touch else "mouse_sensitivity"))
	return value * sensitivity * 4.0


func is_pressed(action: String) -> bool:
	if not enabled:
		return false
	if bool(_touch_actions.get(action, false)):
		return true
	return InputMap.has_action(action) and Input.is_action_pressed(action)


func was_pressed(action: String) -> bool:
	if not enabled:
		return false
	if bool(_touch_just_pressed.get(action, false)):
		return true
	return InputMap.has_action(action) and Input.is_action_just_pressed(action)


func was_released(action: String) -> bool:
	if not enabled:
		return false
	if bool(_touch_just_released.get(action, false)):
		return true
	return InputMap.has_action(action) and Input.is_action_just_released(action)


## Sprint and crouch honour the hold-vs-toggle settings; the controller asks for
## the *intent*, not the raw button.
func wants_sprint(currently_sprinting: bool) -> bool:
	if bool(Settings.get_value("hold_to_sprint")):
		return is_pressed("sprint")
	if was_pressed("sprint"):
		return not currently_sprinting
	return currently_sprinting


func wants_crouch(currently_crouching: bool) -> bool:
	if bool(Settings.get_value("hold_to_crouch")):
		return is_pressed("crouch")
	if was_pressed("crouch"):
		return not currently_crouching
	return currently_crouching


func using_touch() -> bool:
	return _using_touch


# ---------------------------------------------------------------------------
# Called by TouchControls through the `player_input` group
# ---------------------------------------------------------------------------

func set_touch_move(vector: Vector2) -> void:
	_touch_move = vector
	if vector.length_squared() > 0.001:
		_using_touch = true


func add_touch_look(delta: Vector2) -> void:
	_look_accumulator += delta * TOUCH_LOOK_SCALE
	_using_touch = true


func set_touch_action(action: String, pressed: bool) -> void:
	var was := bool(_touch_actions.get(action, false))
	_touch_actions[action] = pressed
	if pressed and not was:
		_touch_just_pressed[action] = true
	elif was and not pressed:
		_touch_just_released[action] = true


## Fire an action for exactly one frame — used by touch buttons that are taps
## rather than holds (interact, inventory, pause).
func tap_touch_action(action: String) -> void:
	_touch_just_pressed[action] = true
	_using_touch = true


## Drop everything. Called when a menu opens so a held key does not leak into
## the pause screen and back out again.
func clear() -> void:
	_look_accumulator = Vector2.ZERO
	_touch_move = Vector2.ZERO
	_touch_just_pressed.clear()
	_touch_just_released.clear()
	for action in ACTIONS:
		_touch_actions[action] = false
