class_name SurvivalStats
extends Node
## Health, stamina, sanity and torch battery.
##
## These are separated from the controller because they are read by almost
## everything — HUD, horror director, AI, post-process, audio — and because the
## rules are worth stating in one place:
##
##   * **Health** regenerates, but only after a grace period and only up to a
##     ceiling that falls as sanity falls. You can walk off a mauling; you
##     cannot walk off four of them in a night.
##   * **Stamina** has an exhaustion lock. Running out does not merely stop you
##     sprinting, it forbids sprinting until you have recovered a real margin,
##     so panic-sprinting has a cost you feel afterwards.
##   * **Sanity** is the game's real resource. It drains in darkness and near
##     the things that live here, and it is restored by light, by shelter, and
##     by understanding what is happening — not by items alone.
##   * **Battery** is spent by the torch and is the only one of the four that
##     cannot recover on its own.

const MAX_HEALTH := 100.0
const MAX_STAMINA := 100.0
const MAX_SANITY := 100.0
const MAX_BATTERY := 100.0

# Stamina
const SPRINT_DRAIN := 15.0
const STAMINA_REGEN := 12.0
const STAMINA_REGEN_DELAY := 0.9
const EXHAUSTION_RECOVERY := 35.0   ## stamina needed before sprinting is allowed again

# Health
const HEALTH_REGEN := 1.6
const HEALTH_REGEN_DELAY := 12.0

# Sanity
const SANITY_DARK_DRAIN := 0.55
const SANITY_NIGHT_MULTIPLIER := 1.5
const SANITY_LIT_RECOVERY := 0.9
const SANITY_SHELTER_RECOVERY := 2.2
const SANITY_PROXIMITY_DRAIN := 6.0  ## per second when something is very close

signal exhausted()
signal recovered()
signal died(cause: String)

var health: float = MAX_HEALTH
var stamina: float = MAX_STAMINA
var sanity: float = MAX_SANITY
var battery: float = MAX_BATTERY

var is_exhausted: bool = false
var is_alive: bool = true

## Set by the player each frame.
var in_darkness: bool = true
var in_shelter: bool = false
var is_sprinting: bool = false

## Set by the horror director: 0 = nothing nearby, 1 = something is on you.
var threat_proximity: float = 0.0

var _health_delay := 0.0
var _stamina_delay := 0.0
var _sanity_floor := 0.0


func _ready() -> void:
	_broadcast_all()


func load_from(vitals: Dictionary) -> void:
	health = clampf(float(vitals.get("health", MAX_HEALTH)), 0.0, MAX_HEALTH)
	stamina = clampf(float(vitals.get("stamina", MAX_STAMINA)), 0.0, MAX_STAMINA)
	sanity = clampf(float(vitals.get("sanity", MAX_SANITY)), 0.0, MAX_SANITY)
	battery = clampf(float(vitals.get("battery", MAX_BATTERY)), 0.0, MAX_BATTERY)
	is_alive = health > 0.0
	is_exhausted = stamina < EXHAUSTION_RECOVERY and stamina <= 0.5
	_broadcast_all()


func to_dictionary() -> Dictionary:
	return {"health": health, "stamina": stamina, "sanity": sanity, "battery": battery}


func tick(delta: float, night_factor: float) -> void:
	if not is_alive:
		return
	_tick_stamina(delta)
	_tick_health(delta)
	_tick_sanity(delta, night_factor)


# ---------------------------------------------------------------------------

func _tick_stamina(delta: float) -> void:
	var previous := stamina
	if is_sprinting and not is_exhausted:
		stamina = maxf(0.0, stamina - SPRINT_DRAIN * delta)
		_stamina_delay = STAMINA_REGEN_DELAY
		if stamina <= 0.0 and not is_exhausted:
			is_exhausted = true
			exhausted.emit()
	else:
		_stamina_delay = maxf(0.0, _stamina_delay - delta)
		if _stamina_delay <= 0.0:
			# Recovery is slower while exhausted: the penalty is the point.
			var rate := STAMINA_REGEN * (0.6 if is_exhausted else 1.0)
			stamina = minf(MAX_STAMINA, stamina + rate * delta)
		if is_exhausted and stamina >= EXHAUSTION_RECOVERY:
			is_exhausted = false
			recovered.emit()
	if absf(stamina - previous) > 0.01:
		EventBus.player_stamina_changed.emit(stamina, MAX_STAMINA)


func _tick_health(delta: float) -> void:
	_health_delay = maxf(0.0, _health_delay - delta)
	if _health_delay > 0.0 or health >= _health_ceiling():
		return
	var previous := health
	health = minf(_health_ceiling(), health + HEALTH_REGEN * delta)
	if absf(health - previous) > 0.01:
		EventBus.player_health_changed.emit(health, MAX_HEALTH)


## Low sanity caps how far the body will knit itself back together. At full
## sanity you heal to full; at zero you top out at 40%.
func _health_ceiling() -> float:
	return lerpf(40.0, MAX_HEALTH, sanity / MAX_SANITY)


func _tick_sanity(delta: float, night_factor: float) -> void:
	var previous := sanity
	var change := 0.0
	if threat_proximity > 0.01:
		change -= SANITY_PROXIMITY_DRAIN * threat_proximity
	elif in_shelter and not in_darkness:
		change += SANITY_SHELTER_RECOVERY
	elif in_darkness:
		change -= SANITY_DARK_DRAIN * lerpf(1.0, SANITY_NIGHT_MULTIPLIER, night_factor)
	else:
		change += SANITY_LIT_RECOVERY
	sanity = clampf(sanity + change * delta, _sanity_floor, MAX_SANITY)
	if absf(sanity - previous) > 0.01:
		EventBus.player_sanity_changed.emit(sanity, MAX_SANITY)


# ---------------------------------------------------------------------------
# External changes
# ---------------------------------------------------------------------------

func damage(amount: float, source: String = "unknown") -> void:
	if not is_alive or amount <= 0.0:
		return
	health = maxf(0.0, health - amount)
	_health_delay = HEALTH_REGEN_DELAY
	EventBus.player_health_changed.emit(health, MAX_HEALTH)
	EventBus.player_damaged.emit(amount, source)
	if health <= 0.0:
		is_alive = false
		died.emit(source)
		EventBus.player_died.emit(source)


func heal(amount: float) -> void:
	if not is_alive:
		return
	health = minf(MAX_HEALTH, health + amount)
	EventBus.player_health_changed.emit(health, MAX_HEALTH)


func restore_sanity(amount: float) -> void:
	sanity = clampf(sanity + amount, 0.0, MAX_SANITY)
	EventBus.player_sanity_changed.emit(sanity, MAX_SANITY)


func drain_sanity(amount: float) -> void:
	restore_sanity(-amount)


## The story raises this floor as the player learns what the basin is: knowing
## what is happening is protective, even when what is happening is worse.
func set_sanity_floor(value: float) -> void:
	_sanity_floor = clampf(value, 0.0, MAX_SANITY)
	sanity = maxf(sanity, _sanity_floor)


func consume_battery(amount: float) -> void:
	var previous := battery
	battery = maxf(0.0, battery - amount)
	if absf(battery - previous) > 0.01:
		EventBus.flashlight_battery_changed.emit(battery)


func add_battery(amount: float) -> void:
	battery = minf(MAX_BATTERY, battery + amount)
	EventBus.flashlight_battery_changed.emit(battery)


func can_sprint() -> bool:
	return is_alive and not is_exhausted and stamina > 1.0


## 0..1 normalised accessors, for the HUD and post-process.
func health_fraction() -> float:
	return health / MAX_HEALTH


func stamina_fraction() -> float:
	return stamina / MAX_STAMINA


func sanity_fraction() -> float:
	return sanity / MAX_SANITY


func battery_fraction() -> float:
	return battery / MAX_BATTERY


func _broadcast_all() -> void:
	EventBus.player_health_changed.emit(health, MAX_HEALTH)
	EventBus.player_stamina_changed.emit(stamina, MAX_STAMINA)
	EventBus.player_sanity_changed.emit(sanity, MAX_SANITY)
	EventBus.flashlight_battery_changed.emit(battery)
