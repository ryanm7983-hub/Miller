class_name UITheme
extends RefCounted
## The game's UI theme, built in code.
##
## Keeping the theme as a script rather than a .tres has two payoffs here: the
## palette is a single named constant block that the HUD shaders and the 3D
## world can also read, and the whole theme can be rebuilt at a different scale
## when the player changes UI size or the browser window is resized on a phone.

# --- Palette ---------------------------------------------------------------
const INK := Color(0.035, 0.038, 0.042)          ## near-black panel fill
const INK_SOFT := Color(0.075, 0.080, 0.086)
const BONE := Color(0.84, 0.83, 0.78)            ## primary text
const BONE_DIM := Color(0.55, 0.55, 0.52)
const MOSS := Color(0.36, 0.45, 0.33)            ## accent, "safe"
const RUST := Color(0.58, 0.27, 0.16)            ## accent, "danger"
const AMBER := Color(0.78, 0.62, 0.30)           ## flashlight / interact
const COLD := Color(0.42, 0.52, 0.60)            ## sanity / cold
const BLOOD := Color(0.42, 0.08, 0.09)

const BASE_FONT_SIZE := 17


## Build a full Theme scaled by `scale`. `large_text` bumps only the type sizes,
## not the metrics, so the layout does not explode.
static func build(scale: float = 1.0, large_text: bool = false) -> Theme:
	var theme := Theme.new()
	var font_size := int(round(BASE_FONT_SIZE * scale * (1.25 if large_text else 1.0)))
	theme.default_font_size = font_size

	_style_buttons(theme, scale, font_size)
	_style_panels(theme, scale)
	_style_labels(theme, font_size)
	_style_ranges(theme, scale)
	_style_inputs(theme, scale, font_size)
	return theme


static func _flat(colour: Color, radius: float, border: float = 0.0,
		border_colour: Color = Color.TRANSPARENT) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = colour
	sb.corner_radius_top_left = int(radius)
	sb.corner_radius_top_right = int(radius)
	sb.corner_radius_bottom_left = int(radius)
	sb.corner_radius_bottom_right = int(radius)
	if border > 0.0:
		sb.border_width_left = int(border)
		sb.border_width_right = int(border)
		sb.border_width_top = int(border)
		sb.border_width_bottom = int(border)
		sb.border_color = border_colour
	return sb


static func _pad(sb: StyleBoxFlat, h: float, v: float) -> StyleBoxFlat:
	sb.content_margin_left = h
	sb.content_margin_right = h
	sb.content_margin_top = v
	sb.content_margin_bottom = v
	return sb


static func _style_buttons(theme: Theme, scale: float, font_size: int) -> void:
	var h := 18.0 * scale
	var v := 11.0 * scale
	var normal := _pad(_flat(Color(0.10, 0.105, 0.112, 0.92), 3.0 * scale, 1.0, Color(0.20, 0.21, 0.20, 0.8)), h, v)
	var hover := _pad(_flat(Color(0.16, 0.17, 0.165, 0.96), 3.0 * scale, 1.0, MOSS), h, v)
	var pressed := _pad(_flat(Color(0.07, 0.075, 0.08, 1.0), 3.0 * scale, 1.0, MOSS.darkened(0.2)), h, v)
	var disabled := _pad(_flat(Color(0.08, 0.08, 0.08, 0.55), 3.0 * scale, 1.0, Color(0.16, 0.16, 0.16, 0.5)), h, v)
	var focus := _pad(_flat(Color(0, 0, 0, 0), 3.0 * scale, 1.0, AMBER), h, v)

	for type_name in ["Button", "OptionButton", "MenuButton", "CheckButton", "CheckBox"]:
		theme.set_stylebox("normal", type_name, normal)
		theme.set_stylebox("hover", type_name, hover)
		theme.set_stylebox("pressed", type_name, pressed)
		theme.set_stylebox("disabled", type_name, disabled)
		theme.set_stylebox("focus", type_name, focus)
		theme.set_color("font_color", type_name, BONE)
		theme.set_color("font_hover_color", type_name, Color(0.95, 0.94, 0.88))
		theme.set_color("font_pressed_color", type_name, MOSS.lightened(0.3))
		theme.set_color("font_disabled_color", type_name, Color(0.38, 0.38, 0.36))
		theme.set_font_size("font_size", type_name, font_size)


static func _style_panels(theme: Theme, scale: float) -> void:
	var panel := _flat(Color(0.045, 0.048, 0.052, 0.94), 4.0 * scale, 1.0, Color(0.16, 0.17, 0.16, 0.9))
	_pad(panel, 16.0 * scale, 14.0 * scale)
	theme.set_stylebox("panel", "PanelContainer", panel)
	theme.set_stylebox("panel", "Panel", _flat(Color(0.04, 0.042, 0.046, 0.92), 3.0 * scale))

	var popup := _flat(Color(0.05, 0.052, 0.056, 0.98), 3.0 * scale, 1.0, Color(0.22, 0.23, 0.22))
	theme.set_stylebox("panel", "PopupMenu", popup)
	theme.set_color("font_color", "PopupMenu", BONE)

	var tab_selected := _pad(_flat(Color(0.11, 0.12, 0.115, 1.0), 3.0 * scale, 1.0, MOSS), 16 * scale, 8 * scale)
	var tab_unselected := _pad(_flat(Color(0.06, 0.062, 0.066, 0.9), 3.0 * scale), 16 * scale, 8 * scale)
	theme.set_stylebox("tab_selected", "TabContainer", tab_selected)
	theme.set_stylebox("tab_unselected", "TabContainer", tab_unselected)
	theme.set_stylebox("panel", "TabContainer", panel)

	theme.set_constant("separation", "VBoxContainer", int(8 * scale))
	theme.set_constant("separation", "HBoxContainer", int(8 * scale))
	theme.set_constant("margin_left", "MarginContainer", int(12 * scale))
	theme.set_constant("margin_right", "MarginContainer", int(12 * scale))
	theme.set_constant("margin_top", "MarginContainer", int(12 * scale))
	theme.set_constant("margin_bottom", "MarginContainer", int(12 * scale))


static func _style_labels(theme: Theme, font_size: int) -> void:
	theme.set_color("font_color", "Label", BONE)
	theme.set_font_size("font_size", "Label", font_size)
	theme.set_color("default_color", "RichTextLabel", BONE)
	theme.set_font_size("normal_font_size", "RichTextLabel", font_size)
	theme.set_stylebox("normal", "RichTextLabel", StyleBoxEmpty.new())


static func _style_ranges(theme: Theme, scale: float) -> void:
	var track := _flat(Color(0.10, 0.105, 0.11, 1.0), 2.0 * scale)
	var fill := _flat(MOSS, 2.0 * scale)
	theme.set_stylebox("slider", "HSlider", track)
	theme.set_stylebox("grabber_area", "HSlider", fill)
	theme.set_stylebox("grabber_area_highlight", "HSlider", _flat(MOSS.lightened(0.25), 2.0 * scale))
	theme.set_constant("center_grabber", "HSlider", 1)

	theme.set_stylebox("background", "ProgressBar", track)
	theme.set_stylebox("fill", "ProgressBar", fill)
	theme.set_color("font_color", "ProgressBar", BONE_DIM)


static func _style_inputs(theme: Theme, scale: float, font_size: int) -> void:
	var field := _pad(_flat(Color(0.07, 0.072, 0.076, 1.0), 2.0 * scale, 1.0, Color(0.20, 0.21, 0.20)),
			10 * scale, 6 * scale)
	theme.set_stylebox("normal", "LineEdit", field)
	theme.set_color("font_color", "LineEdit", BONE)
	theme.set_font_size("font_size", "LineEdit", font_size)

	theme.set_stylebox("panel", "ScrollContainer", StyleBoxEmpty.new())
	theme.set_stylebox("scroll", "VScrollBar", _flat(Color(0.06, 0.06, 0.06, 0.6), 2 * scale))
	theme.set_stylebox("grabber", "VScrollBar", _flat(Color(0.24, 0.25, 0.24), 2 * scale))
	theme.set_stylebox("grabber_highlight", "VScrollBar", _flat(MOSS, 2 * scale))
