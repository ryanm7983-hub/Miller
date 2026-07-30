shader_type spatial;
// Trunks and heavy timber. Same wind model as vegetation.gdshader but with a
// much smaller amplitude, so a tree's trunk and canopy stay attached.
render_mode diffuse_lambert, specular_schlick_ggx;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint_dark : source_color = vec4(0.12, 0.10, 0.09, 1.0);
uniform vec4 tint_light : source_color = vec4(0.29, 0.24, 0.20, 1.0);
uniform float roughness_value : hint_range(0.0, 1.0) = 0.95;
uniform float ao_strength : hint_range(0.0, 1.0) = 0.6;
uniform float wetness : hint_range(0.0, 1.0) = 0.0;

uniform vec2 wind_direction = vec2(1.0, 0.2);
uniform float wind_strength : hint_range(0.0, 4.0) = 0.6;
uniform float wind_speed : hint_range(0.0, 8.0) = 1.4;
uniform float wind_enabled : hint_range(0.0, 1.0) = 1.0;

varying float v_ao;
varying float v_variation;

void vertex() {
	vec3 world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_ao = COLOR.g;
	v_variation = fract(world.x * 0.09 + world.z * 0.13);
	if (wind_enabled > 0.5 && COLOR.r > 0.001) {
		float phase = world.x * 0.35 + world.z * 0.27;
		float t = TIME * wind_speed;
		float bend = sin(t * 0.6 + phase) * 0.6 + sin(t * 1.37 + phase * 1.9) * 0.4;
		vec2 dir = normalize(wind_direction + vec2(0.0001));
		VERTEX += vec3(dir.x, 0.0, dir.y) * bend * wind_strength * COLOR.r * 0.35;
	}
}

void fragment() {
	vec3 tex = texture(albedo_tex, UV).rgb;
	vec3 base = mix(tint_dark.rgb, tint_light.rgb, tex.r);
	base = mix(base, base * 0.85, v_variation * 0.4);
	float ao = mix(1.0, v_ao, ao_strength);
	ALBEDO = base * ao;
	ROUGHNESS = mix(roughness_value, 0.42, wetness);
	SPECULAR = mix(0.1, 0.4, wetness);
	NORMAL_MAP = vec3(0.5, 0.5, 1.0);
}
