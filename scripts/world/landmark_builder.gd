class_name LandmarkBuilder
extends Node3D
## Builds the basin's fourteen landmarks.
##
## Landmarks are the only hand-designed geometry in the game. Everything else is
## generated because variety is what a forest needs; a ranger station needs the
## opposite — it has to be recognisable, memorable, and the same shape every
## time, because the player navigates by it.
##
## They are still *assembled* rather than modelled: each is a short recipe over
## `MeshFactory` parts, so they cost nothing to download and adapt to whatever
## height the terrain settled at.
##
## Landmarks are built once, when the world is created, and never streamed. All
## fourteen together are a few thousand triangles.

const INTERACT_LAYER := 32
const HIDE_LAYER := 256

var _generator: WorldGenerator
var _world: WorldRoot
var _rng := RandomNumberGenerator.new()
var _posts: Array[Node3D] = []


func build(world: WorldRoot) -> void:
	_world = world
	_generator = world.generator
	_rng.seed = _generator.seed_value + 3131

	for entry: Dictionary in _generator.pois():
		_build_one(entry)
	_place_listening_posts()
	Log.info("landmarks", "built %d landmarks and %d listening posts"
			% [_generator.pois().size(), _posts.size()])


func _build_one(entry: Dictionary) -> void:
	var origin: Vector3 = entry["position"]
	origin.y = _generator.height_at(origin.x, origin.z)

	var root := Node3D.new()
	root.name = String(entry["id"])
	root.position = origin
	root.rotation.y = float(entry["yaw"])
	add_child(root)

	# Every landmark announces itself once, so the player builds a mental map.
	var discovery := Area3D.new()
	discovery.collision_layer = 0
	discovery.collision_mask = 4  # player
	var discovery_shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = float(entry["clearing"]) + 6.0
	discovery_shape.shape = sphere
	discovery.add_child(discovery_shape)
	discovery.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			GameState.discover_poi(String(entry["id"]), String(entry["name"])))
	root.add_child(discovery)

	match String(entry["type"]):
		"trailhead": _build_trailhead(root)
		"station": _build_station(root)
		"tower": _build_tower(root)
		"cabin": _build_cabin(root)
		"camp": _build_camp(root)
		"mine": _build_mine(root)
		"bunker": _build_bunker(root)
		"cemetery": _build_cemetery(root)
		"ritual": _build_ritual(root)
		"relay": _build_relay(root)
		"shack": _build_shack(root)
		"cave": _build_cave(root)
		"waterfall": _build_waterfall(root)


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

func _mesh(parent: Node3D, key: String, position: Vector3, material_key: String = "",
		scale: Vector3 = Vector3.ONE, yaw: float = 0.0) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = AssetFoundry.mesh(key)
	if material_key != "":
		instance.material_override = AssetFoundry.material(material_key)
	instance.position = position
	instance.scale = scale
	instance.rotation.y = yaw
	parent.add_child(instance)
	return instance


## A hollow structure with collision, from the room-shell builder.
func _structure(parent: Node3D, size: Vector3, position: Vector3, material_key: String,
		openings: Array, roof_pitch: float = 0.0) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.collision_layer = 2
	body.collision_mask = 0
	body.position = position
	parent.add_child(body)

	var shell := MeshFactory.room_shell(size, 0.22, openings)
	shell.surface_set_material(0, AssetFoundry.material(material_key))
	var walls := MeshInstance3D.new()
	walls.mesh = shell
	walls.position = Vector3(0, size.y * 0.5, 0)
	body.add_child(walls)

	var collider := CollisionShape3D.new()
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(shell.get_faces())
	collider.shape = shape
	collider.position = Vector3(0, size.y * 0.5, 0)
	body.add_child(collider)

	if roof_pitch > 0.0:
		var roof := MeshFactory.gable_roof(size, roof_pitch, 0.5)
		roof.surface_set_material(0, AssetFoundry.material("rot_planks"))
		var roof_instance := MeshInstance3D.new()
		roof_instance.mesh = roof
		body.add_child(roof_instance)

	# Interiors are shelter: sanity recovers and the audio goes close and dry.
	_add_shelter_volume(body, size)
	return body


func _add_shelter_volume(parent: Node3D, size: Vector3) -> void:
	var area := Area3D.new()
	area.collision_layer = HIDE_LAYER
	area.collision_mask = 4
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(size.x * 0.85, size.y, size.z * 0.85)
	shape.shape = box
	shape.position = Vector3(0, size.y * 0.5, 0)
	area.add_child(shape)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body is Player:
			body.register_hide_volume(true))
	area.body_exited.connect(func(body: Node3D) -> void:
		if body is Player:
			body.register_hide_volume(false))
	parent.add_child(area)


## A document lying where somebody left it.
func _document(parent: Node3D, item_id: String, position: Vector3) -> void:
	var pickup := preload("res://scenes/props/pickup.tscn").instantiate()
	pickup.position = position
	parent.add_child(pickup)
	pickup.configure(item_id, 1)


func _supplies(parent: Node3D, position: Vector3, count: int) -> void:
	for i in count:
		var offset := Vector3(_rng.randf_range(-1.4, 1.4), 0.0, _rng.randf_range(-1.4, 1.4))
		var pool: Array[String] = ["battery_cell", "battery_cell", "gauze", "tincture", "coffee"]
		var pickup := preload("res://scenes/props/pickup.tscn").instantiate()
		pickup.position = position + offset
		parent.add_child(pickup)
		pickup.configure(pool[_rng.randi() % pool.size()], 1)


func _clutter(parent: Node3D, radius: float, count: int) -> void:
	for i in count:
		var angle := _rng.randf() * TAU
		var distance := _rng.randf_range(1.0, radius)
		var position := Vector3(cos(angle) * distance, 0.0, sin(angle) * distance)
		var key: String = ["crate", "barrel", "log_0", "stump_1"][_rng.randi() % 4]
		_mesh(parent, key, position, "", Vector3.ONE * _rng.randf_range(0.8, 1.3),
				_rng.randf() * TAU)


# ---------------------------------------------------------------------------
# The landmarks
# ---------------------------------------------------------------------------

func _build_trailhead(root: Node3D) -> void:
	_mesh(root, "sign", Vector3(0, 0, 0), "planks")
	# Walking out is available from the first minute and is never signposted as
	# an ending. Refusing to participate has to be a real option.
	_ending_site(root, Vector3(0, 0, 5.0), "walk_out",
			"Walk back up the fire road", "Walk back up the fire road", false)
	for i in 4:
		_mesh(root, "fence", Vector3(-4.0 + float(i) * 2.4, 0, 3.0), "rot_planks")
	_mesh(root, "barrel", Vector3(2.2, 0, -1.4), "rust")
	_document(root, "note_arrival", Vector3(0.4, 0.4, 1.2))


func _build_station(root: Node3D) -> void:
	# The largest interior in the game, and the first shelter the player finds.
	var size := Vector3(9.0, 3.0, 7.0)
	var body := _structure(root, size, Vector3.ZERO, "planks", [
		{"side": "n", "x": 0.0, "w": 1.2, "y0": 0.0, "y1": 2.1},
		{"side": "e", "x": 1.5, "w": 1.4, "y0": 1.0, "y1": 2.0},
		{"side": "w", "x": -1.5, "w": 1.4, "y0": 1.0, "y1": 2.0},
	], 1.6)
	_mesh(root, "door", Vector3(-0.6, 0, -size.z * 0.5), "planks")
	_mesh(root, "antenna", Vector3(4.6, 0, 2.8), "metal")
	_clutter(root, 8.0, 5)
	_supplies(root, Vector3(1.5, 0.4, 1.5), 4)
	_document(body, "note_rill_1", Vector3(2.0, 0.5, -1.0))
	_document(body, "note_marsh_1", Vector3(-2.4, 0.5, 1.4))


func _build_tower(root: Node3D) -> void:
	var height := 11.0
	var tower := MeshFactory.lattice_tower(height, 4.4, 2.6, 0.16, 7)
	tower.surface_set_material(0, AssetFoundry.material("rot_planks"))
	var instance := MeshInstance3D.new()
	instance.mesh = tower
	root.add_child(instance)

	var body := StaticBody3D.new()
	body.collision_layer = 2
	var collider := CollisionShape3D.new()
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(tower.get_faces())
	collider.shape = shape
	body.add_child(collider)
	root.add_child(body)

	# The cab on top: the best view in the basin, and the worst place to be
	# caught, because there is one way down.
	var cab := _structure(root, Vector3(3.4, 2.4, 3.4), Vector3(0, height, 0), "planks", [
		{"side": "n", "x": 0.0, "w": 1.0, "y0": 0.0, "y1": 2.0},
		{"side": "s", "x": 0.0, "w": 2.4, "y0": 0.9, "y1": 1.9},
		{"side": "e", "x": 0.0, "w": 2.4, "y0": 0.9, "y1": 1.9},
		{"side": "w", "x": 0.0, "w": 2.4, "y0": 0.9, "y1": 1.9},
	], 0.8)
	_document(cab, "note_tower", Vector3(0.8, 0.4, 0.8))
	_supplies(cab, Vector3(-0.8, 0.4, -0.6), 2)


func _build_cabin(root: Node3D) -> void:
	var size := Vector3(6.0, 2.7, 5.0)
	var body := _structure(root, size, Vector3.ZERO, "rot_planks", [
		{"side": "n", "x": 0.4, "w": 1.1, "y0": 0.0, "y1": 2.0},
		{"side": "w", "x": 0.0, "w": 1.2, "y0": 1.0, "y1": 1.9},
	], 1.4)
	_mesh(root, "door", Vector3(-0.2, 0, -size.z * 0.5), "rot_planks",
			Vector3.ONE, deg_to_rad(_rng.randf_range(-70.0, -20.0)))
	_clutter(root, 6.0, 4)
	_supplies(body, Vector3(1.2, 0.4, 0.8), 2)
	if _rng.randf() < 0.5:
		_document(body, "note_rill_2", Vector3(-1.4, 0.4, 1.2))


func _build_camp(root: Node3D) -> void:
	# No structure: a ring of stones, a lean-to, and things left behind.
	for i in 8:
		var angle := TAU * float(i) / 8.0
		_mesh(root, "rock_0", Vector3(cos(angle) * 1.2, 0, sin(angle) * 1.2), "stone",
				Vector3.ONE * 0.35)
	for i in 3:
		_mesh(root, "log_%d" % i, Vector3(_rng.randf_range(-4, 4), 0, _rng.randf_range(-4, 4)),
				"dead_bark", Vector3.ONE, _rng.randf() * TAU)
	_mesh(root, "crate", Vector3(2.4, 0, -1.8), "planks")
	_supplies(root, Vector3(2.4, 0.5, -1.8), 3)
	_document(root, "note_camp", Vector3(-1.8, 0.3, 2.2))


func _build_mine(root: Node3D) -> void:
	# An adit driven into a hillside: a framed mouth and a tunnel that goes dark.
	_structure(root, Vector3(3.2, 2.4, 9.0), Vector3(0, 0, -4.0), "rot_planks", [
		{"side": "n", "x": 0.0, "w": 2.0, "y0": 0.0, "y1": 2.1},
	])
	for i in 4:
		_mesh(root, "fence", Vector3(0, 0, -1.0 - float(i) * 2.2), "rot_planks",
				Vector3(1.3, 1.9, 1.0))
	_mesh(root, "sign", Vector3(2.6, 0, 1.4), "rot_planks")
	_mesh(root, "barrel", Vector3(-2.2, 0, 0.8), "rust")
	_document(root, "note_mine", Vector3(0.6, 0.4, -6.0))
	_supplies(root, Vector3(-0.8, 0.4, -7.0), 3)
	# Rill got nine of eleven posts down and could not find the last two. The
	# resin store is where the basin keeps what it has taken.
	_ending_site(root, Vector3(0.0, 0.0, -8.2), "silence",
			"The store is sealed and you have nothing to burn it with",
			"Burn the resin store and take the network down")


func _build_bunker(root: Node3D) -> void:
	var body := _structure(root, Vector3(5.0, 2.4, 5.0), Vector3(0, -0.8, 0), "concrete", [
		{"side": "n", "x": 0.0, "w": 1.1, "y0": 0.0, "y1": 2.0},
	])
	_mesh(root, "antenna", Vector3(2.4, 0, 2.0), "metal")
	_mesh(root, "listening_post", Vector3(-2.6, 0, -1.6), "rust")
	_document(body, "note_bunker", Vector3(1.2, -0.4, 1.0))
	_supplies(body, Vector3(-1.2, -0.4, -1.0), 3)


func _build_cemetery(root: Node3D) -> void:
	# Eleven stones in two uneven rows, and a twelfth that is newer and blank.
	for i in 11:
		var row := i / 6
		var column := i % 6
		var position := Vector3(-4.0 + float(column) * 1.7 + _rng.randf_range(-0.2, 0.2),
				0.0, -1.6 + float(row) * 3.2 + _rng.randf_range(-0.3, 0.3))
		var stone := _mesh(root, "gravestone_%d" % (i % 3), position, "marker",
				Vector3.ONE, _rng.randf_range(-0.25, 0.25))
		stone.rotation.z = _rng.randf_range(-0.12, 0.12)
	_mesh(root, "gravestone_0", Vector3(6.0, 0, 1.6), "concrete", Vector3.ONE * 1.15)
	for i in 6:
		_mesh(root, "fence", Vector3(-6.0 + float(i) * 2.4, 0, -5.2), "rot_planks")
	_document(root, "note_cemetery", Vector3(6.4, 0.3, 2.6))


func _build_ritual(root: Node3D) -> void:
	# A ring of standing timber. Nothing supernatural in the geometry — the
	# horror is that eleven ordinary men built it on purpose.
	var count := 11
	for i in count:
		var angle := TAU * float(i) / float(count)
		var position := Vector3(cos(angle) * 6.0, 0, sin(angle) * 6.0)
		var post := _mesh(root, "dead_tree_0", position, "dead_bark",
				Vector3(0.4, 0.32, 0.4), angle)
		post.rotation.x = _rng.randf_range(-0.06, 0.06)
	_mesh(root, "listening_post", Vector3.ZERO, "rust")
	_document(root, "note_ritual", Vector3(1.4, 0.3, 0.6))
	_ending_site(root, Vector3(0, 0, 2.2), "answer",
			"There is nothing here to answer yet",
			"Say your own name into the ring")


func _build_relay(root: Node3D) -> void:
	var body := _structure(root, Vector3(4.0, 2.5, 4.0), Vector3.ZERO, "concrete", [
		{"side": "n", "x": 0.0, "w": 1.1, "y0": 0.0, "y1": 2.0},
	])
	_mesh(root, "antenna", Vector3(0, 0, 3.4), "metal", Vector3(1.4, 1.6, 1.4))
	_mesh(root, "listening_post", Vector3(-2.4, 0, 1.4), "rust")
	_document(body, "note_marsh_2", Vector3(1.0, 0.4, 0.9))
	_ending_site(root, Vector3(1.2, 0, 3.4), "transmit",
			"The relay is dead and the network is barely awake",
			"Bring the relay up and let the basin be heard")


func _build_shack(root: Node3D) -> void:
	var body := _structure(root, Vector3(3.4, 2.2, 3.0), Vector3.ZERO, "rot_planks", [
		{"side": "n", "x": 0.0, "w": 1.0, "y0": 0.0, "y1": 1.9},
	], 1.0)
	_clutter(root, 4.0, 3)
	_supplies(body, Vector3(0.6, 0.4, 0.6), 2)
	_document(body, "note_rill_3", Vector3(-0.8, 0.4, -0.6))


func _build_cave(root: Node3D) -> void:
	for i in 7:
		var angle := TAU * float(i) / 7.0
		_mesh(root, "rock_%d" % (i % AssetFoundry.ROCK_VARIANTS),
				Vector3(cos(angle) * 3.4, 0, sin(angle) * 3.4), "cliff",
				Vector3.ONE * _rng.randf_range(1.4, 2.6), _rng.randf() * TAU)
	_structure(root, Vector3(3.0, 2.2, 7.0), Vector3(0, -0.4, -3.5), "cliff", [
		{"side": "n", "x": 0.0, "w": 1.8, "y0": 0.0, "y1": 2.0},
	])
	_mesh(root, "listening_post", Vector3(1.8, 0, 1.2), "rust")
	_supplies(root, Vector3(0.0, 0.2, -5.0), 2)


func _build_waterfall(root: Node3D) -> void:
	for i in 5:
		_mesh(root, "rock_%d" % (i % AssetFoundry.ROCK_VARIANTS),
				Vector3(_rng.randf_range(-4, 4), 0, _rng.randf_range(-4, 4)), "cliff",
				Vector3.ONE * _rng.randf_range(1.2, 2.2), _rng.randf() * TAU)
	_mesh(root, "listening_post", Vector3(2.0, 0, -2.0), "rust")


# ---------------------------------------------------------------------------
# The listening network
# ---------------------------------------------------------------------------

## Eleven posts, matching the eleven graves and the eleven men of the night
## shift. Nine sit at landmarks; the remaining two are out in the trees, which
## is the point — Rill could not find the last two either.
func _place_listening_posts() -> void:
	var hosts := ["ranger_station", "fire_tower", "cabin_hollow", "cabin_ridge",
		"hunting_camp", "mine", "bunker", "cemetery", "swamp_shack"]
	var index := 0
	for host_id in hosts:
		var entry := _generator.poi(host_id)
		if entry.is_empty():
			continue
		var origin: Vector3 = entry["position"]
		var angle := _rng.randf() * TAU
		var distance := float(entry["clearing"]) * 0.7
		var x := origin.x + cos(angle) * distance
		var z := origin.z + sin(angle) * distance
		_spawn_post(index, Vector3(x, _generator.height_at(x, z), z))
		index += 1

	for i in 2:
		var angle := _rng.randf() * TAU
		var radius := _rng.randf_range(120.0, 300.0)
		var x := cos(angle) * radius
		var z := sin(angle) * radius
		if not _generator.is_in_bounds(x, z):
			continue
		_spawn_post(index, Vector3(x, _generator.height_at(x, z), z))
		index += 1


func _spawn_post(index: int, position: Vector3) -> void:
	var post := preload("res://scenes/props/listening_post.tscn").instantiate()
	post.position = position
	add_child(post)
	post.configure("post_%02d" % index, index)
	_posts.append(post)


## Attach one of the four places a run can be ended.
func _ending_site(parent: Node3D, position: Vector3, ending_id: String,
		locked: String, ready_text: String, gated: bool = true) -> void:
	var site := preload("res://scenes/props/ending_site.tscn").instantiate()
	site.position = position
	parent.add_child(site)
	site.configure(ending_id, locked, ready_text, gated)


func posts() -> Array[Node3D]:
	return _posts
