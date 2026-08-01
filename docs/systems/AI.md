# AI, wildlife and horror direction

## The thing all of it is built around

Every hunting behaviour in this game reads one number: **how much noise the
player is making**. The player controller publishes it
(`EventBus.noise_emitted`), weather scales it down, surface scales it up, and
`Perception` is the only thing that consumes it. That single channel is what
makes crouching on gravel a decision rather than a habit.

```
crouch  1.5 m/s   noise 0.10
walk    3.3 m/s   noise 0.35
sprint  6.0 m/s   noise 0.85     ×1.35 gravel   ×1.5 water   ×0.6 moss
                                 −rain, −wind (WeatherSystem.noise_masking)
```

---

## Perception

`scripts/ai/perception.gd`. Sight and hearing are **graded**, not boolean.

Awareness accumulates toward 1 while the player is detectable and decays when
they are not:

| Threshold | Value | Effect |
| --- | --- | --- |
| `LOSE_INTEREST` | 0.25 | drops out of the hunt entirely |
| `SUSPICIOUS` | 0.45 | goes to look |
| `CERTAIN` | 0.85 | chases |

The gap between suspicious and certain is where the game lives. A boolean
"can see player" produces an enemy that either ignores you or is instantly
certain; both are boring, and neither produces the half-noticed state that
makes a forest frightening.

Two details that matter:

- **Line of sight ignores foliage.** The raycast hits terrain and static world
  geometry only. Testing against a forest of alpha-cut billboards makes sight
  effectively random, and random is not tense — it is unfair.
- **Hearing gives a direction, not a position.** The reported location is
  jittered by how weak the signal was, so an enemy goes to *roughly* where a
  sound came from. This is why standing still after being heard works.

Archetypes differ almost entirely by `sight_weight` and `hearing_weight`. That
is how one implementation produces a blind hunter and a sighted one.

---

## Navigation

`scripts/ai/steering.gd` — steering, deliberately **not** `NavigationAgent3D`.

A baked navmesh would have to be rebuilt every time a chunk streams in, dozens
of times a minute while the player walks. On a single-threaded web build that
is a stutter the game cannot afford. Steering costs a handful of raycasts.

The trade is that agents cannot solve mazes. The forest is open terrain with
scattered blockers — exactly the case where steering beats pathfinding — and
interiors are small enough that a doorway waypoint handles them.

Composition: seek the goal → whisker avoidance (a fan of five rays, weighted by
proximity) → commit to one side when blocked head-on, so agents do not
oscillate in front of a tree → refuse headings that lead up a cliff or into
deep water. A `StuckDetector` triggers re-planning when progress stops.

---

## The four archetypes

The state ladder is shared. The important property is that coming *down* it is
slow: an enemy that snaps back to patrol the moment you break line of sight is
not frightening.

```
PATROL / WANDER  →  INVESTIGATE  →  SEARCH  ⇄  CHASE  →  ATTACK
                                      ↑____________________|
```

### The Listener — "the quiet one"
Blind. Hunts entirely by ear, decays awareness very slowly, searches for forty
seconds. It is the game's **teacher**: it is slow enough to walk away from and
completely uninterested in what you look like, so every encounter is a lesson
in the noise mechanic. In chase it tracks the last *sound*, never the player's
actual position — standing still works even face to face.

### The Surveyor
Walks the fire roads with a lantern, and calls out with a human voice at
intervals. It is the one that looks like a person, behaves like a person
looking for someone, and is therefore the one players trust. Answering — which
in this game means making noise near it — is the trap. Sight-based, fast, and
the only enemy that carries its own light, which cuts both ways. Its patrol
route is the real road network from the generator, not a scripted path.

### The Hollow Chorus
**Cannot kill you.** It drains sanity by being near, moves toward noise and
freezes in silence. That inverts the instinct every other threat teaches:
this one is escaped by standing still and then *walking* out of the middle of
it. It arrives as a group, because one is a curiosity and four are a situation.

Its existence is a deliberate answer to the problem that all horror threats
eventually become "a thing that reduces your health bar", after which fear
becomes arithmetic.

### The Wretch
Territorial, underground, and the only thing faster than a sprinting player. It
**leashes**: chase it past thirty metres from its home and it breaks off. That
promise is what makes entering the mine a calculated risk rather than a coin
flip. It ambushes from a dormant state, and holding the torch on it delays the
lunge without preventing it.

---

## Wildlife

Six species in one script with a table, because six near-identical scripts
would be six places to fix the same bug.

Wildlife is the game's most honest information channel. Animals flee from
things, and a deer bolting past for no visible reason means something is behind
you. It does a job no UI element could without breaking the fiction.

The flee radius is the whole contract, and it responds to how the player is
moving — crouching lets you get to 45% of the normal distance, sprinting
triggers it at 150%. A bolting animal publishes real noise, so a chase
announces itself before it arrives.

---

## The horror director

`scripts/ai/horror_director.gd`. Maintains a **tension** value and spends it,
the way a dungeon master reads a table.

Tension rises with darkness, night, low sanity, threat proximity, a dying
battery, and how much of the archive the player has played back. It falls with
light, shelter and daylight.

Two rules stop it becoming noise:

1. **Relief is mandatory.** Every event buys a cooldown proportional to its
   weight, during which the director does nothing at all. Sustained pressure
   stops registering as pressure; the quiet afterwards is what makes the next
   one land.
2. **Escalation is earned.** Events are gated by intensity, and the heavy ones
   additionally require tension to have been *sustained* for twenty seconds,
   not merely spiked. Players get whispers long before they get anything with a
   face.

The ambient response runs continuously rather than only at event time: the
insect layer fades as tension climbs, so the forest goes quiet before something
happens. That is the oldest tell there is and still the best.

The single loud jump scare is gated behind the `jump_scares` setting, which
leaves everything else intact — the atmosphere is the game and the shocks are
garnish.

### The watcher

A silhouette placed at the edge of vision that removes itself the moment the
player looks straight at it. It is never confirmed and never resolves into
something the player can get used to. Looking at it costs sanity, which is the
only feedback that it was ever there.

### Hallucinations

Rewrite ambience, never geometry. A hallucination that alters the level teaches
players to distrust navigation, which is exhausting rather than frightening.

---

## Population

`scripts/ai/population.gd`. Nothing is placed in advance. Everything alive is
spawned in a ring around the player — outside sight range, inside earshot — and
retired when it falls behind, so population cost is flat regardless of how far
the player walks.

The budget comes from the quality tier; the **mix** comes from place and time:

| Condition | Roster |
| --- | --- |
| Underground (mine, cave, bunker) | Wretch, occasionally a Listener |
| Night, near a road | Surveyor (never more than one) |
| Night, open forest | Listener, Chorus |
| Night, sanity below 60% | Chorus, weighted up |
| Daylight | at most one distant Listener |

Daylight is genuinely close to safe. That is a design decision, not a
performance one — the clock has to matter, or a day/night cycle is decoration.

A spawn point is rejected if the player could watch it appear: in front of them
it must be occluded by terrain.
