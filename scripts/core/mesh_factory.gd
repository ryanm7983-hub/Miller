class_name MeshFactory
extends RefCounted
## Procedural mesh construction.
##
## Every mesh in the game is built here from primitives. That is a deliberate
## trade for the HTML5 target: the whole game downloads in a few hundred
## kilobytes, there is no glTF import step, no texture atlas to stream, and
## meshes can be generated at exactly the triangle budget the current quality
## tier asks for.
##
## Conventions used by the shaders:
##   * COLOR.r  - wind influence (0 = rigid, 1 = whips around)
##   * COLOR.g  - baked ambient occlusion (0 = dark crevice, 1 = open)
##   * COLOR.b  - material variation / per-instance tint mask
##
## All builders return an ArrayMesh with normals and tangents generated.

# ---------------------------------------------------------------------------
# Collision
# ---------------------------------------------------------------------------

## Triangles from `mesh`, wound for `ConcavePolygonShape3D`.
##
## The renderer and the collision shape disagree about which winding faces
## which way, so `shape.set_faces(mesh.get_faces())` — the obvious line, and the
## one this project had in three places — builds a collider whose front faces
## point *into* the geometry. Godot culls backfaces during collision, so the
## result is a shape that is present, correctly positioned, has the right vertex
## count, reports no error, and lets everything fall straight through it. The
## terrain looked solid for weeks that way.
##
## Anything handing mesh triangles to a collision shape must go through here.
static func collision_faces(mesh: Mesh) -> PackedVector3Array:
	var source := mesh.get_faces()
	var out := PackedVector3Array()
	out.resize(source.size())
	var i := 0
	while i + 2 < source.size():
		out[i] = source[i]
		out[i + 1] = source[i + 2]
		out[i + 2] = source[i + 1]
		i += 3
	return out


# ---------------------------------------------------------------------------
# Low level primitive helpers
# ---------------------------------------------------------------------------

static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3,
		uv_scale: Vector2 = Vector2.ONE, colour: Color = Color.WHITE) -> void:
	st.set_color(colour)
	st.set_uv(Vector2(0, 0) * uv_scale); st.add_vertex(a)
	st.set_uv(Vector2(1, 0) * uv_scale); st.add_vertex(b)
	st.set_uv(Vector2(1, 1) * uv_scale); st.add_vertex(c)

	st.set_uv(Vector2(0, 0) * uv_scale); st.add_vertex(a)
	st.set_uv(Vector2(1, 1) * uv_scale); st.add_vertex(c)
	st.set_uv(Vector2(0, 1) * uv_scale); st.add_vertex(d)


## Axis-aligned box. `ao_bottom` darkens the lower vertices so untextured
## geometry still reads as grounded.
static func add_box(st: SurfaceTool, centre: Vector3, size: Vector3,
		uv_scale: float = 1.0, wind: float = 0.0, ao_bottom: float = 0.55) -> void:
	var h := size * 0.5
	var top := Color(wind, 1.0, 0.5)
	var bot := Color(wind * 0.35, ao_bottom, 0.5)
	var p := []
	for i in 8:
		p.append(centre + Vector3(
			h.x if (i & 1) else -h.x,
			h.y if (i & 2) else -h.y,
			h.z if (i & 4) else -h.z))
	var u := Vector2(maxf(size.x, size.z), size.y) * uv_scale
	var uxz := Vector2(size.x, size.z) * uv_scale
	# -Z, +Z, -X, +X, +Y, -Y
	_quad_c(st, p[1], p[0], p[2], p[3], u, bot, bot, top, top)
	_quad_c(st, p[4], p[5], p[7], p[6], u, bot, bot, top, top)
	_quad_c(st, p[0], p[4], p[6], p[2], u, bot, bot, top, top)
	_quad_c(st, p[5], p[1], p[3], p[7], u, bot, bot, top, top)
	_quad_c(st, p[2], p[6], p[7], p[3], uxz, top, top, top, top)
	_quad_c(st, p[4], p[0], p[1], p[5], uxz, bot, bot, bot, bot)


static func _quad_c(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3,
		uv: Vector2, ca: Color, cb: Color, cc: Color, cd: Color) -> void:
	st.set_color(ca); st.set_uv(Vector2(0, 0)); st.add_vertex(a)
	st.set_color(cb); st.set_uv(Vector2(uv.x, 0)); st.add_vertex(b)
	st.set_color(cc); st.set_uv(Vector2(uv.x, uv.y)); st.add_vertex(c)

	st.set_color(ca); st.set_uv(Vector2(0, 0)); st.add_vertex(a)
	st.set_color(cc); st.set_uv(Vector2(uv.x, uv.y)); st.add_vertex(c)
	st.set_color(cd); st.set_uv(Vector2(0, uv.y)); st.add_vertex(d)


## Tapered cylinder along +Y, optionally leaning and bending.
static func add_tapered_cylinder(st: SurfaceTool, base: Vector3, height: float,
		radius_bottom: float, radius_top: float, sides: int,
		lean: Vector3 = Vector3.ZERO, rings: int = 1,
		wind_bottom: float = 0.0, wind_top: float = 0.0, cap: bool = true) -> void:
	sides = maxi(3, sides)
	rings = maxi(1, rings)
	for ring in rings:
		var t0 := float(ring) / float(rings)
		var t1 := float(ring + 1) / float(rings)
		var r0 := lerpf(radius_bottom, radius_top, t0)
		var r1 := lerpf(radius_bottom, radius_top, t1)
		var c0 := base + Vector3(0, height * t0, 0) + lean * (t0 * t0)
		var c1 := base + Vector3(0, height * t1, 0) + lean * (t1 * t1)
		var w0 := lerpf(wind_bottom, wind_top, t0)
		var w1 := lerpf(wind_bottom, wind_top, t1)
		for i in sides:
			var a0 := TAU * float(i) / float(sides)
			var a1 := TAU * float(i + 1) / float(sides)
			var d0 := Vector3(cos(a0), 0, sin(a0))
			var d1 := Vector3(cos(a1), 0, sin(a1))
			var col0 := Color(w0, lerpf(0.55, 1.0, t0), 0.5)
			var col1 := Color(w1, lerpf(0.55, 1.0, t1), 0.5)
			var u0 := float(i) / float(sides) * 2.0
			var u1 := float(i + 1) / float(sides) * 2.0
			var v0 := t0 * height * 0.5
			var v1 := t1 * height * 0.5
			st.set_color(col0); st.set_uv(Vector2(u0, v0)); st.add_vertex(c0 + d0 * r0)
			st.set_color(col0); st.set_uv(Vector2(u1, v0)); st.add_vertex(c0 + d1 * r0)
			st.set_color(col1); st.set_uv(Vector2(u1, v1)); st.add_vertex(c1 + d1 * r1)

			st.set_color(col0); st.set_uv(Vector2(u0, v0)); st.add_vertex(c0 + d0 * r0)
			st.set_color(col1); st.set_uv(Vector2(u1, v1)); st.add_vertex(c1 + d1 * r1)
			st.set_color(col1); st.set_uv(Vector2(u0, v1)); st.add_vertex(c1 + d0 * r1)
	if cap and radius_top > 0.001:
		var top_centre := base + Vector3(0, height, 0) + lean
		for i in sides:
			var a0 := TAU * float(i) / float(sides)
			var a1 := TAU * float(i + 1) / float(sides)
			st.set_color(Color(wind_top, 1.0, 0.5))
			st.set_uv(Vector2(0.5, 0.5)); st.add_vertex(top_centre)
			st.set_uv(Vector2(0.5 + cos(a1) * 0.5, 0.5 + sin(a1) * 0.5))
			st.add_vertex(top_centre + Vector3(cos(a1), 0, sin(a1)) * radius_top)
			st.set_uv(Vector2(0.5 + cos(a0) * 0.5, 0.5 + sin(a0) * 0.5))
			st.add_vertex(top_centre + Vector3(cos(a0), 0, sin(a0)) * radius_top)


## Cone skirt used for conifer foliage layers.
static func add_cone(st: SurfaceTool, apex: Vector3, height: float, radius: float,
		sides: int, wind_apex: float, wind_rim: float, droop: float = 0.25) -> void:
	sides = maxi(3, sides)
	var base_y := apex.y - height
	for i in sides:
		var a0 := TAU * float(i) / float(sides)
		var a1 := TAU * float(i + 1) / float(sides)
		var p0 := Vector3(apex.x + cos(a0) * radius, base_y - droop, apex.z + sin(a0) * radius)
		var p1 := Vector3(apex.x + cos(a1) * radius, base_y - droop, apex.z + sin(a1) * radius)
		st.set_color(Color(wind_apex, 1.0, 0.5))
		st.set_uv(Vector2(0.5, 0.0)); st.add_vertex(apex)
		st.set_color(Color(wind_rim, 0.72, 0.5))
		st.set_uv(Vector2(0.0, 1.0)); st.add_vertex(p1)
		st.set_color(Color(wind_rim, 0.72, 0.5))
		st.set_uv(Vector2(1.0, 1.0)); st.add_vertex(p0)
		# Underside so the canopy is not see-through from below.
		st.set_color(Color(wind_apex, 0.4, 0.5))
		st.set_uv(Vector2(0.5, 0.0)); st.add_vertex(apex)
		st.set_color(Color(wind_rim, 0.3, 0.5))
		st.set_uv(Vector2(1.0, 1.0)); st.add_vertex(p0)
		st.set_color(Color(wind_rim, 0.3, 0.5))
		st.set_uv(Vector2(0.0, 1.0)); st.add_vertex(p1)


## Two crossed vertical quads - the classic cheap vegetation impostor.
static func add_cross_planes(st: SurfaceTool, origin: Vector3, width: float, height: float,
		planes: int = 2, wind_top: float = 1.0, y_offset: float = 0.0) -> void:
	for i in planes:
		var angle := PI * float(i) / float(planes)
		var dir := Vector3(cos(angle), 0, sin(angle)) * width * 0.5
		var bottom_l := origin - dir + Vector3(0, y_offset, 0)
		var bottom_r := origin + dir + Vector3(0, y_offset, 0)
		var top_l := bottom_l + Vector3(0, height, 0)
		var top_r := bottom_r + Vector3(0, height, 0)
		var cb := Color(0.0, 0.45, 0.5)
		var ct := Color(wind_top, 1.0, 0.5)
		# Both faces, so the plane is visible from either side without needing
		# a two-sided material (cheaper than disabling backface culling).
		st.set_color(cb); st.set_uv(Vector2(0, 1)); st.add_vertex(bottom_l)
		st.set_color(cb); st.set_uv(Vector2(1, 1)); st.add_vertex(bottom_r)
		st.set_color(ct); st.set_uv(Vector2(1, 0)); st.add_vertex(top_r)
		st.set_color(cb); st.set_uv(Vector2(0, 1)); st.add_vertex(bottom_l)
		st.set_color(ct); st.set_uv(Vector2(1, 0)); st.add_vertex(top_r)
		st.set_color(ct); st.set_uv(Vector2(0, 0)); st.add_vertex(top_l)

		st.set_color(cb); st.set_uv(Vector2(1, 1)); st.add_vertex(bottom_r)
		st.set_color(cb); st.set_uv(Vector2(0, 1)); st.add_vertex(bottom_l)
		st.set_color(ct); st.set_uv(Vector2(0, 0)); st.add_vertex(top_l)
		st.set_color(cb); st.set_uv(Vector2(1, 1)); st.add_vertex(bottom_r)
		st.set_color(ct); st.set_uv(Vector2(0, 0)); st.add_vertex(top_l)
		st.set_color(ct); st.set_uv(Vector2(1, 0)); st.add_vertex(top_r)


## Irregular low-poly blob, used for rocks and boulders.
static func add_rock(st: SurfaceTool, centre: Vector3, radius: Vector3, rings: int,
		segments: int, rng: RandomNumberGenerator, jitter: float = 0.22) -> void:
	rings = maxi(2, rings)
	segments = maxi(4, segments)
	var grid: Array = []
	for r in range(rings + 1):
		var row: Array = []
		var phi := PI * float(r) / float(rings)
		for s in range(segments + 1):
			var theta := TAU * float(s) / float(segments)
			var n := Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
			var wobble := 1.0 + rng.randf_range(-jitter, jitter)
			if s == segments:
				wobble = 1.0  # keep the seam watertight
			row.append(centre + Vector3(n.x * radius.x, n.y * radius.y, n.z * radius.z) * wobble)
		grid.append(row)
	# Re-stitch the seam with the values from column 0.
	for r in range(rings + 1):
		grid[r][segments] = grid[r][0]
	for r in range(rings):
		for s in range(segments):
			var a: Vector3 = grid[r][s]
			var b: Vector3 = grid[r][s + 1]
			var c: Vector3 = grid[r + 1][s + 1]
			var d: Vector3 = grid[r + 1][s]
			var ao_top := clampf((a.y - centre.y) / maxf(radius.y, 0.01) * 0.5 + 0.6, 0.3, 1.0)
			var ao_bot := clampf((d.y - centre.y) / maxf(radius.y, 0.01) * 0.5 + 0.6, 0.3, 1.0)
			var ct := Color(0.0, ao_top, 0.5)
			var cbm := Color(0.0, ao_bot, 0.5)
			st.set_color(ct); st.set_uv(Vector2(a.x, a.z) * 0.4); st.add_vertex(a)
			st.set_color(ct); st.set_uv(Vector2(b.x, b.z) * 0.4); st.add_vertex(b)
			st.set_color(cbm); st.set_uv(Vector2(c.x, c.z) * 0.4); st.add_vertex(c)
			st.set_color(ct); st.set_uv(Vector2(a.x, a.z) * 0.4); st.add_vertex(a)
			st.set_color(cbm); st.set_uv(Vector2(c.x, c.z) * 0.4); st.add_vertex(c)
			st.set_color(cbm); st.set_uv(Vector2(d.x, d.z) * 0.4); st.add_vertex(d)


static func _finish(st: SurfaceTool, smooth: bool = false) -> ArrayMesh:
	st.generate_normals(not smooth)
	st.generate_tangents()
	st.index()
	return st.commit()


static func _new_surface() -> SurfaceTool:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	return st


# ---------------------------------------------------------------------------
# Vegetation
# ---------------------------------------------------------------------------

## Black pine. `lod` 0 = full, 1 = reduced, 2 = crossed impostor.
## Returns a mesh whose surface 0 is bark and surface 1 is needles, so a single
## MultiMeshInstance3D can draw a forest with two materials.
static func pine_tree(rng: RandomNumberGenerator, lod: int = 0, height: float = 14.0) -> ArrayMesh:
	var trunk_r := height * 0.026
	var lean := Vector3(rng.randf_range(-0.5, 0.5), 0, rng.randf_range(-0.5, 0.5)) * (height * 0.03)

	var bark := _new_surface()
	var needles := _new_surface()

	match lod:
		0:
			add_tapered_cylinder(bark, Vector3.ZERO, height, trunk_r * 1.35, trunk_r * 0.22,
					7, lean, 4, 0.0, 0.35)
			var layers := 7
			var crown_start := height * 0.30
			for i in layers:
				var t := float(i) / float(layers - 1)
				var y := lerpf(crown_start, height * 1.02, t)
				var radius := lerpf(height * 0.20, height * 0.045, pow(t, 0.72))
				var cone_h := lerpf(height * 0.17, height * 0.09, t)
				var apex := Vector3(0, y + cone_h, 0) + lean * pow(y / height, 2.0)
				add_cone(needles, apex, cone_h, radius, 8,
						lerpf(0.25, 0.8, t), lerpf(0.55, 1.0, t), height * 0.02)
		1:
			add_tapered_cylinder(bark, Vector3.ZERO, height, trunk_r * 1.3, trunk_r * 0.25,
					5, lean, 2, 0.0, 0.3)
			for i in 4:
				var t := float(i) / 3.0
				var y := lerpf(height * 0.34, height * 1.0, t)
				var radius := lerpf(height * 0.19, height * 0.05, pow(t, 0.7))
				var cone_h := lerpf(height * 0.24, height * 0.14, t)
				add_cone(needles, Vector3(0, y + cone_h, 0) + lean, cone_h, radius, 6,
						lerpf(0.3, 0.8, t), lerpf(0.6, 1.0, t), height * 0.02)
		_:
			add_tapered_cylinder(bark, Vector3.ZERO, height * 0.34, trunk_r * 1.2, trunk_r * 0.7,
					4, Vector3.ZERO, 1, 0.0, 0.15)
			add_cross_planes(needles, Vector3(0, height * 0.30, 0),
					height * 0.40, height * 0.74, 2, 0.75)

	var mesh := _finish(bark)
	var needle_mesh := _finish(needles)
	if needle_mesh.get_surface_count() > 0:
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,
				needle_mesh.surface_get_arrays(0))
	return mesh


## Bare, storm-killed pine - the visual signature of the burn scar.
static func dead_tree(rng: RandomNumberGenerator, height: float = 11.0) -> ArrayMesh:
	var st := _new_surface()
	var lean := Vector3(rng.randf_range(-1.0, 1.0), 0, rng.randf_range(-1.0, 1.0)) * height * 0.05
	add_tapered_cylinder(st, Vector3.ZERO, height, height * 0.03, height * 0.006, 6, lean, 3, 0.0, 0.45)
	var branches := rng.randi_range(3, 6)
	for i in branches:
		var t := rng.randf_range(0.35, 0.9)
		var origin := Vector3(0, height * t, 0) + lean * (t * t)
		var angle := rng.randf() * TAU
		var length := height * rng.randf_range(0.12, 0.28)
		var dir := Vector3(cos(angle), rng.randf_range(0.1, 0.55), sin(angle)).normalized()
		add_tapered_cylinder(st, origin, length * dir.y + 0.05, height * 0.012, height * 0.003, 4,
				Vector3(dir.x, 0, dir.z) * length, 2, 0.2, 0.7)
	return _finish(st)


static func bush(rng: RandomNumberGenerator, radius: float = 0.9) -> ArrayMesh:
	var st := _new_surface()
	var clumps := rng.randi_range(3, 5)
	for i in clumps:
		var offset := Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1)) * radius * 0.45
		add_cross_planes(st, offset, radius * rng.randf_range(0.8, 1.3),
				radius * rng.randf_range(0.9, 1.5), 2, 1.0)
	return _finish(st, true)


static func fern(rng: RandomNumberGenerator, size: float = 0.65) -> ArrayMesh:
	var st := _new_surface()
	var fronds := rng.randi_range(4, 7)
	for i in fronds:
		var angle := TAU * float(i) / float(fronds) + rng.randf_range(-0.3, 0.3)
		var dir := Vector3(cos(angle), 0, sin(angle))
		var tip := dir * size * rng.randf_range(0.8, 1.3) + Vector3(0, size * 0.75, 0)
		var w := dir.cross(Vector3.UP) * size * 0.13
		st.set_color(Color(0.15, 0.5, 0.5)); st.set_uv(Vector2(0, 1)); st.add_vertex(-w)
		st.set_color(Color(0.15, 0.5, 0.5)); st.set_uv(Vector2(1, 1)); st.add_vertex(w)
		st.set_color(Color(1.0, 1.0, 0.5)); st.set_uv(Vector2(0.5, 0)); st.add_vertex(tip)
		st.set_color(Color(0.15, 0.5, 0.5)); st.set_uv(Vector2(1, 1)); st.add_vertex(w)
		st.set_color(Color(0.15, 0.5, 0.5)); st.set_uv(Vector2(0, 1)); st.add_vertex(-w)
		st.set_color(Color(1.0, 1.0, 0.5)); st.set_uv(Vector2(0.5, 0)); st.add_vertex(tip)
	return _finish(st, true)


## A patch of grass blades sharing one draw call.
static func grass_patch(rng: RandomNumberGenerator, blades: int = 8, size: float = 0.45) -> ArrayMesh:
	var st := _new_surface()
	for i in blades:
		var origin := Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1)) * size
		add_cross_planes(st, origin, size * rng.randf_range(0.35, 0.6),
				size * rng.randf_range(0.7, 1.4), 1, 1.0)
	return _finish(st, true)


static func rock(rng: RandomNumberGenerator, scale: float = 1.0, detail: int = 1) -> ArrayMesh:
	var st := _new_surface()
	var radius := Vector3(
		scale * rng.randf_range(0.7, 1.3),
		scale * rng.randf_range(0.5, 0.95),
		scale * rng.randf_range(0.7, 1.3))
	add_rock(st, Vector3(0, radius.y * 0.55, 0), radius,
			3 + detail, 6 + detail * 2, rng, 0.24)
	return _finish(st)


static func log_prop(rng: RandomNumberGenerator, length: float = 3.2, radius: float = 0.28) -> ArrayMesh:
	var st := _new_surface()
	add_tapered_cylinder(st, Vector3(0, radius, -length * 0.5), 0.001, radius, radius * 0.85, 7,
			Vector3(0, 0, length), 3, 0.0, 0.0, true)
	return _finish(st)


static func stump(rng: RandomNumberGenerator, radius: float = 0.45) -> ArrayMesh:
	var st := _new_surface()
	var h := radius * rng.randf_range(1.1, 2.0)
	add_tapered_cylinder(st, Vector3.ZERO, h, radius * 1.15, radius * 0.95, 8, Vector3.ZERO, 2)
	return _finish(st)


# ---------------------------------------------------------------------------
# Structures
# ---------------------------------------------------------------------------

## Hollow rectangular room with a doorway punched in the -Z wall.
## `openings` is a list of {"side": "n"|"s"|"e"|"w", "x": float, "w": float, "y0": float, "y1": float}.
static func room_shell(size: Vector3, wall: float, openings: Array) -> ArrayMesh:
	var st := _new_surface()
	var hx := size.x * 0.5
	var hz := size.z * 0.5
	# Floor
	add_box(st, Vector3(0, -wall * 0.5, 0), Vector3(size.x, wall, size.z), 0.5, 0.0, 0.75)
	for side in ["n", "s", "e", "w"]:
		var spans := _wall_spans(side, size, openings)
		for span: Dictionary in spans:
			var a: float = span["a"]
			var b: float = span["b"]
			var y0: float = span["y0"]
			var y1: float = span["y1"]
			var mid := (a + b) * 0.5
			var length := b - a
			if length <= 0.01 or y1 - y0 <= 0.01:
				continue
			match side:
				"n":
					add_box(st, Vector3(mid, (y0 + y1) * 0.5, -hz + wall * 0.5),
							Vector3(length, y1 - y0, wall), 0.6, 0.0, 0.5)
				"s":
					add_box(st, Vector3(mid, (y0 + y1) * 0.5, hz - wall * 0.5),
							Vector3(length, y1 - y0, wall), 0.6, 0.0, 0.5)
				"w":
					add_box(st, Vector3(-hx + wall * 0.5, (y0 + y1) * 0.5, mid),
							Vector3(wall, y1 - y0, length), 0.6, 0.0, 0.5)
				"e":
					add_box(st, Vector3(hx - wall * 0.5, (y0 + y1) * 0.5, mid),
							Vector3(wall, y1 - y0, length), 0.6, 0.0, 0.5)
	return _finish(st)


## Split a wall into solid spans around its openings.
static func _wall_spans(side: String, size: Vector3, openings: Array) -> Array:
	var extent: float = size.z if (side == "e" or side == "w") else size.x
	var half := extent * 0.5
	var mine: Array = []
	for o: Dictionary in openings:
		if String(o.get("side", "n")) == side:
			mine.append(o)
	mine.sort_custom(func(a, b): return float(a.get("x", 0.0)) < float(b.get("x", 0.0)))
	var spans: Array = []
	var cursor := -half
	for o: Dictionary in mine:
		var cx := float(o.get("x", 0.0))
		var w := float(o.get("w", 1.0))
		var y0 := float(o.get("y0", 0.0))
		var y1 := float(o.get("y1", size.y))
		var left := cx - w * 0.5
		var right := cx + w * 0.5
		if left > cursor:
			spans.append({"a": cursor, "b": left, "y0": 0.0, "y1": size.y})
		# Lintel above and sill below the opening.
		if y1 < size.y:
			spans.append({"a": left, "b": right, "y0": y1, "y1": size.y})
		if y0 > 0.0:
			spans.append({"a": left, "b": right, "y0": 0.0, "y1": y0})
		cursor = maxf(cursor, right)
	if cursor < half:
		spans.append({"a": cursor, "b": half, "y0": 0.0, "y1": size.y})
	return spans


## Gable roof sitting on top of a room of the given footprint.
static func gable_roof(size: Vector3, pitch: float, overhang: float = 0.4) -> ArrayMesh:
	var st := _new_surface()
	var hx := size.x * 0.5 + overhang
	var hz := size.z * 0.5 + overhang
	var peak := size.y + pitch
	var eave := size.y
	var a := Vector3(-hx, eave, -hz)
	var b := Vector3(hx, eave, -hz)
	var c := Vector3(hx, eave, hz)
	var d := Vector3(-hx, eave, hz)
	var ridge_n := Vector3(0, peak, -hz)
	var ridge_s := Vector3(0, peak, hz)
	var col := Color(0.0, 1.0, 0.5)
	# Two slopes
	_quad_c(st, a, ridge_n, ridge_s, d, Vector2(size.z, hx), col, col, col, col)
	_quad_c(st, ridge_n, b, c, ridge_s, Vector2(size.z, hx), col, col, col, col)
	# Underside (so the roof is not invisible from inside)
	_quad_c(st, d, ridge_s, ridge_n, a, Vector2(size.z, hx),
			Color(0, 0.3, 0.5), Color(0, 0.3, 0.5), Color(0, 0.3, 0.5), Color(0, 0.3, 0.5))
	_quad_c(st, ridge_s, c, b, ridge_n, Vector2(size.z, hx),
			Color(0, 0.3, 0.5), Color(0, 0.3, 0.5), Color(0, 0.3, 0.5), Color(0, 0.3, 0.5))
	# Gable ends
	st.set_color(col)
	st.set_uv(Vector2(0, 1)); st.add_vertex(a)
	st.set_uv(Vector2(1, 1)); st.add_vertex(b)
	st.set_uv(Vector2(0.5, 0)); st.add_vertex(ridge_n)
	st.set_uv(Vector2(1, 1)); st.add_vertex(c)
	st.set_uv(Vector2(0, 1)); st.add_vertex(d)
	st.set_uv(Vector2(0.5, 0)); st.add_vertex(ridge_s)
	return _finish(st)


## Four-legged lattice tower (fire watch tower substructure).
static func lattice_tower(height: float, base_width: float, top_width: float,
		post: float = 0.16, rungs: int = 6) -> ArrayMesh:
	var st := _new_surface()
	for i in 4:
		var sx := 1.0 if (i & 1) else -1.0
		var sz := 1.0 if (i & 2) else -1.0
		var bottom := Vector3(sx * base_width * 0.5, 0, sz * base_width * 0.5)
		var top := Vector3(sx * top_width * 0.5, height, sz * top_width * 0.5)
		var lean := top - bottom - Vector3(0, height, 0)
		add_tapered_cylinder(st, bottom, height, post, post * 0.9, 4, lean, 3)
	for r in range(1, rungs + 1):
		var t := float(r) / float(rungs + 1)
		var y := height * t
		var w := lerpf(base_width, top_width, t)
		add_box(st, Vector3(0, y, -w * 0.5), Vector3(w, post * 0.7, post * 0.7), 1.0, 0.0, 0.8)
		add_box(st, Vector3(0, y, w * 0.5), Vector3(w, post * 0.7, post * 0.7), 1.0, 0.0, 0.8)
		add_box(st, Vector3(-w * 0.5, y, 0), Vector3(post * 0.7, post * 0.7, w), 1.0, 0.0, 0.8)
		add_box(st, Vector3(w * 0.5, y, 0), Vector3(post * 0.7, post * 0.7, w), 1.0, 0.0, 0.8)
	return _finish(st)


static func plank_door(width: float = 0.95, height: float = 2.05, thickness: float = 0.08) -> ArrayMesh:
	var st := _new_surface()
	# Hinge at local origin so the door node can simply rotate about Y.
	add_box(st, Vector3(width * 0.5, height * 0.5, 0), Vector3(width, height, thickness), 1.0)
	add_box(st, Vector3(width * 0.5, height * 0.25, thickness * 0.6),
			Vector3(width * 0.95, 0.09, thickness * 0.3), 1.0)
	add_box(st, Vector3(width * 0.5, height * 0.78, thickness * 0.6),
			Vector3(width * 0.95, 0.09, thickness * 0.3), 1.0)
	return _finish(st)


static func crate(size: float = 0.7) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3(0, size * 0.5, 0), Vector3.ONE * size, 1.2)
	var edge := size * 0.5 + 0.012
	for axis in 3:
		for sign_i in [-1.0, 1.0]:
			var thin := Vector3.ONE * (size * 0.96)
			thin[axis] = 0.03
			var pos := Vector3(0, size * 0.5, 0)
			pos[axis] = edge * sign_i
			add_box(st, pos, thin, 1.0, 0.0, 0.9)
	return _finish(st)


static func barrel(radius: float = 0.34, height: float = 0.9) -> ArrayMesh:
	var st := _new_surface()
	add_tapered_cylinder(st, Vector3.ZERO, height, radius * 0.92, radius * 0.92, 10, Vector3.ZERO, 3)
	add_tapered_cylinder(st, Vector3(0, height * 0.22, 0), 0.06, radius, radius, 10)
	add_tapered_cylinder(st, Vector3(0, height * 0.7, 0), 0.06, radius, radius, 10)
	return _finish(st)


static func gravestone(rng: RandomNumberGenerator) -> ArrayMesh:
	var st := _new_surface()
	var w := rng.randf_range(0.38, 0.6)
	var h := rng.randf_range(0.55, 1.1)
	add_box(st, Vector3(0, h * 0.5, 0), Vector3(w, h, 0.11), 1.0, 0.0, 0.4)
	add_box(st, Vector3(0, 0.06, 0), Vector3(w * 1.35, 0.12, 0.3), 1.0, 0.0, 0.35)
	return _finish(st)


static func sign_post(width: float = 1.1, height: float = 1.6) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3(0, height * 0.5, 0), Vector3(0.1, height, 0.1), 1.0, 0.0, 0.5)
	add_box(st, Vector3(0, height * 0.86, 0.03), Vector3(width, 0.42, 0.05), 1.0, 0.0, 0.9)
	return _finish(st)


static func fence_section(length: float = 2.4, height: float = 1.15) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3(-length * 0.5, height * 0.5, 0), Vector3(0.1, height, 0.1))
	add_box(st, Vector3(length * 0.5, height * 0.5, 0), Vector3(0.1, height, 0.1))
	add_box(st, Vector3(0, height * 0.75, 0), Vector3(length, 0.08, 0.05), 1.0, 0.0, 0.9)
	add_box(st, Vector3(0, height * 0.42, 0), Vector3(length, 0.08, 0.05), 1.0, 0.0, 0.9)
	return _finish(st)


## Antenna mast for the relay - tall, thin, with guy wires implied by struts.
static func antenna_mast(height: float = 9.0) -> ArrayMesh:
	var st := _new_surface()
	add_tapered_cylinder(st, Vector3.ZERO, height, 0.14, 0.05, 6, Vector3.ZERO, 3)
	for i in 4:
		var y := height * (0.35 + 0.16 * i)
		var w := lerpf(0.9, 0.45, float(i) / 3.0)
		add_box(st, Vector3(0, y, 0), Vector3(w, 0.05, 0.05), 1.0, 0.0, 0.9)
		add_box(st, Vector3(0, y + 0.06, 0), Vector3(0.05, 0.05, w * 0.8), 1.0, 0.0, 0.9)
	return _finish(st)


## Simple listening post: a weatherproof box on a short mast with a horn.
static func listening_post() -> ArrayMesh:
	var st := _new_surface()
	add_tapered_cylinder(st, Vector3.ZERO, 1.5, 0.09, 0.07, 6, Vector3.ZERO, 2)
	add_box(st, Vector3(0, 1.62, 0), Vector3(0.42, 0.34, 0.24), 1.0, 0.0, 0.6)
	add_tapered_cylinder(st, Vector3(0, 1.86, 0), 0.34, 0.06, 0.22, 8, Vector3.ZERO, 2)
	return _finish(st)


# ---------------------------------------------------------------------------
# Characters / creatures (blocked-out, animated by bone-less node hierarchies)
# ---------------------------------------------------------------------------

## Elongated humanoid silhouette. Parts are separate meshes so the enemy scene
## can articulate them; this returns the torso only.
static func humanoid_torso(scale: float = 1.0, gaunt: float = 1.0) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3(0, 0.0, 0), Vector3(0.42 / gaunt, 0.62, 0.22) * scale, 1.0, 0.0, 0.7)
	add_box(st, Vector3(0, -0.42 * scale, 0), Vector3(0.34 / gaunt, 0.26, 0.2) * scale, 1.0, 0.0, 0.6)
	return _finish(st)


static func humanoid_head(scale: float = 1.0) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3.ZERO, Vector3(0.20, 0.27, 0.21) * scale, 1.0, 0.0, 0.8)
	add_box(st, Vector3(0, -0.05, 0.10) * scale, Vector3(0.13, 0.10, 0.06) * scale, 1.0, 0.0, 0.9)
	return _finish(st)


static func limb(length: float, thickness: float) -> ArrayMesh:
	var st := _new_surface()
	# Built downward from the origin so the node can be rotated at the joint.
	add_tapered_cylinder(st, Vector3(0, -length, 0), length, thickness * 0.7, thickness, 5,
			Vector3.ZERO, 1)
	return _finish(st)


## Four-legged animal body used by deer, fox and rabbit at different scales.
static func quadruped_body(length: float, height: float, width: float) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3.ZERO, Vector3(width, height, length), 1.0, 0.0, 0.7)
	add_box(st, Vector3(0, height * 0.35, -length * 0.55), Vector3(width * 0.75, height * 0.7, length * 0.28),
			1.0, 0.0, 0.85)
	return _finish(st)


static func bird_body(size: float) -> ArrayMesh:
	var st := _new_surface()
	add_box(st, Vector3.ZERO, Vector3(size * 0.5, size * 0.55, size), 1.0, 0.0, 0.8)
	add_box(st, Vector3(0, size * 0.1, size * 0.62), Vector3(size * 0.35, size * 0.35, size * 0.3),
			1.0, 0.0, 0.9)
	return _finish(st)


static func bird_wing(size: float) -> ArrayMesh:
	var st := _new_surface()
	# Hinged at the origin, extending along +X.
	st.set_color(Color(0, 1, 0.5))
	st.set_uv(Vector2(0, 0)); st.add_vertex(Vector3(0, 0, -size * 0.4))
	st.set_uv(Vector2(1, 0)); st.add_vertex(Vector3(size, 0, -size * 0.2))
	st.set_uv(Vector2(1, 1)); st.add_vertex(Vector3(size, 0, size * 0.3))
	st.set_uv(Vector2(0, 0)); st.add_vertex(Vector3(0, 0, -size * 0.4))
	st.set_uv(Vector2(1, 1)); st.add_vertex(Vector3(size, 0, size * 0.3))
	st.set_uv(Vector2(0, 1)); st.add_vertex(Vector3(0, 0, size * 0.45))
	st.set_uv(Vector2(1, 0)); st.add_vertex(Vector3(size, 0, -size * 0.2))
	st.set_uv(Vector2(0, 0)); st.add_vertex(Vector3(0, 0, -size * 0.4))
	st.set_uv(Vector2(0, 1)); st.add_vertex(Vector3(0, 0, size * 0.45))
	st.set_uv(Vector2(1, 0)); st.add_vertex(Vector3(size, 0, -size * 0.2))
	st.set_uv(Vector2(0, 1)); st.add_vertex(Vector3(0, 0, size * 0.45))
	st.set_uv(Vector2(1, 1)); st.add_vertex(Vector3(size, 0, size * 0.3))
	return _finish(st)


# ---------------------------------------------------------------------------
# Utility meshes
# ---------------------------------------------------------------------------

## Flat XZ plane centred on the origin, `divisions` quads per side.
static func plane(size: float, divisions: int = 1, uv_scale: float = 1.0) -> ArrayMesh:
	var st := _new_surface()
	divisions = maxi(1, divisions)
	var step := size / float(divisions)
	var half := size * 0.5
	for x in divisions:
		for z in divisions:
			var x0 := -half + step * x
			var z0 := -half + step * z
			var x1 := x0 + step
			var z1 := z0 + step
			st.set_color(Color(0, 1, 0.5))
			st.set_uv(Vector2(x0, z0) / size * uv_scale); st.add_vertex(Vector3(x0, 0, z0))
			st.set_uv(Vector2(x0, z1) / size * uv_scale); st.add_vertex(Vector3(x0, 0, z1))
			st.set_uv(Vector2(x1, z1) / size * uv_scale); st.add_vertex(Vector3(x1, 0, z1))
			st.set_uv(Vector2(x0, z0) / size * uv_scale); st.add_vertex(Vector3(x0, 0, z0))
			st.set_uv(Vector2(x1, z1) / size * uv_scale); st.add_vertex(Vector3(x1, 0, z1))
			st.set_uv(Vector2(x1, z0) / size * uv_scale); st.add_vertex(Vector3(x1, 0, z0))
	return _finish(st, true)


## Small hand-props for the inventory's 3D inspection view.
##
## These exist only to be turned over at arm's length, so they are built to be
## readable in silhouette at one scale and nothing else — a few dozen triangles
## each. Item ids map onto these shapes in AssetFoundry.
static func item_shape(kind: String) -> ArrayMesh:
	var st := _new_surface()
	match kind:
		"cell":
			add_tapered_cylinder(st, Vector3(0, -0.09, 0), 0.18, 0.045, 0.045, 10, Vector3.ZERO, 1)
			add_tapered_cylinder(st, Vector3(0, 0.09, 0), 0.02, 0.018, 0.018, 6, Vector3.ZERO, 1)
		"key":
			add_box(st, Vector3(0, -0.02, 0), Vector3(0.014, 0.14, 0.014), 1.0, 0.0, 1.0)
			add_tapered_cylinder(st, Vector3(0, 0.05, 0), 0.001, 0.038, 0.038, 10, Vector3.ZERO, 1)
			add_box(st, Vector3(0.022, -0.075, 0), Vector3(0.03, 0.016, 0.012), 1.0, 0.0, 1.0)
			add_box(st, Vector3(0.02, -0.045, 0), Vector3(0.026, 0.014, 0.012), 1.0, 0.0, 1.0)
		"reel":
			add_tapered_cylinder(st, Vector3(0, -0.012, 0), 0.024, 0.10, 0.10, 16, Vector3.ZERO, 1)
			add_tapered_cylinder(st, Vector3(0, -0.02, 0), 0.04, 0.028, 0.028, 8, Vector3.ZERO, 1)
		"paper":
			add_box(st, Vector3.ZERO, Vector3(0.14, 0.002, 0.19), 1.0, 0.0, 1.0)
			add_box(st, Vector3(0.0, 0.003, -0.06), Vector3(0.10, 0.001, 0.006), 1.0, 0.0, 1.0)
			add_box(st, Vector3(0.0, 0.003, -0.03), Vector3(0.12, 0.001, 0.006), 1.0, 0.0, 1.0)
			add_box(st, Vector3(-0.01, 0.003, 0.0), Vector3(0.09, 0.001, 0.006), 1.0, 0.0, 1.0)
		"bottle":
			add_tapered_cylinder(st, Vector3(0, -0.09, 0), 0.13, 0.042, 0.038, 10, Vector3.ZERO, 2)
			add_tapered_cylinder(st, Vector3(0, 0.04, 0), 0.05, 0.02, 0.018, 8, Vector3.ZERO, 1)
			add_tapered_cylinder(st, Vector3(0, 0.09, 0), 0.02, 0.024, 0.024, 8, Vector3.ZERO, 1)
		"torch":
			add_tapered_cylinder(st, Vector3(0, -0.13, 0), 0.22, 0.032, 0.036, 10, Vector3.ZERO, 2)
			add_tapered_cylinder(st, Vector3(0, 0.09, 0), 0.05, 0.038, 0.058, 12, Vector3.ZERO, 1)
		"recorder":
			add_box(st, Vector3.ZERO, Vector3(0.22, 0.07, 0.16), 1.0, 0.0, 0.9)
			add_tapered_cylinder(st, Vector3(-0.05, 0.035, -0.02), 0.012, 0.05, 0.05, 12, Vector3.ZERO, 1)
			add_tapered_cylinder(st, Vector3(0.05, 0.035, -0.02), 0.012, 0.05, 0.05, 12, Vector3.ZERO, 1)
			add_box(st, Vector3(0, 0.04, 0.055), Vector3(0.09, 0.012, 0.03), 1.0, 0.0, 1.0)
		"fuse":
			add_tapered_cylinder(st, Vector3(0, -0.05, 0), 0.10, 0.022, 0.022, 8, Vector3.ZERO, 1)
			add_tapered_cylinder(st, Vector3(0, -0.055, 0), 0.015, 0.028, 0.028, 8, Vector3.ZERO, 1)
			add_tapered_cylinder(st, Vector3(0, 0.04, 0), 0.015, 0.028, 0.028, 8, Vector3.ZERO, 1)
		"crank":
			add_tapered_cylinder(st, Vector3(0, -0.09, 0), 0.18, 0.014, 0.014, 6, Vector3.ZERO, 1)
			add_box(st, Vector3(0.05, 0.09, 0), Vector3(0.11, 0.016, 0.016), 1.0, 0.0, 1.0)
			add_tapered_cylinder(st, Vector3(0.1, 0.06, 0), 0.06, 0.018, 0.018, 6, Vector3.ZERO, 1)
		"cutters":
			add_box(st, Vector3(-0.06, -0.02, 0), Vector3(0.16, 0.018, 0.018), 1.0, 0.0, 1.0)
			add_box(st, Vector3(-0.06, 0.02, 0), Vector3(0.16, 0.018, 0.018), 1.0, 0.0, 1.0)
			add_box(st, Vector3(0.07, -0.008, 0), Vector3(0.09, 0.012, 0.014), 1.0, 0.0, 1.0)
			add_box(st, Vector3(0.07, 0.008, 0), Vector3(0.09, 0.012, 0.014), 1.0, 0.0, 1.0)
		"map":
			add_box(st, Vector3.ZERO, Vector3(0.24, 0.004, 0.17), 1.0, 0.0, 1.0)
			add_box(st, Vector3(0, 0.004, 0), Vector3(0.005, 0.002, 0.17), 1.0, 0.0, 1.0)
		"core":
			add_tapered_cylinder(st, Vector3(0, -0.07, 0), 0.14, 0.02, 0.018, 8, Vector3.ZERO, 3)
		_:
			add_box(st, Vector3.ZERO, Vector3(0.12, 0.12, 0.12), 1.0, 0.0, 0.85)
	return _finish(st)


## Vertical quad facing -Z, used for fog cards and impostors.
static func billboard(width: float, height: float) -> ArrayMesh:
	var st := _new_surface()
	var hw := width * 0.5
	st.set_color(Color.WHITE)
	st.set_uv(Vector2(0, 1)); st.add_vertex(Vector3(-hw, 0, 0))
	st.set_uv(Vector2(1, 1)); st.add_vertex(Vector3(hw, 0, 0))
	st.set_uv(Vector2(1, 0)); st.add_vertex(Vector3(hw, height, 0))
	st.set_uv(Vector2(0, 1)); st.add_vertex(Vector3(-hw, 0, 0))
	st.set_uv(Vector2(1, 0)); st.add_vertex(Vector3(hw, height, 0))
	st.set_uv(Vector2(0, 0)); st.add_vertex(Vector3(-hw, height, 0))
	return _finish(st, true)
