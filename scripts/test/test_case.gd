class_name TestCase
extends RefCounted
## Minimal xUnit-style base class.
##
## The project deliberately does not depend on an addon for this: the whole
## suite has to run in the same headless Godot binary that CI uses for the web
## export, and a 150-line runner is easier to keep working across engine
## upgrades than a vendored framework.
##
## Subclasses implement `test_*` methods. `before_each`/`after_each` run around
## every test, `before_all`/`after_all` once per case.

var failures: PackedStringArray = []
var assertions: int = 0

## Set by the runner so tests can add nodes to a live tree.
var tree: SceneTree = null

var _current_test := ""


func suite_name() -> String:
	var script := get_script() as Script
	if script == null:
		return "UnknownCase"
	return script.resource_path.get_file().get_basename()


func before_all() -> void:
	pass


func after_all() -> void:
	pass


func before_each() -> void:
	pass


func after_each() -> void:
	pass


func begin_test(test_name: String) -> void:
	_current_test = test_name


# --- assertions ------------------------------------------------------------

func assert_true(condition: bool, message: String = "") -> void:
	assertions += 1
	if not condition:
		_fail("expected true" if message == "" else message)


func assert_false(condition: bool, message: String = "") -> void:
	assert_true(not condition, message if message != "" else "expected false")


func assert_eq(actual: Variant, expected: Variant, message: String = "") -> void:
	assertions += 1
	if actual != expected:
		_fail("%s (expected %s, got %s)" % [
			message if message != "" else "values differ", str(expected), str(actual)])


func assert_ne(actual: Variant, unexpected: Variant, message: String = "") -> void:
	assertions += 1
	if actual == unexpected:
		_fail("%s (both %s)" % [message if message != "" else "values equal", str(actual)])


func assert_almost(actual: float, expected: float, tolerance: float = 0.001,
		message: String = "") -> void:
	assertions += 1
	if absf(actual - expected) > tolerance:
		_fail("%s (expected %f +/- %f, got %f)" % [
			message if message != "" else "value out of tolerance",
			expected, tolerance, actual])


func assert_between(actual: float, low: float, high: float, message: String = "") -> void:
	assertions += 1
	if actual < low or actual > high:
		_fail("%s (%f not in [%f, %f])" % [
			message if message != "" else "value out of range", actual, low, high])


func assert_not_null(value: Variant, message: String = "") -> void:
	assertions += 1
	if value == null:
		_fail(message if message != "" else "expected non-null")


func assert_has(collection: Variant, key: Variant, message: String = "") -> void:
	assertions += 1
	var ok := false
	if typeof(collection) == TYPE_DICTIONARY:
		ok = collection.has(key)
	elif typeof(collection) == TYPE_ARRAY or typeof(collection) == TYPE_PACKED_STRING_ARRAY:
		ok = collection.has(key)
	if not ok:
		_fail("%s (missing %s)" % [message if message != "" else "collection missing key", str(key)])


func fail(message: String) -> void:
	assertions += 1
	_fail(message)


func _fail(message: String) -> void:
	failures.append("%s :: %s" % [_current_test, message])
