# Changelog

Kept per milestone. Each entry records what changed and, where a decision was
not obvious, why.

---

## M2 — World, time and weather

**Added**

- `WorldGenerator`: deterministic 1 km² basin from a 32-bit seed. Layered noise
  height field with a ridged crag term and a radial rim that encloses the play
  area with geography instead of an invisible wall. Rivers traced by gradient
  descent, roads routed by least-climb search, fourteen landmarks sited by
  scored local search, all carved into a 256×256 influence grid that
  `height_at()` bilinearly samples.
- `TerrainChunk` / `ChunkManager`: 64 m tiles with ring-based LOD, MultiMesh
  vegetation, trunk colliders added directly to the physics server, and a
  one-chunk-per-frame build budget for the single-threaded web build.
- `WaterManager`: river ribbons that follow their own carved beds, irregular
  lake discs, and waterfalls detected from the river profile.
- `TimeOfDay`: sun/moon arcs, dynamic sky, ambient and fog response, phase
  events, and a `light_level()` the AI reads.
- `WeatherSystem`: seven states on a severity ladder with gradual blending;
  publishes visibility, hearing and noise-masking factors, wetness, and wind.
- `scenes/test/world_preview.tscn`: free-camera inspection scene with time,
  weather and quality controls.
- 28 new tests across the generator, streaming, time and weather.

**Fixed during the milestone** (each found by a test, not by looking at it)

- Rivers ran uphill. Three separate causes: upstream carve stamps claimed cells
  before their downstream neighbours could deepen them; tributaries carved
  through the channels they joined; and `min()` blending left natural potholes
  in the graded bed. Now the bed is forced strictly descending, paths stop and
  are trimmed back at confluences and meander cutoffs, and the carve blends to
  the bed rather than clamping to it.
- Landmarks could be placed underwater, because rivers were traced *after*
  siting. Water is now decided first and the site search rejects wet ground.
- Roads stepped up to 9 m where they met a flattened landmark clearing, because
  grading was computed against raw noise. Roads are now graded against the
  terrain including clearings, and smoothed over a five-sample window.
- Unloaded chunks stayed in the scene tree — still rendering, still colliding —
  until the end of the frame, which matters because unloads arrive in bursts
  when the player crosses a chunk border. They are now detached immediately.

---

## M1 — Procedural asset foundry

**Added**

- `MeshFactory`: vegetation with a three-step pine LOD chain, structures,
  props, and blocked-out creatures. Vertex colours carry wind influence and
  baked AO.
- `TextureFactory`: seamless noise, stretched fibre, cellular, alpha masks,
  normal maps, and analytic gradients.
- `AssetFoundry`: builds, caches and shares every resource; binds materials to
  mesh surfaces so MultiMesh can draw two-material trees in one node; pushes
  wind and wetness uniforms.
- Nine shaders: terrain, vegetation, bark, water, procedural sky, fog cards,
  rain sheets, entity silhouettes, screen post-process.
- `AudioSynth`: a small DSP library plus every sound in the game.
- `AudioDirector`: bus graph, six-layer ambience bed, four-stem adaptive score,
  pooled 3D one-shots, browser audio unlock.

**Performance**

Boot-time asset generation went from 7.4 s to 1.4 s natively (measured with
`scenes/test/profile_assets.tscn`) by:

- choosing a sample rate per sound class instead of one global rate — ambience
  and music are band-limited well below 5 kHz and are generated at 11 025 and
  8 000 Hz;
- inlining the DSP filters in the hot loops, which was two thirds of the cost;
- reading a shared sine table instead of calling `sin()` per partial per sample;
- generating one buffer per ambience bed and varying character with pitch and
  level at playback instead of generating near-duplicates;
- replacing two GDScript pixel loops with native `Image.resize()` calls.

---

## M0 — Foundation

**Added**

- Godot 4.6 project targeting GL Compatibility on every platform, so the
  browser build behaves identically to the editor.
- Autoloads: `Log`, `EventBus`, `Platform`, `Settings`, `PerformanceDirector`,
  `SaveManager`, `GameState`, `SceneRouter`.
- `PerformanceDirector`'s quality ladder uses asymmetric hysteresis — quick to
  step down, slow to step up — because dropping frames is worse for a horror
  game than looking slightly worse.
- `SaveManager` writes versioned JSON to `user://`, which the web export backs
  with IndexedDB, and migrates older payloads in place.
- Test framework, headless runner with a non-zero exit on failure, and an asset
  generation profiler.
- Documentation set and MIT licence.
