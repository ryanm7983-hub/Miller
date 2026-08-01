class_name Pickup
extends Area3D
## A thing lying on the ground waiting to be taken.
##
## Duck-typed against `Interactor`: it answers `interaction_prompt()` and
## `interact()`, and needs no shared base class with doors or puzzle machines.
##
## Pickups that do not fit are *not* destroyed. The prompt says so and the item
## stays where it is, because silently deleting something the player wanted is
## the worst possible failure in an inventory game.

const BOB_HEIGHT := 0.04
const SPIN_SPEED := 0.55

var item_id: String = ""
var count: int = 1

var _mesh: MeshInstance3D
var _base_y := 0.0
var _phase := 0.0
var _taken := false


func _ready() -> void:
	collision_layer = 32   # interactable
	collision_mask = 0
	monitoring = false
	add_to_group("pickup")
	_phase = randf() * TAU


func configure(new_item_id: String, new_count: int = 1) -> void:
	item_id = new_item_id
	count = maxi(1, new_count)
	if not is_inside_tree():
		await ready
	_build()


func _build() -> void:
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(0.45, 0.45, 0.45)
	shape.shape = box
	shape.position = Vector3(0, 0.2, 0)
	add_child(shape)

	_mesh = MeshInstance3D.new()
	_mesh.mesh = AssetFoundry.item_mesh(item_id)
	_mesh.position = Vector3(0, 0.18, 0)
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)
	_base_y = _mesh.position.y

	# Documents get a faint glow. They are small, pale and easy to walk past,
	# and missing the story because a page blended into leaf litter is not
	# difficulty.
	if ItemDatabase.is_document(item_id):
		var glow := OmniLight3D.new()
		glow.light_color = UITheme.BONE
		glow.light_energy = 0.35
		glow.omni_range = 2.6
		glow.shadow_enabled = false
		glow.position = Vector3(0, 0.35, 0)
		add_child(glow)


func _process(delta: float) -> void:
	if _mesh == null or _taken:
		return
	_phase += delta
	_mesh.rotate_y(delta * SPIN_SPEED)
	_mesh.position.y = _base_y + sin(_phase * 1.6) * BOB_HEIGHT


# ---------------------------------------------------------------------------
# Interaction
# ---------------------------------------------------------------------------

func interaction_prompt() -> String:
	var name := ItemDatabase.display_name(item_id)
	if count > 1:
		name += " x%d" % count
	return "Take %s" % name


func can_interact(_player: Node3D) -> bool:
	return not _taken


func interact(player: Node3D) -> void:
	if _taken:
		return
	var game := get_tree().get_first_node_in_group("game") as Game
	if game == null or game.inventory == null:
		return

	var leftover := game.inventory.add(item_id, count)
	if leftover == count:
		EventBus.notification_posted.emit("No room for the %s."
				% ItemDatabase.display_name(item_id))
		AudioDirector.play_2d("ui_deny", -8.0)
		return

	count = leftover
	AudioDirector.play_3d("pickup", global_position, -6.0, randf_range(0.95, 1.1))
	if ItemDatabase.is_document(item_id):
		GameState.collect_document(ItemDatabase.note_id(item_id))
	if count <= 0:
		_taken = true
		queue_free()


## Drop something back into the world, used when the player discards an item.
static func spawn(parent: Node, item_id_to_drop: String, position: Vector3,
		amount: int = 1) -> Pickup:
	var pickup: Pickup = preload("res://scenes/props/pickup.tscn").instantiate()
	pickup.position = position
	parent.add_child(pickup)
	pickup.configure(item_id_to_drop, amount)
	return pickup
