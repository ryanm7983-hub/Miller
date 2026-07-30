class_name TextureFactory
extends RefCounted
## Runtime texture synthesis.
##
## Textures are generated with FastNoiseLite (C++ side, synchronous) and kept
## small and single-channel wherever the shader only needs a mask. The shaders
## supply colour through tint uniforms, so one 256x256 L8 noise image (64 KB)
## can serve as the detail for bark, dirt and stone at once.
##
## Why not GPU-compressed formats: a runtime `Image.compress()` to ETC2 costs
## several hundred milliseconds per texture in WebAssembly and ETC2 is not
## available on every desktop WebGL2 driver. Small L8/RG8 sources hit the same
## memory target without the compatibility risk. Authored textures that ship in
## the repository do use ETC2/ASTC import (see project.godot).

const DEFAULT_SIZE := 256


static func _noise(seed_value: int, frequency: float,
		type: FastNoiseLite.NoiseType = FastNoiseLite.TYPE_SIMPLEX_SMOOTH,
		octaves: int = 4, lacunarity: float = 2.0, gain: float = 0.5) -> FastNoiseLite:
	var n := FastNoiseLite.new()
	n.seed = seed_value
	n.noise_type = type
	n.frequency = frequency
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	n.fractal_octaves = octaves
	n.fractal_lacunarity = lacunarity
	n.fractal_gain = gain
	return n


static func _finish(image: Image, mipmaps: bool = true) -> ImageTexture:
	if mipmaps:
		image.generate_mipmaps()
	return ImageTexture.create_from_image(image)


## Seamless grey noise. The workhorse behind most surfaces.
static func noise_tile(seed_value: int, frequency: float = 0.03, size: int = DEFAULT_SIZE,
		octaves: int = 4) -> ImageTexture:
	var n := _noise(seed_value, frequency, FastNoiseLite.TYPE_SIMPLEX_SMOOTH, octaves)
	return _finish(n.get_seamless_image(size, size))


## Vertically stretched fibres: bark, planks, brushed metal.
##
## Generated squat and then stretched with `Image.resize()` rather than by
## copying pixels in GDScript — the engine's resize is native code and turns a
## 65k-iteration loop into a single call.
static func fibre_tile(seed_value: int, size: int = DEFAULT_SIZE,
		stretch: float = 8.0, frequency: float = 0.05) -> ImageTexture:
	var n := _noise(seed_value, frequency, FastNoiseLite.TYPE_SIMPLEX, 4)
	var squat_height := maxi(8, int(float(size) / maxf(stretch, 1.0)))
	var src := n.get_seamless_image(size, squat_height)
	src.resize(size, size, Image.INTERPOLATE_BILINEAR)
	return _finish(src)


## Cracked / cellular pattern for stone and dried mud.
static func cellular_tile(seed_value: int, frequency: float = 0.05,
		size: int = DEFAULT_SIZE) -> ImageTexture:
	var n := _noise(seed_value, frequency, FastNoiseLite.TYPE_CELLULAR, 2)
	n.cellular_return_type = FastNoiseLite.RETURN_DISTANCE2_DIV
	n.cellular_distance_function = FastNoiseLite.DISTANCE_EUCLIDEAN
	n.cellular_jitter = 0.9
	return _finish(n.get_seamless_image(size, size))


## Normal map derived from a height field, for water and wet stone.
static func normal_from_noise(seed_value: int, frequency: float = 0.05,
		size: int = 128, strength: float = 4.0) -> ImageTexture:
	var n := _noise(seed_value, frequency, FastNoiseLite.TYPE_SIMPLEX_SMOOTH, 3)
	var height := n.get_seamless_image(size, size)
	height.convert(Image.FORMAT_RGB8)
	height.bump_map_to_normal_map(strength)
	return _finish(height)


## Needle-cluster alpha mask. Small enough that a per-pixel loop is trivial.
static func needle_mask(seed_value: int, size: int = 128) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var img := Image.create(size, size, false, Image.FORMAT_LA8)
	img.fill(Color(0, 0, 0, 0))
	var centre := Vector2(size * 0.5, size)
	var needles := 90
	for i in needles:
		var angle := rng.randf_range(-PI * 0.92, -PI * 0.08)
		var length := rng.randf_range(size * 0.30, size * 0.62)
		var origin := centre + Vector2(rng.randf_range(-0.32, 0.32) * size, rng.randf_range(-0.30, 0.02) * size)
		var tip := origin + Vector2(cos(angle), sin(angle)) * length
		var shade := rng.randf_range(0.55, 1.0)
		_draw_line(img, origin, tip, rng.randf_range(0.8, 1.9), Color(shade, shade, shade, 1.0))
	# Soften the edges so the alpha cut does not produce hard staircases.
	_blur(img, 1)
	return _finish(img)


## Broadleaf / fern blade mask.
static func leaf_mask(seed_value: int, size: int = 128) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var img := Image.create(size, size, false, Image.FORMAT_LA8)
	img.fill(Color(0, 0, 0, 0))
	var blades := 26
	for i in blades:
		var base_x := rng.randf_range(0.05, 0.95) * size
		var height := rng.randf_range(0.45, 1.0) * size
		var width := rng.randf_range(0.02, 0.055) * size
		var bend := rng.randf_range(-0.25, 0.25) * size
		var shade := rng.randf_range(0.5, 1.0)
		var steps := 18
		for s in steps:
			var t := float(s) / float(steps - 1)
			var x := base_x + bend * t * t
			var y := float(size) - height * t
			var w := width * (1.0 - t * 0.85)
			_draw_disc(img, Vector2(x, y), maxf(w, 0.6), Color(shade, shade, shade, 1.0))
	_blur(img, 1)
	return _finish(img)


## Soft round puff for fog cards and light halos.
static func puff(size: int = 128, softness: float = 1.6) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_L8)
	var n := _noise(97, 0.02, FastNoiseLite.TYPE_SIMPLEX_SMOOTH, 3)
	var noise_img := n.get_seamless_image(size, size)
	var centre := Vector2(size, size) * 0.5
	var radius := float(size) * 0.5
	for y in size:
		for x in size:
			var d := Vector2(x, y).distance_to(centre) / radius
			var falloff := clampf(pow(1.0 - clampf(d, 0.0, 1.0), softness), 0.0, 1.0)
			var value := falloff * (0.55 + 0.45 * noise_img.get_pixel(x, y).r)
			img.set_pixel(x, y, Color(value, value, value))
	return _finish(img)


## Vertical rain streaks for the rain cylinder shader.
static func rain_streaks(seed_value: int = 5, size: int = 128) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var img := Image.create(size, size, false, Image.FORMAT_L8)
	img.fill(Color.BLACK)
	var streaks := 70
	for i in streaks:
		var x := rng.randi_range(0, size - 1)
		var y0 := rng.randi_range(0, size - 1)
		var length := rng.randi_range(int(size * 0.10), int(size * 0.42))
		var brightness := rng.randf_range(0.25, 1.0)
		for s in length:
			var y := (y0 + s) % size
			var fade := sin(float(s) / float(length) * PI)
			var c := Color(brightness * fade, brightness * fade, brightness * fade)
			img.set_pixel(x, y, c)
			if rng.randf() < 0.4 and x + 1 < size:
				img.set_pixel(x + 1, y, c * 0.5)
	return _finish(img)


## Aged paper for notes and journal pages. Generated small and magnified by the
## sampler: the grain is meant to be subtle behind text, not legible.
static func paper(seed_value: int = 11, size: int = 128) -> ImageTexture:
	var n := _noise(seed_value, 0.012, FastNoiseLite.TYPE_SIMPLEX_SMOOTH, 5)
	var stain := _noise(seed_value + 31, 0.004, FastNoiseLite.TYPE_SIMPLEX, 3)
	var base := n.get_seamless_image(size, size)
	var blot := stain.get_seamless_image(size, size)
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	for y in size:
		for x in size:
			var grain := base.get_pixel(x, y).r
			var mark := blot.get_pixel(x, y).r
			var tone := clampf(0.86 - grain * 0.14 - pow(mark, 3.0) * 0.45, 0.0, 1.0)
			img.set_pixel(x, y, Color(tone, tone * 0.955, tone * 0.86))
	return _finish(img)


## Radial gradient used as the flashlight projector cookie.
static func light_cookie(size: int = 128) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_L8)
	var centre := Vector2(size, size) * 0.5
	var radius := float(size) * 0.5
	for y in size:
		for x in size:
			var d := Vector2(x, y).distance_to(centre) / radius
			# Bright hotspot, soft shoulder, hard cut at the rim - like a real
			# reflector torch rather than a perfect cone.
			var v := clampf(1.0 - smoothstep(0.32, 0.98, d), 0.0, 1.0)
			v = v * v * (0.75 + 0.25 * clampf(1.0 - d * 1.6, 0.0, 1.0))
			img.set_pixel(x, y, Color(v, v, v))
	return _finish(img, false)


# --- tiny raster helpers ---------------------------------------------------

static func _draw_line(img: Image, from: Vector2, to: Vector2, width: float, colour: Color) -> void:
	var steps := int(maxf(from.distance_to(to), 1.0))
	for s in steps + 1:
		var p := from.lerp(to, float(s) / float(steps))
		_draw_disc(img, p, width, colour)


static func _draw_disc(img: Image, centre: Vector2, radius: float, colour: Color) -> void:
	var r := int(ceil(radius))
	var w := img.get_width()
	var h := img.get_height()
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var x := int(centre.x) + dx
			var y := int(centre.y) + dy
			if x < 0 or y < 0 or x >= w or y >= h:
				continue
			if Vector2(dx, dy).length() > radius:
				continue
			var existing := img.get_pixel(x, y)
			if existing.a >= colour.a and existing.r >= colour.r:
				continue
			img.set_pixel(x, y, colour)


## Cheap blur: downsample and upsample with bilinear filtering. A 3x3 box blur
## written in GDScript costs ~150k pixel accesses on a 128px mask; this costs
## two native resizes and looks the same at the alpha-cut threshold.
static func _blur(img: Image, strength: int) -> void:
	var w := img.get_width()
	var h := img.get_height()
	var factor := maxi(2, strength * 2)
	img.resize(maxi(4, w / factor), maxi(4, h / factor), Image.INTERPOLATE_BILINEAR)
	img.resize(w, h, Image.INTERPOLATE_BILINEAR)
