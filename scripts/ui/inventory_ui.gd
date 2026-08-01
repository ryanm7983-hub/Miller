class_name InventoryUI
extends Control
## Grid inventory with drag-and-drop and 3D item inspection.
##
## The grid is drawn rather than assembled from Control nodes. With items of
## varying footprint, a node per cell means every drag has to reconcile a node
## tree against the model; drawing straight from the model means there is only
## one source of truth and a dropped item can never end up rendered in a place
## the model does not agree with.
##
## Dragging works with mouse and touch through the same code path — both arrive
## as press/motion/release at a screen position.

const CELL_SIZE := 62.0
const CELL_GAP := 4.0
const INSPECT_SPIN := 0.6

signal closed()

var inventory: Inventory
var stats: SurvivalStats

var _drag_index := -1
var _drag_offset := Vector2.ZERO
var _drag_position := Vector2.ZERO
var _hover_index := -1
var _selected := -1

var _detail_name: Label
var _detail_body: RichTextLabel
var _detail_actions: HBoxContainer
var _viewport: SubViewport
var _preview: MeshInstance3D
var _preview_pivot: Node3D
var _grid_panel: Control


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	_build()


func bind(player_inventory: Inventory, player_stats: SurvivalStats) -> void:
	inventory = player_inventory
	stats = player_stats
	inventory.changed.connect(_on_inventory_changed)


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------

func _build() -> void:
	var backdrop := ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.01, 0.012, 0.015, 0.78)
	add_child(backdrop)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	var frame := PanelContainer.new()
	centre.add_child(frame)

	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 18)
	frame.add_child(columns)

	# Left: the grid itself, drawn by `_draw`.
	_grid_panel = Control.new()
	_grid_panel.custom_minimum_size = Vector2(
		Inventory.COLUMNS * (CELL_SIZE + CELL_GAP) + CELL_GAP,
		Inventory.ROWS * (CELL_SIZE + CELL_GAP) + CELL_GAP + 34)
	_grid_panel.draw.connect(_draw_grid)
	# Input is taken on the grid panel itself, not on the InventoryUI root: the
	# panel is on top, so a root-level `_gui_input` never sees the clicks that
	# land on it. Everything below therefore works in panel-local coordinates.
	_grid_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_grid_panel.gui_input.connect(_on_grid_input)
	columns.add_child(_grid_panel)

	# Right: detail, preview and actions.
	var detail := VBoxContainer.new()
	detail.custom_minimum_size = Vector2(290, 0)
	detail.add_theme_constant_override("separation", 10)
	columns.add_child(detail)

	_detail_name = Label.new()
	_detail_name.add_theme_font_size_override("font_size", 20)
	_detail_name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail.add_child(_detail_name)

	detail.add_child(_build_preview())

	_detail_body = RichTextLabel.new()
	_detail_body.fit_content = true
	_detail_body.custom_minimum_size = Vector2(0, 140)
	_detail_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_detail_body.add_theme_color_override("default_color", UITheme.BONE_DIM)
	detail.add_child(_detail_body)

	_detail_actions = HBoxContainer.new()
	_detail_actions.add_theme_constant_override("separation", 8)
	detail.add_child(_detail_actions)

	var close := Button.new()
	close.text = "Close"
	close.pressed.connect(_on_close)
	detail.add_child(close)


## A live 3D view rather than an icon: turning an object over is the point of
## inspecting it, and the meshes already exist.
func _build_preview() -> Control:
	_viewport = SubViewport.new()
	_viewport.size = Vector2i(280, 190)
	_viewport.transparent_bg = true
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_viewport.own_world_3d = true
	_viewport.world_3d = World3D.new()

	_preview_pivot = Node3D.new()
	_viewport.add_child(_preview_pivot)

	_preview = MeshInstance3D.new()
	_preview_pivot.add_child(_preview)

	var camera := Camera3D.new()
	camera.position = Vector3(0, 0.08, 0.55)
	camera.fov = 42.0
	_viewport.add_child(camera)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38, 32, 0)
	key.light_energy = 1.5
	key.light_color = Color(1.0, 0.95, 0.86)
	_viewport.add_child(key)

	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(18, -140, 0)
	fill.light_energy = 0.4
	fill.light_color = Color(0.55, 0.62, 0.72)
	_viewport.add_child(fill)

	var container := SubViewportContainer.new()
	container.stretch = true
	container.custom_minimum_size = Vector2(280, 190)
	container.add_child(_viewport)
	return container


# ---------------------------------------------------------------------------
# Open / close
# ---------------------------------------------------------------------------

func open() -> void:
	visible = true
	_selected = -1
	_drag_index = -1
	_refresh_detail()
	_grid_panel.queue_redraw()
	AudioDirector.play_ui("ui_confirm")
	EventBus.ui_screen_opened.emit("inventory")


func close() -> void:
	visible = false
	_drag_index = -1
	AudioDirector.play_ui("ui_back")
	EventBus.ui_screen_closed.emit("inventory")
	closed.emit()


func _on_close() -> void:
	close()


func _process(delta: float) -> void:
	if not visible or _preview_pivot == null:
		return
	_preview_pivot.rotate_y(delta * INSPECT_SPIN)


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------

func _draw_grid() -> void:
	if inventory == null:
		return
	var origin := _grid_origin()

	var font := _grid_panel.get_theme_default_font()
	if font != null:
		_grid_panel.draw_string(font, Vector2(CELL_GAP, 20), "SATCHEL",
				HORIZONTAL_ALIGNMENT_LEFT, -1, 16, UITheme.BONE_DIM)
		var capacity := "%d / %d" % [inventory.used_cells(), Inventory.COLUMNS * Inventory.ROWS]
		_grid_panel.draw_string(font, Vector2(_grid_panel.size.x - 70, 20), capacity,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 16, UITheme.BONE_DIM)

	# Empty cells.
	for y in Inventory.ROWS:
		for x in Inventory.COLUMNS:
			var rect := Rect2(origin + Vector2(x, y) * (CELL_SIZE + CELL_GAP),
					Vector2(CELL_SIZE, CELL_SIZE))
			_grid_panel.draw_rect(rect, Color(0.06, 0.065, 0.07, 0.85))
			_grid_panel.draw_rect(rect, Color(0.14, 0.15, 0.14, 0.9), false, 1.0)

	# Drop preview under a dragged item.
	if _drag_index >= 0:
		var cell := _cell_at(_drag_position - _drag_offset)
		var size: Vector2i = inventory.slots[_drag_index]["size"]
		var valid := _can_drop(cell)
		var rect := Rect2(origin + Vector2(cell) * (CELL_SIZE + CELL_GAP),
				Vector2(size) * (CELL_SIZE + CELL_GAP) - Vector2(CELL_GAP, CELL_GAP))
		_grid_panel.draw_rect(rect, (UITheme.MOSS if valid else UITheme.RUST) * Color(1, 1, 1, 0.25))

	for i in inventory.slots.size():
		if i == _drag_index:
			continue
		_draw_slot(origin, i, false)

	if _drag_index >= 0:
		_draw_slot(_drag_position - _drag_offset, _drag_index, true)


func _draw_slot(origin: Vector2, index: int, floating: bool) -> void:
	var slot: Dictionary = inventory.slots[index]
	var item_id: String = slot["id"]
	var size: Vector2i = slot["size"]
	var position := origin
	if not floating:
		var cell: Vector2i = slot["origin"]
		position = origin + Vector2(cell) * (CELL_SIZE + CELL_GAP)
	var rect := Rect2(position, Vector2(size) * (CELL_SIZE + CELL_GAP) - Vector2(CELL_GAP, CELL_GAP))

	var tint := ItemDatabase.tint(item_id)
	var fill := Color(0.10, 0.105, 0.11, 0.95 if not floating else 0.8)
	if index == _selected:
		fill = Color(0.16, 0.17, 0.16, 0.95)
	_grid_panel.draw_rect(rect, fill)
	_grid_panel.draw_rect(rect, Color(tint.r, tint.g, tint.b, 0.6), false,
			2.0 if index == _selected else 1.0)

	var font := _grid_panel.get_theme_default_font()
	if font == null:
		return
	var glyph := ItemDatabase.glyph(item_id)
	var glyph_size := int(CELL_SIZE * 0.62)
	var glyph_width := font.get_string_size(glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, glyph_size).x
	_grid_panel.draw_string(font, rect.position + rect.size * 0.5
			+ Vector2(-glyph_width * 0.5, glyph_size * 0.32),
			glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, glyph_size, tint)

	var count := int(slot["count"])
	if count > 1:
		_grid_panel.draw_string(font, rect.position + rect.size - Vector2(16, 6),
				str(count), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, UITheme.BONE)


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

func _on_grid_input(event: InputEvent) -> void:
	if inventory == null:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_begin_drag(event.position)
		else:
			_end_drag(event.position)
		accept_event()
	elif event is InputEventScreenTouch:
		if event.pressed:
			_begin_drag(event.position)
		else:
			_end_drag(event.position)
		accept_event()
	elif event is InputEventMouseMotion or event is InputEventScreenDrag:
		_drag_position = event.position
		if _drag_index >= 0:
			_grid_panel.queue_redraw()
			accept_event()


func _begin_drag(position: Vector2) -> void:
	var cell := _cell_at(position)
	var index := inventory.slot_at(cell)
	_drag_position = position
	if index < 0:
		return
	_selected = index
	_drag_index = index
	var slot_origin: Vector2i = inventory.slots[index]["origin"]
	_drag_offset = position - _grid_origin() - Vector2(slot_origin) * (CELL_SIZE + CELL_GAP)
	_refresh_detail()
	_grid_panel.queue_redraw()


func _end_drag(position: Vector2) -> void:
	if _drag_index < 0:
		return
	var index := _drag_index
	_drag_index = -1
	var cell := _cell_at(position - _drag_offset)
	var target := inventory.slot_at(cell)

	if target >= 0 and target != index:
		if not inventory.merge(index, target):
			AudioDirector.play_ui("ui_deny")
	elif not inventory.move_to(index, cell):
		AudioDirector.play_ui("ui_deny")
	else:
		AudioDirector.play_ui("ui_move")
	_selected = mini(_selected, inventory.slots.size() - 1)
	_refresh_detail()
	_grid_panel.queue_redraw()


## Top-left of the cell grid, in `_grid_panel`-local coordinates.
func _grid_origin() -> Vector2:
	return Vector2(CELL_GAP, 28.0)


func _cell_at(position: Vector2) -> Vector2i:
	var local := position - _grid_origin()
	return Vector2i(
		int(floor(local.x / (CELL_SIZE + CELL_GAP))),
		int(floor(local.y / (CELL_SIZE + CELL_GAP))))


func _can_drop(cell: Vector2i) -> bool:
	if _drag_index < 0:
		return false
	var size: Vector2i = inventory.slots[_drag_index]["size"]
	if cell.x < 0 or cell.y < 0:
		return false
	if cell.x + size.x > Inventory.COLUMNS or cell.y + size.y > Inventory.ROWS:
		return false
	for y in size.y:
		for x in size.x:
			var occupant := inventory.slot_at(cell + Vector2i(x, y))
			if occupant != -1 and occupant != _drag_index:
				return false
	return true


# ---------------------------------------------------------------------------
# Detail panel
# ---------------------------------------------------------------------------

func _refresh_detail() -> void:
	for child in _detail_actions.get_children():
		child.queue_free()

	if _selected < 0 or _selected >= inventory.slots.size():
		_detail_name.text = ""
		_detail_body.text = "[i]Nothing selected.[/i]"
		_preview.mesh = null
		return

	var item_id: String = inventory.slots[_selected]["id"]
	_detail_name.text = ItemDatabase.display_name(item_id)
	_detail_name.add_theme_color_override("font_color", ItemDatabase.tint(item_id))
	_detail_body.text = ItemDatabase.description(item_id)
	_preview.mesh = AssetFoundry.item_mesh(item_id)
	_preview_pivot.rotation = Vector3.ZERO

	if ItemDatabase.is_usable(item_id):
		_detail_actions.add_child(_action_button("Use", func() -> void:
			if not inventory.use(_selected, stats):
				AudioDirector.play_ui("ui_deny")
			_refresh_detail()
			_grid_panel.queue_redraw()))
	if ItemDatabase.is_document(item_id):
		_detail_actions.add_child(_action_button("Read", func() -> void:
			EventBus.document_opened.emit(ItemDatabase.note_id(item_id))))
	if not ItemDatabase.is_essential(item_id):
		_detail_actions.add_child(_action_button("Drop", func() -> void:
			inventory.remove_slot(_selected)
			_selected = -1
			_refresh_detail()
			_grid_panel.queue_redraw()))


func _action_button(text: String, handler: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.pressed.connect(handler)
	return button


func _on_inventory_changed() -> void:
	_grid_panel.queue_redraw()
	if _selected >= inventory.slots.size():
		_selected = -1
		_refresh_detail()
