class_name Population
extends Node3D
## Spawns and retires everything alive in the basin.
##
## Nothing is placed in advance. Enemies and wildlife are created in a ring
## around the player — outside sight range, inside earshot — and removed when
## they fall far behind. That keeps the population cost flat no matter how far
## the player walks, and it is the only way a 1 km² world stays affordable on a
## phone.
##
## The interesting decisions are *when* and *what*:
##
##  * Enemy budget comes from the quality tier, but the **type mix** comes from
##    where and when the player is. The Surveyor only exists near roads. The
##    Wretch only exists underground. The Listener is everywhere after dark.
##  * Night is not simply "more enemies" — it is a different roster. Daytime in
##    the basin is genuinely close to safe, which is what gives the player a
##    reason to plan around the clock rather than treat it as decoration.
##  * Nothing spawns where the player could watch it appear. A spawn is only
##    accepted if it is out of the view cone or behind cover.

const SPAWN_RING := Vector2(34.0, 62.0)
const RETIRE_DISTANCE := 130.0
const ENEMY_CHECK_INTERVAL := 6.0
const WILDLIFE_CHECK_INTERVAL := 2.5
const UNDERGROUND_POIS := ["mine", "cave", "bunker"]
const UNDERGROUND_RADIUS := 34.0

var enemies_enabled: bool = true

var _player: Player
var _world: WorldRoot
var _rng := RandomNumberGenerator.new()
var _enemy_timer := 3.0
var _wildlife_timer := 1.0
var _enemies: Array[EnemyBase] = []
var _wildlife: Array[Wildlife] = []


func setup(player: Player, world: WorldRoot) -> void:
	_player = player
	_world = world
	_rng.seed = GameState.world_seed + 5150


func _process(delta: float) -> void:
	if _player == null or _world == null or not _player.stats.is_alive:
		return
	_prune()

	_wildlife_timer -= delta
	if _wildlife_timer <= 0.0:
		_wildlife_timer = WILDLIFE_CHECK_INTERVAL
		_top_up_wildlife()

	_enemy_timer -= delta
	if _enemy_timer <= 0.0:
		_enemy_timer = ENEMY_CHECK_INTERVAL
		if enemies_enabled:
			_top_up_enemies()


func _prune() -> void:
	for i in range(_enemies.size() - 1, -1, -1):
		if not is_instance_valid(_enemies[i]):
			_enemies.remove_at(i)
	for i in range(_wildlife.size() - 1, -1, -1):
		if not is_instance_valid(_wildlife[i]):
			_wildlife.remove_at(i)


# ---------------------------------------------------------------------------
# Enemies
# ---------------------------------------------------------------------------

func _enemy_budget() -> int:
	var budget: int = int(PerformanceDirector.get_budget("max_enemies", 4))
	var night := 1.0
	if _world.time_of_day != null:
		night = 1.0 - _world.time_of_day.day_factor
	# Daylight is close to safe. That is a design decision, not a performance
	# one: the clock has to matter.
	if night < 0.25:
		budget = mini(budget, 1)
	elif night < 0.6:
		budget = mini(budget, maxi(2, budget - 2))
	# The basin pays more attention the more of it the player has played back.
	budget += clampi(GameState.posts_recorded() - 1, 0, 2)
	return clampi(budget, 0, 6)


func _top_up_enemies() -> void:
	if _enemies.size() >= _enemy_budget():
		return
	var kind := _pick_enemy_kind()
	if kind == "":
		return
	var spawn := _find_spawn_point(kind == "wretch")
	if spawn == Vector3.INF:
		return
	_spawn_enemy(kind, spawn)


## Which archetype belongs here, now. Returning "" means "nothing fits", which
## is a perfectly good outcome — an empty forest at noon is correct.
func _pick_enemy_kind() -> String:
	var night := 1.0
	if _world.time_of_day != null:
		night = 1.0 - _world.time_of_day.day_factor
	var position := _player.global_position
	var near_road := _world.generator.road_influence_at(position.x, position.z) > 0.15
	var underground := _is_underground(position)

	var pool: Array[String] = []
	if underground:
		# Territorial things own the enclosed places at any hour.
		pool.append_array(["wretch", "wretch", "listener"])
	else:
		if night > 0.35:
			pool.append_array(["listener", "listener"])
			pool.append("chorus")
		if night > 0.15 and near_road:
			pool.append_array(["surveyor", "surveyor"])
		if night > 0.7 and _player.stats.sanity_fraction() < 0.6:
			# The Chorus is drawn to a mind that is already coming apart.
			pool.append_array(["chorus", "chorus"])
		if night <= 0.35 and not near_road:
			# Daytime: at most something distant and slow.
			if _rng.randf() < 0.35:
				pool.append("listener")

	if pool.is_empty():
		return ""
	# Never more than one Surveyor: two lanterns on one road reads as an army.
	var chosen := pool[_rng.randi() % pool.size()]
	if chosen == "surveyor" and _count_of("surveyor") > 0:
		return ""
	return chosen


func _count_of(kind: String) -> int:
	var total := 0
	for enemy in _enemies:
		if not is_instance_valid(enemy):
			continue
		match kind:
			"surveyor": total += 1 if enemy is TheSurveyor else 0
			"listener": total += 1 if enemy is TheListener else 0
			"chorus": total += 1 if enemy is TheChorus else 0
			"wretch": total += 1 if enemy is TheWretch else 0
	return total


func _spawn_enemy(kind: String, spawn: Vector3) -> void:
	var enemy: EnemyBase
	match kind:
		"listener": enemy = TheListener.new()
		"surveyor": enemy = TheSurveyor.new()
		"chorus": enemy = TheChorus.new()
		"wretch": enemy = TheWretch.new()
		_: return
	add_child(enemy)
	enemy.setup(_player, _world, spawn)
	_enemies.append(enemy)

	# The Chorus arrives as a group; a single one is a curiosity, several are a
	# situation.
	if kind == "chorus":
		var extra := _rng.randi_range(1, 3)
		for i in extra:
			if _enemies.size() >= _enemy_budget() + 2:
				break
			var companion := TheChorus.new()
			add_child(companion)
			var offset := Vector3(_rng.randf_range(-6, 6), 0, _rng.randf_range(-6, 6))
			var point := spawn + offset
			point.y = _world.ground_height(point.x, point.z)
			companion.setup(_player, _world, point)
			_enemies.append(companion)


func _is_underground(position: Vector3) -> bool:
	for poi_id in UNDERGROUND_POIS:
		var entry := _world.generator.poi(poi_id)
		if entry.is_empty():
			continue
		var p: Vector3 = entry["position"]
		if Vector2(p.x - position.x, p.z - position.z).length() < UNDERGROUND_RADIUS:
			return true
	return false


# ---------------------------------------------------------------------------
# Wildlife
# ---------------------------------------------------------------------------

func _top_up_wildlife() -> void:
	var budget: int = int(PerformanceDirector.get_budget("max_wildlife", 12))
	if _wildlife.size() >= budget:
		return
	var spawn := _find_spawn_point(false, false)
	if spawn == Vector3.INF:
		return
	var is_night: bool = _world.time_of_day != null and _world.time_of_day.is_night()
	var kind := Wildlife.species_for_time(is_night, _rng)

	var animal := Wildlife.new()
	add_child(animal)
	animal.setup(kind, _player, _world, spawn)
	_wildlife.append(animal)


# ---------------------------------------------------------------------------
# Placement
# ---------------------------------------------------------------------------

## Find a point in the ring around the player that is standable and — for
## anything the player should not watch materialise — out of view.
func _find_spawn_point(underground: bool, hidden: bool = true) -> Vector3:
	var forward := -_player.camera.global_basis.z
	for attempt in 16:
		var angle := _rng.randf() * TAU
		var distance := _rng.randf_range(SPAWN_RING.x, SPAWN_RING.y)
		var offset := Vector3(cos(angle) * distance, 0.0, sin(angle) * distance)
		var candidate := _player.global_position + offset

		if not _world.generator.is_in_bounds(candidate.x, candidate.z):
			continue
		var ground := _world.generator.height_at(candidate.x, candidate.z)
		if ground < _world.generator.water_level_at(candidate.x, candidate.z) + 0.5:
			continue
		if _world.generator.slope_at(candidate.x, candidate.z) > 0.55:
			continue
		if underground != _is_underground(candidate):
			continue
		if hidden and forward.dot(offset.normalized()) > 0.35:
			# In front of the player: only allow it if the terrain hides it.
			if not _is_occluded(candidate + Vector3(0, ground + 1.5, 0)):
				continue
		return Vector3(candidate.x, ground, candidate.z)
	return Vector3.INF


func _is_occluded(point: Vector3) -> bool:
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(_player.eye_position(), point, 1 | 2)
	return not space.intersect_ray(query).is_empty()


# ---------------------------------------------------------------------------
# Queries and control
# ---------------------------------------------------------------------------

func enemy_count() -> int:
	_prune()
	return _enemies.size()


func wildlife_count() -> int:
	_prune()
	return _wildlife.size()


func enemies() -> Array[EnemyBase]:
	_prune()
	return _enemies


## Clear the basin. Used by story beats that need a guaranteed-quiet stretch.
func clear_enemies() -> void:
	for enemy in _enemies:
		if is_instance_valid(enemy):
			enemy.queue_free()
	_enemies.clear()


## Put something specific somewhere specific, for scripted moments.
func force_spawn(kind: String, position: Vector3) -> EnemyBase:
	_spawn_enemy(kind, position)
	return _enemies.back() if not _enemies.is_empty() else null
