class_name DocumentReader
extends Control
## Full-screen reader for notes, journals and tape transcripts.
##
## Documents are the game's main channel for story, so the reader is treated as
## a diegetic object rather than a dialogue box: paper texture, a warm pool of
## light, and text set in a column narrow enough to read comfortably on a phone
## held in one hand.
##
## The journal view lists everything collected so far. Reading is how the
## player earns a higher sanity floor — understanding the basin is protective —
## so `DocumentLibrary` records what has been read, not just what was picked up.

const COLUMN_WIDTH := 560.0

signal closed()

var _paper: TextureRect
var _title: Label
var _body: RichTextLabel
var _footer: Label
var _index: VBoxContainer
var _index_scroll: ScrollContainer
var _current := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	_build()
	EventBus.document_opened.connect(open_document)


func _build() -> void:
	var backdrop := ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.008, 0.010, 0.012, 0.9)
	add_child(backdrop)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	centre.add_child(row)

	# Left: the collected-documents index.
	_index_scroll = ScrollContainer.new()
	_index_scroll.custom_minimum_size = Vector2(240, 520)
	_index_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	row.add_child(_index_scroll)

	_index = VBoxContainer.new()
	_index.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_index.add_theme_constant_override("separation", 4)
	_index_scroll.add_child(_index)

	# Right: the page.
	var page := PanelContainer.new()
	page.custom_minimum_size = Vector2(COLUMN_WIDTH, 520)
	row.add_child(page)

	_paper = TextureRect.new()
	_paper.stretch_mode = TextureRect.STRETCH_TILE
	_paper.modulate = Color(0.82, 0.79, 0.71)
	_paper.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.add_child(_paper)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 34)
	margin.add_theme_constant_override("margin_right", 34)
	margin.add_theme_constant_override("margin_top", 26)
	margin.add_theme_constant_override("margin_bottom", 20)
	page.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	margin.add_child(column)

	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_color_override("font_color", Color(0.12, 0.10, 0.08))
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_title)

	_body = RichTextLabel.new()
	_body.bbcode_enabled = true
	_body.scroll_active = true
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_theme_color_override("default_color", Color(0.14, 0.12, 0.10))
	_body.add_theme_font_size_override("normal_font_size", 17)
	column.add_child(_body)

	_footer = Label.new()
	_footer.add_theme_color_override("font_color", Color(0.32, 0.28, 0.22))
	_footer.add_theme_font_size_override("font_size", 14)
	_footer.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	column.add_child(_footer)

	var close := Button.new()
	close.text = "Close"
	close.pressed.connect(close_reader)
	column.add_child(close)


func _ensure_paper() -> void:
	if _paper.texture == null:
		_paper.texture = AssetFoundry.texture("paper")


# ---------------------------------------------------------------------------

## Open a specific document.
func open_document(document_id: String) -> void:
	if not DocumentLibrary.exists(document_id):
		Log.warn("reader", "unknown document '%s'" % document_id)
		return
	_ensure_paper()
	_current = document_id
	var entry := DocumentLibrary.get_entry(document_id)
	_title.text = String(entry["title"])
	_body.text = String(entry["body"])
	_footer.text = String(entry.get("attribution", ""))
	DocumentLibrary.mark_read(document_id)
	_populate_index()
	visible = true
	_index_scroll.visible = true
	AudioDirector.play_ui("ui_confirm")
	EventBus.ui_screen_opened.emit("document")


## Open the journal with the most recent document showing.
func open_journal() -> void:
	var collected := GameState.documents
	if collected.is_empty():
		_ensure_paper()
		_current = ""
		_title.text = "Journal"
		_body.text = "[i]You have not written anything down, and nobody has left you anything to read.[/i]"
		_footer.text = ""
		_populate_index()
		visible = true
		EventBus.ui_screen_opened.emit("journal")
		return
	open_document(collected[collected.size() - 1])


func close_reader() -> void:
	visible = false
	AudioDirector.play_ui("ui_back")
	EventBus.ui_screen_closed.emit("document")
	closed.emit()


func _populate_index() -> void:
	for child in _index.get_children():
		child.queue_free()

	var header := Label.new()
	header.text = "COLLECTED"
	header.add_theme_color_override("font_color", UITheme.BONE_DIM)
	_index.add_child(header)

	if GameState.documents.is_empty():
		var empty := Label.new()
		empty.text = "nothing yet"
		empty.add_theme_color_override("font_color", UITheme.BONE_DIM)
		_index.add_child(empty)
		return

	for document_id in GameState.documents:
		var entry := DocumentLibrary.get_entry(document_id)
		var button := Button.new()
		button.text = String(entry.get("short", entry.get("title", document_id)))
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size = Vector2(220, 34)
		if document_id == _current:
			button.add_theme_color_override("font_color", UITheme.AMBER)
		elif not DocumentLibrary.has_read(document_id):
			button.add_theme_color_override("font_color", UITheme.MOSS)
		button.pressed.connect(func() -> void: open_document(document_id))
		_index.add_child(button)
