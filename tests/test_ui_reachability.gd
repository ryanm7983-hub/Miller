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
	# Nothing except the start button itself may claim a mouse event...
	var blockers := _controls_claiming_mouse(root)
	assert_true(blockers.is_empty(),
			"the title card blocks input at: %s" % ", ".join(blockers))
	# ...and the start button has to cover the card and be on top of it, because
	# on a phone a tap is the only way in.
	var button := root.get_node_or_null("StartButton") as Button
	assert_not_null(button, "the title card has no StartButton")
	if button != null:
		assert_true(button.size.x >= SCREEN_SIZE.x and button.size.y >= SCREEN_SIZE.y,
				"the start button does not cover the title card")
		for point in [SCREEN_SIZE * 0.5, Vector2(8, 8), SCREEN_SIZE - Vector2(8, 8)]:
			var hit := _control_at(root, point)
			assert_true(hit == button, "a tap at %s lands on '%s' instead of the start button"
					% [point, hit.name if hit != null else "nothing"])
	root.free()


## `canvas_items` stretch takes the smaller axis ratio against the reference
## canvas, so a 1280×720 reference on a portrait phone scales the entire
## interface by width/1280 — about a third of its intended size. The reference
## has to turn with the window, or the game is technically playable in portrait
## and practically not.
func test_ui_scale_does_not_collapse_in_portrait() -> void:
	var landscape := Platform.content_scale_for(Vector2i(844, 390))
	var portrait := Platform.content_scale_for(Vector2i(390, 844))
	assert_true(landscape.x > landscape.y, "the landscape reference canvas is not landscape")
	assert_true(portrait.y > portrait.x, "the portrait reference canvas is not portrait")

	# What matters is the resulting scale, and it should barely differ between a
	# phone held one way and the same phone held the other.
	var scale_landscape := minf(844.0 / landscape.x, 390.0 / landscape.y)
	var scale_portrait := minf(390.0 / portrait.x, 844.0 / portrait.y)
	assert_almost(scale_portrait, scale_landscape, 0.02,
			"turning the phone changes the UI scale from %.2f to %.2f"
			% [scale_landscape, scale_portrait])
	assert_true(scale_portrait > 0.45,
			"portrait UI scale is %.2f — controls would be too small to hit"
			% scale_portrait)
	assert_eq(Platform.content_scale_for(Vector2i(0, 0)), Vector2i.ZERO,
			"a degenerate window size should be left alone")


## The shell's orientation nudge is drawn over the canvas by the browser, where
## Godot's hit testing cannot see it. It shipped once as an opaque full-screen
## cover that appeared as soon as the engine started, which on a portrait phone
## swallowed every tap on the title card — the game loaded and then could not be
## started at all. It must stay transparent to pointer events.
func test_html_shell_never_covers_the_canvas() -> void:
	var shell := FileAccess.get_file_as_string("res://export/black_pine_shell.html")
	assert_true(shell.length() > 0, "the HTML shell is missing")
	var rotate := _css_rule(shell, "#rotate")
	assert_true(rotate.contains("pointer-events: none"),
			"#rotate can swallow taps: it has no `pointer-events: none`")
	assert_false(rotate.contains("inset: 0"),
			"#rotate covers the whole viewport")


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


## Two touch buttons that overlap are worse than two that look cramped: the
## first one found wins the tap, so a thumb aimed at CROUCH triggers USE and the
## player has no way to tell why. The cluster is laid out by pure functions
## precisely so this can be checked at sizes this machine does not have.
func test_touch_buttons_never_overlap_each_other() -> void:
	var screens := [
		Vector2(1280, 720),     # desktop / tablet landscape
		Vector2(1558, 720),     # phone landscape, after content scaling
		Vector2(720, 1558),     # phone portrait, after content scaling
		Vector2(960, 540),      # small tablet
		Vector2(2048, 720),     # a very wide foldable
	]
	for view: Vector2 in screens:
		for left_handed in [false, true]:
			for ui_scale in [0.85, 1.0, 1.4]:
				_assert_cluster_is_clean(view, left_handed, ui_scale)


func _assert_cluster_is_clean(view: Vector2, left_handed: bool, ui_scale: float) -> void:
	var button_size := TouchControls.button_size_for(view, ui_scale)
	var margin := TouchControls.edge_margin_for(view)
	var top_size := button_size * 0.8

	# `TouchButton.contains` is a circle wider than the drawn glyph, so that is
	# what has to stay apart — matching on the drawn rectangle would pass a
	# layout in which two hit areas still fight over the same thumb.
	var buttons: Array[Array] = []
	for centre: Vector2 in TouchControls.cluster_centres(view, button_size, margin, left_handed):
		buttons.append([centre, button_size * 0.62, button_size])
	for centre: Vector2 in TouchControls.top_row_centres(view, top_size, margin, left_handed):
		buttons.append([centre, top_size * 0.62, top_size])

	var where := "%.0fx%.0f scale %.2f%s" % [view.x, view.y, ui_scale,
			" left-handed" if left_handed else ""]
	var screen := Rect2(Vector2.ZERO, view)
	for i in buttons.size():
		var centre: Vector2 = buttons[i][0]
		var drawn: float = buttons[i][2]
		assert_true(screen.encloses(Rect2(centre - Vector2(drawn, drawn) * 0.5,
				Vector2(drawn, drawn))),
				"%s: touch button %d is off screen at %s" % [where, i, centre])
		for j in range(i + 1, buttons.size()):
			var gap: float = centre.distance_to(buttons[j][0])
			var needed: float = float(buttons[i][1]) + float(buttons[j][1])
			assert_true(gap >= needed,
					"%s: touch buttons %d and %d are %.1f apart, need %.1f"
					% [where, i, j, gap, needed])


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


## The declaration block of the first rule whose selector is exactly `selector`.
func _css_rule(source: String, selector: String) -> String:
	var start := source.find(selector + " {")
	if start < 0:
		return ""
	var open := source.find("{", start)
	var close := source.find("}", open)
	if open < 0 or close < 0:
		return ""
	return source.substr(open + 1, close - open - 1)


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
