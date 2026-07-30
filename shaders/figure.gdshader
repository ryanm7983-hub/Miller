shader_type spatial;
// Shader for the things that walk in the Basin.
//
// The entities are never fully lit — they are read as silhouettes with a faint
// rim. `presence` drives how solid they are, which is how the Hollow Chorus
// fades in and out and how a hallucination dissolves when looked at directly.
render_mode blend_mix, cull_disabled, diffuse_lambert, specular_disabled, shadows_disabled;

uniform sampler2D noise_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 body_colour : source_color = vec4(0.020, 0.022, 0.026, 1.0);
uniform vec4 rim_colour : source_color = vec4(0.32, 0.34, 0.38, 1.0);
uniform float rim_power : hint_range(0.5, 8.0) = 3.0;
uniform float rim_strength : hint_range(0.0, 4.0) = 1.1;
uniform float presence : hint_range(0.0, 1.0) = 1.0;
uniform float dissolve : hint_range(0.0, 1.0) = 0.0;
uniform float shimmer : hint_range(0.0, 1.0) = 0.0;
uniform float emissive_eyes : hint_range(0.0, 4.0) = 0.0;

varying vec3 v_local;

void vertex() {
	v_local = VERTEX;
	if (shimmer > 0.001) {
		float t = TIME * 3.1;
		VERTEX.x += sin(t + VERTEX.y * 6.0) * 0.012 * shimmer;
		VERTEX.z += cos(t * 1.3 + VERTEX.y * 5.0) * 0.012 * shimmer;
	}
}

void fragment() {
	float n = texture(noise_tex, UV * 2.0 + vec2(TIME * 0.03, 0.0)).r;
	// Dissolve from the feet up: they come apart into the ground fog.
	float threshold = dissolve * 1.25 - clamp(v_local.y * 0.5 + 0.5, 0.0, 1.0) * 0.25;
	if (n < threshold) {
		discard;
	}
	float fres = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), rim_power);
	ALBEDO = body_colour.rgb;
	EMISSION = rim_colour.rgb * fres * rim_strength * presence;
	// Eyes are just the small UV band near the top of the head mesh.
	if (emissive_eyes > 0.01 && UV.y < 0.14 && abs(UV.x - 0.5) < 0.26) {
		EMISSION += vec3(0.9, 0.86, 0.72) * emissive_eyes;
	}
	ALPHA = clamp(presence * (0.35 + 0.65 * fres) + 0.25 * presence, 0.0, 1.0);
	ROUGHNESS = 1.0;
}
