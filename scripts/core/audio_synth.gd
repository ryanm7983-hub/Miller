class_name AudioSynth
extends RefCounted
## Procedural audio synthesis.
##
## Every sound in the game is generated here into an AudioStreamWAV at boot.
## Same reasoning as the mesh and texture factories: nothing to stream, nothing
## to decode, no licensing surface. It also gives the horror systems something
## recorded audio cannot — sounds parameterised at runtime.
##
## PERFORMANCE
## This code runs once at boot, but it runs *in WebAssembly on a phone*, where
## GDScript is several times slower than native. Three rules keep it inside its
## budget (~0.7 s native, ~2 s on a mid-range phone):
##
##   1. Sample rates are chosen per sound class, not globally. Wind, rain and
##      music are band-limited well below 5 kHz, so they are generated at 11025
##      or 8000 Hz and cost a quarter of what 44.1 kHz would.
##   2. Filters are *inlined* inside the hot loops. The `BandPass`/`LowPass`
##      classes below document the maths and are used by cold paths, but a
##      dynamic method call per sample per filter was measured at roughly two
##      thirds of total synthesis time, so the beds hand-roll the same two
##      lines.
##   3. Oscillator-heavy sounds read a shared sine table instead of calling
##      `sin()` per partial per sample.
##
## Variation is produced at *playback* time by pitch and volume, not by
## generating near-duplicate buffers.

const RATE_BED := 11025    ## looping ambience: everything here is low-passed
const RATE_MUSIC := 8000   ## drones and stems; content lives under 1 kHz
const RATE_SFX := 16000    ## short one-shots
const RATE_DETAIL := 22050 ## the few sounds that need real high end

const TABLE_BITS := 11
const TABLE_SIZE := 1 << TABLE_BITS  # 2048
const TABLE_MASK := TABLE_SIZE - 1

static var _sine: PackedFloat32Array = _build_sine_table()


static func _build_sine_table() -> PackedFloat32Array:
	var table := PackedFloat32Array()
	table.resize(TABLE_SIZE)
	for i in TABLE_SIZE:
		table[i] = sin(TAU * float(i) / float(TABLE_SIZE))
	return table


# ---------------------------------------------------------------------------
# DSP primitives
#
# These document the filter shapes used throughout. Hot loops inline the same
# arithmetic; cold paths (one-shots that run a handful of times) use the classes.
# ---------------------------------------------------------------------------

## One-pole low-pass. `cutoff` is normalised, roughly cutoff_hz / nyquist.
class LowPass:
	var _z := 0.0
	var _a := 0.2
	func _init(cutoff: float) -> void:
		_a = clampf(cutoff, 0.001, 0.999)
	func process(x: float) -> float:
		_z += _a * (x - _z)
		return _z


## Two-pole state-variable band-pass.
class BandPass:
	var _low := 0.0
	var _band := 0.0
	var _f := 0.1
	var _q := 0.4
	func _init(freq_hz: float, rate: float, q: float = 0.4) -> void:
		# Inner classes do not inherit the outer script's scope, so the shared
		# tuning helper has to be addressed through the class name.
		_f = AudioSynth.svf_coefficient(freq_hz, rate)
		_q = clampf(q, 0.02, 1.0)
	func process(x: float) -> float:
		var high := x - _low - _q * _band
		_band += _f * high
		_low += _f * _band
		return _band


## Frequency coefficient for the state-variable filter, shared by the inlined
## copies so there is exactly one definition of the tuning.
static func svf_coefficient(freq_hz: float, rate: float) -> float:
	return clampf(2.0 * sin(PI * clampf(freq_hz, 20.0, rate * 0.45) / rate), 0.0001, 1.2)


static func _rng(seed_value: int) -> RandomNumberGenerator:
	var r := RandomNumberGenerator.new()
	r.seed = seed_value
	return r


## Pack a float buffer (-1..1) into a 16-bit PCM AudioStreamWAV.
static func _to_stream(samples: PackedFloat32Array, rate: int, looping: bool) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	var frames := samples.size()
	var data := PackedByteArray()
	data.resize(frames * 2)
	for i in frames:
		data.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.stereo = false
	stream.data = data
	if looping:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = maxi(frames - 1, 0)
	return stream


## Cosine cross-fade across the loop seam so a looped bed has no click.
static func _apply_loop_crossfade(buffer: PackedFloat32Array, fade_samples: int) -> void:
	var n := buffer.size()
	if fade_samples <= 0 or n < fade_samples * 2:
		return
	for i in fade_samples:
		var w := 0.5 - 0.5 * cos(float(i) / float(fade_samples) * PI)
		var head := buffer[i]
		var tail := buffer[n - fade_samples + i]
		buffer[i] = lerpf(tail, head, w)
		buffer[n - fade_samples + i] = lerpf(tail, head, w)


static func _envelope(t: float, duration: float, attack: float, release: float) -> float:
	if t < attack:
		return t / maxf(attack, 0.0001)
	if t > duration - release:
		return maxf(0.0, (duration - t) / maxf(release, 0.0001))
	return 1.0


# ---------------------------------------------------------------------------
# Ambience beds (looping)
# ---------------------------------------------------------------------------

## Wind through pines: a low body and a high hiss, both band-passed noise, each
## with its own slow envelope. The two envelopes drifting against each other are
## what gives real wind its breathing quality.
static func wind_bed(duration: float = 6.0, seed_value: int = 1) -> AudioStreamWAV:
	var rate := RATE_BED
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)

	var f_body := svf_coefficient(190.0, rate)
	var f_hiss := svf_coefficient(1750.0, rate)
	var low_b := 0.0
	var band_b := 0.0
	var low_h := 0.0
	var band_h := 0.0
	var smooth := 0.0
	var inv_rate := 1.0 / float(rate)

	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var high_b := white - low_b - 0.85 * band_b
		band_b += f_body * high_b
		low_b += f_body * band_b
		var high_h := white - low_h - 0.55 * band_h
		band_h += f_hiss * high_h
		low_h += f_hiss * band_h

		var gust := 0.55 + 0.45 * sin(t * 0.31 + sin(t * 0.11) * 2.0)
		var flurry := 0.6 + 0.4 * sin(t * 1.7 + 1.3)
		var s := band_b * 2.4 * gust + band_h * 0.55 * gust * flurry
		smooth += 0.35 * (s - smooth)
		buf[i] = smooth * 0.6

	_apply_loop_crossfade(buf, int(rate * 0.4))
	return _to_stream(buf, rate, true)


## Rain. Hiss plus body plus discrete droplet transients — without the
## droplets it reads as tape hiss rather than weather.
static func rain_bed(duration: float = 5.0, seed_value: int = 2, intensity: float = 1.0) -> AudioStreamWAV:
	var rate := RATE_BED
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)

	var f_hiss := svf_coefficient(lerpf(2200.0, 3300.0, intensity), rate)
	var f_body := svf_coefficient(620.0, rate)
	var low_h := 0.0
	var band_h := 0.0
	var low_b := 0.0
	var band_b := 0.0
	var hiss_gain := 0.55 + 0.7 * intensity
	var body_gain := 0.45 * intensity

	# Droplets live in a fixed-capacity ring: no per-sample allocation. The ring
	# is scanned every sample, so its size is a direct multiplier on generation
	# cost — ten simultaneous droplets is already past the point where more are
	# audible against the hiss.
	const MAX_DROPS := 10
	var drop_phase := PackedFloat32Array()
	var drop_freq := PackedFloat32Array()
	drop_phase.resize(MAX_DROPS)
	drop_freq.resize(MAX_DROPS)
	for d in MAX_DROPS:
		drop_phase[d] = -1.0
	var drop_cursor := 0
	var inv_rate := 1.0 / float(rate)
	var spawn_chance := 0.006 * intensity

	for i in n:
		var white := rng.randf_range(-1.0, 1.0)
		var high_h := white - low_h - 0.35 * band_h
		band_h += f_hiss * high_h
		low_h += f_hiss * band_h
		var high_b := white - low_b - 0.7 * band_b
		band_b += f_body * high_b
		low_b += f_body * band_b
		var s := band_h * hiss_gain + band_b * body_gain

		if rng.randf() < spawn_chance:
			drop_phase[drop_cursor] = 0.0
			drop_freq[drop_cursor] = rng.randf_range(700.0, 2400.0)
			drop_cursor = (drop_cursor + 1) % MAX_DROPS
		for d in MAX_DROPS:
			var p := drop_phase[d]
			if p < 0.0:
				continue
			if p > 0.035:
				drop_phase[d] = -1.0
				continue
			s += sin(p * TAU * drop_freq[d]) * exp(-p * 130.0) * 0.30
			drop_phase[d] = p + inv_rate

		buf[i] = s * 0.5

	_apply_loop_crossfade(buf, int(rate * 0.25))
	return _to_stream(buf, rate, true)


## Running water. `depth` moves it from a shallow creek to a river/waterfall.
static func water_bed(duration: float = 5.0, seed_value: int = 3, depth: float = 0.5) -> AudioStreamWAV:
	var rate := RATE_BED
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)

	var f_low := svf_coefficient(lerpf(320.0, 110.0, depth), rate)
	var f_mid := svf_coefficient(lerpf(1400.0, 800.0, depth), rate)
	var f_high := svf_coefficient(lerpf(3600.0, 2400.0, depth), rate)
	var l0 := 0.0; var b0 := 0.0
	var l1 := 0.0; var b1 := 0.0
	var l2 := 0.0; var b2 := 0.0
	var g_low := 1.2 + depth * 1.8
	var g_high := 0.6 - depth * 0.3
	var inv_rate := 1.0 / float(rate)

	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var h0 := white - l0 - 0.8 * b0
		b0 += f_low * h0
		l0 += f_low * b0
		var h1 := white - l1 - 0.5 * b1
		b1 += f_mid * h1
		l1 += f_mid * b1
		var h2 := white - l2 - 0.35 * b2
		b2 += f_high * h2
		l2 += f_high * b2
		var burble := 0.75 + 0.25 * sin(t * 3.1 + sin(t * 0.7) * 3.0)
		buf[i] = (b0 * g_low + b1 * 0.9 * burble + b2 * g_high) * 0.42

	_apply_loop_crossfade(buf, int(rate * 0.3))
	return _to_stream(buf, rate, true)


## Night insects: overlapping trills from a handful of detuned voices.
static func insect_bed(duration: float = 4.0, seed_value: int = 4) -> AudioStreamWAV:
	var rate := RATE_BED
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var table := _sine

	var voices := 6
	var step := PackedFloat32Array()      # phase increment per sample, in table units
	var trill_step := PackedFloat32Array()
	var phase := PackedFloat32Array()
	var trill := PackedFloat32Array()
	for v in voices:
		# Nyquist at 11025 is 5512 Hz, so the chirps sit just under it.
		step.append(rng.randf_range(2800.0, 4900.0) / float(rate) * float(TABLE_SIZE))
		trill_step.append(rng.randf_range(11.0, 26.0) / float(rate) * float(TABLE_SIZE))
		phase.append(rng.randf() * float(TABLE_SIZE))
		trill.append(rng.randf() * float(TABLE_SIZE))

	for i in n:
		var s := 0.0
		for v in voices:
			var g := table[int(trill[v]) & TABLE_MASK]
			trill[v] += trill_step[v]
			phase[v] += step[v]
			if g <= 0.0:
				continue
			s += table[int(phase[v]) & TABLE_MASK] * g * g * 0.07
		buf[i] = s

	_apply_loop_crossfade(buf, int(rate * 0.2))
	return _to_stream(buf, rate, true)


## Sub-bass presence under the forest at night. Nearly inaudible on a phone
## speaker and deeply unpleasant on headphones, which is the intent.
static func sub_drone(duration: float = 6.0, root: float = 41.0, detune: float = 0.0,
		seed_value: int = 5) -> AudioStreamWAV:
	var rate := RATE_MUSIC
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var table := _sine

	var partials := [1.0, 2.0, 2.99, 4.02, 5.97]
	var gains := [1.0, 0.42, 0.25, 0.14, 0.08]
	var count := partials.size()
	var phase := PackedFloat32Array()
	var step := PackedFloat32Array()
	var gain := PackedFloat32Array()
	for p in count:
		var f: float = root * float(partials[p]) * (1.0 + detune * 0.012 * float(p))
		step.append(f / float(rate) * float(TABLE_SIZE))
		phase.append(0.0)
		gain.append(float(gains[p]))

	var inv_rate := 1.0 / float(rate)
	for i in n:
		var s := 0.0
		for p in count:
			s += table[int(phase[p]) & TABLE_MASK] * gain[p]
			phase[p] += step[p]
		var swell := 0.6 + 0.4 * sin(float(i) * inv_rate * 0.19)
		buf[i] = s * 0.18 * swell

	_apply_loop_crossfade(buf, int(rate * 0.5))
	return _to_stream(buf, rate, true)


## Interior room tone: a filtered noise floor and a faint mains hum.
static func room_tone(duration: float = 4.0, seed_value: int = 6, hum: float = 0.25) -> AudioStreamWAV:
	var rate := RATE_BED
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var z := 0.0
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		z += 0.06 * (rng.randf_range(-1.0, 1.0) - z)
		var s := z * 0.55 + sin(t * 50.0 * TAU) * 0.05 * hum + sin(t * 150.0 * TAU) * 0.018 * hum
		buf[i] = s * 0.4
	_apply_loop_crossfade(buf, int(rate * 0.3))
	return _to_stream(buf, rate, true)


# ---------------------------------------------------------------------------
# One-shots
# ---------------------------------------------------------------------------

## Footstep. `surface` selects filter shape, grit density and decay.
static func footstep(surface: String, seed_value: int, heaviness: float = 1.0) -> AudioStreamWAV:
	var rate := RATE_SFX
	var duration := 0.26
	var n := int(duration * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)

	var body_hz := 180.0
	var grit_hz := 2200.0
	var grit_amount := 0.45
	var decay := 28.0
	match surface:
		"gravel":
			body_hz = 300.0; grit_hz = 3400.0; grit_amount = 1.0; decay = 22.0
		"wood":
			body_hz = 150.0; grit_hz = 1200.0; grit_amount = 0.25; decay = 18.0
		"stone":
			body_hz = 260.0; grit_hz = 4200.0; grit_amount = 0.55; decay = 30.0
		"water":
			body_hz = 420.0; grit_hz = 1800.0; grit_amount = 0.8; decay = 14.0
		"metal":
			body_hz = 190.0; grit_hz = 5200.0; grit_amount = 0.4; decay = 9.0
		"moss":
			body_hz = 140.0; grit_hz = 1400.0; grit_amount = 0.3; decay = 34.0

	var f_body := svf_coefficient(body_hz, rate)
	var f_grit := svf_coefficient(grit_hz, rate)
	var lb := 0.0; var bb := 0.0
	var lg := 0.0; var bg := 0.0
	var inv_rate := 1.0 / float(rate)

	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var hb := white - lb - 0.55 * bb
		bb += f_body * hb
		lb += f_body * bb
		var hg := white - lg - 0.3 * bg
		bg += f_grit * hg
		lg += f_grit * bg
		var env := exp(-t * decay)
		buf[i] = (bb * 2.2 * env * heaviness + bg * grit_amount * exp(-t * decay * 1.7)) * 0.55
	return _to_stream(buf, rate, false)


## Cloth / gear rustle layered under movement.
static func cloth_rustle(seed_value: int) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(0.32 * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var f := svf_coefficient(3200.0, rate)
	var low := 0.0
	var band := 0.0
	for i in n:
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.25 * band
		band += f * high
		low += f * band
		buf[i] = band * sin(float(i) / float(n) * PI) * 0.35
	return _to_stream(buf, rate, false)


## Long pitch-swept resonance: doors, floorboards, trees under load. The
## stick-slip stutter is what separates a creak from a hum.
static func creak(seed_value: int, length: float = 1.4, base_hz: float = 90.0) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var table := _sine
	var direction := 1.0 if rng.randf() < 0.5 else -1.0
	var jitter := rng.randf_range(0.6, 1.4)
	var phase := 0.0
	var inv_rate := 1.0 / float(rate)
	var scale := float(TABLE_SIZE) * inv_rate

	for i in n:
		var t := float(i) * inv_rate
		var progress := t / length
		var freq := base_hz * (1.0 + direction * progress * 0.85) * jitter
		var stutter := 0.5 + 0.5 * sin(t * (14.0 + 30.0 * progress) * TAU)
		phase += freq * scale
		var idx := int(phase)
		var s := table[idx & TABLE_MASK] * 0.5
		s += table[(idx * 2) & TABLE_MASK] * 0.22
		s += table[(idx * 3) & TABLE_MASK] * 0.10
		buf[i] = s * _envelope(t, length, 0.05, length * 0.45) * stutter * 0.4
	return _to_stream(buf, rate, false)


## Thunder: a filtered crack followed by a long, irregular rumble.
static func thunder(seed_value: int, distance: float = 0.5) -> AudioStreamWAV:
	var rate := RATE_BED
	var length := lerpf(2.4, 5.5, distance)
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)

	var f_crack := svf_coefficient(lerpf(1400.0, 340.0, distance), rate)
	var f_rumble := svf_coefficient(lerpf(90.0, 45.0, distance), rate)
	var lc := 0.0; var bc := 0.0
	var lr := 0.0; var br := 0.0
	var body := 0.0
	var body_a := lerpf(0.5, 0.12, distance)
	var crack_decay := lerpf(9.0, 2.2, distance)
	var crack_gain := 1.0 - distance * 0.75
	var rumble_decay := lerpf(1.6, 0.55, distance)
	var inv_rate := 1.0 / float(rate)

	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var hc := white - lc - 0.4 * bc
		bc += f_crack * hc
		lc += f_crack * bc
		var hr := white - lr - 0.9 * br
		br += f_rumble * hr
		lr += f_rumble * br
		var crack_env := exp(-t * crack_decay) * crack_gain
		var rumble_env := (1.0 - exp(-t * 3.0)) * exp(-t * rumble_decay)
		rumble_env *= 0.7 + 0.3 * sin(t * 2.3 + sin(t * 0.9) * 4.0)
		var s := bc * crack_env * 1.6 + br * rumble_env * 3.2
		body += body_a * (s - body)
		buf[i] = body * 0.55
	return _to_stream(buf, rate, false)


## Whisper: formant-filtered noise gated by a syllable rhythm. Re-weighting the
## three formants at syllable boundaries is what makes it read as almost-words.
static func whisper(seed_value: int, length: float = 2.4, words: float = 0.7,
		pitch: float = 1.0) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)

	var f1 := svf_coefficient(560.0 * pitch, rate)
	var f2 := svf_coefficient(1180.0 * pitch, rate)
	var f3 := svf_coefficient(2650.0 * pitch, rate)
	var l1 := 0.0; var b1 := 0.0
	var l2 := 0.0; var b2 := 0.0
	var l3 := 0.0; var b3 := 0.0
	var g1 := 1.0; var g2 := 0.6; var g3 := 0.35
	var syllable_rate := lerpf(2.2, 5.4, words)
	var gate_shape := lerpf(1.0, 3.0, words)
	var shift_samples := 0
	var inv_rate := 1.0 / float(rate)

	for i in n:
		var t := float(i) * inv_rate
		if shift_samples <= 0:
			shift_samples = int(rng.randf_range(0.08, 0.22) * rate)
			g1 = rng.randf_range(0.5, 1.2)
			g2 = rng.randf_range(0.2, 0.9)
			g3 = rng.randf_range(0.1, 0.6)
		shift_samples -= 1
		var white := rng.randf_range(-1.0, 1.0)
		var h1 := white - l1 - 0.28 * b1
		b1 += f1 * h1
		l1 += f1 * b1
		var h2 := white - l2 - 0.22 * b2
		b2 += f2 * h2
		l2 += f2 * b2
		var h3 := white - l3 - 0.30 * b3
		b3 += f3 * h3
		l3 += f3 * b3
		var gate := pow(0.5 + 0.5 * sin(t * syllable_rate * TAU), gate_shape)
		buf[i] = (b1 * g1 + b2 * g2 + b3 * g3) * gate * _envelope(t, length, 0.25, 0.6) * 0.5
	return _to_stream(buf, rate, false)


## Heartbeat. `bpm` is driven by the horror director's tension.
static func heartbeat(bpm: float = 72.0, beats: int = 2) -> AudioStreamWAV:
	var rate := RATE_SFX
	var period := 60.0 / maxf(bpm, 30.0)
	var n := int(period * float(beats) * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := fmod(float(i) * inv_rate, period)
		var s := 0.0
		if t < 0.16:
			s += sin(t * 52.0 * TAU) * exp(-t * 26.0)
		var t2 := t - 0.22
		if t2 > 0.0 and t2 < 0.16:
			s += sin(t2 * 64.0 * TAU) * exp(-t2 * 30.0) * 0.72
		buf[i] = s * 0.75
	return _to_stream(buf, rate, false)


## Stinger for the rare jump scare. Deliberately not a violin screech: a sudden
## low mass impact with a metallic ring on top.
static func stinger(seed_value: int, harshness: float = 0.6) -> AudioStreamWAV:
	var rate := RATE_SFX
	var length := 1.5
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var f := svf_coefficient(lerpf(700.0, 2600.0, harshness), rate)
	var low := 0.0
	var band := 0.0
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.08 * band
		band += f * high
		low += f * band
		var thump := sin(t * lerpf(70.0, 40.0, t / length) * TAU) * exp(-t * 6.5)
		buf[i] = (thump * 1.1 + band * exp(-t * 2.2) * harshness * 0.8) * 0.6
	return _to_stream(buf, rate, false)


## Tape / radio static for the recorder and the relay puzzle.
static func static_noise(seed_value: int, length: float = 1.8, tone: float = 0.5) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var f := svf_coefficient(lerpf(900.0, 4200.0, tone), rate)
	var low := 0.0
	var band := 0.0
	var z := 0.0
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.5 * band
		band += f * high
		low += f * band
		z += 0.4 * (band * 1.4 - z)
		var s := z
		# Occasional dropouts, like a failing connection.
		if sin(t * 3.7) > 0.93:
			s *= 0.15
		buf[i] = s * 0.45
	_apply_loop_crossfade(buf, int(rate * 0.15))
	return _to_stream(buf, rate, true)


# ---------------------------------------------------------------------------
# Wildlife
# ---------------------------------------------------------------------------

static func owl_hoot(seed_value: int) -> AudioStreamWAV:
	var rate := RATE_SFX
	var length := 1.4
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var table := _sine
	var base := rng.randf_range(330.0, 430.0)
	var phase := 0.0
	var inv_rate := 1.0 / float(rate)
	var scale := float(TABLE_SIZE) * inv_rate
	for i in n:
		var t := float(i) * inv_rate
		# Two-note "hoo-hoooo" with a downward bend on each.
		var env := 0.0
		var freq := base
		if t < 0.28:
			env = sin(t / 0.28 * PI)
			freq = base * (1.0 - t * 0.18)
		elif t > 0.45 and t < 1.15:
			var lt := (t - 0.45) / 0.7
			env = sin(lt * PI) * 0.95
			freq = base * (0.94 - lt * 0.12)
		phase += freq * scale
		var idx := int(phase)
		buf[i] = (table[idx & TABLE_MASK] * 0.8 + table[(idx * 2) & TABLE_MASK] * 0.12) * env * 0.55
	return _to_stream(buf, rate, false)


static func crow_caw(seed_value: int) -> AudioStreamWAV:
	var rate := RATE_SFX
	var length := 0.5
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var table := _sine
	var base := rng.randf_range(620.0, 860.0)
	var f := svf_coefficient(base * 2.2, rate)
	var low := 0.0
	var band := 0.0
	var phase := 0.0
	var inv_rate := 1.0 / float(rate)
	var scale := float(TABLE_SIZE) * inv_rate
	for i in n:
		var t := float(i) * inv_rate
		var env := exp(-t * 7.0) * clampf(t / 0.02, 0.0, 1.0)
		phase += base * (1.0 + 0.25 * exp(-t * 12.0)) * scale
		var osc := table[int(phase) & TABLE_MASK]
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.35 * band
		band += f * high
		low += f * band
		# Rasp: a squared-off oscillator plus band-passed noise.
		buf[i] = (signf(osc) * 0.35 + osc * 0.5 + band * 0.5) * env * 0.5
	return _to_stream(buf, rate, false)


static func deer_snort(seed_value: int) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(0.45 * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var f := svf_coefficient(rng.randf_range(700.0, 1100.0), rate)
	var low := 0.0
	var band := 0.0
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.45 * band
		band += f * high
		low += f * band
		buf[i] = band * exp(-t * 11.0) * clampf(t / 0.012, 0.0, 1.0) * 1.3
	return _to_stream(buf, rate, false)


static func small_scurry(seed_value: int) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(0.42 * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var f := svf_coefficient(3600.0, rate)
	var low := 0.0
	var band := 0.0
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.25 * band
		band += f * high
		low += f * band
		var gate := 1.0 if fmod(t * 22.0, 1.0) < 0.25 else 0.15
		buf[i] = band * gate * exp(-t * 3.0) * 0.5
	return _to_stream(buf, rate, false)


static func wing_flap(seed_value: int, size: float = 0.5) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(0.85 * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var f := svf_coefficient(lerpf(900.0, 320.0, size), rate)
	var low := 0.0
	var band := 0.0
	var flap_hz := lerpf(9.0, 3.6, size)
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		var white := rng.randf_range(-1.0, 1.0)
		var high := white - low - 0.6 * band
		band += f * high
		low += f * band
		var beat := maxf(0.0, sin(t * flap_hz * TAU))
		buf[i] = band * beat * beat * beat * exp(-t * 1.6) * 0.7
	return _to_stream(buf, rate, false)


# ---------------------------------------------------------------------------
# Interface and music
# ---------------------------------------------------------------------------

static func ui_tone(freq: float, length: float = 0.09, shape: float = 0.0) -> AudioStreamWAV:
	var rate := RATE_SFX
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var inv_rate := 1.0 / float(rate)
	for i in n:
		var t := float(i) * inv_rate
		var s := sin(t * freq * TAU)
		buf[i] = lerpf(s, signf(s) * 0.6, shape) * exp(-t * 26.0) * 0.35
	return _to_stream(buf, rate, false)


## A sustained, slowly evolving musical layer. The score is built by
## cross-fading these rather than by playing linear tracks.
##
## `unease` detunes the upper partials, which is why the "dread" and "chase"
## stems feel wrong without being dissonant in an obvious, musical way.
static func music_stem(root_hz: float, intervals: Array, seed_value: int,
		length: float = 8.0, brightness: float = 0.5, unease: float = 0.0) -> AudioStreamWAV:
	var rate := RATE_MUSIC
	var n := int(length * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var rng := _rng(seed_value)
	var table := _sine

	var count := intervals.size()
	var phase := PackedFloat32Array()
	var step := PackedFloat32Array()
	var upper_phase := PackedFloat32Array()
	var upper_step := PackedFloat32Array()
	var swell_phase := PackedFloat32Array()
	var swell_step := PackedFloat32Array()
	var table_scale := float(TABLE_SIZE) / float(rate)
	for v in count:
		var f: float = root_hz * pow(2.0, float(intervals[v]) / 12.0) + rng.randf_range(-0.4, 0.4) * (1.0 + unease * 5.0)
		phase.append(rng.randf() * float(TABLE_SIZE))
		step.append(f * table_scale)
		upper_phase.append(rng.randf() * float(TABLE_SIZE))
		upper_step.append(f * 2.0 * (1.0 + unease * 0.006) * table_scale)
		swell_phase.append(rng.randf() * float(TABLE_SIZE))
		swell_step.append(rng.randf_range(0.05, 0.14) * table_scale)

	var upper_gain := 0.06 * brightness
	var lp_a := lerpf(0.08, 0.5, brightness)
	var z := 0.0
	for i in n:
		var s := 0.0
		for v in count:
			var swell := 0.35 + 0.65 * (0.5 + 0.5 * table[int(swell_phase[v]) & TABLE_MASK])
			swell_phase[v] += swell_step[v]
			s += table[int(phase[v]) & TABLE_MASK] * swell * 0.24
			phase[v] += step[v]
			s += table[int(upper_phase[v]) & TABLE_MASK] * swell * upper_gain
			upper_phase[v] += upper_step[v]
		z += lp_a * (s - z)
		buf[i] = z * 0.5

	_apply_loop_crossfade(buf, int(rate * 0.8))
	return _to_stream(buf, rate, true)
