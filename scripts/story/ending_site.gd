class_name EndingSite
extends StaticBody3D
## The four places a run can be ended.
##
## Each ending is a physical place you have to walk to and an action you have to
## take deliberately — no menu, no cutscene trigger you can stumble into. Three
## of them are gated behind having brought at least three listening posts
## online, so the player has to have engaged with the basin before it will let
## them decide anything about it.
##
## The fourth, the fire road, is never gated. Walking out is always available,
## from the first minute, and the game does not warn you that it is an ending.
## That is the point of it: refusing to participate is a real option and it is
## not signposted as one.

const CONFIRM_HOLD := 2.4

var ending_id: String = ""
var prompt_locked: String = ""
var prompt_ready: String = ""
var requires_posts: bool = true

var _armed := false
var _hold := 0.0
var _light: OmniLight3D


func configure(id: String, locked_text: String, ready_text: String,
		gated: bool = true) -> void:
	ending_id = id
	prompt_locked = locked_text
	prompt_ready = ready_text
	requires_posts = gated
	collision_layer = 2 | 32
	collision_mask = 0
	add_to_group("ending_site")
	if not is_inside_tree():
		await ready
	_build()


func _build() -> void:
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.4, 2.0, 1.4)
	collider.shape = shape
	collider.position = Vector3(0, 1.0, 0)
	add_child(collider)

	# A faint marker so the site reads as significant without a waypoint.
	_light = OmniLight3D.new()
	_light.light_color = UITheme.AMBER
	_light.light_energy = 0.0
	_light.omni_range = 5.0
	_light.shadow_enabled = false
	_light.position = Vector3(0, 1.4, 0)
	add_child(_light)


func _process(delta: float) -> void:
	if _light != null:
		_light.light_energy = lerpf(_light.light_energy, 0.6 if _is_available() else 0.0,
				delta * 2.0)
	if _hold > 0.0:
		_hold = maxf(0.0, _hold - delta)


func _is_available() -> bool:
	if not requires_posts:
		return true
	var game := get_tree().get_first_node_in_group("game") as Game
	return game != null and game.story != null and game.story.can_commit_ending()


# ---------------------------------------------------------------------------
# Interaction
# ---------------------------------------------------------------------------

func interaction_prompt() -> String:
	if not _is_available():
		return prompt_locked
	if _armed:
		return "%s  —  again to be sure" % prompt_ready
	return prompt_ready


func can_interact(_player: Node3D) -> bool:
	return true


## Two presses, because an ending is not something to do by accident with the
## same button that opens doors. The confirmation lapses if you walk away.
func interact(player: Node3D) -> void:
	if not _is_available():
		AudioDirector.play_2d("ui_deny", -8.0)
		EventBus.notification_posted.emit("Not yet. The network is barely awake.")
		return

	if not _armed or _hold <= 0.0:
		_armed = true
		_hold = CONFIRM_HOLD
		AudioDirector.play_2d("ui_confirm", -6.0)
		EventBus.notification_posted.emit("Press again to commit.")
		return

	_armed = false
	var game := get_tree().get_first_node_in_group("game") as Game
	if game == null or game.story == null:
		return
	AudioDirector.play_2d("stinger_soft", -6.0, 0.8)
	if player is Player:
		player.set_input_enabled(false)
	game.story.trigger_ending(ending_id)
