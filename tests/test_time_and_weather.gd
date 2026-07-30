extends TestCase
## Covers the day/night cycle and the weather model.
##
## Both systems are read by the AI (light level, hearing, visibility) and by the
## audio bed, so their outputs are effectively an API. These tests pin that API
## down rather than checking that the sky looks nice.

var _time: TimeOfDay
var _weather: WeatherSystem
var _environment: Environment
var _sky_material: ShaderMaterial
var _sun: DirectionalLight3D
var _moon: DirectionalLight3D


func before_all() -> void:
	AssetFoundry.warm_up_blocking()
	AudioDirector.warm_up_blocking()
	GameState.new_game(0, 13579)


func before_each() -> void:
	_sun = DirectionalLight3D.new()
	_moon = DirectionalLight3D.new()
	_environment = Environment.new()
	_environment.fog_enabled = true
	_sky_material = ShaderMaterial.new()
	_sky_material.shader = load("res://shaders/sky.gdshader")

	tree.root.add_child(_sun)
	tree.root.add_child(_moon)

	_time = TimeOfDay.new()
	_time.paused = true
	tree.root.add_child(_time)
	_time.setup(_sun, _moon, _environment, _sky_material)

	_weather = WeatherSystem.new()
	tree.root.add_child(_weather)
	_weather.setup(_environment, _sky_material, AssetFoundry.material("rain") as ShaderMaterial, _time)


func after_each() -> void:
	for node in [_weather, _time, _sun, _moon]:
		if is_instance_valid(node):
			node.free()


# ---------------------------------------------------------------------------
# Time of day
# ---------------------------------------------------------------------------

func test_noon_is_day_and_midnight_is_night() -> void:
	_time.set_hour(12.0)
	assert_almost(_time.day_factor, 1.0, 0.05, "noon should be fully lit")
	assert_false(_time.is_night(), "noon reported as night")
	_time.set_hour(0.5)
	assert_almost(_time.day_factor, 0.0, 0.05, "midnight should be fully dark")
	assert_true(_time.is_night(), "midnight not reported as night")


func test_sun_is_above_the_horizon_only_during_the_day() -> void:
	for hour in [7.0, 10.0, 12.0, 15.0, 18.0]:
		_time.set_hour(hour)
		assert_true(_time.sun_direction.y > 0.0, "sun is below the horizon at %02.0f:00" % hour)
	for hour in [21.0, 23.0, 1.0, 3.0, 5.0]:
		_time.set_hour(hour)
		assert_true(_time.sun_direction.y < 0.0, "sun is above the horizon at %02.0f:00" % hour)


func test_moon_opposes_the_sun() -> void:
	for hour in [3.0, 9.0, 15.0, 21.0]:
		_time.set_hour(hour)
		assert_almost(_time.sun_direction.dot(_time.moon_direction), -1.0, 0.001,
				"moon is not opposite the sun at %02.0f:00" % hour)


func test_twilight_peaks_at_the_terminator() -> void:
	_time.set_hour(12.0)
	var noon := _time.sunset_factor
	_time.set_hour(18.6)
	var dusk := _time.sunset_factor
	assert_true(dusk > noon + 0.5, "dusk warmth (%.2f) barely differs from noon (%.2f)" % [dusk, noon])


func test_phases_cover_the_whole_day_and_change() -> void:
	var seen := {}
	var hour := 0.0
	while hour < 24.0:
		_time.set_hour(hour)
		var phase := _time.phase()
		assert_true(TimeOfDay.PHASES.has(phase), "unknown phase '%s' at %.1f" % [phase, hour])
		seen[phase] = true
		hour += 0.25
	for required in ["deep_night", "dawn", "day", "dusk", "night"]:
		assert_has(seen, required, "phase '%s' never occurs" % required)


func test_clock_rolls_over_into_the_next_day() -> void:
	_time.set_hour(23.5)
	var day := GameState.day
	_time.advance(1.0)
	assert_eq(GameState.day, day + 1, "day did not advance past midnight")
	assert_between(GameState.time_of_day, 0.0, 1.0, "hour did not wrap")


func test_light_level_is_lowest_at_night() -> void:
	_time.set_hour(12.0)
	var day_light := _time.light_level()
	_time.set_hour(1.0)
	var night_light := _time.light_level()
	assert_true(night_light < day_light * 0.4,
			"night light %.3f is not meaningfully darker than day %.3f" % [night_light, day_light])
	assert_true(night_light > 0.0, "night must not be perfectly black")


func test_sun_shadows_switch_off_after_dark() -> void:
	_time.set_hour(12.0)
	assert_true(_sun.visible, "sun light hidden at noon")
	_time.set_hour(1.0)
	assert_false(_sun.shadow_enabled, "sun still casting shadows at 01:00")


# ---------------------------------------------------------------------------
# Weather
# ---------------------------------------------------------------------------

func test_states_are_well_formed() -> void:
	for id: String in WeatherSystem.STATES:
		var state: Dictionary = WeatherSystem.STATES[id]
		for key in ["name", "cloud", "rain", "fog", "wind", "thunder", "min_minutes"]:
			assert_has(state, key, "weather '%s' is missing '%s'" % [id, key])
		assert_has(WeatherSystem.SEVERITY, id, "weather '%s' has no severity rank" % id)


func test_setting_a_state_applies_immediately_when_asked() -> void:
	_weather.set_state("storm", true)
	assert_eq(_weather.state_id, "storm")
	assert_almost(_weather.rain, 1.0, 0.001, "immediate transition did not apply rain")
	assert_true(_weather.wind_strength > 1.0, "storm wind did not apply")


func test_transitions_are_gradual() -> void:
	_weather.set_state("clear", true)
	_weather.set_state("storm", false)
	# One frame of blending must not complete the change.
	_weather._process(0.016)
	assert_true(_weather.rain < 0.2,
			"weather snapped to %.2f rain in a single frame" % _weather.rain)
	for i in 400:
		_weather._process(0.05)
	assert_true(_weather.rain > 0.8, "weather never reached the storm (%.2f)" % _weather.rain)


func test_rain_makes_the_world_wet_and_drying_is_slower() -> void:
	_weather.set_state("rain", true)
	for i in 60:
		_weather._process(0.1)
	var wet := _weather.wetness
	assert_true(wet > 0.4, "rain did not wet the ground (%.2f)" % wet)

	_weather.set_state("clear", true)
	_weather.wetness = wet
	for i in 60:
		_weather._process(0.1)
	assert_true(_weather.wetness < wet, "ground never dries")
	assert_true(_weather.wetness > wet * 0.5,
			"ground dried from %.2f to %.2f in six seconds" % [wet, _weather.wetness])


func test_weather_degrades_perception() -> void:
	_weather.set_state("clear", true)
	var clear_visibility := _weather.visibility_factor()
	var clear_hearing := _weather.hearing_factor()

	_weather.set_state("storm", true)
	assert_true(_weather.visibility_factor() < clear_visibility,
			"a storm should cut visibility")
	assert_true(_weather.hearing_factor() < clear_hearing,
			"a storm should cut hearing")
	assert_true(_weather.noise_masking() > 0.2,
			"a storm should mask the player's noise")

	_weather.set_state("fog", true)
	assert_true(_weather.visibility_factor() < clear_visibility * 0.75,
			"heavy fog barely changed visibility (%.2f)" % _weather.visibility_factor())


func test_perception_factors_stay_in_range() -> void:
	for id: String in WeatherSystem.STATES:
		_weather.set_state(id, true)
		assert_between(_weather.visibility_factor(), 0.1, 1.0, "visibility in '%s'" % id)
		assert_between(_weather.hearing_factor(), 0.1, 1.0, "hearing in '%s'" % id)
		assert_between(_weather.noise_masking(), 0.0, 1.0, "masking in '%s'" % id)


func test_wind_direction_stays_normalised_and_horizontal() -> void:
	_weather.set_state("gale", true)
	for i in 200:
		_weather._process(0.1)
		assert_almost(_weather.wind_direction.length(), 1.0, 0.01, "wind vector denormalised")
		assert_almost(_weather.wind_direction.y, 0.0, 0.001, "wind acquired a vertical component")


func test_transitions_prefer_neighbouring_severities() -> void:
	# Sampled rather than asserted per-draw: the point is that clear weather
	# rarely jumps straight to a storm, not that it never can.
	_weather.set_state("clear", true)
	var jumps := 0
	for i in 400:
		var next := _weather._pick_next()
		if absi(int(WeatherSystem.SEVERITY[next]) - int(WeatherSystem.SEVERITY["clear"])) > 2:
			jumps += 1
	assert_true(float(jumps) / 400.0 < 0.12,
			"%d of 400 transitions from clear were extreme jumps" % jumps)


func test_locking_pins_the_weather() -> void:
	_weather.lock_to("fog")
	_weather._time_in_state = 100000.0
	_weather._process(0.016)
	assert_eq(_weather.state_id, "fog", "locked weather changed anyway")
	_weather.unlock()
	assert_false(_weather.locked)
