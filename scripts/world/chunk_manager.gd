class_name ChunkManager
extends Node3D
## Streams terrain chunks around the player.
##
## Two constraints shape this:
##
##  * The web build is usually single-threaded, so a chunk cannot be built on a
##    worker. Instead the manager keeps a strict per-frame *budget* — building
##    one chunk costs a few milliseconds, and building nine in one frame is a
##    visible hitch, so nine frames is the correct answer.
##  * Ring index decides detail (see TerrainChunk), so a chunk whose ring
##    changes has to be rebuilt, not just moved. Hysteresis on the unload radius
##    stops a player pacing on a chunk border from thrashing the builder.

const CHUNK_SIZE := TerrainChunk.CHUNK_SIZE
const UNLOAD_MARGIN := 1          ## extra rings kept before discarding
const MAX_BUILDS_PER_FRAME := 1
const MAX_REBUILDS_PER_FRAME := 1

signal streaming_settled()

var generator: WorldGenerator

var _chunks: Dictionary = {}      ## Vector2i -> TerrainChunk
var _rings: Dictionary = {}       ## Vector2i -> int
var _build_queue: Array[Vector2i] = []
var _rebuild_queue: Array[Vector2i] = []
var _centre := Vector2i(999999, 999999)
var _radius := 4
var _tracked: Node3D = null
var _settled := false


func _ready() -> void:
	EventBus.quality_tier_changed.connect(_on_quality_changed)
	EventBus.settings_changed.connect(_on_settings_changed)
	_refresh_radius()


func setup(world_generator: WorldGenerator, tracked_node: Node3D) -> void:
	generator = world_generator
	_tracked = tracked_node


func _process(_delta: float) -> void:
	if generator == null or not generator.is_built():
		return
	if _tracked != null:
		_update_centre(_tracked.global_position)
	_drain_queues()


## Build every chunk the player can currently see, without yielding. Used by the
## loading screen so the world is complete before the fade-in.
func prime(around: Vector3) -> void:
	_update_centre(around)
	while not _build_queue.is_empty():
		_build_next()
	_rebuild_queue.clear()


## Same, but yields between chunks so a progress bar can move.
func prime_async(around: Vector3, on_progress: Callable = Callable()) -> void:
	_update_centre(around)
	var total := maxi(_build_queue.size(), 1)
	while not _build_queue.is_empty():
		_build_next()
		if on_progress.is_valid():
			on_progress.call(1.0 - float(_build_queue.size()) / float(total))
		await get_tree().process_frame
	_rebuild_queue.clear()


func chunk_at(world_position: Vector3) -> TerrainChunk:
	return _chunks.get(_coord_of(world_position))


func loaded_count() -> int:
	return _chunks.size()


func pending_count() -> int:
	return _build_queue.size() + _rebuild_queue.size()


func total_instances() -> int:
	var total := 0
	for chunk: TerrainChunk in _chunks.values():
		total += chunk.instance_count()
	return total


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

func _refresh_radius() -> void:
	var base: int = int(PerformanceDirector.get_budget("stream_radius", 4))
	var multiplier := float(Settings.get_value("view_distance"))
	_radius = clampi(int(round(float(base) * multiplier)), 2, 7)


func _coord_of(world_position: Vector3) -> Vector2i:
	return Vector2i(
		int(floor(world_position.x / CHUNK_SIZE)),
		int(floor(world_position.z / CHUNK_SIZE)))


func _update_centre(world_position: Vector3) -> void:
	var new_centre := _coord_of(world_position)
	if new_centre == _centre:
		return
	_centre = new_centre
	_rescan()


func _rescan() -> void:
	_build_queue.clear()
	_rebuild_queue.clear()

	# Wanted set, nearest first, so the player is never looking at a hole.
	var wanted: Array[Vector2i] = []
	for dz in range(-_radius, _radius + 1):
		for dx in range(-_radius, _radius + 1):
			var coord := _centre + Vector2i(dx, dz)
			if maxi(absi(dx), absi(dz)) > _radius:
				continue
			wanted.append(coord)
	wanted.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		return _ring_of(a) < _ring_of(b))

	for coord in wanted:
		var ring := _ring_of(coord)
		if not _chunks.has(coord):
			_build_queue.append(coord)
		elif int(_rings.get(coord, ring)) != ring:
			_rebuild_queue.append(coord)

	# Drop anything well outside the ring; the margin is the hysteresis.
	for coord: Vector2i in _chunks.keys():
		if _ring_of(coord) > _radius + UNLOAD_MARGIN:
			_unload(coord)
	_settled = _build_queue.is_empty() and _rebuild_queue.is_empty()


func _ring_of(coord: Vector2i) -> int:
	return maxi(absi(coord.x - _centre.x), absi(coord.y - _centre.y))


func _drain_queues() -> void:
	var built := 0
	while built < MAX_BUILDS_PER_FRAME and not _build_queue.is_empty():
		_build_next()
		built += 1
	var rebuilt := 0
	while rebuilt < MAX_REBUILDS_PER_FRAME and not _rebuild_queue.is_empty():
		var coord: Vector2i = _rebuild_queue.pop_front()
		if _chunks.has(coord):
			_unload(coord)
			_load(coord)
		rebuilt += 1
	if not _settled and _build_queue.is_empty() and _rebuild_queue.is_empty():
		_settled = true
		streaming_settled.emit()


func _build_next() -> void:
	var coord: Vector2i = _build_queue.pop_front()
	if not _chunks.has(coord):
		_load(coord)


func _load(coord: Vector2i) -> void:
	var chunk := TerrainChunk.new()
	var ring := _ring_of(coord)
	chunk.configure(generator, coord, ring)
	add_child(chunk)
	chunk.build()
	_chunks[coord] = chunk
	_rings[coord] = ring
	EventBus.chunk_loaded.emit(coord)


func _unload(coord: Vector2i) -> void:
	var chunk: TerrainChunk = _chunks.get(coord)
	if chunk != null:
		# Detach before freeing. `queue_free()` alone leaves the chunk in the
		# tree — still rendering, still colliding — until the end of the frame,
		# and unloads arrive in bursts when the player crosses a chunk border.
		remove_child(chunk)
		chunk.queue_free()
	_chunks.erase(coord)
	_rings.erase(coord)
	EventBus.chunk_unloaded.emit(coord)


## Discard and rebuild everything. Only used when the quality tier changes,
## because tier decides mesh resolution and vegetation density.
func rebuild_all() -> void:
	for coord: Vector2i in _chunks.keys():
		_unload(coord)
	_centre = Vector2i(999999, 999999)
	if _tracked != null:
		_update_centre(_tracked.global_position)


func _on_quality_changed(_tier: int) -> void:
	_refresh_radius()
	rebuild_all()


func _on_settings_changed(key: String, _value: Variant) -> void:
	if key == "view_distance":
		_refresh_radius()
		_rescan()
