# Architecture

## The one rule

**Systems never hold references across layers.** They publish to
[`EventBus`](../scripts/autoload/event_bus.gd) and read from
[`GameState`](../scripts/autoload/game_state.gd).

This is not style. The world streams: chunks, enemies and wildlife are created
and destroyed constantly, and any direct reference held by the UI or the AI to
something the world owns becomes a dangling reference within a minute of play.
It also means every subsystem can be exercised headlessly by emitting the
signals it expects — which is why there are 130 tests and no need to open the
editor to run them.

```
             ┌──────────────┐
   world ───▶│              │◀─── player
     ai  ───▶│   EventBus   │◀─── ui
   story ───▶│              │◀─── audio
             └──────────────┘
                    │
             ┌──────▼───────┐
             │  GameState   │   plain data, no scene tree, serialisable
             └──────────────┘
```

## Layers

```
scripts/
  autoload/   singletons. May be used by anything; must depend on nothing but
              each other and the engine.
  core/       pure factories (MeshFactory, TextureFactory, AudioSynth).
              RefCounted, no scene tree, no autoload access except Log.
  world/      terrain generation, streaming, water, time, weather, landmarks.
  player/     controller, stats, torch, interaction, input.
  ai/         perception, steering, enemies, wildlife, horror direction.
  items/      item data and the inventory model (no UI).
  story/      documents, objectives, endings.
  ui/         everything that draws. Reads models; never owns them.
  test/       framework and harnesses.
```

A layer may use the layers above it in that list, never below. The one
deliberate exception is `ui/ui_theme.gd`, whose palette is read by `items/` for
item tints — a colour table, not a dependency on the UI.

## Conventions

**Signals** are named `<subject>_<past_tense_verb>`: `player_damaged`,
`chunk_loaded`, `document_opened`. Past tense because they report what has
happened, not what should.

**Anything expensive is budgeted, never guessed.** `PerformanceDirector` owns
the numbers; systems ask it (`get_budget("tree_density")`) and react to
`quality_tier_changed`. No system decides for itself what it can afford.

**Scenes are thin.** `.tscn` files hold the nodes that are identical every run.
Anything that varies by seed, device or screen is built in code, so there is
one place to read the construction order rather than two.

**Doc comments explain *why*.** The code says what it does. Comments are for
the decision — what the alternative was and why it lost. Most of them exist
because something was tried and failed.

## Where the load-bearing decisions live

| Decision | File | Reason |
| --- | --- | --- |
| Everything is generated at boot | `core/*_factory.gd`, `core/audio_synth.gd` | 350 KB of game against a 37 MB engine; no licensing surface |
| GL Compatibility on every platform | `project.godot` | The browser build is the primary target and must behave like the editor |
| Carve grids rather than pure noise | `world/world_generator.gd` | Rivers that flow uphill read as broken instantly |
| Steering rather than a navmesh | `ai/steering.gd` | A navmesh rebuild per streamed chunk is unaffordable single-threaded |
| One chunk built per frame | `world/chunk_manager.gd` | Nine in one frame is a visible hitch |
| Graded perception with hysteresis | `ai/perception.gd` | Binary detection gives enemies that are either blind or omniscient |
| Tension spent, not scheduled | `ai/horror_director.gd` | Timed scares become predictable; triggered ones become a puzzle |
| Noise as the single AI input | `player/player.gd` → `ai/perception.gd` | One legible currency the player can reason about |

## Testing

`tests/run.sh` runs every `tests/test_*.gd` in a headless Godot with the real
autoloads live, and exits non-zero on failure. The CI workflow runs it as a
gate before exporting.

The suites are organised around *what would break silently*:

| Suite | Guards against |
| --- | --- |
| `test_asset_foundry` | Empty meshes, flat textures, silent or clipping audio |
| `test_world_generator` | Rivers that climb, landmarks underwater, unwalkable roads |
| `test_world_streaming` | Chunk leaks, LOD inversion, non-reproducible terrain |
| `test_time_and_weather` | The perception API the AI depends on |
| `test_player` | The noise ordering the AI contract rests on |
| `test_inventory` | Losing an essential item, corrupt saves |
| `test_ai` | Blind enemies that can see, unoutrunnable chases, ungated scares |
| `test_ui_reachability` | Buttons that cannot be clicked |

The last one is worth singling out. It reproduces Godot's GUI hit test and
asserts that a click at the centre of every button actually lands on that
button. It exists because three separate overlay-blocking bugs shipped into a
browser build, all invisible in code review and in a screenshot, and all found
only by driving the real export with a real browser.
