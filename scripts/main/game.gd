class_name Game
extends Node3D
## The playable scene: world, player, UI, and the glue between them.
##
## Everything is assembled here rather than saved in a `.tscn` because almost
## none of it is static — the world is a function of the seed, the control
## scheme depends on the device, and the HUD layout depends on the screen. What
## a scene file would hold is the handful of nodes that never vary, and keeping
## those in code too means there is one place to read the startup order.
##
## Startup order is load-bearing:
##   assets -> world layout -> player spawn -> chunk priming -> fade in
## Priming before the fade is what stops the player looking at a hole in the
## ground on the first frame. The player is suspended across the whole of it:
## it is spawned before the terrain under it is built, and a CharacterBody3D
## left running would simply fall through the gap and keep going.

const AUTOSAVE_INTERVAL := 180.0

@onready var _ui_layer: CanvasLayer = $UI

var world: WorldRoot
var player: Player
var inventory: Inventory
var story: StoryDirector
var horror: HorrorDirector
var population: Population
var hud: HUD
var touch_controls: TouchControls
var screen_effects: ScreenEffects
var pause_menu: PauseMenu
var inventory_ui: InventoryUI
var reader: DocumentReader

var _autosave_timer := AUTOSAVE_INTERVAL
var _is_paused := false
var _loading := true


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	add_to_group("game")
	_build_ui()
	call_deferred("_start")


func _start() -> void:
	# Entering the game scene directly (from the editor or a test) skips the
	# bootstrap, so make sure the generated assets exist either way.
	if not AssetFoundry.is_ready:
		await AssetFoundry.warm_up()
	if not AudioDirector.is_ready:
		await AudioDirector.warm_up()
	if GameState.world_seed == 0:
		GameState.new_game(Settings.get_value("last_slot"), 0)

	world = WorldRoot.new()
	world.name = "World"
	add_child(world)

	player = preload("res://scenes/player/player.tscn").instantiate()
	# Frozen before it can take a single physics step. The terrain under the
	# spawn point does not exist yet — priming builds it below — and gravity does
	# not wait to be told that.
	player.set_simulating(false)
	add_child(player)
	world.build(player)
	player.setup(world)

	inventory = Inventory.new()
	inventory.name = "Inventory"
	add_child(inventory)

	story = StoryDirector.new()
	story.name = "Story"
	add_child(story)

	horror = HorrorDirector.new()
	horror.name = "Horror"
	add_child(horror)

	population = Population.new()
	population.name = "Population"
	add_child(population)

	var is_new_run := GameState.player_position == Vector3.ZERO
	if is_new_run:
		player.spawn_at(world.generator.spawn_point(), world.generator.spawn_yaw())
		player.stats.load_from(GameState.player_vitals)
		_grant_starting_kit()
	else:
		player.restore_from_state()
		inventory.deserialize(GameState.inventory_payload)

	story.setup(player, world)
	horror.setup(player, world)
	population.setup(player, world)
	hud.bind(player, world)
	screen_effects.bind(player)
	inventory_ui.bind(inventory, player.stats)

	await world.prime_around(player.global_position, func(fraction: float) -> void:
		hud.set_loading_progress(fraction))

	# There is ground now.
	player.set_simulating(true)

	_loading = false
	hud.finish_loading()
	_apply_control_scheme()
	_capture_mouse(true)
	EventBus.game_started.emit(GameState.slot)
	Log.info("game", "entered basin at %v (seed %d)" % [player.global_position, GameState.world_seed])


func _build_ui() -> void:
	screen_effects = ScreenEffects.new()
	screen_effects.name = "ScreenEffects"
	_ui_layer.add_child(screen_effects)

	hud = HUD.new()
	hud.name = "HUD"
	_ui_layer.add_child(hud)

	inventory_ui = InventoryUI.new()
	inventory_ui.name = "InventoryUI"
	inventory_ui.closed.connect(func() -> void: _set_screen_open(false))
	_ui_layer.add_child(inventory_ui)

	reader = DocumentReader.new()
	reader.name = "DocumentReader"
	reader.closed.connect(func() -> void: _set_screen_open(false))
	_ui_layer.add_child(reader)

	pause_menu = PauseMenu.new()
	pause_menu.name = "PauseMenu"
	pause_menu.resume_requested.connect(func() -> void: set_paused(false))
	pause_menu.quit_requested.connect(_on_quit_to_menu)
	_ui_layer.add_child(pause_menu)

	EventBus.settings_changed.connect(_on_settings_changed)
	EventBus.game_over.connect(_on_game_over)
	EventBus.ending_reached.connect(_on_ending_reached)
	EventBus.document_opened.connect(func(_id: String) -> void: _set_screen_open(true))


## The player starts with what the work order says they were issued, and no
## more. Everything else has to be found.
func _grant_starting_kit() -> void:
	inventory.add("recorder", 1)
	inventory.add("flashlight", 1)
	inventory.add("basin_map", 1)
	inventory.add("battery_cell", 2)
	inventory.add("gauze", 1)
	inventory.add("note_arrival", 1)
	GameState.collect_document("note_arrival")


# ---------------------------------------------------------------------------
# Control scheme
# ---------------------------------------------------------------------------

func _apply_control_scheme() -> void:
	var mode := String(Settings.get_value("touch_controls"))
	var wants_touch := Platform.prefers_touch_controls() if mode == "auto" else (mode == "on")
	if wants_touch and touch_controls == null:
		touch_controls = TouchControls.new()
		touch_controls.name = "TouchControls"
		_ui_layer.add_child(touch_controls)
		# Keep the on-screen toggles honest about the real state of things.
		player.flashlight.toggled.connect(func(on: bool) -> void:
			touch_controls.sync_toggle("flashlight", on))
	elif not wants_touch and touch_controls != null:
		touch_controls.queue_free()
		touch_controls = null
	if touch_controls != null:
		touch_controls.visible = not _is_paused


func _capture_mouse(capture: bool) -> void:
	if not Platform.has_pointer_lock:
		return
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if capture else Input.MOUSE_MODE_VISIBLE


# ---------------------------------------------------------------------------
# Frame
# ---------------------------------------------------------------------------

func _process(delta: float) -> void:
	if _loading or player == null:
		return
	_autosave_timer -= delta
	if _autosave_timer <= 0.0:
		_autosave_timer = AUTOSAVE_INTERVAL
		autosave()


func _unhandled_input(event: InputEvent) -> void:
	if _loading:
		return
	if event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		if _close_open_screen():
			return
		set_paused(not _is_paused)
	elif event.is_action_pressed("inventory") and not _is_paused:
		get_viewport().set_input_as_handled()
		_toggle_screen(inventory_ui, func() -> void: inventory_ui.open())
	elif event.is_action_pressed("journal") and not _is_paused:
		get_viewport().set_input_as_handled()
		_toggle_screen(reader, func() -> void: reader.open_journal())


## Full-screen panels (inventory, journal) suspend the player without pausing
## the world: the basin keeps moving while you rummage in your bag, which is
## the entire reason the inventory is a decision at all.
func _toggle_screen(screen: Control, opener: Callable) -> void:
	if screen.visible:
		if screen == inventory_ui:
			inventory_ui.close()
		else:
			reader.close_reader()
		return
	inventory_ui.visible = false
	reader.visible = false
	opener.call()
	_set_screen_open(true)


func _close_open_screen() -> bool:
	if inventory_ui.visible:
		inventory_ui.close()
		return true
	if reader.visible:
		reader.close_reader()
		return true
	return false


func _set_screen_open(open: bool) -> void:
	if _loading or player == null:
		return
	player.set_input_enabled(not open)
	if touch_controls != null:
		touch_controls.visible = not open and not _is_paused
	_capture_mouse(not open and not _is_paused)


# ---------------------------------------------------------------------------
# Pause and saving
# ---------------------------------------------------------------------------

func set_paused(value: bool) -> void:
	if _is_paused == value or _loading:
		return
	_is_paused = value
	get_tree().paused = value
	player.set_input_enabled(not value)
	pause_menu.set_open(value)
	if touch_controls != null:
		touch_controls.visible = not value
	_capture_mouse(not value)
	EventBus.pause_toggled.emit(value)


func autosave() -> void:
	if player == null or not player.stats.is_alive:
		return
	_sync_state()
	SaveManager.save_game(SaveManager.AUTOSAVE_SLOT)
	EventBus.notification_posted.emit("Saved")


func save_to_slot(slot: int) -> bool:
	_sync_state()
	return SaveManager.save_game(slot)


func _sync_state() -> void:
	player.write_to_state()
	GameState.inventory_payload = inventory.serialize()
	GameState.current_region = world.region_name_at(player.global_position)


func _on_ending_reached(_ending_id: String) -> void:
	_sync_state()
	if touch_controls != null:
		touch_controls.visible = false
	_capture_mouse(false)
	await SceneRouter.fade_out(2.2)
	SceneRouter.go_to("ending")


func _on_quit_to_menu() -> void:
	autosave()
	get_tree().paused = false
	SceneRouter.go_to("menu", "Leaving the basin")


func _on_game_over(cause: String) -> void:
	if touch_controls != null:
		touch_controls.visible = false
	_capture_mouse(false)
	await get_tree().create_timer(2.4).timeout
	GameState.set_flag("last_death_cause", cause)
	SceneRouter.go_to("ending", "…")


func _on_settings_changed(key: String, _value: Variant) -> void:
	if key == "touch_controls" or key == "ui_scale":
		if not _loading:
			_apply_control_scheme()
