class_name Perception
extends Node3D
## Shared sight and hearing for everything that hunts.
##
## Both senses are *graded*, not boolean. An enemy accumulates and loses
## awareness of the player over time, which is what makes it possible to be
## half-noticed — the state the whole game is trying to keep you in. A binary
## "can see player" test produces AI that either ignores you completely or is
## instantly certain, and both of those are boring.
##
## Awareness rises toward 1 while the player is detectable and decays when they
## are not. Crossing `SUSPICIOUS` makes the enemy investigate; crossing
## `CERTAIN` starts a chase. There is hysteresis between them, so an enemy does
## not flicker between states at the boundary.
##
## The senses are deliberately asymmetric between archetypes: `sight_weight` and
## `hearing_weight` are how the Listener ends up blind and the Surveyor ends up
## deaf-ish, from one implementation.

const SUSPICIOUS := 0.45
const CERTAIN := 0.85
const LOSE_INTEREST := 0.25

## Line-of-sight tests hit terrain and static world geometry only. Foliage does
## not block: a forest of alpha-cut billboards would make sight tests random.
const SIGHT_MASK := 1 | 2

signal became_suspicious(position: Vector3)
signal became_certain(position: Vector3)
signal lost_track()

@export var sight_range := 26.0
@export var sight_angle := 1.15          ## half-angle, radians
@export var hearing_range := 34.0
@export var sight_weight := 1.0
@export var hearing_weight := 1.0
@export var gain := 1.7                  ## awareness gained per second at full signal
@export var decay := 0.28                ## awareness lost per second with no signal
@export var memory_time := 12.0          ## how long a lost target is still searched for

var awareness: float = 0.0
var last_known_position: Vector3 = Vector3.ZERO
var has_target: bool = false
var can_see_now: bool = false

var _player: Player
var _weather: WeatherSystem
var _time: TimeOfDay
var _memory := 0.0
var _was_suspicious := false
var _was_certain := false
var _noise_signal := 0.0


func setup(player: Player, world: WorldRoot) -> void:
	_player = player
	if world != null:
		_weather = world.weather
		_time = world.time_of_day
	EventBus.noise_emitted.connect(_on_noise)


func _physics_process(delta: float) -> void:
	if _player == null or not _player.stats.is_alive:
		awareness = maxf(0.0, awareness - decay * delta)
		return

	var signal_strength := maxf(_sight_signal(), _noise_signal)
	# Noise is an impulse: it decays quickly so an enemy is drawn to *where* a
	# sound was, not held by the fact that one happened.
	_noise_signal = maxf(0.0, _noise_signal - delta * 1.4)

	if signal_strength > 0.01:
		awareness = minf(1.0, awareness + signal_strength * gain * delta)
		_memory = memory_time
	else:
		awareness = maxf(0.0, awareness - decay * delta)
		_memory = maxf(0.0, _memory - delta)

	has_target = _memory > 0.0
	_emit_transitions()


func _emit_transitions() -> void:
	if awareness >= CERTAIN and not _was_certain:
		_was_certain = true
		_was_suspicious = true
		became_certain.emit(last_known_position)
	elif awareness >= SUSPICIOUS and not _was_suspicious:
		_was_suspicious = true
		became_suspicious.emit(last_known_position)

	if _was_certain and awareness < SUSPICIOUS:
		_was_certain = false
	if _was_suspicious and awareness < LOSE_INTEREST:
		_was_suspicious = false
		_was_certain = false
		lost_track.emit()


# ---------------------------------------------------------------------------
# Sight
# ---------------------------------------------------------------------------

func _sight_signal() -> float:
	can_see_now = false
	if sight_weight <= 0.001:
		return 0.0

	var eye := global_position
	var target := _player.eye_position()
	var offset := target - eye
	var distance := offset.length()
	var effective_range := sight_range * _visibility_multiplier()
	if distance > effective_range or distance < 0.01:
		return 0.0

	# Cone test, in the direction the head is facing.
	var forward := -global_basis.z
	var angle := forward.angle_to(offset.normalized())
	if angle > sight_angle:
		return 0.0

	if _is_blocked(eye, target):
		return 0.0

	can_see_now = true
	last_known_position = _player.global_position

	# Strength falls off with distance and with how far off-centre the target
	# is; a figure at the edge of vision is noticed slowly.
	var by_distance := 1.0 - (distance / effective_range)
	var by_angle := 1.0 - (angle / sight_angle) * 0.7
	return clampf(by_distance * by_angle * _player.visibility() * sight_weight, 0.0, 1.0)


func _is_blocked(from: Vector3, to: Vector3) -> bool:
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, to, SIGHT_MASK)
	query.hit_from_inside = false
	return not space.intersect_ray(query).is_empty()


## Fog, rain and darkness all shorten how far anything can see.
func _visibility_multiplier() -> float:
	var value := 1.0
	if _weather != null:
		value *= _weather.visibility_factor()
	if _time != null:
		# Things that live here see better in the dark than the player does, but
		# not perfectly.
		value *= lerpf(0.55, 1.0, _time.light_level())
	return value


# ---------------------------------------------------------------------------
# Hearing
# ---------------------------------------------------------------------------

func _on_noise(position: Vector3, loudness: float, source: Node) -> void:
	if hearing_weight <= 0.001 or source == self or loudness <= 0.001:
		return
	# Only the player's noise draws a hunter; a deer stepping on a twig is not
	# interesting, and wiring it up that way produces enemies that spend the
	# whole game chasing rabbits.
	if source != null and not source.is_in_group("player") and not (source is Flashlight) \
			and not source.is_in_group("noise_source"):
		return

	var effective_range := hearing_range * loudness
	if _weather != null:
		effective_range *= _weather.hearing_factor()
	var distance := global_position.distance_to(position)
	if distance > effective_range:
		return

	var strength := (1.0 - distance / maxf(effective_range, 0.01)) * loudness * hearing_weight
	if strength <= _noise_signal:
		return
	_noise_signal = clampf(strength, 0.0, 1.0)
	# Hearing gives a direction, not a position: the enemy goes to roughly where
	# the sound came from, which is why standing still after being heard works.
	var error := (1.0 - strength) * 5.0
	last_known_position = position + Vector3(
		randf_range(-error, error), 0.0, randf_range(-error, error))


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

func is_suspicious() -> bool:
	return awareness >= SUSPICIOUS


func is_certain() -> bool:
	return awareness >= CERTAIN


func distance_to_player() -> float:
	if _player == null:
		return INF
	return global_position.distance_to(_player.global_position)


func player() -> Player:
	return _player


## Force awareness, used by scripted beats and by the horror director.
func alert(position: Vector3, amount: float = 1.0) -> void:
	last_known_position = position
	awareness = clampf(maxf(awareness, amount), 0.0, 1.0)
	_memory = memory_time
	_emit_transitions()


func forget() -> void:
	awareness = 0.0
	_memory = 0.0
	_noise_signal = 0.0
	has_target = false
	if _was_suspicious or _was_certain:
		_was_suspicious = false
		_was_certain = false
		lost_track.emit()
