shader_type sky;
// Dynamic sky for the day/night cycle.
//
// Fully procedural: gradient, sun, moon, stars and two scrolling cloud layers.
// TimeOfDay and WeatherSystem push the uniforms; nothing here reads TIME for
// anything but cloud drift, so pausing the game freezes the sky as expected.

uniform vec3 zenith_day : source_color = vec3(0.18, 0.32, 0.55);
uniform vec3 horizon_day : source_color = vec3(0.62, 0.68, 0.72);
uniform vec3 zenith_night : source_color = vec3(0.012, 0.018, 0.035);
uniform vec3 horizon_night : source_color = vec3(0.035, 0.045, 0.062);
uniform vec3 sunset_tint : source_color = vec3(0.85, 0.36, 0.16);
uniform vec3 ground_colour : source_color = vec3(0.03, 0.03, 0.028);

uniform float day_factor : hint_range(0.0, 1.0) = 1.0;    // 0 night .. 1 day
uniform float sunset_factor : hint_range(0.0, 1.0) = 0.0; // peaks at dawn/dusk
uniform vec3 sun_direction = vec3(0.0, 1.0, 0.0);
uniform vec3 moon_direction = vec3(0.0, -1.0, 0.0);
uniform float moon_phase : hint_range(0.0, 1.0) = 0.85;

uniform float cloud_coverage : hint_range(0.0, 1.0) = 0.35;
uniform float cloud_darkness : hint_range(0.0, 1.0) = 0.2;
uniform float cloud_speed : hint_range(0.0, 0.2) = 0.008;
uniform float star_intensity : hint_range(0.0, 2.0) = 1.0;
uniform float haze : hint_range(0.0, 1.0) = 0.25;
uniform float lightning_flash : hint_range(0.0, 4.0) = 0.0;

float hash21(vec2 p) {
	p = fract(p * vec2(233.34, 851.73));
	p += dot(p, p + 23.45);
	return fract(p.x * p.y);
}

float value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	float total = 0.0;
	float amp = 0.5;
	for (int i = 0; i < 4; i++) {
		total += value_noise(p) * amp;
		p *= 2.03;
		amp *= 0.5;
	}
	return total;
}

void sky() {
	vec3 dir = normalize(EYEDIR);
	float up = clamp(dir.y, -1.0, 1.0);
	float horizon_blend = pow(clamp(1.0 - abs(up), 0.0, 1.0), 2.2);

	vec3 zenith = mix(zenith_night, zenith_day, day_factor);
	vec3 horizon = mix(horizon_night, horizon_day, day_factor);
	vec3 base = mix(zenith, horizon, horizon_blend);

	// Warm band that only appears around the terminator, biased to the sun.
	float sun_align = clamp(dot(dir, normalize(sun_direction + vec3(0.0, 0.0001, 0.0))) * 0.5 + 0.5, 0.0, 1.0);
	base = mix(base, sunset_tint, sunset_factor * horizon_blend * pow(sun_align, 2.0) * 0.85);

	// Stars: a hashed lattice, faded out by daylight and cloud cover.
	if (day_factor < 0.6 && up > -0.05) {
		vec2 sp = dir.xz / max(abs(dir.y) + 0.35, 0.001) * 44.0;
		float star = hash21(floor(sp));
		float twinkle = 0.65 + 0.35 * sin(TIME * (1.4 + star * 4.0) + star * 30.0);
		float mask = smoothstep(0.9955, 0.9995, star) * twinkle;
		base += vec3(0.82, 0.86, 1.0) * mask * star_intensity * (1.0 - day_factor)
			* (1.0 - cloud_coverage * 0.85);
	}

	// Moon: a soft disc with a terminator driven by `moon_phase`.
	float moon_dot = dot(dir, normalize(moon_direction));
	float moon_disc = smoothstep(0.9986, 0.99955, moon_dot);
	float phase_mask = smoothstep(-0.2, 0.35, dot(normalize(dir - moon_direction * 0.5),
		normalize(vec3(moon_phase * 2.0 - 1.0, 0.15, 0.4))));
	base += vec3(0.78, 0.80, 0.86) * moon_disc * mix(0.25, 1.0, phase_mask)
		* (1.0 - day_factor) * 1.6;
	base += vec3(0.20, 0.23, 0.30) * pow(max(moon_dot, 0.0), 220.0) * (1.0 - day_factor);

	// Sun: a small disc plus a broad glow that survives into the fog.
	float sun_dot = dot(dir, normalize(sun_direction));
	float sun_disc = smoothstep(0.9994, 0.99985, sun_dot);
	base += mix(vec3(1.0, 0.95, 0.86), sunset_tint * 1.6, sunset_factor)
		* sun_disc * day_factor * 4.0;
	base += mix(vec3(0.55, 0.52, 0.45), sunset_tint, sunset_factor)
		* pow(max(sun_dot, 0.0), 24.0) * day_factor * 0.5;

	// Clouds. Projected onto a virtual plane so they compress near the horizon.
	if (up > 0.005) {
		vec2 cuv = dir.xz / max(up, 0.02) * 0.35;
		float drift = TIME * cloud_speed;
		float c = fbm(cuv * 0.9 + vec2(drift, drift * 0.4));
		c = mix(c, fbm(cuv * 2.3 - vec2(drift * 1.6, 0.0)), 0.4);
		float cover = smoothstep(1.0 - cloud_coverage, 1.05 - cloud_coverage * 0.6, c);
		cover *= smoothstep(0.0, 0.16, up);
		vec3 lit = mix(vec3(0.72, 0.74, 0.76), sunset_tint * 1.1, sunset_factor);
		vec3 cloud_col = mix(vec3(0.05, 0.055, 0.065), lit, day_factor);
		cloud_col = mix(cloud_col, cloud_col * 0.35, cloud_darkness);
		base = mix(base, cloud_col, cover * 0.92);
	}

	// Horizon haze ties the sky to the scene fog.
	base = mix(base, mix(horizon, vec3(0.06, 0.065, 0.07), 1.0 - day_factor),
		haze * horizon_blend);
	// Below the horizon we render flat ground colour so distant terrain reads
	// as continuous with the sky.
	base = mix(base, ground_colour, smoothstep(0.0, -0.08, up));
	base += vec3(0.62, 0.66, 0.78) * lightning_flash;

	COLOR = base;
}
