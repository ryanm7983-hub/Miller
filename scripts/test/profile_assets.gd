extends Node
## Boot-cost profiler for the procedural asset pipeline.
##
##   godot --headless --path . res://scenes/test/profile_assets.tscn
##
## Everything the game ships is generated at startup, so "how long does the
## first frame take?" is a number that has to be watched. The browser build runs
## roughly 3-4x slower than this native measurement, so the working budget is
## about 1.5 s here for a ~5 s worst case on a mid-range phone.
##
## Run this after touching MeshFactory, TextureFactory or AudioSynth.

var _rows: Array[Dictionary] = []


func _ready() -> void:
	call_deferred("_run")


func _bench(label: String, fn: Callable) -> void:
	var started := Time.get_ticks_usec()
	fn.call()
	var ms := float(Time.get_ticks_usec() - started) / 1000.0
	_rows.append({"label": label, "ms": ms})
	print("  %-26s %8.1f ms" % [label, ms])


func _run() -> void:
	print("Asset generation profile")
	print("--- visual ---")
	_bench("shaders", func() -> void: AssetFoundry._build_shaders())
	_bench("ground textures", func() -> void: AssetFoundry._build_ground_textures())
	_bench("organic textures", func() -> void: AssetFoundry._build_organic_textures())
	_bench("effect textures", func() -> void: AssetFoundry._build_effect_textures())
	_bench("materials", func() -> void: AssetFoundry._build_materials())
	_bench("tree meshes", func() -> void: AssetFoundry._build_tree_meshes())
	_bench("prop meshes", func() -> void: AssetFoundry._build_prop_meshes())
	_bench("creature meshes", func() -> void: AssetFoundry._build_creature_meshes())
	print("--- audio ---")
	_bench("ambience beds", func() -> void: AudioDirector._build_beds())
	_bench("footsteps", func() -> void: AudioDirector._build_footsteps())
	_bench("world sfx", func() -> void: AudioDirector._build_world_sfx())
	_bench("wildlife", func() -> void: AudioDirector._build_wildlife())
	_bench("horror", func() -> void: AudioDirector._build_horror())
	_bench("ui and music", func() -> void: AudioDirector._build_ui_and_music())

	var total := 0.0
	var worst := {"label": "-", "ms": 0.0}
	for row in _rows:
		total += float(row["ms"])
		if float(row["ms"]) > float(worst["ms"]):
			worst = row
	print("")
	print("  total %.1f ms   (slowest stage: %s at %.1f ms)" % [total, worst["label"], worst["ms"]])
	print("  projected web worst case: ~%.1f s" % (total * 3.5 / 1000.0))
	get_tree().quit(0)
