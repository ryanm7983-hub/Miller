extends Node3D
## Free-flying inspection scene for the world systems.
##
##   godot --path . res://scenes/test/world_preview.tscn
##
## Builds the basin around a debug camera with no player, no AI and no UI, so
## terrain, streaming, water, the day/night cycle and weather can be looked at
## in isolation. Controls:
##
##   WASD / QE     fly, Shift to sprint
##   mouse         look (click to capture, Escape to release)
##   [ / ]         scrub time back / forward one hour
##   1-7           force a weather state
##   T             toggle time advance
##   Tab           cycle quality tier
##   F             jump to the next landmark

const FLY_SPEED := 18.0
const SPRINT_MULTIPLIER := 4.0
const WEATHER_KEYS := ["clear", "cloudy", "drizzle", "rain", "storm", "fog", "gale"]

var _world: WorldRoot
var _camera: Camera3D
var _pivot: Node3D
var _label: Label
var _yaw := 0.0
var _pitch := -0.15
var _poi_index := 0


func _ready() -> void:
	AssetFoundry.warm_up_blocking()
	AudioDirector.warm_up_blocking()
	if GameState.world_seed == 0:
		GameState.new_game(0, 20260730)

	_pivot = Node3D.new()
	add_child(_pivot)
	_camera = Camera3D.new()
	_camera.fov = 75.0
	_camera.far = 900.0
	_pivot.add_child(_camera)

	_world = WorldRoot.new()
	_world.name = "World"
	add_child(_world)
	_world.build(_pivot)

	_pivot.global_position = _world.generator.spawn_point() + Vector3(0, 3, 0)
	_world.chunks.prime(_pivot.global_position)

	_build_overlay()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	_label = Label.new()
	_label.position = Vector2(14, 12)
	_label.add_theme_color_override("font_color", Color(0.85, 0.87, 0.82))
	_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_label.add_theme_constant_override("shadow_offset_y", 1)
	layer.add_child(_label)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_yaw -= event.relative.x * 0.003
		_pitch = clampf(_pitch - event.relative.y * 0.003, -1.5, 1.5)
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		_handle_key(event.physical_keycode)


func _handle_key(key: int) -> void:
	match key:
		KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		KEY_BRACKETLEFT:
			_world.time_of_day.set_hour(_world.time_of_day.hour() - 1.0)
		KEY_BRACKETRIGHT:
			_world.time_of_day.set_hour(_world.time_of_day.hour() + 1.0)
		KEY_T:
			_world.time_of_day.paused = not _world.time_of_day.paused
		KEY_TAB:
			var next := (PerformanceDirector.current_tier + 1) % 4
			Settings.set_value("auto_quality", false)
			PerformanceDirector.set_tier(next as PerformanceDirector.Tier)
		KEY_F:
			_jump_to_next_poi()
		_:
			for i in WEATHER_KEYS.size():
				if key == KEY_1 + i:
					_world.weather.lock_to(WEATHER_KEYS[i])
					return


func _jump_to_next_poi() -> void:
	var pois := _world.generator.pois()
	if pois.is_empty():
		return
	_poi_index = (_poi_index + 1) % pois.size()
	var target: Vector3 = pois[_poi_index]["position"]
	_pivot.global_position = Vector3(target.x, _world.ground_height(target.x, target.z) + 4.0, target.z)
	_world.chunks.prime(_pivot.global_position)


func _process(delta: float) -> void:
	_pivot.rotation = Vector3(0, _yaw, 0)
	_camera.rotation = Vector3(_pitch, 0, 0)

	var direction := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): direction -= _pivot.global_basis.z
	if Input.is_key_pressed(KEY_S): direction += _pivot.global_basis.z
	if Input.is_key_pressed(KEY_A): direction -= _pivot.global_basis.x
	if Input.is_key_pressed(KEY_D): direction += _pivot.global_basis.x
	if Input.is_key_pressed(KEY_E): direction += Vector3.UP
	if Input.is_key_pressed(KEY_Q): direction -= Vector3.UP
	var speed := FLY_SPEED * (SPRINT_MULTIPLIER if Input.is_key_pressed(KEY_SHIFT) else 1.0)
	# Vertical component of the look direction is applied through the camera.
	if direction.length_squared() > 0.0:
		var forward_pitch := Vector3(0, sin(_pitch), 0) * (direction.dot(-_pivot.global_basis.z))
		_pivot.global_position += (direction.normalized() + forward_pitch) * speed * delta

	_update_overlay()


func _update_overlay() -> void:
	var position := _pivot.global_position
	_label.text = "\n".join([
		"seed %d   %s  day %d   %s" % [
			GameState.world_seed, _world.time_of_day.formatted(),
			GameState.day, _world.time_of_day.phase()],
		"weather %s   wind %.2f   fog %.2f   wet %.2f" % [
			_world.weather.display_name(), _world.weather.wind_strength,
			_world.weather.fog, _world.weather.wetness],
		"pos %.0f, %.0f, %.0f   %s" % [
			position.x, position.y, position.z, _world.region_name_at(position)],
		"chunks %d (+%d queued)   instances %d" % [
			_world.chunks.loaded_count(), _world.chunks.pending_count(),
			_world.chunks.total_instances()],
		"quality %s   %.0f fps   visibility %.2f   hearing %.2f" % [
			PerformanceDirector.tier_name(), PerformanceDirector.fps(),
			_world.weather.visibility_factor(), _world.weather.hearing_factor()],
	])
