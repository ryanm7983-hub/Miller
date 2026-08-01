class_name ScreenEffects
extends ColorRect
## Full-screen post-process driven by the player's condition.
##
## One shader, every term gated behind a uniform that sits at zero in the common
## case (see `shaders/screen_effect.gdshader`). The whole layer removes itself on
## the lowest quality tier, where a full-screen pass is not affordable.
##
## The mapping from state to effect is intentionally legible — a player should
## be able to tell *what* is wrong with them from the screen alone:
##
##   sanity falling   -> desaturation, breathing warp, closing vignette
##   hurt             -> red edge, which fades as health returns
##   something close  -> chromatic fringing and a pulse
##   torch flicker    -> a brief brightness dip

const DAMAGE_DECAY := 0.55
const FLICKER_DECAY := 5.0

var _player: Player
var _material: ShaderMaterial
var _damage_flash := 0.0
var _flicker := 0.0
var _enabled := true


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	color = Color.WHITE
	_material = ShaderMaterial.new()
	_material.shader = load("res://shaders/screen_effect.gdshader")
	material = _material
	EventBus.player_damaged.connect(_on_damaged)
	EventBus.flashlight_flickered.connect(_on_flicker)
	EventBus.quality_tier_changed.connect(_on_quality_changed)
	_on_quality_changed(PerformanceDirector.current_tier)


func bind(player: Player) -> void:
	_player = player


func _process(delta: float) -> void:
	if not _enabled or _player == null:
		return
	_damage_flash = maxf(0.0, _damage_flash - DAMAGE_DECAY * delta)
	_flicker = maxf(0.0, _flicker - FLICKER_DECAY * delta)

	var stats := _player.stats
	var sanity := stats.sanity_fraction()
	var strain := clampf(1.0 - sanity, 0.0, 1.0)
	var hurt := clampf(1.0 - stats.health_fraction(), 0.0, 1.0)
	var threat := clampf(stats.threat_proximity, 0.0, 1.0)
	var reduce_flashing := bool(Settings.get_value("reduce_flashing"))

	# Vignette closes as sanity falls and as the player is hurt; exhaustion adds
	# a little, so hard running visibly narrows the world.
	var exhaustion := 1.0 - stats.stamina_fraction()
	_material.set_shader_parameter("vignette",
			0.30 + strain * 0.55 + hurt * 0.20 + exhaustion * 0.12)
	_material.set_shader_parameter("desaturation", strain * 0.65)
	_material.set_shader_parameter("grain", 0.02 + strain * 0.06)
	_material.set_shader_parameter("warp", 0.0 if reduce_flashing else strain * strain * 0.018)
	_material.set_shader_parameter("aberration",
			0.0 if reduce_flashing else (threat * 0.006 + strain * 0.002))
	_material.set_shader_parameter("pulse",
			0.0 if reduce_flashing else maxf(threat * 0.6, strain * 0.25))
	_material.set_shader_parameter("damage", maxf(hurt * 0.7, _damage_flash))
	_material.set_shader_parameter("brightness",
			float(Settings.get_value("brightness")) * (1.0 - _flicker * 0.55))
	# Scanlines only appear while a recording is playing back.
	_material.set_shader_parameter("scanline",
			1.0 if GameState.has_flag("playback_active") else 0.0)


func _on_damaged(amount: float, _source: String) -> void:
	_damage_flash = clampf(_damage_flash + amount / 45.0, 0.0, 1.0)


func _on_flicker(intensity: float) -> void:
	if bool(Settings.get_value("reduce_flashing")):
		return
	_flicker = clampf(maxf(_flicker, intensity), 0.0, 1.0)


func _on_quality_changed(tier: int) -> void:
	# A full-screen pass is the first thing to go on the weakest devices.
	_enabled = tier > PerformanceDirector.Tier.POTATO
	visible = _enabled
