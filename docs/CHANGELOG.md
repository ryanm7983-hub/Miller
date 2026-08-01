# Changelog

Kept per milestone. Each entry records what changed and, where a decision was
not obvious, why.

---

## Post-release — the game was unplayable on a phone

Reported from a real device: the build loaded and the title card would not
start. Four separate faults, all of which desktop testing was structurally
incapable of finding.

**Fixed**

- **The orientation nudge swallowed every tap.** `#rotate` in the HTML shell was
  an opaque `position: fixed; inset: 0` cover with no `pointer-events: none`,
  shown as soon as `body.playing` was set — which happens when the engine
  starts, *before* the tap-to-begin gate. On a portrait phone it sat over the
  canvas and ate the only input the platform has. It is now a small
  pointer-transparent banner at the bottom edge that fades on the first touch.
  `test_html_shell_never_covers_the_canvas` reads the shell's CSS and fails if
  either property comes back.
- **The interface scaled to a third of its intended size in portrait.**
  `canvas_items` stretch takes the smaller axis ratio against the 1280×720
  reference canvas, so a 390 px-wide phone scaled everything by 390/1280.
  `Platform.apply_content_scale()` now turns the reference canvas to match the
  window on every resize, so the scale is governed by the short edge either way
  up — 0.30 to 0.54 on a typical phone.
- **Touch buttons overlapped each other.** The action cluster swept six buttons
  along one arc at alternating radii; three pairs of hit circles intersected, so
  a thumb aimed at CROUCH triggered USE with nothing on screen to explain why.
  The cluster is now two explicit arcs, and the geometry lives in pure functions
  that `test_touch_buttons_never_overlap_each_other` checks at five screen sizes,
  both handedness settings and three UI scales.
- **A stall during warm-up was indistinguishable from a hang.** The progress bar
  only moved between the foundry's eight stages. It now drifts towards the next
  stage continuously, the title card reports each stage out to the page via
  `Platform.report_stage()`, and the shell puts the last stage on screen if the
  game has not reached the menu after a minute.

**Added**

- A full-rect `StartButton` on the title card, so the start gesture also travels
  the ordinary GUI hit-test path that `test_ui_reachability` verifies, not only
  the raw `_input` path. The title card is the one screen where a missed input
  leaves nothing on screen to suggest why.
- `window.blackPineRequestLandscape()`: asks for landscape on the first
  gesture. Android Chrome honours it; iOS Safari refuses, which is what the
  banner is still for.

---

## M5 + M6 — AI, wildlife, horror direction, landmarks and story

**Added**

- `Perception`: graded sight and hearing with hysteresis between "suspicious"
  and "certain". Line of sight ignores foliage on purpose — testing against a
  forest of alpha-cut billboards makes sight random, and random is not tense.
  Hearing reports a direction, not a position, which is why standing still
  after being heard works.
- `Steering`: navigation without a navmesh. A baked mesh would have to be
  rebuilt every time a chunk streams in, dozens of times a minute, which a
  single-threaded web build cannot afford.
- Four enemy archetypes over one state machine, differing almost entirely by
  tuning: the blind Listener that teaches the noise mechanic, the Surveyor that
  hails you in a human voice from the road network, the Chorus that cannot hurt
  you and is escaped by standing still, and the Wretch that leashes to its
  territory so entering the mine is a calculated risk.
- `Wildlife`: six species in one table-driven script. Fleeing animals publish
  real noise, so they double as the player's early-warning system.
- `HorrorDirector`: a tension model that spends rather than schedules. Every
  event buys a mandatory cooldown, heavy events additionally require sustained
  tension rather than a spike, and the insect layer fades as tension rises so
  the forest goes quiet before anything happens.
- `Population`: everything alive is spawned in a ring outside sight range and
  retired behind the player, so cost is flat. The roster — not just the count —
  changes with time of day and place. Daylight is close to safe by design.
- `LandmarkBuilder`: the fourteen landmarks, assembled from MeshFactory parts.
  These are the only hand-designed geometry in the game, because a ranger
  station has to be recognisable where a forest has to be varied.
- `ListeningPost`: the central interaction. Bringing a post online is safe and
  costs a cell; playing it back is free and permanently makes the game harder.
  The warning is in Rill's journal, which the player may never find.
- `StoryDirector` and `DocumentLibrary`: state-driven chapters that let the
  player do things out of order, sixteen readable documents, and four endings.
  Reading raises the sanity floor — understanding the basin is protective.

---

## M3 + M4 — Player, touch controls, inventory, UI and web export

**Added**

- FPS controller built around noise as the game's currency; survival stats with
  an exhaustion lock and a sanity-capped healing ceiling; torch flicker driven
  by battery, sanity and threat rather than randomly.
- `PlayerInput` unifying keyboard/mouse and touch; `TouchControls` owning every
  finger in one handler, with a floating stick, an arc of thumb-reachable
  buttons and a full left-handed mirror.
- Grid inventory with footprints and drag-and-drop, live 3D item inspection,
  document reader, HUD, settings generated from a declarative table, pause and
  main menus, ending screen.
- Web export preset (threads off, so no COOP/COEP headers are needed) and a
  custom HTML shell with the game's palette, an orientation nudge and viewport
  fitting that survives a mobile address bar collapsing.

**Fixed during the milestone** — all three found by driving the exported build
in a real browser, and none visible in code review or a screenshot:

- The title card's root `Control` consumed the tap meant to start the game. A
  key press still worked, which hid it on desktop; on a phone there is no key.
- The main menu added a full-rect `CenterContainer` after its button column,
  which rendered nothing and blocked every click.
- The inventory's `_gui_input` never fired, because the drawn grid panel sat on
  top of the root that was listening.

`tests/test_ui_reachability.gd` now reproduces Godot's GUI hit test and asserts
that every button in every screen is actually clickable, which is the general
form of all three.

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
