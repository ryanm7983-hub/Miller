shader_type spatial;
// Foliage: wind sway, per-instance tint, cheap two-sided lighting.
//
// Compatibility-renderer notes:
//  * ALPHA_SCISSOR_THRESHOLD is used instead of `depth_prepass_alpha` because
//    the prepass render mode is a no-op on GL Compatibility.
//  * The sway is entirely vertex-side. No screen reads, no extra passes.
//
// Vertex colour channels (see MeshFactory):
//   COLOR.r - wind influence, COLOR.g - baked AO, COLOR.b - variation mask.
render_mode cull_disabled, diffuse_lambert, specular_disabled, shadows_disabled;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint_a : source_color = vec4(0.22, 0.30, 0.19, 1.0);
uniform vec4 tint_b : source_color = vec4(0.13, 0.20, 0.13, 1.0);
uniform float alpha_cut : hint_range(0.0, 1.0) = 0.42;
uniform float ao_strength : hint_range(0.0, 1.0) = 0.75;

// Driven every frame by WeatherSystem.
uniform vec2 wind_direction = vec2(1.0, 0.2);
uniform float wind_strength : hint_range(0.0, 4.0) = 0.6;
uniform float wind_speed : hint_range(0.0, 8.0) = 1.4;
uniform float wind_enabled : hint_range(0.0, 1.0) = 1.0;

// Raised by the horror director when the forest "notices" the player.
uniform float agitation : hint_range(0.0, 1.0) = 0.0;

varying float v_ao;
varying float v_variation;

void vertex() {
	vec3 world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float influence = COLOR.r;
	v_ao = COLOR.g;
	v_variation = fract(world.x * 0.137 + world.z * 0.211);

	if (wind_enabled > 0.5 && influence > 0.001) {
		float phase = world.x * 0.35 + world.z * 0.27;
		float t = TIME * wind_speed;
		// Two octaves: a slow bend plus a fast flutter at the tips.
		float bend = sin(t * 0.6 + phase) * 0.6 + sin(t * 1.37 + phase * 1.9) * 0.4;
		float flutter = sin(t * 5.1 + phase * 4.3) * 0.18 * influence;
		float gust = 1.0 + agitation * 1.8;
		vec2 dir = normalize(wind_direction + vec2(0.0001));
		vec3 offset = vec3(dir.x, 0.0, dir.y) * bend * wind_strength * influence * gust;
		offset.y -= abs(bend) * wind_strength * influence * 0.12;
		offset += vec3(dir.y, 0.35, -dir.x) * flutter * wind_strength * gust;
		VERTEX += offset;
	}
}

void fragment() {
	vec4 tex = texture(albedo_tex, UV);
	if (tex.a < alpha_cut) {
		discard;
	}
	vec3 base = mix(tint_a.rgb, tint_b.rgb, v_variation);
	float ao = mix(1.0, v_ao, ao_strength);
	ALBEDO = base * tex.rgb * ao;
	ROUGHNESS = 0.92;
	SPECULAR = 0.05;
	ALPHA_SCISSOR_THRESHOLD = alpha_cut;
	// Fake wrapped lighting so canopies do not go pitch black from below.
	BACKLIGHT = vec3(0.16, 0.20, 0.14);
}
