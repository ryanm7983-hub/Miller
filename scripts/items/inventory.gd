class_name Inventory
extends Node
## Grid inventory model.
##
## A spatial grid rather than a list: items have a footprint, so a satchel that
## holds a torch, a recorder and a map holds very little else. That is a
## deliberate pressure — every battery you carry is a bandage you did not.
##
## The model knows nothing about the UI. It exposes placement, stacking and
## queries; `InventoryUI` renders it and calls `move_to()` when something is
## dragged. That split is what lets the whole thing be tested headlessly.
##
## Occupancy is tracked in a flat array of slot indices (-1 for empty) so
## collision tests are O(area) rather than O(items).

const COLUMNS := 6
const ROWS := 5

signal changed()
signal item_used(item_id: String)
signal rejected(item_id: String, reason: String)

## Each entry: {"id": String, "count": int, "origin": Vector2i, "size": Vector2i}
var slots: Array[Dictionary] = []

var _occupancy: PackedInt32Array = []


func _ready() -> void:
	_reset_occupancy()


func _reset_occupancy() -> void:
	_occupancy.resize(COLUMNS * ROWS)
	_occupancy.fill(-1)


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

func slot_at(cell: Vector2i) -> int:
	if not _in_bounds(cell):
		return -1
	return _occupancy[cell.y * COLUMNS + cell.x]


func count_of(item_id: String) -> int:
	var total := 0
	for slot in slots:
		if slot["id"] == item_id:
			total += int(slot["count"])
	return total


func has(item_id: String, amount: int = 1) -> bool:
	return count_of(item_id) >= amount


func used_cells() -> int:
	var total := 0
	for slot in slots:
		var size: Vector2i = slot["size"]
		total += size.x * size.y
	return total


func free_cells() -> int:
	return COLUMNS * ROWS - used_cells()


func is_empty() -> bool:
	return slots.is_empty()


func documents() -> Array[String]:
	var out: Array[String] = []
	for slot in slots:
		if ItemDatabase.is_document(slot["id"]):
			out.append(slot["id"])
	return out


# ---------------------------------------------------------------------------
# Adding
# ---------------------------------------------------------------------------

## Add `count` of an item. Returns the number that did not fit, so callers can
## leave the remainder in the world instead of destroying it.
func add(item_id: String, count: int = 1) -> int:
	if not ItemDatabase.exists(item_id):
		Log.warn("inventory", "unknown item '%s'" % item_id)
		return count
	var remaining := count

	# Top up existing stacks first.
	if ItemDatabase.is_stackable(item_id):
		var limit := ItemDatabase.max_stack(item_id)
		for slot in slots:
			if remaining <= 0:
				break
			if slot["id"] != item_id or int(slot["count"]) >= limit:
				continue
			var room: int = limit - int(slot["count"])
			var moved: int = mini(room, remaining)
			slot["count"] = int(slot["count"]) + moved
			remaining -= moved

	# Then open new slots.
	var size := ItemDatabase.size_of(item_id)
	var limit := ItemDatabase.max_stack(item_id)
	while remaining > 0:
		var origin := _find_space(size, -1)
		if origin.x < 0:
			EventBus.inventory_full.emit(item_id)
			rejected.emit(item_id, "full")
			break
		var placed: int = mini(limit, remaining)
		slots.append({"id": item_id, "count": placed, "origin": origin, "size": size})
		_stamp(slots.size() - 1, origin, size)
		remaining -= placed

	var added := count - remaining
	if added > 0:
		EventBus.item_added.emit(item_id, added)
		_notify()
	return remaining


## Place an item at a specific cell. Used by drag-and-drop and by save loading.
func place_at(item_id: String, count: int, origin: Vector2i) -> bool:
	var size := ItemDatabase.size_of(item_id)
	if not _fits(origin, size, -1):
		return false
	slots.append({"id": item_id, "count": count, "origin": origin, "size": size})
	_stamp(slots.size() - 1, origin, size)
	_notify()
	return true


# ---------------------------------------------------------------------------
# Removing and moving
# ---------------------------------------------------------------------------

func remove(item_id: String, count: int = 1) -> int:
	var remaining := count
	# Drain the smallest stacks first so the grid tidies itself as it empties.
	var order: Array[int] = []
	for i in slots.size():
		if slots[i]["id"] == item_id:
			order.append(i)
	order.sort_custom(func(a: int, b: int) -> bool:
		return int(slots[a]["count"]) < int(slots[b]["count"]))

	for index in order:
		if remaining <= 0:
			break
		var slot := slots[index]
		var taken: int = mini(int(slot["count"]), remaining)
		slot["count"] = int(slot["count"]) - taken
		remaining -= taken

	var emptied := false
	for i in range(slots.size() - 1, -1, -1):
		if int(slots[i]["count"]) <= 0:
			slots.remove_at(i)
			emptied = true
	if emptied:
		_rebuild_occupancy()

	var removed := count - remaining
	if removed > 0:
		EventBus.item_removed.emit(item_id, removed)
		_notify()
	return removed


func remove_slot(index: int) -> void:
	if index < 0 or index >= slots.size():
		return
	var slot := slots[index]
	EventBus.item_removed.emit(slot["id"], int(slot["count"]))
	slots.remove_at(index)
	_rebuild_occupancy()
	_notify()


## Move a slot to a new origin. Returns false (and changes nothing) if it does
## not fit, so a failed drag snaps back rather than deleting the item.
func move_to(index: int, origin: Vector2i) -> bool:
	if index < 0 or index >= slots.size():
		return false
	var slot := slots[index]
	var size: Vector2i = slot["size"]
	if not _fits(origin, size, index):
		return false
	slot["origin"] = origin
	_rebuild_occupancy()
	_notify()
	return true


## Merge one stack into another. Returns true if anything moved.
func merge(from_index: int, to_index: int) -> bool:
	if from_index == to_index:
		return false
	if from_index < 0 or to_index < 0 or from_index >= slots.size() or to_index >= slots.size():
		return false
	var from := slots[from_index]
	var to := slots[to_index]
	if from["id"] != to["id"] or not ItemDatabase.is_stackable(from["id"]):
		return false
	var limit := ItemDatabase.max_stack(from["id"])
	var room: int = limit - int(to["count"])
	if room <= 0:
		return false
	var moved: int = mini(room, int(from["count"]))
	to["count"] = int(to["count"]) + moved
	from["count"] = int(from["count"]) - moved
	if int(from["count"]) <= 0:
		slots.remove_at(from_index)
		_rebuild_occupancy()
	_notify()
	return true


# ---------------------------------------------------------------------------
# Using
# ---------------------------------------------------------------------------

## Apply an item's effect to the player. Consumables are spent; everything else
## reports the attempt so callers can open a note or refuse.
func use(index: int, stats: SurvivalStats) -> bool:
	if index < 0 or index >= slots.size():
		return false
	var item_id: String = slots[index]["id"]
	var effect := ItemDatabase.use_effect(item_id)
	if effect == "":
		return false

	match effect:
		"heal":
			if stats.health >= SurvivalStats.MAX_HEALTH:
				rejected.emit(item_id, "not_needed")
				return false
			stats.heal(ItemDatabase.use_value(item_id))
		"battery":
			if stats.battery >= SurvivalStats.MAX_BATTERY - 0.5:
				rejected.emit(item_id, "not_needed")
				return false
			stats.add_battery(ItemDatabase.use_value(item_id))
		"sanity":
			stats.restore_sanity(ItemDatabase.use_value(item_id))
		"stamina":
			stats.stamina = minf(SurvivalStats.MAX_STAMINA,
					stats.stamina + ItemDatabase.use_value(item_id))
			EventBus.player_stamina_changed.emit(stats.stamina, SurvivalStats.MAX_STAMINA)
		_:
			return false

	_consume_one(index)
	item_used.emit(item_id)
	EventBus.item_used.emit(item_id)
	AudioDirector.play_2d("ui_confirm", -8.0)
	return true


func _consume_one(index: int) -> void:
	var slot := slots[index]
	slot["count"] = int(slot["count"]) - 1
	if int(slot["count"]) <= 0:
		slots.remove_at(index)
		_rebuild_occupancy()
	_notify()


# ---------------------------------------------------------------------------
# Placement helpers
# ---------------------------------------------------------------------------

func _in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < COLUMNS and cell.y < ROWS


## `ignore_index` lets a slot be tested against a new position without colliding
## with itself.
func _fits(origin: Vector2i, size: Vector2i, ignore_index: int) -> bool:
	if origin.x < 0 or origin.y < 0:
		return false
	if origin.x + size.x > COLUMNS or origin.y + size.y > ROWS:
		return false
	for y in size.y:
		for x in size.x:
			var occupant := _occupancy[(origin.y + y) * COLUMNS + origin.x + x]
			if occupant != -1 and occupant != ignore_index:
				return false
	return true


func _find_space(size: Vector2i, ignore_index: int) -> Vector2i:
	for y in ROWS - size.y + 1:
		for x in COLUMNS - size.x + 1:
			var origin := Vector2i(x, y)
			if _fits(origin, size, ignore_index):
				return origin
	return Vector2i(-1, -1)


func _stamp(index: int, origin: Vector2i, size: Vector2i) -> void:
	for y in size.y:
		for x in size.x:
			_occupancy[(origin.y + y) * COLUMNS + origin.x + x] = index


func _rebuild_occupancy() -> void:
	_reset_occupancy()
	for i in slots.size():
		_stamp(i, slots[i]["origin"], slots[i]["size"])


func _notify() -> void:
	changed.emit()
	EventBus.inventory_changed.emit()


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

func serialize() -> Dictionary:
	var entries: Array = []
	for slot in slots:
		entries.append({
			"id": slot["id"],
			"count": int(slot["count"]),
			"x": int(slot["origin"].x),
			"y": int(slot["origin"].y),
		})
	return {"columns": COLUMNS, "rows": ROWS, "slots": entries}


func deserialize(payload: Dictionary) -> void:
	slots.clear()
	_reset_occupancy()
	for entry: Dictionary in payload.get("slots", []):
		var item_id := String(entry.get("id", ""))
		if not ItemDatabase.exists(item_id):
			# An item removed from the database in a later build should not stop
			# the save from loading.
			Log.warn("inventory", "dropping unknown saved item '%s'" % item_id)
			continue
		var origin := Vector2i(int(entry.get("x", 0)), int(entry.get("y", 0)))
		var count := maxi(1, int(entry.get("count", 1)))
		if not place_at(item_id, count, origin):
			# The grid may have been resized between builds; fall back to
			# anywhere it fits rather than losing the item.
			add(item_id, count)
	_notify()
