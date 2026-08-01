extends Node
## Mixing, ambience layering and adaptive music.
##
## Three responsibilities:
##  1. Own the bus graph (created in code so no .tres has to stay in sync).
##  2. Cross-fade an ambience *bed* assembled from independent layers — wind,
##     rain, water, insects, sub-drone, room tone — whose target volumes are
##     driven by time of day, weather, biome and interior/exterior state.
##  3. Cross-fade musical stems against the horror director's tension value
##     instead of playing linear tracks, so the score never restarts abruptly.
##
## Sounds themselves come from AudioSynth. Nothing is loaded from disk.

const BUSES := ["Music", "Ambience", "SFX", "Voice", "Interior"]

## Ambience layers and the AudioSynth call that builds each one.
const LAYERS := ["wind", "rain", "water", "insects", "drone", "room"]

## Musical stems, ordered by the tension they belong to.
const STEMS := ["calm", "unease", "dread", "chase"]

## Number of pre-generated variants per repeated sound.
const FOOTSTEP_VARIANTS := 3
const WHISPER_VARIANTS := 3

const FADE_SPEED := 1.6          ## dB-domain lerp speed for ambience layers
const MUSIC_FADE_SPEED := 0.55
const POOL_SIZE_3D := 20
const POOL_SIZE_2D := 8
const SILENCE_DB := -60.0

signal library_ready()

var is_ready: bool = false
var audio_unlocked: bool = false

var _library: Dictionary = {}
var _layer_players: Dictionary = {}       ## layer -> AudioStreamPlayer
var _layer_targets: Dictionary = {}       ## layer -> 0..1
var _layer_current: Dictionary = {}
var _stem_players: Dictionary = {}
var _stem_targets: Dictionary = {}
var _stem_current: Dictionary = {}
var _pool_3d: Array[AudioStreamPlayer3D] = []
var _pool_2d: Array[AudioStreamPlayer] = []
var _pool_3d_next := 0
var _pool_2d_next := 0

var _music_enabled := true
var _interior_amount := 0.0
var _muffle_amount := 0.0
var _low_pass: AudioEffectLowPassFilter
var _reverb: AudioEffectReverb


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_buses()
	_build_players()
	EventBus.settings_changed.connect(_on_settings_changed)
	_apply_volumes()


# ---------------------------------------------------------------------------
# Bus graph
# ---------------------------------------------------------------------------

func _build_buses() -> void:
	for bus_name in BUSES:
		if AudioServer.get_bus_index(bus_name) != -1:
			continue
		var index := AudioServer.bus_count
		AudioServer.add_bus(index)
		AudioServer.set_bus_name(index, bus_name)
		AudioServer.set_bus_send(index, "Master")

	# Interior colouration: a reverb plus a gentle low-pass, both dry by default
	# and dialled in when the player steps inside a structure or hides.
	var interior := AudioServer.get_bus_index("Interior")
	if AudioServer.get_bus_effect_count(interior) == 0:
		_reverb = AudioEffectReverb.new()
		_reverb.room_size = 0.55
		_reverb.damping = 0.65
		_reverb.wet = 0.0
		_reverb.dry = 1.0
		AudioServer.add_bus_effect(interior, _reverb)
	else:
		_reverb = AudioServer.get_bus_effect(interior, 0) as AudioEffectReverb

	var ambience := AudioServer.get_bus_index("Ambience")
	if AudioServer.get_bus_effect_count(ambience) == 0:
		_low_pass = AudioEffectLowPassFilter.new()
		_low_pass.cutoff_hz = 20000.0
		AudioServer.add_bus_effect(ambience, _low_pass)
	else:
		_low_pass = AudioServer.get_bus_effect(ambience, 0) as AudioEffectLowPassFilter


func _build_players() -> void:
	for layer: String in LAYERS:
		var player := AudioStreamPlayer.new()
		player.bus = "Ambience"
		player.volume_db = SILENCE_DB
		player.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(player)
		_layer_players[layer] = player
		_layer_targets[layer] = 0.0
		_layer_current[layer] = 0.0

	for stem: String in STEMS:
		var player := AudioStreamPlayer.new()
		player.bus = "Music"
		player.volume_db = SILENCE_DB
		player.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(player)
		_stem_players[stem] = player
		_stem_targets[stem] = 0.0
		_stem_current[stem] = 0.0

	for i in POOL_SIZE_3D:
		var p3 := AudioStreamPlayer3D.new()
		p3.bus = "SFX"
		p3.max_distance = 60.0
		p3.unit_size = 6.0
		p3.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		add_child(p3)
		_pool_3d.append(p3)

	for i in POOL_SIZE_2D:
		var p2 := AudioStreamPlayer.new()
		p2.bus = "SFX"
		p2.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(p2)
		_pool_2d.append(p2)


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------

## Generate every sound. Yields between groups like AssetFoundry.warm_up().
func warm_up() -> void:
	if is_ready:
		library_ready.emit()
		return
	var groups: Array[Callable] = [
		func() -> void: _build_beds(),
		func() -> void: _build_footsteps(),
		func() -> void: _build_world_sfx(),
		func() -> void: _build_wildlife(),
		func() -> void: _build_horror(),
		func() -> void: _build_ui_and_music(),
	]
	for i in groups.size():
		groups[i].call()
		await get_tree().process_frame
	_assign_layer_streams()
	is_ready = true
	library_ready.emit()
	Log.info("audio", "library ready: %d sounds" % _library.size())


func warm_up_blocking() -> void:
	if is_ready:
		return
	_build_beds()
	_build_footsteps()
	_build_world_sfx()
	_build_wildlife()
	_build_horror()
	_build_ui_and_music()
	_assign_layer_streams()
	is_ready = true


func _build_beds() -> void:
	# One buffer per bed. Character variation (a gale versus a breeze, a creek
	# versus a river) comes from pitch and level at playback, which costs
	# nothing, rather than from near-duplicate buffers, which cost boot time.
	_library["bed_wind"] = AudioSynth.wind_bed(6.0, 11)
	_library["bed_rain_light"] = AudioSynth.rain_bed(4.0, 13, 0.35)
	_library["bed_rain_heavy"] = AudioSynth.rain_bed(4.0, 14, 1.0)
	_library["bed_water"] = AudioSynth.water_bed(5.0, 15, 0.45)
	_library["bed_insects"] = AudioSynth.insect_bed(4.0, 17)
	_library["bed_drone"] = AudioSynth.sub_drone(6.0, 41.0, 0.0, 18)
	_library["bed_drone_wrong"] = AudioSynth.sub_drone(6.0, 38.5, 1.0, 19)
	_library["bed_room"] = AudioSynth.room_tone(4.0, 20, 0.2)


func _build_footsteps() -> void:
	# Three variations per surface, further varied by pitch at playback, so
	# repeated steps never machine-gun.
	for surface in ["loam", "gravel", "wood", "stone", "water", "metal", "moss"]:
		for v in FOOTSTEP_VARIANTS:
			_library["step_%s_%d" % [surface, v]] = AudioSynth.footstep(surface, 3100 + v * 7, 1.0)
	for v in 2:
		_library["cloth_%d" % v] = AudioSynth.cloth_rustle(3300 + v * 11)


func _build_world_sfx() -> void:
	for v in 2:
		_library["creak_door_%d" % v] = AudioSynth.creak(4100 + v * 13, 1.4, 95.0)
		_library["creak_wood_%d" % v] = AudioSynth.creak(4200 + v * 17, 1.9, 62.0)
		_library["creak_tree_%d" % v] = AudioSynth.creak(4300 + v * 19, 2.6, 48.0)
	_library["thunder_near"] = AudioSynth.thunder(4400, 0.12)
	_library["thunder_far"] = AudioSynth.thunder(4500, 0.85)
	_library["static"] = AudioSynth.static_noise(4700, 1.8, 0.5)
	_library["switch"] = AudioSynth.ui_tone(1400.0, 0.05, 0.8)
	_library["pickup"] = AudioSynth.ui_tone(760.0, 0.14, 0.2)
	_library["door_latch"] = AudioSynth.footstep("wood", 4900, 0.7)
	_library["metal_clank"] = AudioSynth.footstep("metal", 5000, 1.2)


func _build_wildlife() -> void:
	for v in 2:
		_library["owl_%d" % v] = AudioSynth.owl_hoot(5100 + v * 23)
		_library["crow_%d" % v] = AudioSynth.crow_caw(5200 + v * 29)
		_library["deer_%d" % v] = AudioSynth.deer_snort(5300 + v * 31)
		_library["scurry_%d" % v] = AudioSynth.small_scurry(5400 + v * 37)
	_library["flap_small"] = AudioSynth.wing_flap(5500, 0.2)
	_library["flap_large"] = AudioSynth.wing_flap(5600, 0.85)


func _build_horror() -> void:
	for v in WHISPER_VARIANTS:
		_library["whisper_%d" % v] = AudioSynth.whisper(6100 + v * 41, 2.4, 0.55 + v * 0.15, 0.9 + v * 0.08)
	_library["whisper_close"] = AudioSynth.whisper(6200, 1.6, 0.85, 1.15)
	_library["whisper_name"] = AudioSynth.whisper(6300, 1.1, 0.95, 1.0)
	_library["stinger_soft"] = AudioSynth.stinger(6400, 0.25)
	_library["stinger_hard"] = AudioSynth.stinger(6500, 0.9)
	_library["heartbeat_slow"] = AudioSynth.heartbeat(64.0, 2)
	_library["heartbeat_fast"] = AudioSynth.heartbeat(128.0, 2)
	_library["breath"] = AudioSynth.whisper(6600, 1.3, 0.15, 0.6)
	_library["scream_far"] = AudioSynth.whisper(6700, 2.0, 0.9, 1.6)


func _build_ui_and_music() -> void:
	_library["ui_move"] = AudioSynth.ui_tone(520.0, 0.05, 0.0)
	_library["ui_confirm"] = AudioSynth.ui_tone(680.0, 0.12, 0.15)
	_library["ui_back"] = AudioSynth.ui_tone(340.0, 0.12, 0.15)
	_library["ui_deny"] = AudioSynth.ui_tone(180.0, 0.18, 0.5)

	# D minor material. Each stem adds a more crowded, more detuned chord; the
	# chase stem is a tritone stack that never resolves.
	_library["music_calm"] = AudioSynth.music_stem(73.42, [0.0, 12.0, 19.0], 7100, 7.0, 0.35, 0.0)
	_library["music_unease"] = AudioSynth.music_stem(73.42, [0.0, 3.0, 14.0], 7200, 7.0, 0.45, 0.25)
	_library["music_dread"] = AudioSynth.music_stem(58.27, [0.0, 1.0, 6.0], 7300, 7.0, 0.55, 0.6)
	_library["music_chase"] = AudioSynth.music_stem(48.99, [0.0, 6.0, 11.0, 18.0], 7400, 6.0, 0.85, 1.0)


func _assign_layer_streams() -> void:
	set_layer_stream("wind", "bed_wind")
	set_layer_stream("rain", "bed_rain_light")
	set_layer_stream("water", "bed_water")
	set_layer_stream("insects", "bed_insects")
	set_layer_stream("drone", "bed_drone")
	set_layer_stream("room", "bed_room")
	for stem: String in STEMS:
		var player: AudioStreamPlayer = _stem_players[stem]
		player.stream = _library.get("music_%s" % stem)
		player.play()


func has(key: String) -> bool:
	return _library.has(key)


func stream(key: String) -> AudioStream:
	return _library.get(key)


# ---------------------------------------------------------------------------
# Ambience
# ---------------------------------------------------------------------------

## Swap the stream backing an ambience layer without a click (fades through
## silence when the layer is currently audible).
func set_layer_stream(layer: String, key: String) -> void:
	if not _layer_players.has(layer):
		return
	var player: AudioStreamPlayer = _layer_players[layer]
	var new_stream: AudioStream = _library.get(key)
	if new_stream == null or player.stream == new_stream:
		return
	player.stream = new_stream
	if not player.playing:
		player.play()
	else:
		# Restart at a random offset so two layers never phase-lock.
		player.play(randf() * maxf(new_stream.get_length() - 0.5, 0.0))


## 0..1 target loudness for an ambience layer.
func set_layer(layer: String, amount: float) -> void:
	if _layer_targets.has(layer):
		_layer_targets[layer] = clampf(amount, 0.0, 1.0)


## Re-pitch an ambience layer. This is how one wind buffer covers everything
## from a still night to a gale, and one water buffer covers a creek, a river
## and a waterfall, without generating separate recordings for each.
func set_layer_pitch(layer: String, pitch: float) -> void:
	var player: AudioStreamPlayer = _layer_players.get(layer)
	if player != null:
		player.pitch_scale = clampf(pitch, 0.4, 2.2)


func layer_level(layer: String) -> float:
	return float(_layer_current.get(layer, 0.0))


## Interior colouration, 0 outdoors, 1 fully enclosed.
func set_interior(amount: float) -> void:
	_interior_amount = clampf(amount, 0.0, 1.0)


## Muffling applied while hiding or stunned.
func set_muffle(amount: float) -> void:
	_muffle_amount = clampf(amount, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Music
# ---------------------------------------------------------------------------

## Map a 0..1 tension value onto cross-faded stems. The curve deliberately keeps
## two stems audible at once through most of the range so transitions are felt
## rather than heard.
func set_tension(tension: float) -> void:
	var t := clampf(tension, 0.0, 1.0)
	_stem_targets["calm"] = clampf(1.0 - t * 2.4, 0.0, 1.0)
	_stem_targets["unease"] = clampf(1.0 - absf(t - 0.38) * 3.1, 0.0, 1.0)
	_stem_targets["dread"] = clampf(1.0 - absf(t - 0.74) * 3.4, 0.0, 1.0)
	_stem_targets["chase"] = clampf((t - 0.80) * 5.0, 0.0, 1.0)


func set_music_enabled(enabled: bool) -> void:
	_music_enabled = enabled


# ---------------------------------------------------------------------------
# One-shots
# ---------------------------------------------------------------------------

## Play a positioned sound from the pool. Returns the player so callers can
## adjust it (e.g. attach it to a moving node).
func play_3d(key: String, position: Vector3, volume_db: float = 0.0,
		pitch: float = 1.0, bus: String = "SFX", max_distance: float = 60.0) -> AudioStreamPlayer3D:
	var s: AudioStream = _library.get(key)
	if s == null:
		Log.warn("audio", "missing sound '%s'" % key)
		return null
	var player := _pool_3d[_pool_3d_next]
	_pool_3d_next = (_pool_3d_next + 1) % _pool_3d.size()
	player.stream = s
	player.global_position = position
	player.volume_db = volume_db
	player.pitch_scale = clampf(pitch, 0.05, 4.0)
	player.bus = bus
	player.max_distance = max_distance
	player.play()
	return player


func play_2d(key: String, volume_db: float = 0.0, pitch: float = 1.0,
		bus: String = "SFX") -> AudioStreamPlayer:
	var s: AudioStream = _library.get(key)
	if s == null:
		Log.warn("audio", "missing sound '%s'" % key)
		return null
	var player := _pool_2d[_pool_2d_next]
	_pool_2d_next = (_pool_2d_next + 1) % _pool_2d.size()
	player.stream = s
	player.volume_db = volume_db
	player.pitch_scale = clampf(pitch, 0.05, 4.0)
	player.bus = bus
	player.play()
	return player


## Pick one of the numbered variants of a sound (e.g. `step_gravel_*`).
func play_variant_3d(prefix: String, variants: int, position: Vector3,
		volume_db: float = 0.0, pitch_jitter: float = 0.12) -> AudioStreamPlayer3D:
	var key := "%s_%d" % [prefix, randi() % maxi(variants, 1)]
	return play_3d(key, position, volume_db, 1.0 + randf_range(-pitch_jitter, pitch_jitter))


func play_ui(key: String) -> void:
	play_2d(key, -6.0, 1.0, "SFX")


# ---------------------------------------------------------------------------
# Frame update
# ---------------------------------------------------------------------------

func _process(delta: float) -> void:
	for layer: String in LAYERS:
		var target: float = _layer_targets[layer]
		var current: float = _layer_current[layer]
		current = move_toward(current, target, FADE_SPEED * delta)
		_layer_current[layer] = current
		var player: AudioStreamPlayer = _layer_players[layer]
		player.volume_db = _linear_to_db(current)
		# Silent layers are stopped so they cost no mixing time on mobile.
		if current <= 0.001 and player.playing:
			player.stop()
		elif current > 0.001 and not player.playing and player.stream != null:
			player.play()

	var music_scale := 1.0 if _music_enabled else 0.0
	for stem: String in STEMS:
		var target: float = float(_stem_targets[stem]) * music_scale
		var current: float = _stem_current[stem]
		current = move_toward(current, target, MUSIC_FADE_SPEED * delta)
		_stem_current[stem] = current
		var player: AudioStreamPlayer = _stem_players[stem]
		player.volume_db = _linear_to_db(current)
		if current <= 0.001 and player.playing:
			player.stop()
		elif current > 0.001 and not player.playing and player.stream != null:
			player.play()

	if _reverb != null:
		_reverb.wet = _interior_amount * 0.45
		_reverb.dry = 1.0 - _interior_amount * 0.25
		_reverb.room_size = lerpf(0.35, 0.75, _interior_amount)
	if _low_pass != null:
		var cutoff := lerpf(20000.0, 900.0, maxf(_muffle_amount, _interior_amount * 0.35))
		_low_pass.cutoff_hz = cutoff
	var sfx_bus := AudioServer.get_bus_index("SFX")
	if sfx_bus != -1:
		AudioServer.set_bus_volume_db(sfx_bus,
			_linear_to_db(float(Settings.get_value("volume_sfx")) * lerpf(1.0, 0.55, _muffle_amount)))


func _linear_to_db(linear: float) -> float:
	if linear <= 0.0009:
		return SILENCE_DB
	return maxf(SILENCE_DB, linear_to_db(clampf(linear, 0.0, 1.0)))


# ---------------------------------------------------------------------------
# Settings & browser audio unlock
# ---------------------------------------------------------------------------

func _apply_volumes() -> void:
	_set_bus_volume("Master", float(Settings.get_value("volume_master")))
	_set_bus_volume("Music", float(Settings.get_value("volume_music")))
	_set_bus_volume("Ambience", float(Settings.get_value("volume_ambience")))
	_set_bus_volume("SFX", float(Settings.get_value("volume_sfx")))
	_set_bus_volume("Voice", float(Settings.get_value("volume_voice")))


func _set_bus_volume(bus_name: String, linear: float) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index == -1:
		return
	AudioServer.set_bus_volume_db(index, _linear_to_db(linear))
	AudioServer.set_bus_mute(index, linear <= 0.0009)


func _on_settings_changed(key: String, _value: Variant) -> void:
	if key.begins_with("volume_"):
		_apply_volumes()


## Browsers refuse to start an AudioContext without a user gesture, and iOS
## Safari is the strictest about it. The bootstrap screen calls this from the
## player's first tap/click; playing one silent sound is enough to unlock it.
func unlock_audio() -> void:
	if audio_unlocked:
		return
	audio_unlocked = true
	var index := AudioServer.get_bus_index("Master")
	if index != -1:
		AudioServer.set_bus_mute(index, false)
	# The unlock gesture happens on the title card, *before* the library has
	# been synthesised, so there may be nothing to play yet. Un-muting the bus
	# is what actually resumes the context; the silent blip is belt and braces.
	if has("ui_move"):
		play_2d("ui_move", -40.0)
	Log.info("audio", "audio context unlocked")
