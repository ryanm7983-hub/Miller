extends TestCase
## Covers the player's survival model, input abstraction and controller.
##
## The movement numbers matter beyond feel: the AI reads the noise the player
## emits, so "sprinting is louder than walking is louder than crouching" is a
## contract between two systems, not a preference.

var _stats: SurvivalStats
var _input: PlayerInput


func before_each() -> void:
	_stats = SurvivalStats.new()
	tree.root.add_child(_stats)
	_input = PlayerInput.new()
	tree.root.add_child(_input)


func after_each() -> void:
	for node in [_stats, _input]:
		if is_instance_valid(node):
			node.free()


# ---------------------------------------------------------------------------
# Stamina
# ---------------------------------------------------------------------------

func test_sprinting_drains_stamina() -> void:
	_stats.is_sprinting = true
	for i in 20:
		_stats.tick(0.1, 0.0)
	assert_true(_stats.stamina < SurvivalStats.MAX_STAMINA - 20.0,
			"two seconds of sprinting drained only %.1f" % (SurvivalStats.MAX_STAMINA - _stats.stamina))


func test_stamina_regenerates_after_a_delay() -> void:
	# Sprint first: the grace period starts when stamina is spent, so it only
	# exists if the player has actually been running.
	_stats.is_sprinting = true
	for i in 10:
		_stats.tick(0.1, 0.0)
	var spent := _stats.stamina
	assert_true(spent < SurvivalStats.MAX_STAMINA, "sprinting cost nothing")

	_stats.is_sprinting = false
	_stats.tick(0.1, 0.0)
	assert_almost(_stats.stamina, spent, 0.5, "stamina regenerated during the grace period")

	for i in 40:
		_stats.tick(0.1, 0.0)
	assert_true(_stats.stamina > spent + 4.0,
			"stamina did not recover after the grace period (%.1f -> %.1f)" % [spent, _stats.stamina])


func test_exhaustion_locks_sprinting_until_a_real_margin_returns() -> void:
	_stats.stamina = 1.0
	_stats.is_sprinting = true
	for i in 20:
		_stats.tick(0.1, 0.0)
	assert_true(_stats.is_exhausted, "running out of stamina did not exhaust the player")
	assert_false(_stats.can_sprint(), "exhausted player can still sprint")

	# A trickle of stamina must not immediately re-enable sprinting.
	_stats.is_sprinting = false
	for i in 30:
		_stats.tick(0.1, 0.0)
	if _stats.stamina < SurvivalStats.EXHAUSTION_RECOVERY:
		assert_false(_stats.can_sprint(),
				"sprint unlocked at %.1f stamina, below the recovery threshold" % _stats.stamina)

	for i in 400:
		_stats.tick(0.1, 0.0)
	assert_false(_stats.is_exhausted, "player never recovered from exhaustion")
	assert_true(_stats.can_sprint())


# ---------------------------------------------------------------------------
# Health and sanity
# ---------------------------------------------------------------------------

func test_damage_and_death() -> void:
	var deaths: Array[String] = []
	_stats.died.connect(func(cause: String) -> void: deaths.append(cause))
	_stats.damage(30.0, "test")
	assert_almost(_stats.health, 70.0, 0.01)
	assert_true(_stats.is_alive)
	_stats.damage(80.0, "the_listener")
	assert_almost(_stats.health, 0.0, 0.01)
	assert_false(_stats.is_alive)
	assert_eq(deaths.size(), 1, "death fired the wrong number of times")
	assert_eq(deaths[0], "the_listener")


func test_dead_players_stop_ticking() -> void:
	_stats.damage(200.0, "test")
	var health := _stats.health
	for i in 100:
		_stats.tick(0.1, 0.0)
	assert_almost(_stats.health, health, 0.01, "a dead player regenerated")


func test_health_regeneration_is_capped_by_sanity() -> void:
	_stats.sanity = 0.0
	_stats.health = 20.0
	for i in 2000:
		_stats.tick(0.1, 0.0)
	assert_true(_stats.health < 55.0,
			"at zero sanity health reached %.1f; it should be capped near 40" % _stats.health)
	assert_true(_stats.health > 35.0, "health did not regenerate at all (%.1f)" % _stats.health)


func test_darkness_drains_sanity_and_night_makes_it_worse() -> void:
	_stats.in_darkness = true
	_stats.in_shelter = false
	var start := _stats.sanity
	for i in 100:
		_stats.tick(0.1, 0.0)
	var day_loss := start - _stats.sanity
	assert_true(day_loss > 0.0, "darkness did not drain sanity")

	_stats.sanity = start
	for i in 100:
		_stats.tick(0.1, 1.0)
	var night_loss := start - _stats.sanity
	assert_true(night_loss > day_loss * 1.2,
			"night drain %.2f is not worse than daytime drain %.2f" % [night_loss, day_loss])


func test_light_and_shelter_restore_sanity() -> void:
	_stats.sanity = 50.0
	_stats.in_darkness = false
	_stats.in_shelter = false
	for i in 100:
		_stats.tick(0.1, 0.0)
	var lit := _stats.sanity
	assert_true(lit > 50.0, "light did not restore sanity")

	_stats.sanity = 50.0
	_stats.in_shelter = true
	for i in 100:
		_stats.tick(0.1, 0.0)
	assert_true(_stats.sanity > lit, "shelter should restore faster than open light")


func test_proximity_overrides_everything() -> void:
	_stats.sanity = 80.0
	_stats.in_darkness = false
	_stats.in_shelter = true
	_stats.threat_proximity = 1.0
	for i in 20:
		_stats.tick(0.1, 0.0)
	assert_true(_stats.sanity < 80.0,
			"something standing next to the player did not drain sanity")


func test_sanity_floor_holds() -> void:
	_stats.set_sanity_floor(30.0)
	_stats.in_darkness = true
	for i in 2000:
		_stats.tick(0.1, 1.0)
	assert_true(_stats.sanity >= 29.99, "sanity fell below its floor (%.2f)" % _stats.sanity)


func test_vitals_round_trip_through_a_dictionary() -> void:
	_stats.health = 61.5
	_stats.stamina = 22.25
	_stats.sanity = 47.0
	_stats.battery = 8.5
	var payload := _stats.to_dictionary()

	var restored := SurvivalStats.new()
	tree.root.add_child(restored)
	restored.load_from(payload)
	assert_almost(restored.health, 61.5, 0.001)
	assert_almost(restored.stamina, 22.25, 0.001)
	assert_almost(restored.sanity, 47.0, 0.001)
	assert_almost(restored.battery, 8.5, 0.001)
	restored.free()


func test_battery_only_goes_down_on_its_own() -> void:
	_stats.consume_battery(30.0)
	assert_almost(_stats.battery, 70.0, 0.001)
	for i in 100:
		_stats.tick(0.1, 0.0)
	assert_almost(_stats.battery, 70.0, 0.001, "battery regenerated by itself")
	_stats.add_battery(50.0)
	assert_almost(_stats.battery, 100.0, 0.001, "battery exceeded its maximum")


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

func test_touch_move_reaches_the_controller() -> void:
	_input.set_touch_move(Vector2(0.5, 1.0))
	var move := _input.move_vector()
	assert_true(move.length() <= 1.0001, "move vector exceeds unit length")
	assert_true(move.y > 0.5, "forward input lost")
	assert_true(_input.using_touch(), "touch input did not mark the scheme as touch")


func test_touch_actions_latch_for_exactly_one_frame() -> void:
	_input.tap_touch_action("interact")
	assert_true(_input.was_pressed("interact"), "tap did not register")
	_input._process(0.016)
	assert_false(_input.was_pressed("interact"), "tap latched for more than one frame")


func test_held_touch_actions_persist() -> void:
	_input.set_touch_action("sprint", true)
	assert_true(_input.is_pressed("sprint"))
	_input._process(0.016)
	assert_true(_input.is_pressed("sprint"), "held action was cleared by the frame tick")
	_input.set_touch_action("sprint", false)
	assert_false(_input.is_pressed("sprint"))
	assert_true(_input.was_released("sprint"), "release was not reported")


func test_look_is_accumulated_and_consumed() -> void:
	_input.add_touch_look(Vector2(100, 50))
	var first := _input.consume_look()
	assert_true(first.length() > 0.0, "look delta was lost")
	var second := _input.consume_look()
	assert_eq(second, Vector2.ZERO, "look delta was not cleared by reading it")


func test_look_respects_inversion_setting() -> void:
	Settings.set_value("invert_look_y", false)
	_input.add_touch_look(Vector2(0, 100))
	var normal := _input.consume_look()
	Settings.set_value("invert_look_y", true)
	_input.add_touch_look(Vector2(0, 100))
	var inverted := _input.consume_look()
	Settings.set_value("invert_look_y", false)
	assert_true(signf(normal.y) != signf(inverted.y), "invert-Y had no effect")


func test_toggle_and_hold_sprint_modes() -> void:
	Settings.set_value("hold_to_sprint", true)
	_input.set_touch_action("sprint", true)
	assert_true(_input.wants_sprint(false), "hold mode did not start a sprint")
	_input.set_touch_action("sprint", false)
	assert_false(_input.wants_sprint(true), "hold mode did not end the sprint on release")

	Settings.set_value("hold_to_sprint", false)
	_input.tap_touch_action("sprint")
	assert_true(_input.wants_sprint(false), "toggle mode did not start a sprint")
	_input._process(0.016)
	assert_true(_input.wants_sprint(true), "toggle mode dropped the sprint without a press")
	_input.tap_touch_action("sprint")
	assert_false(_input.wants_sprint(true), "toggle mode did not stop the sprint")
	Settings.set_value("hold_to_sprint", true)


func test_disabling_input_silences_everything() -> void:
	_input.set_touch_action("sprint", true)
	_input.set_touch_move(Vector2(1, 1))
	_input.add_touch_look(Vector2(50, 50))
	_input.enabled = false
	assert_eq(_input.move_vector(), Vector2.ZERO)
	assert_eq(_input.consume_look(), Vector2.ZERO)
	assert_false(_input.is_pressed("sprint"))


func test_clear_drops_held_state() -> void:
	_input.set_touch_action("crouch", true)
	_input.set_touch_move(Vector2(1, 0))
	_input.clear()
	assert_false(_input.is_pressed("crouch"), "clear() left an action held")
	assert_eq(_input.move_vector(), Vector2.ZERO, "clear() left movement applied")


# ---------------------------------------------------------------------------
# Noise contract with the AI
# ---------------------------------------------------------------------------

func test_movement_noise_is_ordered() -> void:
	# The AI's hearing depends on this ordering; if it inverts, crouching
	# becomes the loudest thing the player can do.
	assert_true(Player.NOISE_CROUCH < Player.NOISE_WALK,
			"crouching is not quieter than walking")
	assert_true(Player.NOISE_WALK < Player.NOISE_SPRINT,
			"walking is not quieter than sprinting")
	assert_between(Player.NOISE_SPRINT, 0.0, 1.0, "sprint noise must stay normalised")


func test_movement_speeds_are_ordered() -> void:
	assert_true(Player.CROUCH_SPEED < Player.WALK_SPEED)
	assert_true(Player.WALK_SPEED < Player.SPRINT_SPEED)
	assert_true(Player.CROUCH_HEIGHT < Player.STAND_HEIGHT)
