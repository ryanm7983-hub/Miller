extends Node
## Headless test runner.
##
## Runs as a scene (rather than `--script`) so that the game's autoloads are
## live: most of what is worth testing here is the interaction between
## GameState, SaveManager, the world generator and the AI, and all of those
## reach for singletons.
##
##   godot --headless --path . res://scenes/test/test_runner.tscn
##
## Exits 0 when everything passes, 1 otherwise, so CI can gate on it.

const TEST_DIR := "res://tests"

var _total := 0
var _passed := 0
var _failed := 0
var _assertions := 0
var _failure_lines: PackedStringArray = []
var _started_at := 0


func _ready() -> void:
	_started_at = Time.get_ticks_msec()
	Log.level = Log.Level.WARN
	call_deferred("_run")


func _run() -> void:
	print_rich("[b]The Black Pine - test suite[/b]")
	var scripts := _discover()
	if scripts.is_empty():
		push_error("no test scripts found under %s" % TEST_DIR)
		get_tree().quit(1)
		return

	for path in scripts:
		await _run_case(path)

	var elapsed := Time.get_ticks_msec() - _started_at
	print("")
	print("---------------------------------------------")
	print("%d tests, %d assertions, %d failed  (%d ms)" % [
		_total, _assertions, _failed, elapsed])
	if _failed > 0:
		print("")
		for line in _failure_lines:
			print("  FAIL  %s" % line)
	print("---------------------------------------------")
	get_tree().quit(0 if _failed == 0 else 1)


func _discover() -> PackedStringArray:
	var out: PackedStringArray = []
	var dir := DirAccess.open(TEST_DIR)
	if dir == null:
		return out
	dir.list_dir_begin()
	var entry := dir.get_next()
	while entry != "":
		if not dir.current_is_dir() and entry.begins_with("test_") and entry.ends_with(".gd"):
			out.append("%s/%s" % [TEST_DIR, entry])
		entry = dir.get_next()
	dir.list_dir_end()
	var sorted := Array(out)
	sorted.sort()
	return PackedStringArray(sorted)


func _run_case(path: String) -> void:
	var script: Script = load(path)
	if script == null:
		_failure_lines.append("%s :: could not load script" % path)
		_failed += 1
		return
	var instance: TestCase = script.new()
	if instance == null:
		_failure_lines.append("%s :: not a TestCase" % path)
		_failed += 1
		return
	instance.tree = get_tree()

	var methods: Array[String] = []
	for entry in instance.get_method_list():
		var method_name: String = entry["name"]
		if method_name.begins_with("test_") and not methods.has(method_name):
			methods.append(method_name)
	methods.sort()

	print("")
	print("%s (%d)" % [instance.suite_name(), methods.size()])

	# `await` on a call expression handles both plain functions and coroutines,
	# so individual tests are free to yield without the runner caring.
	await instance.before_all()
	for method_name in methods:
		_total += 1
		instance.failures.clear()
		instance.begin_test(method_name)
		await instance.before_each()
		await instance.call(method_name)
		await instance.after_each()
		await get_tree().process_frame
		if instance.failures.is_empty():
			_passed += 1
			print("  ok    %s" % method_name)
		else:
			_failed += 1
			print("  FAIL  %s" % method_name)
			for failure in instance.failures:
				_failure_lines.append("%s :: %s" % [instance.suite_name(), failure])
	await instance.after_all()
	_assertions += instance.assertions
