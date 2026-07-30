shader_type spatial;
// Rain rendered as two nested cylinders that follow the camera.
//
// A particle system convincing enough for a storm costs thousands of quads. Two
// scrolling cylinders cost four hundred triangles and look better in fog, so
// this is the primary rain on every quality tier; GPU particles are added on
// top only for splash impacts near the player.
render_mode blend_add, depth_draw_never, cull_front, unshaded, shadows_disabled;

uniform sampler2D streak_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 rain_colour : source_color = vec4(0.62, 0.66, 0.72, 1.0);
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float fall_speed : hint_range(0.0, 10.0) = 3.4;
uniform float tiling_x = 6.0;
uniform float tiling_y = 2.0;
uniform float slant : hint_range(-1.0, 1.0) = 0.12;
uniform float layer_offset = 0.0;

void fragment() {
	if (intensity <= 0.002) {
		discard;
	}
	vec2 uv = UV * vec2(tiling_x, tiling_y);
	uv.y -= TIME * fall_speed;
	uv.x += TIME * slant + layer_offset;
	float streaks = texture(streak_tex, uv).r;
	streaks *= texture(streak_tex, uv * vec2(1.7, 0.9) + vec2(0.37, 0.0)).r * 1.8;
	// Fade top and bottom so the cylinder's caps are never visible.
	float band = smoothstep(0.0, 0.18, UV.y) * (1.0 - smoothstep(0.82, 1.0, UV.y));
	ALBEDO = rain_colour.rgb;
	ALPHA = clamp(streaks * band * intensity, 0.0, 1.0);
}
