class_name Interactor
extends RayCast3D
## Finds and operates whatever the player is looking at.
##
## Interactable objects are duck-typed rather than sharing a base class: any
## node that answers `interaction_prompt()` and `interact(player)` qualifies.
## That matters because interactables in this game are wildly different kinds of
## node — a door is a `StaticBody3D` with a hinge, a note is an `Area3D`, a
## generator is a puzzle controller — and forcing them into one inheritance
## chain would be worse than the small amount of duck typing here.
##
## The raycast collides with the *interactable* layer and with world geometry,
## so you cannot reach through a wall to open a door on the far side.

const REACH := 2.6
const LAYER_MASK := 1 | 2 | 32 | 64   ## terrain, static world, interactable, prop

signal focus_changed(target: Node)

var current: Node = null
## Renamed from `enabled` because RayCast3D already owns that property and
## shadowing it silently breaks the base class.
var is_active: bool = true

var _player: Node3D
var _last_prompt := ""


func setup(player: Node3D) -> void:
	_player = player
	target_position = Vector3(0, 0, -REACH)
	collision_mask = LAYER_MASK
	collide_with_areas = true
	collide_with_bodies = true
	is_active = true


func _physics_process(_delta: float) -> void:
	if not is_active:
		_set_current(null)
		return
	force_raycast_update()
	var hit: Node = get_collider() if is_colliding() else null
	_set_current(_resolve(hit))


## Walk up from the collider to the node that actually handles interaction: the
## collision shape's owner is usually a child of the real object.
func _resolve(hit: Node) -> Node:
	var node := hit
	var depth := 0
	while node != null and depth < 4:
		if node.has_method("interact") and node.has_method("interaction_prompt"):
			if not node.has_method("can_interact") or node.can_interact(_player):
				return node
			return null
		node = node.get_parent()
		depth += 1
	return null


func _set_current(target: Node) -> void:
	if target == current:
		# The prompt can change without the target changing — a door that has
		# just been unlocked, a radio that is now powered.
		if current != null:
			var prompt: String = current.interaction_prompt()
			if prompt != _last_prompt:
				_last_prompt = prompt
				EventBus.interactable_focused.emit(current)
		return
	current = target
	if current != null:
		_last_prompt = current.interaction_prompt()
		EventBus.interactable_focused.emit(current)
	else:
		_last_prompt = ""
		EventBus.interactable_unfocused.emit()
	focus_changed.emit(current)


## Returns true when something was actually operated.
func activate() -> bool:
	if current == null or not is_active:
		return false
	current.interact(_player)
	EventBus.interaction_performed.emit(current)
	return true


func prompt() -> String:
	return _last_prompt


func has_target() -> bool:
	return current != null
