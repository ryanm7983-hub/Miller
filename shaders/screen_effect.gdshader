shader_type canvas_item;
// Full-screen sanity / damage / hallucination post-process.
//
// Applied by a ColorRect that covers the viewport. Every term is gated behind a
// uniform that sits at 0 in the common case, and PerformanceDirector hides the
// whole layer on the lowest tier, so the cheap path really is "one texture
// fetch and a vignette".
//
// The `reduce_flashing` accessibility setting clamps `pulse` to 0.

uniform sampler2D screen_tex : hint_screen_texture, filter_linear;

uniform float vignette : hint_range(0.0, 1.5) = 0.35;
uniform vec4 vignette_colour : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float grain : hint_range(0.0, 1.0) = 0.03;
uniform float desaturation : hint_range(0.0, 1.0) = 0.0;
uniform float aberration : hint_range(0.0, 0.02) = 0.0;
uniform float warp : hint_range(0.0, 0.05) = 0.0;
uniform float pulse : hint_range(0.0, 1.0) = 0.0;
uniform float damage : hint_range(0.0, 1.0) = 0.0;
uniform vec4 damage_colour : source_color = vec4(0.35, 0.03, 0.04, 1.0);
uniform float brightness : hint_range(0.2, 2.0) = 1.0;
uniform float scanline : hint_range(0.0, 1.0) = 0.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 centred = uv - vec2(0.5);
	float radius = length(centred);

	// Slow breathing warp: the world subtly inhales as sanity drops.
	if (warp > 0.0001) {
		float w = sin(TIME * 0.9 + radius * 14.0) * warp;
		uv += normalize(centred + vec2(0.0001)) * w * radius;
	}

	vec3 col;
	if (aberration > 0.0001) {
		vec2 offset = normalize(centred + vec2(0.0001)) * aberration * radius;
		col.r = texture(screen_tex, uv + offset).r;
		col.g = texture(screen_tex, uv).g;
		col.b = texture(screen_tex, uv - offset).b;
	} else {
		col = texture(screen_tex, uv).rgb;
	}

	if (desaturation > 0.0001) {
		float lum = dot(col, vec3(0.299, 0.587, 0.114));
		col = mix(col, vec3(lum), desaturation);
	}

	col *= brightness;

	if (damage > 0.0001) {
		float edge = smoothstep(0.25, 0.62, radius);
		col = mix(col, damage_colour.rgb, edge * damage);
	}

	float vig = smoothstep(0.30, 0.85, radius) * vignette;
	vig += pulse * (0.5 + 0.5 * sin(TIME * 2.6)) * smoothstep(0.05, 0.8, radius) * 0.5;
	col = mix(col, vignette_colour.rgb, clamp(vig, 0.0, 1.0));

	if (grain > 0.0001) {
		float n = hash(uv * vec2(1024.0, 768.0) + fract(TIME) * 91.7);
		col += (n - 0.5) * grain;
	}

	if (scanline > 0.0001) {
		col *= 1.0 - scanline * 0.35 * step(0.5, fract(uv.y * 240.0));
	}

	COLOR = vec4(col, 1.0);
}
