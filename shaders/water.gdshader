shader_type spatial;
// Rivers, creeks, lakes and swamp water.
//
// Deliberately avoids DEPTH_TEXTURE and SCREEN_TEXTURE: both are available on
// GL Compatibility but each costs a full-screen copy on mobile GPUs, and the
// game's water is almost always seen at night through fog. Two scrolling normal
// layers plus a Fresnel term sell it for a fraction of the cost.
render_mode blend_mix, depth_draw_never, cull_disabled, diffuse_lambert, specular_schlick_ggx;

uniform sampler2D wave_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform vec4 shallow_colour : source_color = vec4(0.09, 0.14, 0.13, 0.62);
uniform vec4 deep_colour : source_color = vec4(0.02, 0.045, 0.05, 0.93);
uniform float wave_scale = 0.22;
uniform float wave_speed = 0.05;
uniform float wave_height = 0.045;
uniform float flow_x = 0.0;
uniform float flow_z = 0.0;
uniform float fresnel_power : hint_range(0.5, 8.0) = 3.4;
uniform float rain_ripples : hint_range(0.0, 1.0) = 0.0;
uniform float murk : hint_range(0.0, 1.0) = 0.0;

varying vec3 v_world;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float t = TIME * (0.6 + wave_speed);
	float h = sin(v_world.x * 0.7 + t) * 0.5 + sin(v_world.z * 0.53 - t * 1.3) * 0.5;
	VERTEX.y += h * wave_height;
}

void fragment() {
	vec2 flow = vec2(flow_x, flow_z);
	vec2 uv1 = v_world.xz * wave_scale + flow * TIME * 0.09 + vec2(TIME * wave_speed, 0.0);
	vec2 uv2 = v_world.xz * wave_scale * 0.63 - flow * TIME * 0.05 + vec2(0.0, TIME * wave_speed * 0.7);
	vec3 n1 = texture(wave_tex, uv1).rgb * 2.0 - 1.0;
	vec3 n2 = texture(wave_tex, uv2).rgb * 2.0 - 1.0;
	vec3 n = normalize(n1 + n2 * 0.7);

	if (rain_ripples > 0.01) {
		vec2 ruv = v_world.xz * 1.7 + floor(TIME * 6.0) * 13.7;
		vec3 rn = texture(wave_tex, ruv).rgb * 2.0 - 1.0;
		n = normalize(n + rn * rain_ripples * 0.8);
	}

	NORMAL_MAP = n * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.6;

	float fres = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), fresnel_power);
	vec4 body = mix(deep_colour, shallow_colour, fres);
	ALBEDO = mix(body.rgb, vec3(0.10, 0.10, 0.07), murk);
	ALPHA = clamp(mix(body.a, 0.97, murk), 0.0, 1.0);
	ROUGHNESS = mix(0.06, 0.55, murk);
	SPECULAR = 0.7;
	METALLIC = 0.0;
}
