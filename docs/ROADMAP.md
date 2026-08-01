# Development roadmap

Milestones are vertical slices: each one ends with the game still running, the
test suite still green, and a commit. Nothing is left as a stub between
milestones — a system that is started in a milestone is finished in it.

Status legend: **done** / *in progress* / planned

---

## M0 — Foundation **done**

Project configuration, folder layout, and the singletons every later system
leans on.

- `project.godot`: GL Compatibility renderer on every platform, input map,
  physics layers, mobile-specific render overrides.
- `Log` — level-gated logging with a ring buffer for the debug overlay.
- `EventBus` — the single cross-system signal hub.
- `Platform` — device, form factor and capability detection.
- `Settings` — schema-validated, debounced, persisted to `user://`.
- `PerformanceDirector` — measured frame times drive a hysteretic quality ladder.
- `SaveManager` — versioned, migratable JSON slots.
- `GameState` — the whole playthrough as plain data.
- `SceneRouter` — threaded scene loading with a real progress bar.
- Test framework (`TestCase`, `test_runner`) and asset profiler.

## M1 — Procedural asset foundry **done**

- `MeshFactory` — vegetation, structures, props, creatures; pines have a
  three-step LOD chain.
- `TextureFactory` — noise, fibre, cellular, alpha masks, normal maps.
- `AssetFoundry` — caches and shares every resource; pushes wind/wetness
  uniforms; scales density to the quality tier.
- Shaders: terrain, vegetation, bark, water, sky, fog cards, rain, figures,
  screen post-process.
- `AudioSynth` — a small DSP library and every sound in the game.
- `AudioDirector` — bus graph, six-layer ambience bed, four-stem adaptive score,
  pooled 3D one-shots, browser audio unlock.
- 13 tests covering geometry validity, LOD monotonicity, texture variance,
  audio loudness/looping and the music cross-fade.

## M2 — World, time and weather **done**

- Seeded heightmap over a 1 km² basin with rivers, lakes, cliffs and swamp.
- Chunk streaming with per-band LOD and MultiMesh vegetation.
- Biome assignment and terrain vertex-colour mask baking.
- Day/night cycle: sun, moon, dynamic sky, ambient response, phase events.
- Weather: clear, cloud, rain, storm, fog, wind — affecting visibility, AI
  hearing/sight, ambience and material wetness.

## M3 — Player and input **done**

- `CharacterBody3D` controller: walk, sprint, crouch, jump, hide.
- Survival stats: health, stamina, sanity, flashlight battery.
- Interaction raycast with focus prompts, doors, pickups, inspection.
- Noise emission model shared with the AI's hearing.
- Input abstraction: keyboard/mouse, gamepad, and a responsive touch layer with
  virtual stick, swipe look and thumb-sized action buttons.

## M4 — Items, inventory and UI **done**

- Item database and grid inventory with drag-and-drop and stacking.
- 3D item inspection, readable documents, journal.
- Main menu, settings, save/load slots, pause, HUD.

## M5 — AI and horror direction **done**

- Shared perception (sight cones with occlusion, hearing with weather falloff).
- Four enemy archetypes with distinct hunting logic and a common state machine.
- Steering navigation over streamed terrain.
- Wildlife: deer, fox, rabbit, squirrel, owl, crow, insects.
- Horror director: a tension model that schedules atmospheric events, escalates
  toward and away from scares, and drives music and sanity.

## M6 — Places, puzzles and story *in progress*

- Points of interest: cabins, fire tower, ranger station, hunting camps, mine,
  bunker, cemetery, ritual site, caves.
- Puzzles tied to the listening-post network.
- Objectives, lore documents, meaningful choices, four endings.

## M7 — Ship *in progress*

- Web export preset, custom HTML shell, orientation and audio-unlock handling.
- Full test pass, documentation, changelog.

---

## Deliberately out of scope

Recorded voice-over, localisation beyond English, gamepad rumble, and
multiplayer. Each is a meaningful cost with no effect on the core experience
described in the brief; the systems are structured so none of them would
require a rewrite to add. Item and document text is already loaded from data
files rather than hard-coded, which is the expensive half of localisation.
