# The Black Pine

A first-person psychological survival horror game that runs entirely in the
browser. Built in Godot 4.6, exported to HTML5/WebAssembly.

## ▶ [Play in your browser](play/)

Desktop, Android and iOS Safari. Roughly a 9 MB transfer on first load
(the engine runtime); the game itself is 350 KB, because every mesh,
texture and sound is generated at startup rather than downloaded.

**Controls**

| | Desktop | Touch |
| --- | --- | --- |
| Move | `WASD` | left-thumb stick (appears where you press) |
| Look | mouse | swipe on the right half |
| Sprint / Crouch / Jump | `Shift` / `Ctrl` / `Space` | thumb cluster |
| Torch | `F` | LIGHT |
| Interact | `E` | USE |
| Inventory / Journal | `I` / `J` | BAG / JOURNAL |
| Pause | `Esc` | ☰ |

Headphones are strongly recommended. The game is mostly quiet on purpose.

## Documentation

- [Design and systems](../README.md)
- [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md)
- [World, time and weather](systems/WORLD.md)
- [Asset provenance and licensing](ASSET_LICENSES.md)
