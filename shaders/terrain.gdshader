shader_type spatial;
// Terrain surface.
//
// The chunk generator bakes the expensive decisions into vertex colours, so the
// fragment stage only ever takes three texture samples regardless of how many
// biomes overlap:
//   COLOR.r - exposed rock / cliff
//   COLOR.g - grass & moss cover
//   COLOR.b - mud / standing water (swamp, river banks)
//   COLOR.a - compacted dirt road or gravel
render_mode diffuse_lambert, specular_schlick_ggx;

uniform sampler2D grass_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D dirt_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D rock_tex : source_color, filter_linear_mipmap, repeat_enable;

uniform float detail_scale = 0.35;
uniform float macro_scale = 0.012;
uniform vec4 grass_tint : source_color = vec4(0.20, 0.26, 0.15, 1.0);
uniform vec4 dirt_tint : source_color = vec4(0.24, 0.19, 0.14, 1.0);
uniform vec4 rock_tint : source_color = vec4(0.30, 0.30, 0.31, 1.0);
uniform vec4 mud_tint : source_color = vec4(0.11, 0.10, 0.08, 1.0);
uniform vec4 road_tint : source_color = vec4(0.32, 0.28, 0.22, 1.0);
uniform float wetness : hint_range(0.0, 1.0) = 0.0;

varying vec3 v_world;
varying vec4 v_mask;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_mask = COLOR;
}

void fragment() {
	vec2 uv = v_world.xz * detail_scale;
	vec3 grass = texture(grass_tex, uv).rgb * grass_tint.rgb;
	vec3 dirt = texture(dirt_tex, uv * 0.8).rgb * dirt_tint.rgb;
	vec3 rock = texture(rock_tex, uv * 0.5).rgb * rock_tint.rgb;

	// Large-scale value variation kills the tiled look without another sample.
	float macro = sin(v_world.x * macro_scale) * cos(v_world.z * macro_scale * 1.31);
	macro = macro * 0.5 + 0.5;

	vec3 albedo = dirt;
	albedo = mix(albedo, road_tint.rgb * dirt / max(dirt_tint.rgb, vec3(0.001)), v_mask.a);
	albedo = mix(albedo, grass, v_mask.g);
	albedo = mix(albedo, rock, v_mask.r);
	albedo = mix(albedo, mud_tint.rgb * (0.7 + 0.6 * dirt), v_mask.b);
	albedo *= mix(0.82, 1.12, macro);

	float wet = clamp(wetness + v_mask.b * 0.6, 0.0, 1.0);
	ALBEDO = albedo * mix(1.0, 0.62, wet);
	ROUGHNESS = mix(mix(0.98, 0.72, v_mask.r), 0.25, wet);
	SPECULAR = mix(0.08, 0.45, wet);
	AO = mix(1.0, 0.75, v_mask.b);
	AO_LIGHT_AFFECT = 0.6;
}
