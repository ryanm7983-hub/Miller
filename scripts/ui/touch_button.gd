class_name TouchButton
extends Control
## A single round on-screen control.
##
## Drawn rather than textured: at the sizes these are used, a circle plus a
## glyph is sharper than any bitmap would be at arbitrary DPI, and it costs no
## asset. `TouchControls` owns hit-testing — these only draw themselves — which
## keeps multi-touch handling in one place instead of spread across eight
## overlapping `_gui_input` handlers.

const RING_WIDTH := 2.0

var action: String = ""
var glyph: String = ""
var label: String = ""
var is_held: bool = false
var is_toggle: bool = false
var is_active: bool = false      ## latched state for toggles (torch on, crouched)
var accent: Color = UITheme.BONE

var _pulse := 0.0


func configure(action_name: String, button_glyph: String, button_label: String,
		toggle: bool = false, colour: Color = UITheme.BONE) -> void:
	action = action_name
	glyph = button_glyph
	label = button_label
	is_toggle = toggle
	accent = colour
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	queue_redraw()


func set_held(value: bool) -> void:
	if is_held == value:
		return
	is_held = value
	if value:
		_pulse = 1.0
	queue_redraw()


func set_active(value: bool) -> void:
	if is_active == value:
		return
	is_active = value
	queue_redraw()


func contains(point: Vector2) -> bool:
	var centre := size * 0.5
	# Hit radius is deliberately larger than the drawn radius: thumbs are
	# imprecise and a missed input in a chase is unforgivable.
	return point.distance_to(global_position + centre) <= size.x * 0.62


func _process(delta: float) -> void:
	if _pulse > 0.0:
		_pulse = maxf(0.0, _pulse - delta * 3.2)
		queue_redraw()


func _draw() -> void:
	var centre := size * 0.5
	var radius := size.x * 0.5

	var fill_alpha := 0.22
	if is_active:
		fill_alpha = 0.4
	if is_held:
		fill_alpha = 0.55
	draw_circle(centre, radius, Color(0.04, 0.045, 0.05, fill_alpha))

	var ring := accent
	ring.a = 0.75 if (is_held or is_active) else 0.42
	draw_arc(centre, radius, 0.0, TAU, 40, ring, RING_WIDTH + (1.0 if is_held else 0.0), true)

	if _pulse > 0.0:
		var flash := accent
		flash.a = _pulse * 0.5
		draw_arc(centre, radius * (1.0 + (1.0 - _pulse) * 0.35), 0.0, TAU, 32, flash, 2.0, true)

	var font := get_theme_default_font()
	if font == null:
		return
	var glyph_size := int(radius * 0.85)
	var glyph_width := font.get_string_size(glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, glyph_size).x
	var glyph_colour := accent
	glyph_colour.a = 0.95 if (is_held or is_active) else 0.72
	draw_string(font, centre + Vector2(-glyph_width * 0.5, glyph_size * 0.35),
			glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, glyph_size, glyph_colour)

	if label != "":
		var label_size := maxi(9, int(radius * 0.32))
		var label_width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size).x
		var label_colour := accent
		label_colour.a = 0.5
		draw_string(font, centre + Vector2(-label_width * 0.5, radius + label_size * 1.1),
				label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size, label_colour)
