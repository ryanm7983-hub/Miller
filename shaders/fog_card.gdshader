shader_type spatial;
// Ground fog billboards.
//
// GL Compatibility has no volumetric fog, so drifting banks of soft camera-
// facing cards stand in for it. A dozen of these at medium quality read as
// volume for a couple of hundred triangles.
render_mode blend_mix, depth_draw_never, cull_disabled, unshaded, shadows_disabled;

uniform sampler2D fog_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 fog_colour : source_color = vec4(0.44, 0.47, 0.49, 1.0);
uniform float density : hint_range(0.0, 2.0) = 0.5;
uniform float drift_speed : hint_range(0.0, 0.5) = 0.02;
uniform float fade_near : hint_range(0.0, 20.0) = 1.5;
uniform float fade_far : hint_range(5.0, 200.0) = 60.0;

varying float v_fade;

void vertex() {
	// Y-locked billboard: cards always face the camera horizontally but stay
	// upright, which keeps them from visibly rotating when the player looks up.
	vec3 origin = MODEL_MATRIX[3].xyz;
	vec3 to_cam = INV_VIEW_MATRIX[3].xyz - origin;
	to_cam.y = 0.0;
	if (length(to_cam) < 0.001) {
		to_cam = vec3(0.0, 0.0, 1.0);
	}
	vec3 fwd = normalize(to_cam);
	vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
	float sx = length(MODEL_MATRIX[0].xyz);
	float sy = length(MODEL_MATRIX[1].xyz);
	mat4 billboard = mat4(
		vec4(right * sx, 0.0),
		vec4(vec3(0.0, 1.0, 0.0) * sy, 0.0),
		vec4(fwd * sx, 0.0),
		MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = VIEW_MATRIX * billboard;
	float dist = length(INV_VIEW_MATRIX[3].xyz - origin);
	v_fade = smoothstep(fade_near, fade_near * 3.0, dist) * (1.0 - smoothstep(fade_far * 0.6, fade_far, dist));
}

void fragment() {
	vec2 uv = UV + vec2(TIME * drift_speed, TIME * drift_speed * 0.4);
	float n = texture(fog_tex, uv).r * texture(fog_tex, uv * 0.5 - TIME * drift_speed * 0.6).r * 2.2;
	// Radial softening so cards have no visible edges.
	vec2 c = UV - vec2(0.5);
	float radial = 1.0 - smoothstep(0.15, 0.5, length(c));
	ALBEDO = fog_colour.rgb;
	ALPHA = clamp(n * radial * density * fog_colour.a * v_fade, 0.0, 1.0);
}
