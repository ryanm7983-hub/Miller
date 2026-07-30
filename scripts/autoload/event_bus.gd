extends Node
## Global signal hub.
##
## Systems in this project never hold direct references to each other across
## layer boundaries (world -> ai -> ui). They publish here instead. That keeps
## the streaming world free to create and destroy nodes at any time without
## leaving dangling connections behind, and it makes every system testable in
## isolation: a test scene can emit the signals a subsystem expects.
##
## Naming convention: <subject>_<past_tense_verb>.

# --- Lifecycle -------------------------------------------------------------
signal game_started(slot: int)
signal game_loaded(slot: int)
signal game_saved(slot: int)
signal game_over(reason: String)
signal ending_reached(ending_id: String)
signal world_ready()

# --- Player ----------------------------------------------------------------
signal player_spawned(player: Node3D)
signal player_despawned()
signal player_health_changed(current: float, maximum: float)
signal player_stamina_changed(current: float, maximum: float)
signal player_sanity_changed(current: float, maximum: float)
signal player_damaged(amount: float, source: String)
signal player_died(cause: String)
signal player_hide_state_changed(hidden: bool)
signal player_moved_region(region_name: String)

# --- Flashlight / equipment ------------------------------------------------
signal flashlight_toggled(on: bool)
signal flashlight_battery_changed(charge: float)
signal flashlight_flickered(intensity: float)

# --- Interaction -----------------------------------------------------------
signal interactable_focused(interactable: Node)
signal interactable_unfocused()
signal interaction_performed(interactable: Node)
signal prompt_requested(text: String, duration: float)

# --- Inventory / items -----------------------------------------------------
signal item_added(item_id: String, count: int)
signal item_removed(item_id: String, count: int)
signal item_used(item_id: String)
signal inventory_changed()
signal inventory_full(item_id: String)
signal document_collected(document_id: String)
signal document_opened(document_id: String)

# --- Perception / noise ----------------------------------------------------
## Anything that makes a sound the AI can hear reports it here.
signal noise_emitted(position: Vector3, loudness: float, source: Node)
signal player_spotted(by: Node)
signal player_lost(by: Node)

# --- Enemies ---------------------------------------------------------------
signal enemy_spawned(enemy: Node3D)
signal enemy_despawned(enemy: Node3D)
signal enemy_state_changed(enemy: Node3D, state: String)
signal chase_started(enemy: Node3D)
signal chase_ended(enemy: Node3D)

# --- World / atmosphere ----------------------------------------------------
signal time_phase_changed(phase: String)
signal hour_changed(hour: int)
signal weather_changed(weather_id: String)
signal wind_changed(direction: Vector3, strength: float)
signal chunk_loaded(coord: Vector2i)
signal chunk_unloaded(coord: Vector2i)
signal poi_discovered(poi_id: String, display_name: String)

# --- Horror director -------------------------------------------------------
signal tension_changed(value: float)
signal scare_triggered(scare_id: String, position: Vector3)
signal hallucination_started(kind: String)
signal hallucination_ended(kind: String)

# --- Story / progression ---------------------------------------------------
signal objective_changed(objective_id: String, text: String)
signal objective_completed(objective_id: String)
signal flag_set(flag: String, value: Variant)
signal choice_made(choice_id: String, option_id: String)
signal listening_post_activated(post_id: String)

# --- UI / meta -------------------------------------------------------------
signal ui_screen_opened(screen: String)
signal ui_screen_closed(screen: String)
signal pause_toggled(paused: bool)
signal settings_changed(key: String, value: Variant)
signal quality_tier_changed(tier: int)
signal notification_posted(text: String)


## Convenience wrapper so callers do not have to remember argument order for
## the most frequently published event in the game.
func report_noise(position: Vector3, loudness: float, source: Node = null) -> void:
	noise_emitted.emit(position, clampf(loudness, 0.0, 1.0), source)
