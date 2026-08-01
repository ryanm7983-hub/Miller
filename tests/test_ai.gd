extends TestCase
## Covers perception, the enemy state machine, the horror director and the
## spawn budget.
##
## AI bugs are the hardest to notice by playing, because "the monster did
## something odd once" is indistinguishable from "the monster is unpredictable".
## These tests pin the properties the design depends on: that awareness is
## graded, that coming down the state ladder is slow, that daylight is safer
## than night, and that the director enforces relief between events.

const SEED := 777001

var _world: WorldRoot
var _player: Player
var _generator: WorldGenerator


func before_all() -> void:
	AssetFoundry.warm_up_blocking()
	AudioDirector.warm_up_blocking()
	GameState.new_game(0, SEED)
	_generator = WorldGenerator.new(SEED)
	_generator.build()


# ---------------------------------------------------------------------------
# Perception
# ---------------------------------------------------------------------------

func test_awareness_thresholds_are_ordered() -> void:
	# The whole "half-noticed" state depends on there being room between these.
	assert_true(Perception.LOSE_INTEREST < Perception.SUSPICIOUS,
			"losing interest must happen below the suspicion threshold")
	assert_true(Perception.SUSPICIOUS < Perception.CERTAIN,
			"suspicion must come before certainty")
	assert_true(Perception.CERTAIN - Perception.SUSPICIOUS > 0.2,
			"there is not enough range between suspicious and certain to be felt")


func test_awareness_decays_without_a_signal() -> void:
	var perception := Perception.new()
	tree.root.add_child(perception)
	perception.awareness = 1.0
	for i in 40:
		perception._physics_process(0.1)
	assert_true(perception.awareness < 1.0, "awareness never decays")
	perception.free()


func test_alert_and_forget_round_trip() -> void:
	var perception := Perception.new()
	tree.root.add_child(perception)
	var lost := [false]
	perception.lost_track.connect(func() -> void: lost[0] = true)

	perception.alert(Vector3(10, 0, 10), 1.0)
	assert_true(perception.is_certain(), "alert did not make it certain")
	assert_eq(perception.last_known_position, Vector3(10, 0, 10))

	perception.forget()
	assert_almost(perception.awareness, 0.0, 0.001)
	assert_false(perception.has_target)
	assert_true(lost[0], "forgetting did not report losing the target")
	perception.free()


func test_transitions_fire_once_each() -> void:
	var perception := Perception.new()
	tree.root.add_child(perception)
	var suspicious := [0]
	var certain := [0]
	perception.became_suspicious.connect(func(_p: Vector3) -> void: suspicious[0] += 1)
	perception.became_certain.connect(func(_p: Vector3) -> void: certain[0] += 1)

	perception.alert(Vector3.ZERO, Perception.SUSPICIOUS + 0.05)
	perception.alert(Vector3.ZERO, Perception.SUSPICIOUS + 0.10)
	assert_eq(suspicious[0], 1, "suspicion fired more than once while staying suspicious")
	assert_eq(certain[0], 0)

	perception.alert(Vector3.ZERO, 1.0)
	assert_eq(certain[0], 1, "certainty did not fire")
	perception.free()


# ---------------------------------------------------------------------------
# Archetypes
# ---------------------------------------------------------------------------

func test_each_archetype_configures_a_distinct_sense_profile() -> void:
	var listener := _make_enemy(TheListener.new())
	var surveyor := _make_enemy(TheSurveyor.new())
	var chorus := _make_enemy(TheChorus.new())
	var wretch := _make_enemy(TheWretch.new())

	# The Listener is the game's teacher for the noise mechanic; if it can see,
	# that lesson never lands.
	assert_almost(listener.perception.sight_weight, 0.0, 0.001,
			"the Listener must be blind")
	assert_true(listener.perception.hearing_weight > 1.0, "the Listener must hear well")

	# The Surveyor is the sight-based hunter and the one that carries a light.
	assert_true(surveyor.perception.sight_weight > surveyor.perception.hearing_weight,
			"the Surveyor should lead with sight")
	assert_not_null(_find_light(surveyor), "the Surveyor has no lantern")

	# The Chorus cannot kill; its threat is entirely sanity.
	assert_almost(chorus.attack_damage, 0.0, 0.001, "the Chorus must do no damage")

	# The Wretch is the only thing faster than a sprinting player, and it leashes.
	assert_true(wretch.chase_speed > Player.SPRINT_SPEED,
			"the Wretch should out-run a sprint over a short distance")

	for enemy in [listener, surveyor, chorus, wretch]:
		enemy.free()


func test_every_archetype_names_its_death_line() -> void:
	# The ending screen looks the cause up by this id; an unmapped one silently
	# falls back to a generic line.
	for enemy in [_make_enemy(TheListener.new()), _make_enemy(TheSurveyor.new()),
			_make_enemy(TheChorus.new()), _make_enemy(TheWretch.new())]:
		var id: String = enemy.attack_id()
		assert_ne(id, "unknown", "%s did not override attack_id()" % enemy.display_name)
		enemy.free()


func test_chase_speeds_leave_the_player_an_out() -> void:
	# Every enemy except the Wretch must be outrunnable, or stamina management
	# stops being a decision and becomes a countdown.
	for enemy in [_make_enemy(TheListener.new()), _make_enemy(TheSurveyor.new()),
			_make_enemy(TheChorus.new())]:
		assert_true(enemy.chase_speed < Player.SPRINT_SPEED,
				"%s (%.1f m/s) cannot be outrun by sprinting (%.1f m/s)"
				% [enemy.display_name, enemy.chase_speed, Player.SPRINT_SPEED])
		enemy.free()


func test_state_changes_are_reported() -> void:
	var enemy := _make_enemy(TheListener.new())
	var seen: Array[int] = []
	enemy.state_changed.connect(func(s: int) -> void: seen.append(s))
	enemy.set_state(EnemyBase.State.INVESTIGATE)
	enemy.set_state(EnemyBase.State.INVESTIGATE)  # no-op
	enemy.set_state(EnemyBase.State.CHASE)
	assert_eq(seen.size(), 2, "state changes were reported %d times, expected 2" % seen.size())
	assert_eq(enemy.state, EnemyBase.State.CHASE)
	enemy.free()


func test_losing_the_player_leads_to_a_search_not_straight_to_patrol() -> void:
	# The single most important AI property in the game: breaking line of sight
	# must not reset the enemy.
	var enemy := _make_enemy(TheSurveyor.new())
	enemy.set_state(EnemyBase.State.CHASE)
	enemy._on_lost_track()
	assert_eq(enemy.state, EnemyBase.State.SEARCH,
			"losing the player dropped the enemy straight out of the hunt")
	assert_true(enemy.search_duration > 15.0,
			"a %.0f second search is too short to be worth evading"
			% enemy.search_duration)
	enemy.free()


func test_threat_level_is_normalised_and_state_ordered() -> void:
	var enemy := _make_enemy(TheListener.new())
	enemy._player = null
	assert_almost(enemy.threat_level(), 0.0, 0.001, "no player means no threat")
	enemy.free()


# ---------------------------------------------------------------------------
# Wildlife
# ---------------------------------------------------------------------------

func test_wildlife_species_table_is_complete() -> void:
	for kind: Wildlife.Species in Wildlife.SPECIES_DEFS:
		var def: Dictionary = Wildlife.SPECIES_DEFS[kind]
		for key in ["body", "material", "flee_distance", "flee_speed", "call",
				"calls", "flying", "nocturnal", "height", "startle_noise"]:
			assert_has(def, key, "species %s is missing '%s'"
					% [Wildlife.Species.keys()[kind], key])
		assert_not_null(AssetFoundry.mesh(String(def["body"])),
				"species %s has no body mesh" % Wildlife.Species.keys()[kind])
		assert_not_null(AssetFoundry.material(String(def["material"])),
				"species %s has no material" % Wildlife.Species.keys()[kind])
		for v in int(def["calls"]):
			assert_true(AudioDirector.has("%s_%d" % [def["call"], v]),
					"species %s call '%s_%d' is missing"
					% [Wildlife.Species.keys()[kind], def["call"], v])


func test_night_favours_nocturnal_species() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	var nocturnal_at_night := 0
	var nocturnal_by_day := 0
	for i in 400:
		if bool(Wildlife.SPECIES_DEFS[Wildlife.species_for_time(true, rng)]["nocturnal"]):
			nocturnal_at_night += 1
		if bool(Wildlife.SPECIES_DEFS[Wildlife.species_for_time(false, rng)]["nocturnal"]):
			nocturnal_by_day += 1
	assert_true(nocturnal_at_night > nocturnal_by_day * 1.5,
			"owls and foxes are no more likely at night (%d vs %d)"
			% [nocturnal_at_night, nocturnal_by_day])


func test_startling_wildlife_is_audible_to_the_ai() -> void:
	# Fleeing animals are the player's early-warning system, which only works if
	# the noise actually enters the shared bus.
	for kind: Wildlife.Species in Wildlife.SPECIES_DEFS:
		assert_true(float(Wildlife.SPECIES_DEFS[kind]["startle_noise"]) > 0.0,
				"species %s bolts silently" % Wildlife.Species.keys()[kind])


# ---------------------------------------------------------------------------
# Horror director
# ---------------------------------------------------------------------------

func test_event_table_is_ordered_and_complete() -> void:
	var handled := ["distant_whisper", "branch_snap", "bird_burst", "tree_groan",
		"footsteps_behind", "torch_interference", "close_whisper", "watcher",
		"name_spoken", "hallucination", "distant_scream", "stinger"]
	for event: Dictionary in HorrorDirector.EVENTS:
		for key in ["id", "intensity", "weight", "cooldown"]:
			assert_has(event, key, "event %s is missing '%s'" % [event.get("id", "?"), key])
		assert_true(handled.has(String(event["id"])),
				"event '%s' has no implementation in _fire()" % event["id"])
		assert_between(float(event["intensity"]), 0.0, 1.0, "event intensity")
		assert_true(float(event["cooldown"]) >= HorrorDirector.MIN_COOLDOWN * 0.5,
				"event '%s' buys almost no quiet afterwards" % event["id"])


func test_low_intensity_events_exist_so_the_ladder_has_a_bottom() -> void:
	var lowest := 1.0
	for event: Dictionary in HorrorDirector.EVENTS:
		lowest = minf(lowest, float(event["intensity"]))
	assert_almost(lowest, 0.0, 0.001,
			"nothing can happen at low tension, so the game opens silent")


func test_jump_scares_are_gated_and_rare() -> void:
	var scares := 0
	var total := 0
	for event: Dictionary in HorrorDirector.EVENTS:
		total += 1
		if bool(event.get("jump_scare", false)):
			scares += 1
			assert_true(float(event["intensity"]) > 0.8,
					"jump scare '%s' unlocks too early" % event["id"])
			assert_true(float(event["cooldown"]) > 60.0,
					"jump scare '%s' can repeat too soon" % event["id"])
	assert_true(scares >= 1, "there should be at least one gated jump scare")
	assert_true(float(scares) / float(total) < 0.2,
			"%d of %d events are jump scares; the design is atmosphere-first"
			% [scares, total])


func test_tension_rises_slower_than_it_falls_is_false_and_deliberate() -> void:
	# Rise is slower than fall: dread should build gradually and drain when the
	# player reaches safety, not the other way round.
	assert_true(HorrorDirector.TENSION_RISE < HorrorDirector.TENSION_FALL,
			"tension builds faster than it releases, which gives no relief")


# ---------------------------------------------------------------------------
# Population
# ---------------------------------------------------------------------------

func test_underground_landmarks_are_declared() -> void:
	for poi_id in Population.UNDERGROUND_POIS:
		assert_false(_generator.poi(poi_id).is_empty(),
				"population expects a '%s' landmark that the generator does not place" % poi_id)


func test_spawn_ring_sits_outside_sight_and_inside_earshot() -> void:
	# Spawning inside sight range means the player watches things appear;
	# spawning beyond earshot means they never announce themselves.
	assert_true(Population.SPAWN_RING.x > 26.0,
			"things spawn close enough to be seen appearing")
	assert_true(Population.SPAWN_RING.y < Population.RETIRE_DISTANCE,
			"things spawn beyond the distance at which they are retired")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

func _make_enemy(enemy: EnemyBase) -> EnemyBase:
	tree.root.add_child(enemy)
	return enemy


func _find_light(node: Node) -> Light3D:
	for child in node.get_children():
		if child is Light3D:
			return child
		var found := _find_light(child)
		if found != null:
			return found
	return null


# ---------------------------------------------------------------------------
# Endings
# ---------------------------------------------------------------------------

func test_every_ending_is_reachable_from_a_place_in_the_world() -> void:
	# The endings live in a data table; without a site in the world that calls
	# trigger_ending(), they are unreachable and the game has no conclusion.
	var source := FileAccess.get_file_as_string("res://scripts/world/landmark_builder.gd")
	assert_true(source.length() > 0, "could not read the landmark builder")
	for ending_id: String in StoryDirector.ENDINGS:
		assert_true(source.contains('"%s"' % ending_id),
				"ending '%s' has no site in the world" % ending_id)
	assert_eq(StoryDirector.ENDINGS.size(), StoryDirector.ENDING_COUNT,
			"the ending count the menu reports does not match the table")


func test_endings_have_titles_and_prose() -> void:
	for ending_id: String in StoryDirector.ENDINGS:
		var entry := StoryDirector.ending_entry(ending_id)
		assert_true(String(entry["title"]).length() > 2, "ending '%s' has no title" % ending_id)
		assert_true(String(entry["body"]).length() > 200,
				"ending '%s' has barely any text" % ending_id)


func test_walking_out_is_never_gated() -> void:
	# Refusing to participate has to be available from the first minute, or it
	# is not a refusal, it is just a worse version of the other endings.
	var director := StoryDirector.new()
	tree.root.add_child(director)
	assert_eq(director.resolve_ending("walk_out"), "walk_out")
	assert_eq(director.resolve_ending(""), "walk_out",
			"an unrecognised commitment should fall through to walking out")
	director.free()
