/* ===========================================================================
   PixelForge — Code prompt data: engines, game types and the system catalog.
   This panel produces prompts that ask an AI to write code; it ships no code
   templates of its own.
   =========================================================================== */
(function (global) {
  'use strict';

  const ENGINES = [
    {
      id: 'unity', name: 'Unity', lang: 'C#',
      note: 'Unity 2022 LTS or newer, C# MonoBehaviour scripts attached to GameObjects. 2D physics via Rigidbody2D and Collider2D, input via the Input System package.',
      conventions: 'Follow standard Unity conventions: [SerializeField] private fields with [Header] grouping, Awake for wiring references, Start for initialisation, FixedUpdate for physics, Update for input. Use Time.deltaTime for frame independence. Prefer composition over deep inheritance.'
    },
    {
      id: 'godot', name: 'Godot', lang: 'GDScript',
      note: 'Godot 4.x, GDScript. Node-based scenes; gameplay classes extend CharacterBody2D, Area2D or Node2D.',
      conventions: 'Follow Godot 4 conventions: typed GDScript with class_name where useful, @export for inspector values, @onready for node references, _physics_process for movement with move_and_slide(), signals for decoupled communication. snake_case for functions and variables, PascalCase for classes.'
    },
    {
      id: 'unreal', name: 'Unreal', lang: 'C++',
      note: 'Unreal Engine 5, C++ Actor and Character classes with Enhanced Input.',
      conventions: 'Follow UE5 conventions: UCLASS/UPROPERTY/UFUNCTION macros, UPROPERTY(EditAnywhere, BlueprintReadWrite) for tunables, BlueprintCallable for functions designers need, components over inheritance, Enhanced Input actions and mapping contexts. Include both the .h and .cpp.'
    },
    {
      id: 'web', name: 'Web / JS', lang: 'JavaScript',
      note: 'Plain HTML5 Canvas or a JS engine such as Phaser. Runs in the browser with no build step required.',
      conventions: 'Modern JavaScript (ES2020+), no framework unless asked. requestAnimationFrame game loop with a fixed timestep accumulator, delta-time movement, clear separation between update and render. No external dependencies unless explicitly requested.'
    }
  ];

  const GAME_TYPES = [
    { id: 'metroidvania', name: 'Metroidvania', note: 'Side-scrolling exploration with gravity, wall jumps, dashes, ability gates and an interconnected map.' },
    { id: 'platformer', name: 'Precision platformer', note: 'Tight jump feel: coyote time, jump buffering, variable jump height, one-way platforms.' },
    { id: 'topdown', name: 'Top-down action', note: 'Four or eight directional movement, melee swings, room transitions, puzzle triggers.' },
    { id: 'dungeon', name: 'Dungeon crawler', note: 'Procedural room generation, enemy spawning, loot pickups and inventory.' },
    { id: 'roguelite', name: 'Roguelite', note: 'Run-based progression, permanent unlocks, randomised rewards and escalating difficulty.' },
    { id: 'rpg', name: 'RPG', note: 'Stats, levelling, equipment, quests, dialogue and turn-based or real-time combat.' },
    { id: 'shooter', name: 'Twin-stick / shmup', note: 'Bullet patterns, object pooling, screen-clearing effects and heavy projectile counts.' },
    { id: 'puzzle', name: 'Puzzle', note: 'Grid or physics rules, deterministic state, undo support and level definitions.' },
    { id: 'survival', name: 'Survival / crafting', note: 'Resource gathering, crafting recipes, hunger and durability loops, base building.' },
    { id: 'tower', name: 'Tower defence', note: 'Waves, pathfinding, tower placement and upgrade economies.' }
  ];

  /* System catalog — what the generated prompt will ask for. */
  const SYSTEMS = {
    'Movement & Feel': [
      { id: 'player-controller', name: 'Player controller', detail: 'ground movement, acceleration and friction, jumping, gravity, and a clean state machine for idle/run/jump/fall.' },
      { id: 'jump-feel', name: 'Jump feel toolkit', detail: 'coyote time, jump buffering, variable jump height, apex hang time, fast-fall and landing recovery.' },
      { id: 'dash', name: 'Dash / dodge', detail: 'directional dash with i-frames, cooldown, air-dash limit, and a trail hook for VFX.' },
      { id: 'wall-movement', name: 'Wall slide & wall jump', detail: 'wall detection, slide damping, wall jump impulse and an input lockout window so it feels crisp.' },
      { id: 'grapple', name: 'Grappling hook', detail: 'aim, projectile travel, attach validation, rope constraint and swing physics.' },
      { id: 'swim', name: 'Swimming / fluid movement', detail: 'buoyancy, drag, surface detection and an oxygen timer.' }
    ],
    'Combat': [
      { id: 'health', name: 'Health & damage', detail: 'health pool, damage application, invincibility frames, knockback, death handling and events other systems can subscribe to.' },
      { id: 'melee', name: 'Melee attack system', detail: 'attack windup/active/recovery phases, hitboxes active only during the active window, combo chaining and hit-stop.' },
      { id: 'projectiles', name: 'Projectile system', detail: 'pooled projectiles, travel, collision filtering, lifetime and impact effects.' },
      { id: 'boss', name: 'Boss fight controller', detail: 'multi-phase state machine, telegraphed attack patterns, phase transitions triggered by health thresholds.' },
      { id: 'status', name: 'Status effects', detail: 'stackable timed effects (burn, freeze, poison) with tick damage, stat modifiers and clean expiry.' },
      { id: 'hitstop', name: 'Hit-stop & screen shake', detail: 'brief time-scale freeze on impact plus a decaying camera shake, both tunable per hit.' }
    ],
    'AI & Enemies': [
      { id: 'patrol', name: 'Patrol & chase AI', detail: 'waypoint patrol, player detection cone, chase, attack range and a return-to-post behaviour.' },
      { id: 'behaviour-tree', name: 'Behaviour tree', detail: 'a small composable behaviour tree with selector, sequence and decorator nodes plus a few concrete leaf actions.' },
      { id: 'pathfinding', name: 'Pathfinding', detail: 'A* over a grid or navmesh with path smoothing and re-path throttling.' },
      { id: 'spawner', name: 'Enemy spawner / waves', detail: 'wave definitions, spawn budgeting, difficulty ramp and a live-enemy cap.' },
      { id: 'flocking', name: 'Flocking / swarm', detail: 'separation, alignment and cohesion steering with neighbour queries that stay cheap at scale.' }
    ],
    'World & Level': [
      { id: 'camera', name: 'Camera follow & bounds', detail: 'smoothed follow with a dead zone, look-ahead in the movement direction, and clamping to level bounds.' },
      { id: 'room-transition', name: 'Room transitions', detail: 'trigger volumes, screen fade, player repositioning and camera hand-off between rooms.' },
      { id: 'tilemap', name: 'Tilemap & collision', detail: 'loading a tilemap, building collision from it, and handling one-way platforms and slopes.' },
      { id: 'procgen', name: 'Procedural generation', detail: 'seeded room or level generation with connectivity guarantees and a validation pass.' },
      { id: 'parallax', name: 'Parallax background', detail: 'multi-layer scrolling tied to camera position with per-layer depth factors and seamless wrapping.' },
      { id: 'hazards', name: 'Hazards & traps', detail: 'spikes, moving platforms, crushers and respawn-on-death handling.' }
    ],
    'Progression & Items': [
      { id: 'inventory', name: 'Inventory system', detail: 'stackable items, slot limits, add/remove/query API and change events for the UI.' },
      { id: 'loot', name: 'Chest & loot tables', detail: 'weighted loot tables, rarity tiers, guaranteed drops and a one-time-open chest.' },
      { id: 'abilities', name: 'Ability unlock gates', detail: 'an ability registry, unlock persistence and gates that check abilities before allowing traversal.' },
      { id: 'save', name: 'Save / load', detail: 'serialising game state to disk, versioned save data, migration on load and safe atomic writes.' },
      { id: 'quests', name: 'Quest system', detail: 'quest definitions, objective tracking, completion conditions and rewards.' },
      { id: 'dialogue', name: 'Dialogue system', detail: 'branching dialogue data, a typewriter reveal, choices and condition-gated lines.' },
      { id: 'stats', name: 'Stats & levelling', detail: 'base stats, modifiers from equipment and buffs, XP curve and level-up handling.' }
    ],
    'Systems & Polish': [
      { id: 'state-machine', name: 'Generic state machine', detail: 'a reusable, typed state machine with enter/exit/update hooks and transition guards.' },
      { id: 'object-pool', name: 'Object pooling', detail: 'a generic pool with pre-warm, acquire/release, automatic growth and leak detection in debug builds.' },
      { id: 'events', name: 'Event bus', detail: 'a decoupled publish/subscribe bus with typed events and automatic unsubscribe on destroy.' },
      { id: 'audio', name: 'Audio manager', detail: 'pooled one-shot SFX, music cross-fade, per-category volume and pitch variation to avoid ear fatigue.' },
      { id: 'settings', name: 'Settings & input rebinding', detail: 'persisted settings, runtime input rebinding with conflict detection, and applying changes without a restart.' },
      { id: 'ui-hud', name: 'HUD / UI binding', detail: 'binding health, resources and inventory to UI widgets via events rather than per-frame polling.' },
      { id: 'localization', name: 'Localisation', detail: 'a string table, key lookup with fallback, runtime language switching and pluralisation.' },
      { id: 'perf', name: 'Performance pass', detail: 'profiling hooks, allocation removal on hot paths, batching and a frame budget check.' }
    ]
  };

  const COMPLEXITY = [
    { id: 'minimal', name: 'Minimal', note: 'The smallest thing that works. One file, no abstractions, easy to read and rip apart.' },
    { id: 'production', name: 'Production', note: 'Properly structured, documented, handles edge cases. What you would actually ship.' },
    { id: 'extensible', name: 'Extensible', note: 'Designed to grow: interfaces, injection points and clear extension seams for a larger game.' }
  ];

  const AUDIENCES = [
    'I am new to this engine — explain as you go',
    'I am comfortable with the engine — skip the basics',
    'I am experienced — be terse and dense'
  ];

  global.PF = global.PF || {};
  global.PF.codeData = { ENGINES, GAME_TYPES, SYSTEMS, COMPLEXITY, AUDIENCES };
})(typeof window !== 'undefined' ? window : globalThis);
