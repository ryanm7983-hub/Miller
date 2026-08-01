extends TestCase
## Every interactive control must actually be clickable.
##
## This suite exists because of two real bugs that shipped into a browser build
## and were only caught by driving it with a real browser:
##
##   * The title card's root `Control` used the default mouse filter, so it
##     consumed the tap that was supposed to start the game. On desktop a key
##     press still worked, which hid the problem — on a phone there is no key.
##   * The main menu added a full-rect `CenterContainer` *after* the button
##     column. It rendered nothing and blocked every click.
##
## Both are invisible in code review and invisible in a screenshot. What they
## have in common is that a control that covers another control swallows its
## input, so the test reproduces Godot's own hit-testing: for every Button in a
## screen, work out what a click at its centre would actually land on.

const SCREEN_SIZE := Vector2(1280, 720)


func before_all() -> void:
	AssetFoundry.warm_up_blocking()
	AudioDirector.warm_up_blocking()
	GameState.new_game(0, 4242)


# ---------------------------------------------------------------------------
# The screens
# ---------------------------------------------------------------------------

func test_title_card_accepts_a_tap() -> void:
	var scene: PackedScene = load("res://scenes/main/bootstrap.tscn")
	var root := scene.instantiate() as Control
	tree.root.add_child(root)
	await _settle(root)
	# The bootstrap has no buttons; it listens for raw input, so what matters is
	# that nothing in it claims mouse events.
	var blockers := _controls_claiming_mouse(root)
	assert_true(blockers.is_empty(),
			"the title card blocks input at: %s" % ", ".join(blockers))
	root.free()


func test_main_menu_buttons_are_reachable() -> void:
	# Force the lowest tier so the menu skips building its live 3D background;
	# this test is about hit testing, not about generating a world.
	var previous := PerformanceDirector.current_tier
	PerformanceDirector.current_tier = PerformanceDirector.Tier.POTATO

	var scene: PackedScene = load("res://scenes/main/main_menu.tscn")
	var menu := scene.instantiate() as Control
	tree.root.add_child(menu)
	await _settle(menu)
	_assert_buttons_reachable(menu, "main menu")
	menu.free()

	PerformanceDirector.current_tier = previous


func test_pause_menu_buttons_are_reachable() -> void:
	var menu := PauseMenu.new()
	tree.root.add_child(menu)
	menu.set_open(true)
	await _settle(menu)
	_assert_buttons_reachable(menu, "pause menu")
	menu.free()


func test_settings_controls_are_reachable() -> void:
	var panel := SettingsPanel.new()
	tree.root.add_child(panel)
	await _settle(panel)
	_assert_buttons_reachable(panel, "settings")
	panel.free()


func test_inventory_grid_takes_input() -> void:
	var ui := InventoryUI.new()
	tree.root.add_child(ui)
	var inventory := Inventory.new()
	var stats := SurvivalStats.new()
	tree.root.add_child(inventory)
	tree.root.add_child(stats)
	ui.bind(inventory, stats)
	inventory.add("recorder", 1)
	ui.open()
	await _settle(ui)

	# The grid is drawn, not built from nodes, so it has to claim mouse input
	# itself or drag-and-drop silently does nothing.
	var grid := _find_grid_panel(ui)
	assert_not_null(grid, "inventory has no grid panel")
	if grid != null:
		assert_ne(grid.mouse_filter, Control.MOUSE_FILTER_IGNORE,
				"the inventory grid ignores mouse input")
		assert_true(grid.gui_input.get_connections().size() > 0,
				"the inventory grid has no input handler connected")
		var centre := grid.global_position + grid.size * 0.5
		var hit := _control_at(ui, centre)
		assert_true(hit == grid or grid.is_ancestor_of(hit),
				"a click in the middle of the inventory grid lands on '%s'"
				% (hit.name if hit != null else "nothing"))
	_assert_buttons_reachable(ui, "inventory")

	for node in [ui, inventory, stats]:
		node.free()


func test_document_reader_buttons_are_reachable() -> void:
	var reader := DocumentReader.new()
	tree.root.add_child(reader)
	reader.open_document("note_arrival")
	await _settle(reader)
	_assert_buttons_reachable(reader, "document reader")
	reader.free()


func test_hud_never_blocks_the_world() -> void:
	# The HUD sits over the game at all times; a single blocking control in it
	# would make the world unclickable and, on touch, unplayable.
	var hud := HUD.new()
	tree.root.add_child(hud)
	await _settle(hud)
	var blockers := _controls_claiming_mouse(hud)
	assert_true(blockers.is_empty(), "the HUD blocks input at: %s" % ", ".join(blockers))
	hud.free()


func test_touch_controls_never_block_the_world() -> void:
	var touch := TouchControls.new()
	tree.root.add_child(touch)
	await _settle(touch)
	# TouchControls handles raw `_input` and draws its own buttons, so every
	# Control in it must be transparent to the GUI hit test.
	var blockers := _controls_claiming_mouse(touch)
	assert_true(blockers.is_empty(),
			"touch controls block GUI input at: %s" % ", ".join(blockers))
	assert_true(touch.get_child_count() > 0, "touch controls built no buttons")
	touch.free()


func test_touch_buttons_cover_the_actions_a_run_needs() -> void:
	var required := ["interact", "sprint", "crouch", "flashlight", "jump",
			"inventory", "journal", "pause"]
	var declared: Array[String] = []
	for def: Dictionary in TouchControls.BUTTON_DEFS:
		declared.append(String(def["action"]))
	for def: Dictionary in TouchControls.TOP_BUTTON_DEFS:
		declared.append(String(def["action"]))
	for action in required:
		assert_true(declared.has(action),
				"touch layout has no button for '%s'" % action)
		assert_true(PlayerInput.ACTIONS.has(action) or action == "jump",
				"'%s' is not an action the input layer knows" % action)


# ---------------------------------------------------------------------------
# Hit testing
# ---------------------------------------------------------------------------

## Reproduces Godot's GUI hit test: the topmost visible control containing the
## point whose mouse filter does not ignore input. Later siblings and deeper
## children are drawn on top, so the search walks the tree in reverse.
func _control_at(root: Control, point: Vector2) -> Control:
	return _hit_test(root, point)


func _hit_test(node: Node, point: Vector2) -> Control:
	var control := node as Control
	if control != null and not control.visible:
		return null
	var children := node.get_children()
	for i in range(children.size() - 1, -1, -1):
		var found := _hit_test(children[i], point)
		if found != null:
			return found
	if control == null:
		return null
	if control.mouse_filter == Control.MOUSE_FILTER_IGNORE:
		return null
	if not Rect2(control.global_position, control.size).has_point(point):
		return null
	return control


func _assert_buttons_reachable(root: Control, label: String) -> void:
	var buttons := _find_all(root, "Button")
	assert_true(buttons.size() > 0, "%s has no buttons at all" % label)
	for node in buttons:
		var button := node as Control
		if not button.is_visible_in_tree() or button.size.x < 1.0:
			continue
		var centre := button.global_position + button.size * 0.5
		var hit := _control_at(root, centre)
		var reachable := hit == button or (hit != null and button.is_ancestor_of(hit))
		assert_true(reachable,
			"%s: a click on '%s' lands on '%s' instead"
			% [label, button.name, hit.name if hit != null else "nothing"])


## Controls that would claim a mouse event anywhere in an overlay that is meant
## to be transparent.
func _controls_claiming_mouse(root: Control) -> PackedStringArray:
	var out: PackedStringArray = []
	for node in _find_all(root, "Control"):
		var control := node as Control
		if control == null or not control.is_visible_in_tree():
			continue
		if control is Button or control is Range or control is LineEdit:
			continue
		if control.mouse_filter != Control.MOUSE_FILTER_IGNORE:
			out.append("%s (%s)" % [control.name, control.get_class()])
	return out


func _find_all(node: Node, type_name: String) -> Array[Node]:
	var out: Array[Node] = []
	if node.is_class(type_name):
		out.append(node)
	for child in node.get_children():
		out.append_array(_find_all(child, type_name))
	return out


func _find_grid_panel(ui: InventoryUI) -> Control:
	for node in _find_all(ui, "Control"):
		if node.gui_input.get_connections().size() > 0 and not (node is Button):
			return node as Control
	return null


## Give the layout a couple of frames to resolve, and force a size so anchored
## controls have real rectangles to hit-test against.
func _settle(root: Control) -> void:
	root.size = SCREEN_SIZE
	await tree.process_frame
	await tree.process_frame
