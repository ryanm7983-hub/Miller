extends TestCase
## Covers the grid inventory model and the item/document data.
##
## The inventory is where a save-corrupting bug would be least visible and most
## damaging: a failed placement that loses an essential item silently strands a
## run, and the player has no way to tell it happened.

var _inventory: Inventory
var _stats: SurvivalStats


func before_each() -> void:
	_inventory = Inventory.new()
	tree.root.add_child(_inventory)
	_stats = SurvivalStats.new()
	tree.root.add_child(_stats)


func after_each() -> void:
	for node in [_inventory, _stats]:
		if is_instance_valid(node):
			node.free()


# ---------------------------------------------------------------------------
# Data integrity
# ---------------------------------------------------------------------------

func test_every_item_is_well_formed() -> void:
	for item_id in ItemDatabase.all_ids():
		assert_true(ItemDatabase.display_name(item_id) != item_id,
				"item '%s' has no display name" % item_id)
		assert_true(ItemDatabase.description(item_id).length() > 10,
				"item '%s' has no description" % item_id)
		var size := ItemDatabase.size_of(item_id)
		assert_between(size.x, 1, Inventory.COLUMNS, "item '%s' width" % item_id)
		assert_between(size.y, 1, Inventory.ROWS, "item '%s' height" % item_id)
		assert_true(ItemDatabase.max_stack(item_id) >= 1, "item '%s' stack size" % item_id)


func test_documents_resolve_to_real_entries() -> void:
	for item_id in ItemDatabase.all_ids():
		if not ItemDatabase.is_document(item_id):
			continue
		var note := ItemDatabase.note_id(item_id)
		assert_true(DocumentLibrary.exists(note),
				"item '%s' points at missing document '%s'" % [item_id, note])


func test_documents_have_content() -> void:
	for document_id in DocumentLibrary.all_ids():
		var entry := DocumentLibrary.get_entry(document_id)
		assert_true(String(entry["title"]).length() > 2, "document '%s' has no title" % document_id)
		assert_true(String(entry["body"]).length() > 40, "document '%s' is empty" % document_id)


func test_every_item_has_an_inspection_mesh() -> void:
	AssetFoundry.warm_up_blocking()
	for item_id in ItemDatabase.all_ids():
		assert_not_null(AssetFoundry.item_mesh(item_id),
				"item '%s' has no inspection mesh" % item_id)


func test_usable_items_declare_a_known_effect() -> void:
	var known := ["heal", "battery", "sanity", "stamina"]
	for item_id in ItemDatabase.all_ids():
		var effect := ItemDatabase.use_effect(item_id)
		if effect == "":
			continue
		assert_true(known.has(effect), "item '%s' has unknown effect '%s'" % [item_id, effect])
		assert_true(ItemDatabase.use_value(item_id) > 0.0,
				"item '%s' has an effect but no magnitude" % item_id)


# ---------------------------------------------------------------------------
# Placement
# ---------------------------------------------------------------------------

func test_adding_places_items_and_reports_overflow() -> void:
	assert_eq(_inventory.add("battery_cell", 3), 0, "a small add should not overflow")
	assert_eq(_inventory.count_of("battery_cell"), 3)
	assert_eq(_inventory.slots.size(), 1, "stackable items should share a slot")


func test_stacks_respect_their_limit() -> void:
	var limit := ItemDatabase.max_stack("battery_cell")
	_inventory.add("battery_cell", limit + 2)
	assert_eq(_inventory.count_of("battery_cell"), limit + 2)
	assert_eq(_inventory.slots.size(), 2, "overflow should open a second stack")
	assert_eq(int(_inventory.slots[0]["count"]), limit)


func test_large_items_consume_their_footprint() -> void:
	_inventory.add("recorder", 1)   # 2x2
	assert_eq(_inventory.used_cells(), 4)
	assert_eq(_inventory.free_cells(), Inventory.COLUMNS * Inventory.ROWS - 4)


func test_grid_fills_up_and_refuses_gracefully() -> void:
	# Fill with 2x2 items until nothing more fits.
	var placed := 0
	while _inventory.add("recorder", 1) == 0 and placed < 40:
		placed += 1
	assert_true(placed > 0, "nothing fitted at all")
	assert_true(_inventory.used_cells() <= Inventory.COLUMNS * Inventory.ROWS,
			"inventory overflowed its own grid")
	# A refused add must not corrupt anything.
	var before := _inventory.slots.size()
	assert_true(_inventory.add("recorder", 1) > 0, "a full inventory should report overflow")
	assert_eq(_inventory.slots.size(), before, "a refused add changed the grid")


func test_items_never_overlap() -> void:
	for i in 6:
		_inventory.add("gauze", 1)
	_inventory.add("recorder", 1)
	_inventory.add("crank", 1)
	var seen := {}
	for slot in _inventory.slots:
		var origin: Vector2i = slot["origin"]
		var size: Vector2i = slot["size"]
		for y in size.y:
			for x in size.x:
				var cell := origin + Vector2i(x, y)
				assert_false(seen.has(cell), "two items occupy cell %v" % cell)
				seen[cell] = true
				assert_true(cell.x < Inventory.COLUMNS and cell.y < Inventory.ROWS,
						"item extends outside the grid at %v" % cell)


func test_moving_into_a_free_space_succeeds_and_into_a_wall_fails() -> void:
	_inventory.add("recorder", 1)
	assert_true(_inventory.move_to(0, Vector2i(3, 2)), "a legal move was refused")
	assert_eq(_inventory.slots[0]["origin"], Vector2i(3, 2))
	# 2x2 item at the far corner would hang off the edge.
	assert_false(_inventory.move_to(0, Vector2i(Inventory.COLUMNS - 1, 0)),
			"an out-of-bounds move was allowed")
	assert_eq(_inventory.slots[0]["origin"], Vector2i(3, 2), "a refused move still moved the item")


func test_moving_onto_another_item_fails() -> void:
	_inventory.add("recorder", 1)
	_inventory.add("crank", 1)
	var target: Vector2i = _inventory.slots[0]["origin"]
	assert_false(_inventory.move_to(1, target), "an overlapping move was allowed")


func test_merging_stacks() -> void:
	_inventory.add("battery_cell", 2)
	_inventory.place_at("battery_cell", 2, Vector2i(4, 4))
	assert_eq(_inventory.slots.size(), 2)
	assert_true(_inventory.merge(1, 0), "merge refused for identical stackables")
	assert_eq(_inventory.slots.size(), 1, "merged stack was not collapsed")
	assert_eq(_inventory.count_of("battery_cell"), 4)


func test_merging_different_items_is_refused() -> void:
	_inventory.add("battery_cell", 1)
	_inventory.add("gauze", 1)
	assert_false(_inventory.merge(1, 0), "unrelated items were merged")
	assert_eq(_inventory.slots.size(), 2)


# ---------------------------------------------------------------------------
# Removal and use
# ---------------------------------------------------------------------------

func test_removing_frees_the_grid() -> void:
	_inventory.add("recorder", 1)
	assert_eq(_inventory.used_cells(), 4)
	_inventory.remove("recorder", 1)
	assert_eq(_inventory.used_cells(), 0)
	assert_true(_inventory.is_empty())


func test_partial_removal_drains_smallest_stacks_first() -> void:
	_inventory.place_at("battery_cell", 4, Vector2i(0, 0))
	_inventory.place_at("battery_cell", 1, Vector2i(1, 0))
	_inventory.remove("battery_cell", 1)
	assert_eq(_inventory.count_of("battery_cell"), 4)
	assert_eq(_inventory.slots.size(), 1, "the emptied stack should have been dropped")


func test_using_a_battery_charges_the_torch_and_is_consumed() -> void:
	_stats.consume_battery(60.0)
	_inventory.add("battery_cell", 2)
	assert_true(_inventory.use(0, _stats), "battery was not usable")
	assert_true(_stats.battery > 40.0, "battery did not charge (%.1f)" % _stats.battery)
	assert_eq(_inventory.count_of("battery_cell"), 1, "battery was not consumed")


func test_using_a_dressing_at_full_health_is_refused() -> void:
	_inventory.add("gauze", 1)
	assert_false(_inventory.use(0, _stats), "a dressing was wasted at full health")
	assert_eq(_inventory.count_of("gauze"), 1, "the refused item was consumed anyway")


func test_non_usable_items_do_nothing() -> void:
	_inventory.add("key_station", 1)
	assert_false(_inventory.use(0, _stats))
	assert_eq(_inventory.count_of("key_station"), 1)


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

func test_inventory_round_trips_through_a_save() -> void:
	_inventory.add("recorder", 1)
	_inventory.add("battery_cell", 3)
	_inventory.add("key_mine", 1)
	_inventory.move_to(0, Vector2i(2, 2))
	var payload := _inventory.serialize()

	var restored := Inventory.new()
	tree.root.add_child(restored)
	restored.deserialize(payload)
	assert_eq(restored.slots.size(), _inventory.slots.size(), "slot count changed")
	assert_eq(restored.count_of("battery_cell"), 3)
	assert_eq(restored.count_of("recorder"), 1)
	for i in _inventory.slots.size():
		assert_eq(restored.slots[i]["origin"], _inventory.slots[i]["origin"],
				"item %d moved across the save" % i)
	restored.free()


func test_unknown_saved_items_are_dropped_not_fatal() -> void:
	var payload := {"slots": [
		{"id": "battery_cell", "count": 2, "x": 0, "y": 0},
		{"id": "an_item_from_a_future_build", "count": 1, "x": 2, "y": 0},
	]}
	_inventory.deserialize(payload)
	assert_eq(_inventory.count_of("battery_cell"), 2, "the valid item was lost")
	assert_eq(_inventory.slots.size(), 1, "the unknown item was kept")


func test_essential_items_are_marked() -> void:
	# The UI refuses to drop these; if the flag is lost a run can be stranded.
	for item_id in ["recorder", "flashlight", "key_station", "crank", "tape_a"]:
		assert_true(ItemDatabase.is_essential(item_id),
				"'%s' should be marked essential" % item_id)
	assert_false(ItemDatabase.is_essential("battery_cell"))
