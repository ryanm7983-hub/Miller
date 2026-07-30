# World generation, streaming, time and weather

## Why the basin is generated rather than authored

A hand-built 1 km² forest would be tens of megabytes of geometry — unacceptable
for a game whose primary platform is a phone browser. Generating it from a
32-bit seed makes the world free to download, free to save (four bytes), and
free to stream: a chunk can be discarded and rebuilt later without the player
ever seeing it change.

The cost is that the *layout* has to be designed, not left to noise. That is
what `WorldGenerator` is: a set of deliberate decisions expressed as code.

---

## WorldGenerator

`scripts/world/world_generator.gd`. Pure data, no scene tree, fully
deterministic, safe to run headlessly.

### The height field

```
base_height = continental fBm      (±46 m, very low frequency)
            + hill fBm             (±16 m)
            + ridged noise³ × rock mask   (up to 34 m of crags)
            + detail fBm           (±2.6 m)
            + radial rim past 400 m       (up to 95 m)
```

The ridged term is `1 - |noise|` cubed. Plain fBm produces rolling hills and
never produces a crest; folding the noise about zero does, and the `rock` mask
keeps crags confined to a few regions instead of spraying them everywhere.

The radial rim is what encloses the basin. The playable area is bounded by
geography — you walk uphill until it is not worth continuing — rather than by an
invisible collider, which always reads as a bug in a game about being lost in a
forest.

### Carving

Rivers, roads and landmark clearings are *carved* into the height field rather
than emerging from it. Each is rasterised once into a 256×256 influence grid
(4 m cells) holding an influence weight and a target height, and `height_at()`
bilinearly samples it. Complexity in the road network therefore costs nothing
per vertex.

The composition order in `height_at()` is river → clearing → road, and each
step blends toward its target rather than clamping:

| Feature | Wins over | Reason |
| --- | --- | --- |
| River | base terrain | The bed must be graded. |
| Clearing | base terrain, attenuated by river influence | Landmarks are sited away from water; this only tidies the falloff. |
| Road | everything | Road crossings are culverts. Without this the fire road drops into every channel it meets, and the one route the player can follow in the dark is broken — along with the Surveyor's patrol. |

An earlier version used `min(terrain, bed)` for rivers so that clearings could
not fill a channel back in. That left natural hollows in the streambed
untouched, so the bed was not monotonically descending and the water surface
visibly stepped up out of potholes. `test_rivers_never_flow_uphill` exists
because of that bug.

### Hydrology

Rivers are traced by gradient descent with momentum from high ground. The
momentum term is what produces meanders: pure steepest descent oscillates
across a shallow gradient instead of turning.

Three rules keep the result coherent, each of which fixed a specific visible
failure:

1. **Forced descent.** The bed drops a minimum amount per step, so a long flat
   reach still has a gradient and noise cannot poke back through it.
2. **Confluence.** A watercourse that runs into an already-carved one has
   joined it and stops. The path is then trimmed back until it is clear of the
   other channel, because a stamp wide enough to carve a river is wide enough
   to punch a hole through the one it just met.
3. **Meander cutoff.** The same argument for a river doubling back on itself.

Standing water forms where a river stalls in a depression, plus one large
central lake that is always present — the player needs a landmark to orient by.

Water is rendered by `WaterManager` as continuous ribbons following each river
and irregular discs for lakes. It is deliberately *not* streamed with the
terrain: a per-chunk water plane can only be flat, so a river running downhill
would show a step at every chunk seam. Waterfalls are detected rather than
authored — wherever the surface drops sharply between samples, mist and a loud
emitter are placed. Those emitters matter to gameplay: near a waterfall nothing
can hear the player, and the player cannot hear anything either.

### Roads

Roads step 8 m at a time. At each step a fan of nine headings is sampled and
the one with the least climb that still makes progress wins, so roads
switchback around hills instead of climbing over them. The profile is then
smoothed over a five-sample window before stamping; one-sample averaging still
left visible steps on broken ground.

### Landmarks

Fourteen landmarks have a fixed anchor angle and radius, so the basin always
reads the same way, and a seeded local search picks the exact site. Each type
states what it wants — a fire tower wants a summit, a trapper's shack wants a
bog — and the search scores candidates against that, against slope, against
proximity to other landmarks, and hard against standing water. If an entire
neighbourhood is unusable the search widens rather than settling for the
least-flooded spot.

---

## Chunk streaming

`TerrainChunk` is one 64 m tile: ground mesh, collision, and all its vegetation.
`ChunkManager` keeps a square of them around the player.

Detail follows a **ring** index (Chebyshev distance from the player's chunk):

| Ring | Ground | Trees | Undergrowth | Collision |
| --- | --- | --- | --- | --- |
| 0–1 | full resolution | LOD 0 | yes | terrain + trunks |
| 2 | half | LOD 1 | sparse | terrain |
| 3+ | quarter | LOD 2 impostors | none | none |

Because ring decides detail, a chunk whose ring changes is rebuilt rather than
moved. Hysteresis on the unload radius stops a player pacing across a chunk
border from thrashing the builder.

The web build is usually single-threaded, so a chunk cannot be built on a
worker. The manager therefore builds **one chunk per frame**: building nine in
one frame is a visible hitch, and nine frames is the correct answer.

Vegetation is placed on a jittered grid — a uniform random scatter clumps badly
at forest densities and leaves visible holes — and drawn with
`MultiMeshInstance3D`, so a chunk holding two hundred trees is a handful of
draw calls. Trunk colliders go straight to `PhysicsServer3D` rather than
becoming `CollisionShape3D` nodes; a hundred nodes per chunk costs far more in
tree overhead than the shapes cost in the broadphase.

---

## Time of day

The clock lives in `GameState.time_of_day` so it survives save/load without the
node existing; everything visual is derived from it every frame. Nothing is
tweened, so scrubbing the clock is instant and consistent.

Sun elevation is a sine arc between 06:24 and 18:36 and a shallower one below
the horizon overnight. Daylight fades out below the horizon rather than
snapping off, which is what produces usable twilight. `day_factor` (0–1) and
`sunset_factor` (peaking at the terminator) drive the sky shader, both lights,
ambient colour and fog colour.

Night is the default state and the dangerous one: `light_level()` — which the AI
reads — bottoms out near 0.03 but never reaches zero, because an enemy that is
perfectly blind is not frightening, it is a non-participant.

---

## Weather

Seven states (clear, overcast, drizzle, rain, storm, heavy fog, gale). Weather
is a difficulty dial, not decoration, and every effect is published for other
systems to read:

| Output | Consumed by |
| --- | --- |
| `visibility_factor()` | enemy sight range |
| `hearing_factor()` | enemy hearing range |
| `noise_masking()` | how much noise the player gets away with |
| `wetness` | terrain and timber materials |
| `wind_direction`, `wind_strength` | every vegetation shader, fog drift |
| `rain`, `fog`, `cloud` | ambience layers, sky, rain cylinder, scene fog |

Transitions blend over roughly twenty seconds — a storm arrives, it does not
appear — and the next state is chosen from a severity ladder so clear weather
rarely jumps straight to a storm. Time of day shifts the weights: fog is far
more likely at night.

Rain wets the ground quickly and dries it slowly, which is why a forest still
looks soaked twenty minutes after the rain stops.

Thunder is a genuine sound source: it is published to `EventBus.noise_emitted`,
so it startles wildlife and briefly deafens everything that hunts by ear.
Lightning flashes are suppressed entirely when the `reduce_flashing`
accessibility setting is on.

---

## Inspecting it

```bash
godot --path . res://scenes/test/world_preview.tscn
```

Free camera, no player, no AI. `[`/`]` scrub the clock, `1`–`7` force weather,
`Tab` cycles quality tier, `F` jumps to the next landmark. The overlay reports
chunk residency, instance count, and the perception factors the AI will read.
