extends Node
## Platform and device capability detection.
##
## The same build ships to desktop browsers, Android Chrome and iOS Safari, and
## those three behave very differently: iOS Safari refuses to start audio until
## a user gesture, mobile GPUs choke on large shadow atlases, and pointer lock
## is unavailable on touch devices. Every branch on "what kind of machine is
## this?" lives here so the rest of the codebase can ask a plain question.

enum Form { DESKTOP, TABLET, PHONE }

var is_web: bool = false
var is_mobile_os: bool = false
var is_ios: bool = false
var is_android: bool = false
var has_touch: bool = false
var has_pointer_lock: bool = false
var form_factor: Form = Form.DESKTOP

## Rough GPU/CPU class derived at boot, refined later by PerformanceDirector.
## 0 = potato, 1 = low, 2 = medium, 3 = high.
var initial_hardware_class: int = 2

var _user_agent: String = ""


func _ready() -> void:
	is_web = OS.has_feature("web")
	is_ios = OS.has_feature("ios") or OS.has_feature("web_ios")
	is_android = OS.has_feature("android") or OS.has_feature("web_android")
	is_mobile_os = is_ios or is_android or OS.has_feature("mobile")
	has_touch = DisplayServer.is_touchscreen_available() or is_mobile_os
	has_pointer_lock = not has_touch
	_user_agent = _read_user_agent()
	form_factor = _detect_form_factor()
	initial_hardware_class = _estimate_hardware_class()
	Log.info("platform", "web=%s mobile=%s touch=%s form=%s class=%d gpu=%s" % [
		is_web, is_mobile_os, has_touch, Form.keys()[form_factor],
		initial_hardware_class, RenderingServer.get_video_adapter_name(),
	])


## True when the control scheme should default to on-screen touch controls.
func prefers_touch_controls() -> bool:
	return has_touch and form_factor != Form.DESKTOP


## Screens narrower than this (in CSS-ish points) get the compact HUD layout.
func is_compact_screen() -> bool:
	var size := DisplayServer.window_get_size()
	return mini(size.x, size.y) < 620


## Suggested UI scale so buttons stay thumb-sized on small high-DPI screens.
func recommended_ui_scale() -> float:
	var size := DisplayServer.window_get_size()
	var shortest := float(mini(size.x, size.y))
	if shortest <= 0.0:
		return 1.0
	match form_factor:
		Form.PHONE:
			return clampf(shortest / 720.0, 0.85, 1.6)
		Form.TABLET:
			return clampf(shortest / 900.0, 0.9, 1.4)
		_:
			return clampf(shortest / 900.0, 0.85, 1.25)


func user_agent() -> String:
	return _user_agent


func _read_user_agent() -> String:
	if not is_web:
		return OS.get_name()
	if not Engine.has_singleton("JavaScriptBridge"):
		return "web"
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval", "navigator.userAgent", true)
	return String(result) if result != null else "web"


func _detect_form_factor() -> Form:
	if not has_touch:
		return Form.DESKTOP
	var size := DisplayServer.window_get_size()
	var shortest := mini(size.x, size.y)
	var longest := maxi(size.x, size.y)
	var ua := _user_agent.to_lower()
	if ua.contains("ipad") or (ua.contains("android") and not ua.contains("mobile")):
		return Form.TABLET
	if shortest >= 700 and longest >= 1000:
		return Form.TABLET
	return Form.PHONE


func _estimate_hardware_class() -> int:
	# Godot cannot query VRAM in a browser, so we combine the few signals that
	# do survive the web sandbox: processor count, renderer name and form
	# factor. PerformanceDirector corrects this from measured frame times.
	var cores := OS.get_processor_count()
	var adapter := RenderingServer.get_video_adapter_name().to_lower()
	var score := 2
	if form_factor == Form.PHONE:
		score -= 1
	if cores <= 2:
		score -= 1
	elif cores >= 8:
		score += 1
	# Software rasterisers and old mobile parts are the reliable red flags.
	for needle in ["swiftshader", "llvmpipe", "software", "mali-4", "adreno 3", "adreno 4", "powervr sgx"]:
		if adapter.contains(needle):
			score -= 2
			break
	if adapter.contains("apple") and form_factor != Form.PHONE:
		score += 1
	return clampi(score, 0, 3)
