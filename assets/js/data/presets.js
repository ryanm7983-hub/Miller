/* PixelForge — preset library.
   Static prompt data: art presets, themes, biomes, weapons, music styles.
   Pure data, no DOM, no network. Loaded as a classic script (file:// safe). */
(function (global) {
  "use strict";

  const LOCK='CRITICAL: fully transparent background — pure alpha channel with NO drop shadow, NO cast shadow, NO ground shadow, NO contact shadow, NO ambient occlusion shadow, NO shadow of any kind under or around the sprite, NO ground, NO floor, NO surface, NO environmental scene — completely isolated sprite on pure transparent alpha background only, if any shadow exists the image is incorrect';
  const STAND='MUST BE STANDING UPRIGHT on both feet — NOT sitting, NOT crouching, NOT on a chair. Standing pose only.';
  const FLY='FLYING or HOVERING — airborne off the ground, wings spread or flight mechanism active, NOT touching any surface.';
  const ATK='MID-ATTACK POSE — weapon or ability at full extension and strike point, body weight committed to the attack, dynamic aggressive action pose, NOT idle, NOT standing still';
  const BOSS_SCREAM='BOSS SCREAM / ROAR POSE — head thrown back, mouth wide open in a powerful roar, arms spread wide or raised dramatically, energy or power erupting outward, dominating intimidating presence, this is the signature boss entrance pose';
  const SWIM='SWIMMING POSE — body horizontal and streamlined, arms extended forward or mid-stroke, underwater environment implied by body angle, hair and clothing flowing behind, aquatic motion pose, NOT standing upright';
  const F2DS='FLAT 2D SIDE-VIEW SPRITE: strictly orthographic side view, zero perspective distortion, viewed exactly from the side, NO isometric angle, NO 3/4 view, NO tilted perspective, NO depth foreshortening — sprite viewed directly from the side in a side-scrolling platformer';
  const F2DT='FLAT 2D PLATFORMER TILE: strictly orthographic side view with zero perspective — top surface is a perfectly horizontal flat line, front face is perfectly vertical, NO isometric tilt, NO 3/4 angle, NO perspective depth — tile designed for side-scrolling 2D platformer (Hollow Knight, Dead Cells, Castlevania style)';
  const ISO='isometric 3/4 top-down view, classic game sprite perspective';
  const NEG_FLAT='isometric perspective, 3/4 angle, tilted perspective, foreshortened depth, angled top surface, box shape visible on multiple faces simultaneously, three-quarter view';
  const BGQ='BACKGROUND QUALITY: hand-painted game background, rich atmospheric depth with clear FAR/MID/NEAR layer separation, dramatic single light source, painterly texture, atmospheric perspective making distant elements lighter and more desaturated, parallax-ready horizontal strip, NO characters, NO UI, NO text';
  const FGQ='FOREGROUND OVERLAY: compositing layer for a side-scrolling 2D game — dark overlay framing the gameplay area, strong readable shapes, high contrast edges, pure alpha transparent background for compositing, frames the playspace without covering the center';
  const VFXQ='VFX SPRITE: game visual effect — pure alpha transparent background, bright saturated core color fading to fully transparent at the edges, strong readable shape language, high contrast between bright effect core and transparent surrounding area, designed to composite over any game background, NO background of its own';
  const BMEQ='TILESET QUALITY: seamlessly tileable, consistent pixel density and color palette across all tiles in this set, flat 2D side-view with zero perspective distortion, game-ready tileset asset';

  const NEG_BASE=['sitting','seated','chair','ground surface','floor','dirt patch','background scenery','environmental context','cast shadow on ground','drop shadow','contact shadow','shadow beneath sprite','ground shadow','ambient occlusion','shadow under feet','dark patch below character','blurry','anti-aliased edges','smooth gradients','3D render','photorealistic','noise texture','watermark','low resolution','JPEG artifacts','extra limbs','deformed anatomy','bad proportions','muddy colors','washed out','oversaturated','motion blur','cute','smiling','friendly'];
let selN=new Set(['sitting','seated','chair','ground surface','floor','dirt patch','background scenery','cast shadow on ground','drop shadow','contact shadow','shadow beneath sprite','ground shadow','ambient occlusion','blurry','3D render','photorealistic','watermark','extra limbs','deformed anatomy','bad proportions']);

  const AS=[
  {id:'is',n:'Idle',t:'char',f:['F1: STANDING UPRIGHT on both feet, weight balanced, arms relaxed at sides — NOT sitting NOT crouching','F2: subtle breath — torso rises 2px, feet planted, still fully upright','F3: micro head lean, still fully standing both feet on ground','F4: slight weight shift to one foot, still fully UPRIGHT, hip barely raised'],fps:'8 fps loop'},
  {id:'ih',n:'Fly Idle',t:'char',f:['F1: airborne hover, wings at mid-beat, body level, gentle sway','F2: wings slightly higher, body dips 2px','F3: wings fully extended, body at highest point','F4: wings sweeping downward, body at lowest point'],fps:'8 fps loop'},
  {id:'wk',n:'Walk',t:'char',f:['F1: right foot forward, left arm forward, upright posture','F2: mid-stride weight shift, both feet near ground','F3: left foot forward, right arm forward, mirror of F1','F4: mid-stride return, body compressing slightly downward'],fps:'10 fps loop'},
  {id:'rn',n:'Run',t:'char',f:['F1: right leg extended forward, left leg back, strong forward lean, arms pumping','F2: both feet off ground, body fully stretched','F3: left leg extended forward, right leg back, mirror lean','F4: second airborne, opposite configuration'],fps:'14 fps loop'},
  {id:'jm',n:'Jump',t:'char',f:['F1: pre-jump crouch, knees bent, loading energy','F2: launch upward, full extension, toes pointed, arms thrown up','F3: peak apex, slight tuck, arms out for balance','F4: descent, tilting forward, arms preparing for landing','F5: landing, knees deeply bent on impact, arms out'],fps:'10 fps, no loop'},
  {id:'at',n:'Attack',t:'char',f:['F1: weapon drawn BACK, weight loaded, windup telegraph','F2: weapon swinging FORWARD fast, body rotating, leading shoulder driving','F3: full arm extension, weapon at impact point, maximum reach','F4: recovery, weapon decelerating, weight re-centering'],fps:'12 fps, no loop'},
  {id:'cs',n:'Cast',t:'char',f:['F1: arms rising, energy particles forming at fingertips','F2: arms fully raised, energy swirling around hands, body tensed','F3: energy BURSTING outward, full extension, head tilted back','F4: arms lowering, residual glow on hands'],fps:'10 fps, no loop'},
  {id:'hu',n:'Hurt',t:'char',f:['F1: body jolted SIDEWAYS from impact, pain expression','F2: full recoil leaning hard away, arms flung back by force','F3: recovering balance, returning toward combat stance'],fps:'14 fps, no loop'},
  {id:'dt',n:'Death',t:'char',f:['F1: fatal hit, stagger BACKWARD, knees buckling','F2: body going horizontal, arms loose','F3: body hitting ground, limbs splaying','F4: final rest, fully collapsed'],fps:'8 fps, no loop'},
  {id:'ei',n:'Enemy Idle',t:'enemy',f:['F1: standing AGGRESSIVE ALERT, weight forward, weapon or claws ready — NOT sitting','F2: subtle weight shift, still upright and threatening, head turns','F3: breathing variation, chest rising, appendages shifting','F4: return to base aggressive stance'],fps:'6 fps loop'},
  {id:'ef',n:'Enemy Fly',t:'enemy',f:['F1: airborne hover, wings beating, body level, menacing stare','F2: wings at upstroke, body dips slightly, airborne','F3: wings at full extension, body at highest hover point','F4: wings sweeping down, body lowering to base hover height'],fps:'6 fps loop'},
  {id:'ea',n:'Enemy Attack',t:'enemy',f:['F1: weapon or limb DRAMATICALLY drawn back, maximum tension','F2: body SURGING forward explosively, fully committed','F3: full extension at impact, weapon or claw outstretched','F4: recovery, pulling back, resetting toward guard'],fps:'12 fps, no loop'},
  {id:'ve',n:'Explosion',t:'vfx',f:['F1: white-yellow central flash, tight circular burst','F2: orange-red fireball expanding, dark forming core','F3: outer flame ring at max diameter, debris flying','F4: flame thinning to smoke column, embers scattering','F5: dissipating smoke cloud, embers settling'],fps:'14 fps, no loop'},
  {id:'vh',n:'Hit Spark',t:'vfx',f:['F1: initial white flash at impact, compact burst','F2: spark lines radiating in starburst, bright yellow core','F3: sparks dispersing, fading to orange at tips','F4: final fading embers, nearly dissipated'],fps:'16 fps, no loop'},
];

/* ── ALL PRESETS ── */
  const CHAR_PRE=[
  // ── Warriors & Knights ──
  'Warrior — heavily armored battle-scarred fighter, two-handed sword, stoic face, powerful build, plate armor with dents',
  'Paladin — holy knight, gleaming gold and white plate, radiant light aura, longsword and tower shield, divine crest on chest',
  'Death Knight — undead warrior, blackened frost-rimed plate armor, glowing blue eye sockets, runed runeblade, dark mist at feet',
  'Berserker — massive warrior, no armor, ritual tribal scars, enormous two-handed axe, rage expression, muscles bulging',
  'Iron Clad — dwarf in fully sealed riveted iron plate, every joint reinforced, short war hammer, no skin visible',
  'Templar — crusader in ornate silver and gold plate, great shield with sun crest, mace in hand, holy symbols engraved',
  'Warden — medium armor in dark green and black, short sword and buckler, watchful guarded expression',
  'Spellblade — half plate with glowing rune engravings, one hand holding blade crackling with arcane energy, other hand channeling spell',
  'Sentinel — tall imposing guard in full ceremonial black and gold plate, two-handed halberd, expressionless helmet',
  'Oath Breaker — cracked and blackened paladin armor, shattered halo above helmet, dark energy bleeding from every joint, fallen hero',
  'Shieldmaiden — female warrior in Norse-style half-plate, round engraved shield, one-handed axe, braided hair, fierce expression',
  'Gladiator — arena fighter, minimal armor on one side only, enormous spiked mace, scarred bare chest, crowd-pleasing pose',
  'Crusader — heavy plate with cross motif, massive two-handed greatmace, holy scripture etched along shaft, surcoat over armor',
  'Iron Fist Brawler — thick iron gauntlets larger than the wearer\'s head, minimal leather armor, fighting stance, brass knuckle spikes',
  // ── Rogues & Scouts ──
  'Rogue — dark leather armor, dual daggers, hood and face mask, crouched alert ready-to-strike pose',
  'Assassin — shadow-cloaked black leather, single long blade at back, smoke wisps at feet, crouching in darkness',
  'Shadow Dancer — silk outfit shifting between shadow and color, two hooked blades, mid-spin pose, scarf trailing',
  'Thief — lightweight dark gear, rope coil on belt, lockpick set at hip, wide brim hat pulled low over eyes',
  'Corsair — sea-worn leather coat, tricorn hat, ornate flintlock pistol and cutlass, eyepatch, grinning gold teeth',
  'Night Blade — fully black cloth wrappings, single sickle blade, ankh of shadows at throat, smoke at feet',
  'Phantom — translucent figure, barely visible outline, daggers that are more shadow than steel, hollow glowing eyes',
  'Trap Master — leather coat lined with tools, mechanical arm with claw device, multiple grenade-like devices on belt',
  'Spider Cultist — rogue in tattered dark web-pattern cloak, wrist-mounted grapple hooks, spider-leg back decoration',
  'Smoke Agent — masked figure in dark wrap, smoke canisters on belt, small throwing blades, vanishing pose',
  // ── Mages & Casters ──
  'Mage — flowing arcane robes with glowing rune trim, staff with pulsing orb, intense focused expression',
  'Necromancer — dark robes, skeletal hands visible, skull-topped staff, hollow dark eyes, purple-black robes',
  'Druid — living vine and bark armor, antler headdress, wooden staff, green leaf energy aura',
  'Blood Mage — red robes, hands dripping blood floating upward as magical fuel, crimson glowing eyes',
  'Soul Reaper — tall robes, enormous scythe, swirling void where face should be, souls orbiting the weapon',
  'Plague Doctor — long leather coat, beak mask, gnarled staff topped with lantern containing something alive',
  'Pyromancer — permanently on fire hands, scorched tattered robes, wild hair, grinning with burning eyes',
  'Storm Caller — wind-whipped robes, lightning arcing between outstretched hands, silver eyes, crackling storm halo',
  'Runesmith — dwarf scholar, leather apron over plate vest, glowing runes across skin, chisel and hammer',
  'Witch — older woman in layered tattered robes, pointed wide-brim hat, gnarled crooked staff, black cat on shoulder',
  'Void Mage — figure partially made of translucent void energy, one normal arm one arm pure dark power, stars visible inside body',
  'Frost Witch — pale ice-blue robes, hair frozen and standing, ice crystal staff, breath perpetually visible, frostbitten fingers glowing',
  'Chronomancer — clockwork-detailed robes, pocket watches orbiting as satellites, hourglass staff, one eye glowing like a clock face',
  'Summoner — elaborate ritual robes with bound circle markings, hands extended summoning, spectral figure emerging from ground before them',
  'Geomancer — earth-toned robes with stone pauldrons, floating rock fragments orbiting, hands pressing into ground, earth cracking',
  'Shadow Priest — dark vestments, inverted holy symbols, shadow tendrils extending from hands, hollow eyes, corrupt halo',
  // ── Rangers & Hunters ──
  'Ranger — forest leather, longbow at draw, quiver over shoulder, hooded cloak, alert scanning expression',
  'Witch Hunter — long dark coat, wide-brim hat, crossbow in hand, bandolier of flasks, silver-tipped bolts',
  'Bounty Hunter — weathered mercenary in mixed practical armor, repeating crossbow, bounty scroll on belt, scarred face',
  'Slayer — monster hunter, heavy coat covered in trophies, oversized blunderbuss, long hunting knife',
  'Warden Archer — forest ranger in green half-cloak, recurve bow nocked, quiver of arrows with different colored fletching',
  'Phantom Stalker — hunter blending into shadow, crossbow raised, one eye lit by scope-glow, dark camouflage gear',
  // ── Monks & Martial Artists ──
  'Monk — simple cloth wrappings, fists raised in combat stance, inner chi energy glow around hands',
  'Blade Saint — single slim blade, simple grey robes open at chest, perfectly calm expression, pure white chi light',
  'Iron Fist — heavy iron-wrapped fists larger than normal, tattered cloth pants, bare tattoo-covered torso, low stance',
  'Wind Dancer — flowing sashes, staff spinning, hair and fabric in perpetual wind motion, bare feet, acrobatic pose',
  'Stone Monk — skin hardened to look like rough stone, no weapon, punching stance, cracks along skin with orange glow beneath',
  // ── Specials & Uniques ──
  'Clockwork Construct — living automaton, exposed gear chest cavity, one arm mechanical one arm flesh, steam from joints',
  'Undead Champion — skeleton in elaborate cursed crown, gold and black plate armor, massive crumbling sword',
  'Fallen Angel — six massive dark wings in decay, one side beautiful one side skeletal, cracked holy sword bleeding shadow',
  'Lich Ascendant — skeleton in magnificent robes, floating bone crown, green necrotic fire hands, phylactery chest gem',
  'Void Reborn — human-shaped figure made entirely of void energy, stars visible inside transparent body, one bright eye',
  'Dread Pirate — flamboyant tattered captain\'s coat, twin pistols, rapier at belt, tentacle scar on face, cursed amulet',
  'Mercenary Captain — veteran soldier in practical mixed-era armor, commanding stance, sword and dagger combination, campaign medals',
  'Divine Chosen — normal person wrapped in pure divine light, eyes glowing white, holy weapon held aloft, humble expression',
  'Feral Shape-Shifter — partially transformed figure, one arm monstrous and clawed, face mid-change, tattered clothes',
  'Arcane Construct — humanoid figure made of pure solidified magic, spell runes visible on the body surface, no face just light',
  'Cursed Gambler — worn formal coat, cards orbiting as weapons, dice on chain, half face hidden by luck-mask, confident smirk',
  'Sea Captain — weathered naval officer, navy coat with epaulettes, tricorn hat, golden telescope, saber at belt, saltwater-stained gear',
  'Bard — flamboyant performer, lute strapped to back, colorful layered outfit with bells and ribbons, rapier at hip, wide charming smile',
  'Alchemist — tinkerer in leather apron, multiple potion bandoliers, goggles pushed up on forehead, flask of bubbling liquid, stained gloves',
  'Demon Hunter — long grey coat with straps, specialized monster-type weapons, scar across face, grim determined expression, holy symbols',
  'Arena Champion — minimal but ornate gladiatorial armor, enormous two-handed weapon, crowd-pleasing victory pose, arena sand on boots',
  'Forest Spirit — humanoid figure of living wood and leaves, bark-textured skin, glowing green eyes, antler-branch crown, nature magic aura',
  'Tech Priest — half-human half-machine, mechanical arm with built-in tools, holy symbols mixed with tech components, monocle targeting eye',
  'Void Knight — knight whose armor is made of crystallized void energy, stars visible through it, sword of pure darkness, hollow visor helm',
  'Beast Tamer — practical worn leather outfit, whip and bond-rune gauntlet, animal companion tokens hanging from belt, keen alert eyes',
  'War Priest — battle-worn religious plate armor, massive ceremonial weapon, holy symbol glowing on chest, war paint, determined expression',
  'Pirate Queen — elaborate sea-captain outfit, twin flintlock pistols, magical compass, sea creature jewelry, salt-bleached hair, commanding',
  'Infiltrator — tight-fitting stealth suit, multi-tool wrist device, grappling hook at hip, full face mask, countless hidden pockets and pouches',
];

  const ENEMY_PRE={
  'Undead':[
    'Skeleton Warrior — reanimated soldier, yellowed cracked bones, rusted notched sword, hollow glowing eye sockets, jaw gaping in silent scream',
    'Rotting Zombie — bloated decaying humanoid, exposed ribcage, milky dead eyes, arms outstretched, one leg dragging, maggots visible',
    'Armored Revenant — undead warrior, battle-damaged plate armor fused to charred bones, cold blue fire in eye sockets, crumbling sword',
    'Banshee — floating screaming undead woman, hollow eye sockets, silver hair streaming, tattered dress, transparent clawed hands reaching',
    'Bone Crawler — disembodied skeleton on all fours like a spider, spine arched unnaturally, skull facing forward, hollow glowing eyes',
    'Grave Warden — ancient undead cemetery guardian, rotting burial shroud, iron keys fused through ribcage, enormous shovel weapon',
    'Drowned Corpse — waterlogged undead, bloated grey skin, seaweed wound into injuries, barnacles on body, clouded white eyes',
    'Stitched Horror — undead from parts of many corpses, thick black sutures, mismatched body, one arm much too long, patchwork skin',
    'Crypt Shade — translucent undead specter, no lower body fading to darkness, hollow skull face, arms phasing through solid matter',
    'Bone Mage — skeleton in tattered arcane robes, finger bones glowing green at tips, cracked staff topped with skull candelabra',
    'Headless Horseman — armored undead torso on ghostly black horse, carrying own screaming head in one hand, cleaving sword in other',
    'Wight — ancient undead king, desiccated wrapped body, rotting crown embedded in skull, black iron long sword, purple wisps from eye sockets',
    'Plague Walker — zombie covered in open sores oozing toxic yellow-green fluid, swollen pustules, trails infected puddles behind it',
    'Skeleton Archer — skeletal figure with longbow drawn, quiver of bone-tipped arrows, one eye socket glowing brighter for aiming',
    'Mummy — ancient bandage-wrapped undead, cracked amber resin on bandages, glowing hieroglyphic tattoos visible through wrappings, cobra on shoulder',
    'Bone Giant — massive skeleton three times player height, rib cage as torso, each hand a fused bundle of smaller bones as a club',
    'Undead Jester — rotting court jester costume, cracked painted skull face, bells still jingling on cap, juggling severed heads',
    'Death Priest — robed skeleton officiating dark rites, ceremonial skull-topped staff, book of the dead chained to wrist, purple flame halo',
    'Necrotic Swarm — cloud of tiny bone fragments and teeth orbiting a glowing skull core, individual pieces breaking off to attack',
    'Skeleton King — towering undead monarch on a throne of bones that walks with him, crown of fused iron spikes, spectral minions orbiting',
  ],
  'Demons & Devils':[
    'Imp — small vicious demon, dark red leathery skin, oversized clawed hands, tiny jagged wings, barbed tail, sinister needle-teeth grin',
    'Hellhound — pitch-black demonic dog, too many teeth in permanent snarl, void eyes with deep red glow, claws that score stone, spines along back',
    'Chain Demon — gaunt figure wrapped in iron chains embedded through own skin with hooks, filed teeth, brand scars everywhere, one chain a weapon',
    'Lava Crawler — low-slung molten stone creature, cracked obsidian body with glowing magma visible through fissures, heat shimmer around body',
    'Flesh Abomination — grotesque amalgam of fused bodies, multiple misplaced limbs, screaming faces merged into torso, wrong proportions everywhere',
    'Crystal Fiend — humanoid encrusted with sharp crystal growths erupting from spine and shoulders, fractured glowing gemstone eyes, crystalline claws',
    'Pit Fiend — towering devil, leathery crimson skin, folded bat wings, barbed tail, cloven hooves, ram horns, military bearing and posture',
    'Pain Wraith — thin translucent demon with exposed nervous system glowing red, hooks embedded in own flesh, ecstatic grinning expression',
    'Infernal Knight — demon in corrupted black plate armor, fel-green runes bleeding light, enormous jagged serrated sword, burning eyes through visor',
    'Brimstone Elemental — creature made of solidified brimstone and magma, vaguely humanoid, rivers of lava between rock plates, steam rising',
    'Herald of Torment — six-armed demon, each arm holding a different weapon, manic grinning skull face, pain-rune tattoos covering entire body',
    'Smoke Fiend — demon existing mostly as thick toxic smoke, just face and clawed hands fully visible coiling through smoke, glowing red eyes',
    'Succubus — deceptively beautiful demonic figure, bat wings, clawed hands, cruel glowing eyes, venomous barbed tail, dark glamour aura',
    'Balor Demon — enormous fire demon wreathed in living flame, whip of fire in one hand, vorpal sword in other, six burning eyes, massive wings',
    'Shadow Lurker — flat two-dimensional shadow entity, wrong perspective, moves on walls and ceilings, reaches out with three-dimensional arms',
    'Void Stalker — demon that absorbs all light around it, visible only as deep black silhouette with two cold white eyes, reality warped at edges',
    'Gore Titan — massive demon with a body built from the remains of its victims, recognizable parts fused into an enormous war form, trophies embedded',
  ],
  'Blobs & Slimes':[
    'Giant Slime — large translucent blob, acidic green color, random objects dissolved and visible inside, cute but dangerous wobbling form',
    'Toxic Ooze — dark purple-black viscous slime, bubbling surface, skull and bone shapes barely visible inside, corrosive dripping edges',
    'Fire Blob — orange-red semi-transparent blob, flame patterns visible inside, surface rippling with heat, tiny ember sparks popping from surface',
    'Ice Jelly — pale blue-white translucent gelatin blob, frozen objects trapped inside, sharp ice crystal growths on surface, frosty aura',
    'Shadow Blob — pure black featureless blob with no light reflection, small white pinpoint eyes, absorbs light around it, leaves dark trail',
    'Mimic Slime — blob that has imperfectly copied a treasure chest shape, chest features warped and melted, toothy maw visible in the lid gap',
    'Plague Blob — sickly yellow-green blob, covered in open sores and tumors, toxic fumes rising, splitting periodically into smaller blobs',
    'Electric Ooze — bright cyan-white electrified gel, constant lightning arcing across surface, crackles and sparks, numbing to the touch visually',
    'Magma Core Slime — dark rock exterior blob, cracks revealing bright orange lava core, superheated, leaves scorched ground impression',
    'Void Cube — perfectly geometric black cube that moves by rolling and tumbling, no visible eyes but clearly intelligent, void energy at edges',
    'Mother Blob — enormous slow blob, dozens of tiny baby blobs budding from its surface, all the small ones have tiny individual faces',
    'Crystal Slime — mostly transparent with faceted crystal growths embedded throughout body, light refracts through it creating rainbow patterns',
    'Acid Pool Elemental — flat spreading acid puddle that rises to attack, half puddle half upright form, dissolving stone where it moves',
    'Tar Horror — thick black viscous tar creature, stretches when pulling limbs apart, extremely sticky surface, anything that touches it adheres',
  ],
  'Insects & Arthropods':[
    'Giant Cave Spider — enormous hairy arachnid, eight glowing red eyes, dripping hollow fangs, thick bristled legs, bulging dark abdomen',
    'Soldier Ant — oversized black ant the size of a dog, serrated mandibles, armored exoskeleton segments, acid-secreting glands visible on abdomen',
    'Wasp Warrior — human-sized aggressive wasp, barbed stinger the length of a sword, compound eyes, aggressive hovering flight posture, yellow-black',
    'Scarab Beetle Guardian — large iridescent emerald scarab, razor sharp wing-case edges used as shields, horn on head, rolling dung-ball of debris',
    'Centipede Titan — massive multi-segmented centipede, forty legs, two enormous forward-facing poison fangs, armored segments, fast and low to ground',
    'Mantis Hunter — enormous praying mantis, serrated raptorial forelegs in attack posture, triangular head with huge compound eyes, camouflage patterns',
    'Scorpion King — giant black scorpion, oversized claws gripping weapons, multiple segmented tail ending in enormous venom-dripping stinger, armored',
    'Dragonfly Raider — large aggressive dragonfly, four wings creating blur, compound eyes, barbed grasping legs, iridescent wing patterns, fast',
    'Beetle Tank — rhinoceros beetle the size of a car, enormous curved horn, near-impenetrable carapace, charges with tremendous force, tiny eyes',
    'Web Spinner — fat spindly-legged spider, abdomen constantly trailing web strands, creates web structures mid-combat, eight eyes on rotating head',
    'Hornet Commander — larger than standard wasps, elaborate natural armor patterns, carrying stolen sword-sized thorn as weapon, commanding posture',
    'Locust Swarm Entity — thousands of locusts so dense they form a vaguely humanoid shape, individual insects visible at edges, devastation aura',
    'Assassin Bug — thin stalking insect, needle-like proboscis for a face, perfectly camouflaged natural patterns, ambush predator posture, silent',
    'Titan Crab — enormous crab, one claw much larger than other for crushing, heavy armored carapace with barnacles, sideways movement, foam at mouth',
  ],
  'Dinosaurs & Prehistoric':[
    'Velociraptor Pack Scout — feathered raptor, sickle claw raised, intelligent hunting eyes, striped plumage, leaning forward in stalking pose',
    'Armored Ankylosaur — low-slung armored dinosaur, bone-club tail raised, entire back covered in thick bone plates and spikes, tiny defensive eyes',
    'Pterodactyl Raider — large flying pterosaur, tooth-filled long beak, leather wings, screeching expression, clawed feet reaching to grab',
    'T-Rex Skeleton — complete tyrannosaurus rex skeleton animated by dark magic, purple glowing eyes in skull, some flesh still clinging to ribs',
    'Triceratops Berserker — armored three-horned dinosaur, massive frill decorated with war-paint patterns, charging posture, tusks scarred from battle',
    'Brachiosaurus Colossus — enormous long-necked dinosaur used as a living siege weapon, armored plates added by handlers, city-scale threat',
    'Mosasaur Leviathan — massive sea lizard, enormous toothed jaws, paddle-like limbs, slick dark skin, predatory intelligence in small eyes',
    'Stegosaurus Guardian — armored dinosaur with double row of bone plates along spine, spiked tail held high in threat display, stocky defensive build',
    'Allosaurus Hunter — bipedal carnivore slightly smaller than T-rex, three-fingered clawed arms actually useful for grabbing, fast aggressive',
    'Parasaurolophus Caller — crested hadrosaur, enormous trumpet-like crest on head used to call other dinosaurs, surprisingly fast when alarmed',
    'Ankylosaurus War-Mount — dinosaur with rider platform built into natural armor, bone club tail enhanced with metal spikes, living tank',
    'Dire Spinosaurus — spined carnivore, massive neural spine sail along back, longer arms than T-rex, semi-aquatic posture, fish-catching jaws',
  ],
  'Aliens & Cosmic':[
    'Grey Alien Scout — classic large-headed alien, enormous black almond-shaped eyes, thin fragile body, telepathic energy visible around head',
    'Xenomorph Drone — sleek biomechanical alien predator, elongated smooth head, inner second jaw, acid blood dripping, quadrupedal attack stance',
    'Blob Alien — amorphous multi-colored alien blob, several mismatched eyes at random positions, pseudopods for movement, absorbs matter on contact',
    'Insectoid Alien — tall thin alien with compound eyes, four arms with clawed hands, chitinous exoskeleton with iridescent sheen, communicates in clicks',
    'Void Horror — tentacled cosmic entity, central eye surrounded by writhing tentacles, non-Euclidean body that hurts to look at, reality distortion aura',
    'Crystal Alien — being made of living crystal formations, body constantly growing and shedding facets, prismatic light emission, no clear face',
    'Plasma Entity — alien made of barely-contained plasma, magnetic field keeping it together, crackling energy body, miniature solar flare arms',
    'Hive Mind Fragment — chunk of a larger hive intelligence, multiple small bodies loosely connected by bio-cable, each piece has part of a face',
    'Spore Alien — plant-animal hybrid alien, bulbous spore-sac body, releases toxic spore clouds, root-like tendrils as legs, flower-crown head',
    'Mech Alien — alien in biomechanical power armor grown from organic components, unclear where pilot ends and suit begins, multiple weapons',
    'Time Wraith — alien that experiences time differently, visible as overlapping multiple positions simultaneously, trails of past and future positions',
    'Star Spawn — entity composed of compressed star matter, burns with inner nuclear light, radiation aura, humanoid silhouette but enormous energy',
    'Mind Flayer — tall thin humanoid with octopus-like face, four facial tentacles, robes hiding a body that is partly brain matter, psychic energy crown',
    'Aboleth — enormous ancient aquatic alien, three eyes on elongated body, four tentacles, mucus aura, has enslaved civilizations for millennia',
    'Elder Brain Colony — detached chunk of a vast alien brain, visible neurons firing, eye stalks emerging from tissue, floating via psychic levitation',
  ],
  'Robots & Constructs':[
    'Patrol Bot — compact boxy security robot, rotating head with scanning laser eye, two arm-mounted weapon barrels, treads for movement, warning lights',
    'Golem Stone — massive humanoid made of stacked stone blocks, glowing rune core visible in chest, slow but devastating, moss in cracks from age',
    'Sentinel Mech — bipedal military mech, heavy armor plating, shoulder-mounted cannons, visor scanning eye, damaged panel hanging off one side',
    'Automaton Soldier — steam-powered brass clockwork soldier, exposed gear mechanism in chest, piston-driven limbs, monocle targeting eye, top hat',
    'Combat Drone Swarm — dozens of small hovering disc-shaped drones in a coordinated swarm, each with single targeting laser, collectively forming shapes',
    'Iron Golem — enormous humanoid of cast iron, riveted plates, furnace glow from interior visible through joints and eyes, slow but unstoppable',
    'Repair Bot Gone Wrong — maintenance robot that has fused with organic material, wires threading through flesh, tools now used as weapons, confused',
    'War Machine Chassis — bare mechanical skeleton of a decommissioned war robot, endoskeleton exposed, still functional, stripped of all armor plating',
    'Spider Bot — multi-legged mechanical spider, central surveillance camera body, electrified leg tips, hydraulic actuated legs, sticky magnetic feet',
    'Laser Turret Guardian — fixed defensive turret that uprooted itself to walk, three rotating barrels, targeting computer visible in chassis, fortified',
    'Nano Swarm — cloud of microscopic robots so dense it appears as a moving silver liquid mass, humanoid form loosely maintained, absorbs matter',
    'Unstable AI Core — floating sphere of pure energy containing a trapped artificial intelligence, tendrils of lightning lashing out, displays glitching',
    'Mech Colossus — enormous bipedal war machine filling most of the screen, multiple weapon systems, missing one arm replaced with improvised spike, scarred',
    'Clockwork Behemoth — enormous Victorian-era mechanical beast, steam venting constantly, gear mechanisms exposed, whistle and pressure valve screams',
    'Corrupted Factory Unit — industrial assembly robot repurposed for combat, welding torch and plasma cutter as weapons, factory paint half-stripped',
  ],
  'Beasts & Monsters':[
    'Troll — massive hunched creature, grey warty skin, tiny malevolent eyes, club from broken stone pillar, visible regenerating wounds mid-combat',
    'Mud Golem — lumbering animated swamp mud, vaguely humanoid, bubbling surface, yellow gas leaking from cracks, no visible eyes, slow and enormous',
    'Cave Basilisk — giant lizard, six legs, crest of venomous spines, one eye sealed shut with rune scar to prevent gaze attacks, armored scales',
    'Dire Wolf — massive wolf three times normal size, scarred battle-worn fur, amber predator eyes, pack leader scar on nose, foam at mouth',
    'Wyvern — serpentine dragon with only hind legs and stinger tail, large bat wings dominating, malicious reptile eyes, acid drip from mouth',
    'Bone Drake — skeletal dragon completely fleshless, chains holding bones together, three pairs of violet burning eyes, necromantic fire between ribs',
    'Fungal Shambler — humanoid entirely colonized by fungi, original host barely visible, mushroom cap growing from shoulders, spore cloud aura',
    'Blind Juggernaut — massive rhino-like creature, no eyes, vibration-sensing tendrils on snout, armored plates covering entire body, unstoppable charge',
    'Carrion Crawler — enormous centipede-like creature, paralytic antennae, multi-segmented armored body, dozens of legs, acidic saliva dripping',
    'Deep Leviathan — massive eel-like water monster, row after row of teeth, bioluminescent lure dangling, long whisker tendrils, crushing coils',
    'Manticore — lion body, bat wings, human-like face frozen in rictus grin, scorpion tail firing bone spines, mane of dark blades',
    'Chimera — lion head, goat head, serpent tail-head, each with separate expression, fire from lion mouth, venom from serpent, goat screaming',
    'Hydra — seven serpentine heads on long necks from one massive body, each head different expression, acid blood, regenerating cut necks',
    'Nightmare Hound — quadrupedal predator, no skin just writhing black muscle, spine-whip tail, head splits open into four-way jaw for attack',
    'Cerberus — three-headed giant dog, each head different personality, chains broken at neck, hellfire in three sets of eyes, massive and muscular',
    'Leviathan Worm — enormous subterranean worm, circular tooth-lined mouth big enough to swallow a person, eyeless, vibration-sensing lateral lines',
    'Wendigo — tall emaciated horned predator, enormous antlers, sunken hollow face, ribcage visible, supernatural speed, leaves frozen footprints',
    'Mimic Beast — creature that has taken the shape of a stone statue, slightly wrong proportions, attack pose mid-transition from statue to beast',
  ],
  'Flying Enemies':[
    'Giant Bat — oversized bat, dripping long fangs, solid-red eyes, leathery dark wings with claw joints, screaming expression in flight',
    'Harpy — winged humanoid, massive feathered wings instead of arms, hooked talons, matted dark feathers, cruel beak and hollow screaming eyes',
    'Void Wraith — ghost-like entity trailing dark mist instead of legs, clawed hands reaching, multiple screaming faces in transparent body',
    'Flame Skull — disembodied flaming skull, jaw open in scream, orbiting flame particles, cracks revealing internal fire, bone horns curling back',
    'Gargoyle — winged stone demon sentinel, cracked rocky skin, large spread taloned wings, permanently snarling fanged mouth, perched pose',
    'Wyvern — serpentine dragon with only hind legs and stinger tail, large bat wings dominating, malicious reptile eyes, acid drip from mouth',
    'Screaming Maw — nothing but a giant flying mouth, concentric rings of teeth, single massive eye on top, trailing wet membrane wings',
    'Shade Stalker — impossibly thin flying shadow, flat black silhouette that bends wrong, white dot eyes, long raking clawed fingers trailing',
    'Soul Leech — floating lamprey-like creature, circular tooth-lined mouth facing forward, parasite tendrils trailing behind, translucent body',
    'Wind Spectre — visible only as a spinning vortex with a screaming face at center, debris orbiting the vortex, hair and fabric whipping',
    'Plague Crow — enormous raven three times normal size, infected one eye clouded over, patches of bare skin between feathers, diseased beak',
    'Aerial Jellyfish — translucent floating entity shaped like jellyfish, long stinging tendrils hanging below, bioluminescent in darkness',
    'Demon Locust — oversized armored insect, chitin body, membranous wings, scorpion stinger tail, mandibles with human teeth visible inside',
    'Eye Tyrant — floating enormous eyeball surrounded by smaller eyeballs on stalks, each eye fires different energy beam, main eye antimagic',
    'Living Tornado — small localized tornado with a screaming face visible in the vortex, debris orbiting, lightning inside the funnel',
    'Bloodsucking Lamprey — enormous eel-like flying creature, circular sucker mouth with rows of teeth, smooth featureless body, magnetic flight',
    'Void Drake — completely black dragon-like creature, no features just silhouette, wings leave trails of darkness, stars visible through body',
    'Gravity Manta — enormous manta ray-like creature, manipulates gravity around it, fish and debris orbiting it, crushing pressure aura',
  ],
  'Humanoid Enemies':[
    'Goblin Shaman — tiny green goblin, oversized head, bone and feather fetishes draped over body, staff with still-blinking eye on top, hex fire',
    'Iron Lurker — hunched mechanical monstrosity, crude self-welded iron shell, one arm a giant claw, one arm a rusted blade, mismatched parts',
    'Corrupted Knight — former paladin, cracked black armor leaking dark ichor from every joint, visor shattered showing hollow skull face inside',
    'Cultist Fanatic — robed figure, face hidden by carved wooden mask, carrying ritual knife, body covered in self-carved runes, frantic energy',
    'Dark Elf Scout — lithe figure in dark leather armor, twin short blades, white hair pulled back, purple-black skin, predatory elven grace',
    'Orc Berserker — massive green-skinned warrior, minimal armor, huge axes in both hands, battle frenzy expression, tusks bared, ritual scars',
    'Gnoll Packmaster — hyena-headed humanoid, cackling laughing expression, short spear and bone-decorated shield, pack-trophy necklace',
    'Minotaur Guard — half-man half-bull, enormous two-handed axe, iron ring through nose, scarred hide, labyrinth-carved shoulder armor plates',
    'Vampire Lord — pale bloodless humanoid, slightly wrong proportions, fully extended retractable fangs, red eyes, tattered noble attire, bat wings',
    'Werewolf — mid-transformation figure, one arm fully wolf one arm human, tearing out of clothes, yellow eyes, elongating jaw, partial fur',
    'Bandit Captain — scarred mercenary, mismatched looted armor pieces, commanding snarl expression, two different weapons, campaign battle medals',
    'Ratfolk Assassin — bipedal rat creature in dark leather, twin poisoned blades, narrow red eyes, tail for balance, twitchy ready stance',
    'Lizardfolk Warrior — bipedal lizard soldier, natural scale armor, large oval shield, primitive stone-tipped spear, cold unblinking reptile eyes',
    'Troll Shaman — hunched massive troll in shamanic fetish robes, staff topped with skulls and feathers, glowing tattoos, warpaint patterns',
    'Cyclops Brute — one-eyed giant, primitive club studded with rocks, single enormous eye on forehead, bad temper expression, primitive loincloth',
  ],
  'Aquatic — Common':[
    'Piranha Swarm Cluster — dense ball of hundreds of razor-toothed piranhas moving as one mass, glinting silver scales, blood in the water around them, chomping mouths visible at edges',
    'Anglerfish Hunter — enormous deep-sea anglerfish, massive toothy underbite jaw, lure dangling from forehead glowing sickly blue-green, huge black eyes, fleshy finned body',
    'Electric Eel Giant — enormous eel, body crackling with blue-white electricity along its length, jolt scars on its own skin, pale underbelly, snapping jaws',
    'Crab Warrior — large aggressive crab, one claw oversized and crushing, one claw razor-sharp for cutting, eyes on stalks scanning, barnacle-encrusted shell, battle-scarred',
    'Shark Predator — great white shark in attack posture, rows of triangular teeth visible, cold black eye, battle scars, torpedo body with powerful tail',
    'Barracuda Assassin — sleek silver barracuda the size of a person, needle-like fang-teeth, lightning fast posture implied, iridescent silver-blue scales, predatory gaze',
    'Sea Serpent Scout — smaller serpent, long sinuous coiling body covered in iridescent scales, frilled neck fanned out in threat display, venomous fangs, intelligent yellow eyes',
    'Jellyfish Drifter — enormous translucent jellyfish, mesmerizing bioluminescent bell pulsing, dozens of long stinging tentacles trailing below, visible glowing organs inside bell',
    'Mantis Shrimp Warrior — human-sized mantis shrimp, rainbow iridescent carapace, two raptorial club arms cocked ready to strike, compound eyes on stalks, armored segments',
    'Hermit Crab Golem — oversized hermit crab using an entire sunken ship as its shell, claws the size of doors, eyes on long stalks, dragging the wreck behind it',
    'Moray Eel Ambusher — enormous moray eel emerging from a crevice, gaping maw with second inner jaw visible, muscular spotted body, perpetual menacing grin expression',
    'Stingray Glider — massive diamond-shaped stingray, long venomous barbed tail raised and ready, flat body with camouflage pattern, graceful but deadly wing-like fins',
    'Pufferfish Bomber — bloated puffer already inflated, covered in long sharp spines, toxic expression, beady angry eyes, yellow-black warning coloration',
    'Nautilus Guardian — enormous living nautilus, spiral shell with ornate natural patterns, tentacles spread wide, jet propulsion implied, ancient and alien intelligence',
    'Lobster Titan — car-sized lobster, enormous crusher claw and ripper claw, armored exoskeleton with battle-scarred plates, antennae swept back, stalked compound eyes',
    'Octopus Shapeshifter — large octopus mid-color-change, one half matching coral one half visible natural brown, intelligent eyes, eight arms reaching in all directions',
    'Lamprey Horror — enormous lamprey, circular tooth-filled suction mouth facing viewer showing concentric rings of teeth, eyeless smooth body, terrifying oral disc',
    'Sea Cucumber Titan — enormous sea cucumber in defense posture, eviscerated internal organs visible as weapon-like protrusions, sticky threads extending outward',
    'Coelacanth Ancient — massive ancient coelacanth fish, lobe fins like stubby limbs, prehistoric scale pattern, deep blue with white spots, slow and ancient power',
    'Gulper Eel Nightmare — deep sea gulper eel, mouth hinges impossibly wide open, entire body just a massive jaw with a small body attached, bioluminescent lure',
  ],
  'Aquatic — Elite':[
    'Shark Knight — anthropomorphic great white shark standing upright in rusted salvaged armor, wielding a trident and anchor-chain flail, battle-hungry grin of exposed teeth',
    'Coral Golem — humanoid figure built entirely from living coral formations, anemones and barnacles covering surface, sea water dripping through porous body, glowing polyps',
    'Deep One Cultist — fish-humanoid hybrid, bulging eyes on sides of head, gill slits on neck, webbed clawed hands, scaled skin with slimy sheen, clutching dark idol',
    'Drowned Revenant — waterlogged undead warrior, bloated pale flesh, seaweed tangled through armor and limbs, barnacles on shoulders, rusted weapons, milky eyes',
    'Kraken Spawn — juvenile kraken, eight massive tentacles radiating from central body, each tentacle covered in suckers with small teeth, intelligent amber eyes, chromatophore skin',
    'Merrow Raider — malevolent mermaid warrior, upper body humanoid but monstrous and fanged, fish tail ending in shark-like fin, wielding bone spear, seaweed hair, predatory',
    'Abyssal Angler — humanoid creature with enormous anglerfish head, body walking upright on crab-like lower limbs, lure extending from between massive jaws, darkness aura',
    'Tide Witch — gaunt humanoid in tattered water-soaked robes, controlling spiraling water tornado around body, fish-bone staff, pale blue skin, black void eyes',
    'Shipwreck Crab — enormous crab that has fused with a sunken galleon, cannons now part of its shell claws, torn sails as fins, crew still visible as skeletal decorations',
    'Sea Witch Eel — enormous moray eel with humanoid face and arms emerging from its neck, casting water spells from clawed hands, living coral crown, cruel intelligent face',
    'Brine Elemental — humanoid figure made entirely of dense seawater and salt, crashing wave energy forming its shape, foam at edges, creatures visible swimming inside body',
    'Abyssal Knight — fully armored warrior in ornate black iron pressure suit, trident weapon, visor glowing with deep sea bioluminescence, wraith-like sea creatures orbiting',
  ],
  'Aquatic — Bosses':[
    'The Kraken — colossal cephalopod of impossible size, twenty tentacles each the width of a ship\'s mast, enormous intelligent amber eyes the size of carriage wheels, barnacle-covered mantle, ink clouds in the water around it, ancient and patient malevolence',
    'Leviathan — biblical sea serpent of apocalyptic scale, armored hide of overlapping obsidian scales, rows of crushing teeth in multiple jaw layers, fins like castle walls, each eye glowing like a lighthouse, trails storm clouds in its wake',
    'The Drowned God — enormous decomposing deity at the bottom of the ocean, cathedral-sized corpse still moving, deep sea creatures living inside its wounds, bioluminescent rot covering the body, one eye still open and aware, worshipper skeletons clinging to it',
    'Abyssal Queen — monstrous deep-sea entity, humanoid torso fused to enormous octopus body, crown of anglerfish lures all glowing different colors, tentacles carrying stolen treasure and weapons, ancient coral throne grown into her form',
    'Tidal Colossus — crab-like giant the size of a small mountain, partially buried in the ocean floor, each claw a different ecosystem attached, colony of smaller creatures living on shell, when it moves tsunamis are implied by body language',
    'The Pearl Serpent — divine sea serpent covered in iridescent pearl-white scales, golden eyes containing entire galaxies, mane of sea anemones and coral, fin-wings spread wide, gentle and terrifying in equal measure, ancient beyond measure',
    'Maw of the Deep — nothing but a mouth, an abyss-scale circular pit of teeth opening in the ocean floor, concentric rings of inward-curved fangs, bioluminescent lure the size of a lighthouse above it, drawing everything into darkness',
    'The Coral Titan — fossilized sea titan now made entirely of living coral, city-sized, fish and sea creatures living in the coral city on its body, moving slowly but with tectonic inevitability, one hand raised and encrusted with entire reefs',
    'Hydra of the Depths — seven-headed sea serpent, each head a different deep-sea creature merged with serpent, aquatic environment of crushing pressure around it, regenerating heads visible with growing stumps, impossibly ancient',
    'The Abyssal Eye — a single eye the size of an island visible at the crushing bottom of the deepest ocean trench, surrounded by thousands of tentacles extending in every direction, the pupil a portal to somewhere worse',
  ],
  'Mini-Bosses':[
    'The Hollow King — desiccated undead monarch, enormous body, crown of rusted iron spikes driven into skull, spectral enemy hands swarming him',
    'Broodmother — enormous bloated cave spider, hundreds of smaller spiders covering body, pulsing egg sac abdomen, venom dripping mandibles',
    'The Executioner — enormous headless undead in black hood, axe the size of a door, lantern on belt containing a screaming trapped face',
    'Forge Demon — industrial demon fused with a working forge, molten metal body, one arm a forge hammer, chimney growing from shoulder blades',
    'The Marionette — broken undead puppetmaster, limbs controlled by dark energy strings, jerky unnatural movement, cracked painted face',
    'Plague Bearer — obese festering daemon of disease, massive rotting body covered in boils and tumors, giant rusty bell on chain dragging',
    'The Stone Sentinel — ancient magical golem, cracked granite body with glowing rune core in chest, one arm a battering ram, moss-covered',
    'Venom Duchess — elegant undead noblewoman, fine decayed gown, snake pit where lower half should be, viper-fang tiara, one black claw arm',
    'The Collector — creature made entirely of weapons embedded in body, exposed organs visible between blades, bleeding from all cuts constantly',
    'Fungal Sovereign — enormous mushroom mycelium intelligence, wagon-wheel-sized cap, tentacle roots as legs, human faces visible in cap flesh',
    'The Amalgam — creature formed from four fused monsters, asymmetrical mismatched body, four different heads all screaming different languages',
    'Siege Golem — enormous mechanical stone giant built as battering ram, iron-reinforced arms, wheels where feet should be, cannon in chest',
    'Abyssal Watcher — massive floating eye surrounded by smaller orbiting eyeballs, each eye firing a different elemental beam at once',
    'Rot Prince — young-looking figure in elaborate decayed royal clothing, charming expression but body visibly decomposing in real time, crown askew',
    'The Stitcher — giant troll-like creature that assembles itself from fallen enemies mid-battle, growing larger and stranger as the fight continues',
    'Queen Insectoid — enormous insect queen, massive abdomen constantly producing drone insects, elegant crowned head completely at odds with body',
    'Alpha Mech — prototype war machine, more powerful than all subsequent models, self-repairing mid-combat, tactical intelligence lights in visor',
    'The Wendigo Patriarch — enormous version of wendigo, ancient and calculating, controlling lesser wendigos, body is a collection of past victims',
  ],
  'Bosses':[
    'The Lich Lord — towering undead sorcerer, ornate black robes, floating phylactery at chest, fleshless skull with purple flame eyes, bone crown, staff of screaming souls',
    'Bone Dragon — colossal undead dragon skeleton completely fleshless, chains holding bones together, violet burning eyes, membrane wings, necrotic fire',
    'Death Angel — vast fallen angelic form, six enormous wings in decay, one half face beautiful one half grinning skull, cracked holy sword bleeding shadow',
    'The Clockwork God — enormous mechanical deity, cathedral-sized geared body, hundreds of clock faces frozen at wrong times, god-eye at chest burns white',
    'Void Incarnate — humanoid shape of compressed collapsing darkness, stars visible through translucent body, face is a void containing one dying galaxy',
    'The Devourer — immense serpentine abomination, ten heads on writhing necks each screaming, body made of compressed victims, reality distorts around it',
    'Ancient Colossus — titanic crumbling stone giant, cathedral ruins built into body, villages on shoulders, one eye a lighthouse one eye a volcano',
    'The Mother of Thorns — enormous plant intelligence, human silhouette from compressed thorned vines, beautiful skull face of white bone, faces in petals',
    'Archlich Sovereign — skeleton on floating throne of bones, twelve skeletal hands orbiting as shields, crown of screaming skulls, staff is an entire spine',
    'God-Eater — something that consumed a god and wears its corpse like armor, divine limbs repurposed as weapons, screaming divine essence leaking out',
    'Infernal Overlord — supreme demon lord thirty feet tall, four arms each a different weapon, six wings of living flame, crown of damned souls orbiting',
    'The Hive Queen — alien intelligence in enormous insectoid body, thousands of drones orbiting, multiple eyes, ovipositor visible, crown of antenna',
    'Mech Titan God — ancient war machine the size of a mountain, partially buried but awakening, multiple exposed weapon systems, nuclear core glowing',
    'The Sleeping Primordial — dinosaur-god hybrid of unimaginable scale, waking up is the battle, tectonic plates shift as it moves, cities on its back',
    'World Serpent Fragment — just the severed head of a world-eating serpent, the size of a castle, ancient and patient, one eye the size of a house',
    'The Resonance — a being made of pure sound given physical form, visible as overlapping shockwave rings, screaming face at the convergence point',
    'Elder Brain Ascendant — vast alien intelligence that has consumed thousands of minds, visible as a city-block-sized brain with mechanical augmentations',
    'The Forgotten Titan — once-worshipped deity now mad and abandoned, divine body half-dissolved, worshippers\' prayers carved everywhere, tragic expression',
  ],
};

  const PLAT_PRE={
  'Grass & Earth':[
    'Lush meadow — bright green grass top, thick blades, wildflowers scattered, dark rich soil front with roots and pebbles',
    'Clover patch — bright grass with clover leaves mixed in, dark earth cross-section, small butterfly at edge',
    'Flower-dotted grass — green grass top with red, yellow, white flowers scattered, earthy front face with root tips',
    'Forest floor — dark green overgrown grass top, deep dark brown almost black soil front, white mushrooms on underside corner',
    'Mossy earth ledge — grass mixed with thick soft moss patches, very dark rich soil front, fern fronds from cracks',
    'Twilight grass — blue-green twilight grass, dark purple-grey soil front, small glowing mushrooms from cracks',
    'Cursed earth — dark sickly grey-green grass, black earth front with purple corruption veins in soil',
    'Autumn grass — dry orange-brown grass top, some blades yellowed, warm amber soil front, fallen red maple leaf',
    'Dead winter grass — pale white-grey frost-covered grass stubs, icy pale grey soil front with ice crystals',
    'Sunlit hilltop — short vivid green blades, warm golden light catching tips, dark brown loamy soil, single daisy at edge',
    'Sandy grass transition — grass thinning at right edge, sandy soil mixing into front face, small pebbles scattered',
    'Bog turf — dark olive green thick clumps, black swamp peat front, water seeping from cut edge, damp surface',
    'Dandelion meadow — grass dotted with yellow dandelion heads, some gone to seed, dark soil with earthworm holes',
    'Mycelium earth — dark grass hiding pale mushroom caps, white mycelium threads visible in soil front, bioluminescent root tips',
  ],
  'Stone & Castle':[
    'Castle cobblestone — large rectangular grey stone blocks, mortar seams, flat top, cracks and small moss patches',
    'Crumbling dungeon ledge — rough-cut grey stone, cracked edges with chunks missing, dark moss in gaps, damp staining',
    'Obsidian fortress — jet-black polished dark stone, faint demonic rune etching on front face, dried blood in carved channels',
    'Ancient ruin slab — weathered pale limestone, carved relief decoration worn on front face, grass from cracks at top edge',
    'Bone platform — compacted bones, flat top of compressed skulls and long bones, stacked bone front face, dark marrow staining',
    'Marble palace ledge — smooth polished white marble top, intricate carved decorative molding on front face, gold trim at top',
    'Sandstone desert block — warm tan sandstone, wind erosion texture on top, vertical sediment lines on front, sand in cracks',
    'Ice dungeon ledge — semi-transparent blue-white ice, frosted top, front face showing frozen air bubbles and trapped dark shapes',
    'Dark basalt platform — volcanic dark basalt, rough matte black top, sharp fractured front face, faint orange heat in deepest cracks',
    'Mossy castle ruin — weathered grey stone with thick green moss carpeting the top and front face, crumbling corner',
    'Carved temple step — wide shallow step of pale carved stone, worn relief carvings on front face, sand blown into carved grooves',
    'Dungeon brick ledge — red-brown fired brick construction, mortar seams, front face slightly bowed outward from age, moss at base',
  ],
  'Nature & Organic':[
    'Floating earth island — natural earth chunk, flat grassy top, side showing soil layers and root tendrils dangling',
    'Mossy log — enormous fallen tree trunk, flat moss-covered top, circular bark end face with tree rings, mushrooms on side',
    'Giant mushroom cap — flat pale blue-white cap, curved underside with pink gills, thick pale stem below',
    'Crystal formation ledge — dark purple arcane crystal cluster, flat jagged crystal top, crystal spires pointing down on front',
    'Giant lily pad — enormous lily pad floating on water, flat bright green top, slightly wavy edge, flower at one end',
    'Coral reef ledge — bright orange and pink coral formation, rough organic top, branching coral structures on front face',
    'Gnarled root platform — thick twisted ancient roots compacted, flat bark-and-root top, root cross-sections on front',
    'Ice floe — thick flat slab of floating ice, flat slightly textured top, transparent front showing layers, dark water below',
    'Cloud platform — dense fluffy solidified white-grey cloud, flat top with soft rounded edges, fluffy textured front',
    'Tree branch wide — enormous living tree branch as platform, flat bark top with small leaf buds, circular wood grain end face',
    'Toadstool cap — giant red mushroom cap with white spots, flat walking surface on top, curved underside visible from front',
    'Bone spine bridge — ribcage bones arching into walkway, vertebrae as flat top surface, rib bones as front arch structure',
    'Swamp log — waterlogged dark mossy log, flat slimy dark top, circular end face with water-stained rings, algae on bottom',
    'Living vine — thick braided vine ropes with horizontal vine slats on top, flat slat surface, hanging vine tendrils below',
  ],
  'Mechanical & Tech':[
    'Clockwork platform — flat dark iron surface, front face showing exposed gear mechanism, steam from vents, brass accents',
    'Metal grating — industrial iron grate with grid pattern, flat top showing grate texture, riveted iron frame front, rust staining',
    'Floating arcane disc — circular dark arcane metal, flat top with rune inscriptions, glowing blue energy ring at rim',
    'Wooden ship deck — weathered sea-worn oak planks, visible caulked seams, vertical hull-plank front, iron bolts, barnacles below',
    'Iron bridge section — heavy wrought iron, diamond plate top, decorative gothic rivet work on front, rust at bolt holes',
    'Arcane conduit — dark metal top with glowing energy lines flowing across, crackling rune nodes at corners, energy pulsing from front vents',
    'Obsidian machine — flat dark iron and glass surface, visible pistons in motion behind front glass panel, steam escaping at joints',
    'Arcane forge platform — dark stone platform with embedded crucible elements, glowing rune seals on front face, heat shimmer above',
  ],
  'Slopes & Thin':[
    'Sloped stone ramp — 30-degree angled cobblestone, left lower right higher, grip markings on angled surface',
    'Thin stone ledge — very thin single-block-height horizontal stone shelf, minimal front face, jump-through design',
    'Steep earth ramp — 45-degree earth and rock ramp, rough surface with grip stones, roots visible in cross-section',
    'Sloped grass hill — 30-degree angled grass and earth, grass blades growing perpendicular to slope',
    'Icy slope — 30-degree smooth ice ramp, dangerously smooth surface, frost texture on top, ice-block front',
    'Bone spine ramp — sloped ramp made of angled rib bones, smooth bone surface on top, skeletal structure visible beneath',
    'Cracked stone stairs — wide stair step, carved stone with wear groove in center from foot traffic, front face ornate',
    'Vine rope bridge section — single plank of aged wood tied in vine ropes on each side, sagging slightly in the middle',
  ],
  'Alien & Sci-Fi':[
    'Alien growth platform — organic alien matter forming a ledge, pulsing bioluminescent veins, bio-luminescent slime at edges, wrong color',
    'Force field floor — partially transparent energy platform, hexagonal tiling visible in the field, crackling blue edge, flickering slightly',
    'Metal grating sci-fi — industrial sci-fi grate platform, warning stripe paint, bolted frame, hazard markings, worn anti-slip surface',
    'Crystal spire top — flat crystal platform on top of a towering crystal spire, faceted transparent edges, inner glow, tiny and precarious',
    'Hovering disc — circular anti-gravity disc, glowing repulsor light underneath, smooth metallic top, occasional bobbing motion implied',
    'Coral platform — living coral formation platform, bright orange and pink, barnacled front face, sea anemone decorations on top surface',
    'Fungal mycelium — white mycelium threads compressed into solid platform, slightly spongy appearance, small mushroom caps at edges',
    'Lava tube ledge — solid cooled lava tube cross-section as platform, hollow core visible in end face, glassy smooth lava surface on top',
    'Crystallized time — platform frozen in amber-like crystallized time, objects mid-motion frozen in the crystal visible inside, warm glow',
  ],
};

  const PROP_PRE={
  'Containers & Loot':[
    'Ornate treasure chest — dark iron reinforced wooden chest, golden lock, glowing rune etchings along lid, battle-worn scratches',
    'Stone burial urn — cracked ancient ceramic urn, faded painted runes, sealed with wax and bone pin, dark stains',
    'Barrel — weathered oak barrel with iron hoops, stave gaps dripping dark liquid, bung on top slightly loose, mossy one side',
    'Coffin — old dark wood coffin, tarnished silver handles, white flower dried and dead on lid, corner broken revealing darkness',
    'Coin pile — glittering mound of gold and silver coins, gems scattered on top, one ancient skull half buried beneath',
    'Scroll pile — stack of ancient rolled scrolls, some sealed with wax, yellowed edges, leather tie bindings',
    'Potion shelf — wooden shelf with glass bottles of glowing liquids in red blue green purple, corks, some cracked',
    'Mimic chest — treasure chest with subtle rows of teeth in lid gap, one panel with closed eye, ancient wood, breathing motion',
    'Sarcophagus — stone coffin with carved relief of the deceased on lid, hieroglyph inscriptions, cracked lid slightly ajar',
    'War trophy pile — mound of captured enemy weapons, cracked shields, broken armor, skulls mounted on top, torn battle flag',
    'Crystal reliquary — small ornate glass and iron box with arcane crystal shards inside, glowing softly, intricate latticework',
    'Crate — rough pine crate with iron corner brackets, straw visible through gaps, rope handle on side, shipping rune branded',
    'Locked strongbox — small heavy iron box with large padlock, reinforced corners, key hole, chain attached to floor ring',
    'Amphora — ancient terracotta wine vessel, sealed with cork and wax, painted hunting scene on body, slightly cracked at neck',
    'Tome on stand — large ancient book on a reading stand, cover has raised eye symbol, pages yellowed and covered in diagrams',
  ],
  'Lights & Fire':[
    'Wall torch — iron bracket mounted torch, bright animated flame, warm orange glow bloom, soot marks above',
    'Brazier — iron tripod brazier, wide bowl filled with roaring fire, glowing ember ash below, rune carvings on iron legs',
    'Lantern — hanging iron cage lantern on chain, green-tinged flame within, cracked glass, rusted chain above, eerie glow',
    'Candelabra — ornate three-armed black iron candleholder, three flickering candles with dripping wax, cobweb between arms',
    'Crystal orb — glass orb on stone stand, pulsing purple-blue arcane energy within, faint rotating light pattern inside',
    'Bone candle — skull with candle burning from eye socket, wax dripping down skull face, pale flame',
    'Sconce pair — two iron wall sconces on either side of stone block, both lit, dripping tallow wax, paired shadows',
    'Campfire — small circle of large stones, crackling flame, ember glow, two short logs crossed in center, warm light pool',
    'Brimstone pit — shallow stone-rimmed depression, slowly bubbling green-black brimstone, dim toxic glow, fumes wisping up',
    'Arcane beacon — tall thin obelisk topped with floating spinning magical orb, runes on shaft glow in sequence',
    'Ghost light — floating orb of pale blue-white light with no obvious source, drifting slowly, leaving faint light trail',
    'Lava lamp — ornate iron stand holding a glass vessel of slowly churning lava, volcanic gas bubbles rising through it',
  ],
  'Interactive':[
    'Iron portcullis — vertical iron bar gate, sharp spike tips on bottom, rust streaks down bars, stone frame with groove tracks',
    'Stone altar — flat-topped stone slab, blood channels carved into surface, iron manacles on sides, dark staining',
    'Lever — large iron floor lever with wooden grip, bolted to stone base, worn shine at the grip',
    'Spike trap pit — dark opening in floor, broken stone edges, rows of iron spike tips barely visible in darkness below',
    'Pendulum blade — massive curved blade on chain from ceiling mount, deeply notched edge, blood-stained arc marks below',
    'Pressure plate — flush stone plate, hairline cracks around edge, mechanism visible in gap, worn center',
    'Ancient door — massive stone double door, carved relief faces, iron ring handles, cracked along center seam, sealed with bar',
    'Rune barrier — translucent magical wall, dark purple energy with glowing rune symbols floating in it, crackling at edges',
    'Elevator platform — small square stone platform suspended by iron chains, counterweight visible, worn leather rope pull handle',
    'Trap door — wooden trap door flush with floor, iron ring pull handle, hinges on one side, lock hasp, scuff marks around edges',
    'Moving platform gear — large wall-mounted gear slowly turning, connected to chains that move an unseen platform, steam from hub',
    'Pressure sensor — floor-flush circular pressure pad, glowing rune ring around edge, mechanism clicking, different state colors',
    'Chain hoist — iron chain hanging from ceiling pulley, hook at bottom, two ends for controlling a platform above, cranking handle',
  ],
  'Decor & Atmosphere':[
    'Skull pile — mound of dozens of skulls, some cracked, one with arrow still lodged in eye socket, old and yellowed',
    'Dead tree — twisted leafless black tree, gnarled bark, hollow section in trunk, bioluminescent fungi on roots, ravens perched',
    'Iron maiden — standing torture device of dark iron, spike-lined interior visible through hinged open door, rust streaking',
    'Gallows — wooden hanging platform, frayed rope with noose, weathered wood, trapdoor mechanism, tally marks scratched in post',
    'Bone tree — twisted tree made of fused bones, ribcage as trunk, finger bones as twigs, skulls growing as fruit',
    'Ancient statue — weathered stone warrior statue, worn features, one arm broken off at base, moss covering shoulders',
    'Blood altar — small stone altar, shallow bowl, deep crimson blood still fresh pooled in the bowl, ritual candles on each side',
    'Dungeon cell — iron-barred cell door in stone doorframe, barred window with chains visible inside, rusted hinges, scratches',
    'Broken pillar — shattered stone column, top half toppled resting against surviving base, moss and ivy growing up it',
    'Gravestone cluster — three weathered headstones of different heights, worn text, one tilted forward, dying flowers between',
    'Tattered banner — iron banner pole, large torn cloth banner hanging, heraldic device barely visible, bottom edge frayed',
    'Wanted poster — worn parchment pinned to wall with iron nail, face drawing with price above, stained and torn',
    'Trophy mount — dark wood wall mount with large monster skull mounted on it, brass nameplate below, dusty and imposing',
    'Ruined bookshelf — tilted wooden bookcase, half the books fallen, remaining books water-warped and moldy, loose pages',
    'Caged skeleton — iron hanging cage, skeleton inside still in standing position, rusted chains, skull tilted to one side',
    'Well — stone-rimmed circular well, cracked masonry, rope disappearing into absolute darkness, wooden bucket hanging',
    'Campfire remains — cold ash pile, charred log ends, scattered bones of something cooked, tin cup nearby',
  ],
  'Nature':[
    'Giant mushroom — oversized bioluminescent blue-white mushroom, glowing spore puffs drifting from gills, thick pale stem',
    'Carnivorous plant — enormous snapping jaw plant, multiple tooth-lined mouth pods, acid drip from tips, tendrils rooting',
    'Web cocoon — large spider-silk wrapped bundle hanging, vaguely humanoid shape inside, dried blood on outside wrapping',
    'Giant egg — large dark leathery egg in nest of bones and black feathers, cracked slightly, faint glow from inside',
    'Poisonous flower — oversized dark purple flower, thorned stem, dripping nectar that burns stone, skull pattern in petals',
    'Ancient oak — massive dark forest oak trunk, deeply furrowed bark, thick roots erupting from ground, hollow at base',
    'Frozen crystal cluster — large dark amethyst crystals erupting from floor, sharp geometric faces, glowing from within',
    'Swamp vine tangle — thick rope-like dark vines coiled across floor and up wall, thorns, dripping moisture, skull tangled inside',
    'Rock formation — dramatic natural stone outcrop, three boulders leaning together forming arch, moss in crevices',
    'Pond — small contained pool of dark still water, lily pads floating, small frogs visible at edge, reflection of environment',
    'Beehive — enormous hexagonal hive hanging from tree branch, visible honey glow, bees orbiting, dripping amber honey',
  ],
  'Sci-Fi & Tech':[
    'Crashed escape pod — small charred cylindrical pod cracked open, emergency lights still blinking, scorch marks on hull, hatch blown off',
    'Energy conduit — glowing plasma tube running vertically, crackling energy visible inside transparent housing, mounting brackets on wall',
    'Holographic terminal — dark console with glowing holographic display floating above, data readouts, alien or futuristic script visible',
    'Cryogenic pod — vertical glass-fronted stasis pod, frost on glass, humanoid outline barely visible inside, life support lights blinking',
    'Explosive barrel tech — metallic barrel with radiation symbol, glowing warning light on top, hazard stripes, unstable energy reading',
    'Autonomous turret — wall-mounted automated weapon, tracking camera eye, barrel assembly, warning lights, targeting reticle projected',
    'Power core — glowing central energy core on a stand, crackling energy tendrils extending from it, console readouts around the base',
    'Alien artifact — non-euclidean object that seems to have too many sides, glows with inner light that does not match its surface color',
  ],
};

  const BG_PRE={
  'Gothic & Castle':[
    'Ruined gothic cathedral interior — FAR: vaulted stone ceiling, broken rose window casting colored light shafts / MID: crumbling columns with ivy, dark coffin alcoves, torchlight / NEAR: broken stone floor edge, pillar silhouette. Cool blues and purples, dust motes in light shafts',
    'Castle battlements at dusk — FAR: blood-orange sunset sky with volcanic peaks / MID: crumbling battlements with guttering torches, ravens circling / NEAR: stone rampart edge. Warm orange sunset key light, cool blue shadow side',
    'Forsaken throne room — FAR: arched ceiling in shadow, moonbeam from shattered roof / MID: shattered throne on dais, rotting tapestries, scattered bones / NEAR: cracked stone floor edge with broken masonry. Cold silver moonlight, deep shadow fills corners',
    'Castle dungeon corridor — FAR: dark stone tunnel receding to blackness / MID: arched brick walls with iron-barred cell doors, dripping moisture, torch pools of warm orange light / NEAR: wet stone floor edge. Warm torch pools vs deep cold shadow',
    'Crypt of kings — FAR: domed stone ceiling with faded battle fresco / MID: rows of enormous stone sarcophagi, standing iron candelabras, dark alcoves / NEAR: worn stone floor with scattered gold coins. Cold blue-purple crypt light, single warm candelabra glow',
    'Burning castle at night — FAR: black sky with fire and smoke column rising / MID: towers with fire erupting from windows, crumbling battlements with siege damage / NEAR: smoldering rubble ground edge. Dramatic orange fire vs dark purple night sky',
    'Great hall in ruins — FAR: vast ceiling supported by half-collapsed arched buttresses / MID: long feasting table now rotting, shattered stained glass windows, ravens on the rafters / NEAR: flagstone floor edge, fireplace ruin. Shaft of moonlight through broken ceiling',
  ],
  'Underground & Cave':[
    'Ancient cave network — FAR: absolute blackness with distant glowing crystal formations / MID: enormous stalactite columns, underground lake reflecting crystal glow / NEAR: cave floor edge with scattered rocks and shallow water. Bioluminescent blue-cyan palette',
    'Volcanic lava cavern — FAR: dark cave ceiling in heat shimmer / MID: rivers of molten orange-red lava between black basalt, heat distortion waves / NEAR: black rock floor edge with ember cracks. Dramatic upward orange-red lava glow',
    'Mushroom spore cavern — FAR: cave ceiling covered in glowing fungi flooding bioluminescent light / MID: forest of enormous glowing mushrooms, bioluminescent water on floor / NEAR: water edge with glowing spores. Cool bioluminescent teal-blue, ethereal and alien',
    'Underground waterfall chamber — FAR: cave ceiling darkness / MID: massive waterfall of glowing blue water into luminous pool, ancient ruins behind waterfall / NEAR: rocky shore edge with water foam. Cool blue-white glow vs warm torch-lit ruins',
    'Bone cavern ossuary — FAR: cave ceiling with bones embedded in stone / MID: walls of stacked bones and skulls, iron torch brackets between skull clusters / NEAR: bone-paved floor edge. Warm torch-orange vs cold bone-white',
    'Underground river canyon — FAR: cave ceiling with ancient carved reliefs / MID: deep underground river cutting through cavern, stone walls with ancient carved stairs / NEAR: stone dock edge. Bioluminescent water reflecting onto carved walls',
    'Crystal geode cavern — FAR: domed ceiling of one enormous geode, walls of crystal formations / MID: floor of flat crystal plates like tiles, reflection of ceiling in the surface / NEAR: crystal floor edge. Single light source creating prismatic color reflections everywhere',
    'Ancient dwarf city — FAR: enormous cavern ceiling with carved stonework / MID: tiers of carved stone buildings receding into the rock, stone bridge over chasm, waterwheels turning / NEAR: carved stone path edge. Warm forge-glow from below, blue cave light from above',
  ],
  'Forest & Nature':[
    'Ancient dark forest at midnight — FAR: black sky through dense canopy, pale moon giving silver backlight / MID: enormous ancient tree trunks, bioluminescent fungi on roots / NEAR: exposed root floor edge. Silver moonlit rim light, deep black shadow',
    'Cursed swamp at twilight — FAR: bruised purple-orange sky, dead tree silhouettes / MID: still dark water reflecting sky, silhouetted dead cypress trees in moss / NEAR: waterline edge with lily pads. Perfect mirror reflection in water',
    'Jungle temple ruins — FAR: warm tropical sky through canopy gaps / MID: massive stone temple walls covered in vines, carved stone faces half-consumed by jungle / NEAR: stone path edge with jungle plants. Dappled warm light shafts',
    'Frozen tundra at night — FAR: dark Arctic sky with vivid green-purple aurora / MID: frozen plain with snow drifts, bare birch trees, distant frozen lake / NEAR: snow-covered ground edge with ice cracks. Aurora palette: green, purple, cyan',
    'Autumn forest at golden hour — FAR: pale golden sky through canopy, orange-red leaf rain / MID: massive oak and maple trunks with warm golden backlight, orange-red leaf carpet / NEAR: leaf-covered ground edge, large gnarled root. Warm amber-gold against cool shadow blue',
    'Desert at high noon — FAR: blazing white-yellow sky, distant dune silhouettes, heat shimmer / MID: crumbling sandstone ruins half-buried in sand, eroded carved columns, dry fountain / NEAR: sun-baked sandy stone path edge. Brutal high-contrast overhead lighting, bleached pale stone',
    'Rainforest in the rain — FAR: grey sky barely visible through dense canopy layers, rain falling / MID: enormous fern and vine-covered jungle floor, dripping leaves, small waterfall / NEAR: mud and root ground edge with puddles. Cool green-grey diffuse light, mist in mid-ground',
    'Cherry blossom grove — FAR: soft pink-white sky, distant mountains / MID: ancient cherry trees in full bloom, petals drifting, stone lanterns between trunks / NEAR: stone path edge with fallen petals. Soft warm pink light, dreamy and peaceful',
  ],
  'Void & Cosmic':[
    'Shattered void dimension — FAR: absolute black void with distant stars and nebula wisps / MID: stone floor fragments floating at different depths, connected by crackling purple-black energy bridges / NEAR: floating stone platform edge with tendrils. Deep space colors, void energy as only light source',
    'Nightmare realm — FAR: impossible sky of churning dark clouds forming screaming faces / MID: contradicting architecture — stairs sideways, doors on ceilings — in wrong cold colors / NEAR: floor edge that dissolves into nothing. Wrong colors, deeply unsettling geometry',
    'Dead god interior — FAR: cathedral-scale ribcage arching overhead / MID: landscape of petrified divine flesh and stone merged, bioluminescent organs the size of hills / NEAR: organic-stone ground edge. Dark organic palette with bioluminescent accent glows',
    'Star graveyard — FAR: deep space filled with dying stars, red giants, white dwarfs / MID: floating ruins of ancient civilization on asteroid fragments / NEAR: crumbling stone edge in zero gravity. Dramatic multi-colored star lighting',
    'Pocket dimension library — FAR: infinite bookshelves curving upward into impossible glowing sky / MID: hovering reading platforms connected by arcane bridges, floating candles, suspended open tomes / NEAR: ornate stone floor edge. Warm candle-gold vs deep blue impossible depth',
    'Mirror world — FAR: exact reflection of the real world but subtly wrong, slightly off colors / MID: inverted landscape, things growing downward, water flowing up, mirror-reversed text on signs / NEAR: mirror surface at floor level, walking on the reflection. Silver-blue palette, deep uncanny atmosphere',
    'Arcane observatory — FAR: open roof revealing painted cosmos with impossible planet arrangements / MID: enormous brass orrery in the center of the room spinning slowly, star chart walls / NEAR: dark stone observatory floor edge, astronomical instrument fragments. Deep blue-black with gold arcane light',
  ],
  'Undead & Horror':[
    'Ancient bone plains — FAR: pale grey sky with thunderclouds lit within by purple lightning / MID: endless flat landscape of packed bones and skulls, single dead tree, fog rolling / NEAR: bone and skull ground edge. Cold grey-white palette, purple lightning accents, completely desolate',
    'Graveyard at midnight — FAR: full moon behind torn dark clouds, silver moonlight breaking through / MID: ancient crooked headstones in uneven rows, iron fence against moon, wisps of white fog / NEAR: disturbed grave dirt edge, pale hand pushing up through soil. Silver moonlight',
    'Necromancer sanctum — FAR: domed ceiling with central floating magical light source / MID: enormous circular chamber, giant necrotic rune circle on floor glowing purple, bone bookshelves / NEAR: stone floor edge with magical inscription details. Deep purple magical light vs absolute dark shadow',
    'Corrupted sacred ground — FAR: once-holy sky now sickly yellow-green / MID: defaced holy temple architecture, inverted symbols carved over holy ones, purple corruption spreading / NEAR: cracked holy stone floor edge with corruption. Sickly green-purple vs remnants of warm holy gold',
    'Plague village ruins — FAR: grey overcast sky heavy with clouds, distant smoking ruins / MID: collapsed thatched-roof buildings, overturned carts, abandoned belongings, mass graves / NEAR: muddy cobblestone path edge. Cold desaturated grey palette, sickly yellow light in distant window',
    'Haunted mansion interior — FAR: high ceilinged drawing room lost in darkness / MID: dusty furniture draped in white sheets, cracked portrait paintings with moving eyes, chandelier of unlit candles / NEAR: warped wooden floorboard edge. Single moonbeam through shutter gap, ghostly face in portrait',
  ],
  'Urban & Architecture':[
    'Medieval village at dawn — FAR: warm pink-orange dawn sky above rooftop silhouettes / MID: cobblestone main street between timber-frame buildings, market stalls being set up, smoke from chimneys / NEAR: cobblestone road edge with puddle reflection. Warm dawn light side-lit from left',
    'Abandoned fortress courtyard — FAR: grey sky above broken battlements / MID: cracked stone courtyard, collapsed siege engine, crow-covered gibbet, empty well / NEAR: cracked flagstone edge with weeds growing through. Cold flat overcast light, deeply abandoned',
    'Sewer under the city — FAR: dark stone tunnel receding / MID: arched sewer channel with flowing dark water, stone walkways on both sides, water-stained walls, iron grate shadows / NEAR: wet stone path edge. Torch light from sconces creating warm pools in cold dark',
    'Library of the Ancients — FAR: impossibly tall ceiling with mezzanine galleries vanishing into shadow / MID: enormous shelves of ancient books, rolling ladders, reading tables, floating candles / NEAR: dark wooden floor edge with scattered open books. Warm golden candlelight vs cool upper shadow',
  ],
};

  const FG_PRE={
  'Stone & Architecture':[
    'Gothic stone archway frame — full four-edge frame: crumbling stone arch overhead, matching crumbling columns left and right, broken stone floor edge at bottom, carved with skull motifs, moss in cracks, dark silhouette style',
    'Iron portcullis frame — full frame: thick rusted iron bars across top, continuation down both sides, chain-wrapped bottom edge, heavy iron construction, rust stains running vertically, spike tips visible',
    'Giant ribcage entrance — two enormous curved ribs arching in from left and right meeting overhead, yellowed cracked bone, dark cartilage strips hanging, bone fragments at the base corners',
    'Dungeon corridor framing — stone ceiling edge with stalactites at top, rough-cut stone wall sections left and right, stone floor edge at bottom with drain grate, torch brackets on wall sections',
    'Demon skull gate pillars — two enormous demon skulls facing inward as pillars left and right, mouth open on each, single thick chain hanging between them at top, glowing eye sockets',
    'Crumbling castle ruin frame — large chunks of crumbled castle masonry in bottom corners, partial collapsed wall sections left and right, dangling ivy and roots at top, all dark silhouette',
    'Cathedral window arch — enormous ornate gothic stone arch at top, dark stained glass sections left and right, stone floor threshold at bottom, worn stone steps up to threshold',
    'Fortress gate wall — massive dark stone gatehouse wall, gate opening as the playable area, murder holes visible overhead, iron torch brackets on wall faces, iron-shod wooden gate standing open',
    'Cracked stone columns — pair of massive crumbling stone columns left and right, broken capitals at top, column drums cracked with vegetation growing in cracks, rubble at base',
    'Ancient arena gate — gladiatorial arena entrance gate, iron portcullis raised, crowd silhouettes visible in background left and right, sand floor visible at bottom',
  ],
  'Organic & Cave':[
    'Cave mouth frame — sharp jagged stalactite teeth hanging from top edge, matching stalagmites rising from bottom edge, rough rocky cave wall sections left and right, bioluminescent moss at edges',
    'Ancient dead tree frame — enormous gnarled dead black tree trunk left side, matching tree on right side, bare branches meeting overhead in a tangle, thick exposed roots spreading across bottom edge, ravens perched',
    'Carnivorous vine frame — thick dark thorned vines covering all four edges, large carnivorous plant pods opening toward center, tooth-lined flower centers, acid drips from vine tips',
    'Crystal cavern frame — enormous dark amethyst crystal spires rising from bottom corners, more crystals hanging from top edge, smaller crystal debris along bottom, bright neon glowing cores',
    'Mushroom forest frame — giant mushroom caps overhanging from above, tall mushroom stems left and right, glowing spore puffs drifting from gill undersides, bioluminescent blue-cyan glow',
    'Giant ribcage interior — curved ribs visible along both sides and meeting at top, organic tissue between ribs, dark and oppressive, bioluminescent parasites on inner surfaces',
    'Enormous tree hollow — inside a vast hollow ancient tree, curved inner bark walls left and right, root arch at the top, root-tangled floor at bottom, faint green light through bark cracks',
    'Swamp root tunnel — massive mangrove-like roots arching overhead forming the tunnel, dark water and mud at bottom, hanging moss curtains left and right, bioluminescent insects in darkness between roots',
    'Ice cave mouth — jagged ice formations framing all four edges, sharp clear icicles top and sides, ridged ice floor at bottom, deep blue inner darkness, frozen air crystals floating',
    'Living forest arch — two enormous living trees bending toward each other, branches intertwined overhead, roots raised in arches left and right, glowing fireflies in the foliage',
  ],
  'Atmospheric Overlays':[
    'Fog bank — thick rolling white-grey fog filling the lower quarter of the screen, soft luminous quality, tendrils reaching upward, slowly drifting, obscures the ground entirely',
    'Heavy blood rain — dark crimson rain falling in dense vertical streaks across full screen width, large drops leaving brief red trails, pools forming at the bottom',
    'Volcanic ash fall — grey-white ash flakes of varied sizes drifting slowly downward, faint warm orange glow from below suggesting lava, ash accumulating on horizontal surfaces',
    'Purple spore cloud — drifting semi-transparent cloud of purple-cyan bioluminescent spores filling the upper portion, individual spore shapes visible, drifting slowly left to right',
    'Shadow tendrils — long black void-energy tendrils reaching inward from all four screen edges, slightly transparent, moving very slowly toward center, purple inner glow at origin points',
    'Ice crystals forming — frost crystals visibly growing and spreading from all four corners inward, sharp geometric patterns, crackling slowly inward, faint blue-white glow at growth front',
    'Firefly swarm — dozens of tiny glowing yellow-green firefly lights floating in gentle random patterns across full screen, each with soft glow halo, peaceful but eerie, some blinking',
    'Dark downpour — sheets of heavy grey-dark rain falling at a slight angle across full screen, wind-driven, near-impenetrable density, dark and oppressive atmosphere',
    'Blizzard whiteout — near-horizontal white snow streaks across full screen, wind-driven, visibility nearly zero, only silhouettes visible through snow, cold white-blue palette',
    'Ember storm — glowing orange-red ember sparks and small flame wisps blowing horizontally across full screen, heat shimmer distortion, dark smoke background',
    'Void rift tears — dark jagged rips in reality tearing open slowly at screen edges, purple-black void visible through tears with distant stars, crackling dark energy at tear edges',
    'Golden petal rain — warm golden-orange flower petals drifting gently downward across full screen, rotating slowly, catching sunlight, soft and beautiful overlay',
    'Thick darkness creep — darkness encroaching from all four edges toward center, darkness has a slight living quality as if it breathes, small faces barely visible within the dark',
    'Underwater caustics — rippling light caustic patterns moving across the environment, wavy distortion of elements behind it, bubble chains rising from bottom to top, deep blue tint overall',
  ],
};

  const UI_PRE={
  'Health & Resources':[
    'Health bar frame — dark iron gothic frame, red fill bar, skull ornament at left cap, cracked glass overlay, darkens when nearly empty',
    'Soul bar — deep blue arcane frame with rune trim, bright blue-white fill, soul orb icon at left cap, glowing intensifies when full',
    'Stamina bar — thin urgent bar, green fill turning yellow then red, minimal frame, ticks at every 25%',
    'Blood gauge — dark crimson bar, black iron frame, blood drop icon, fill has viscous dripping quality, glows ominously at full',
    'Corruption meter — dark purple bar with spreading corruption visuals, tendrils growing from edges as it increases, eye symbol opens at full',
    'Rage bar — jagged dark red bar, cracks appear in frame as it fills, fist icon, sparks fly from edges when at maximum',
    'Mana orb — circular orb UI element, deep blue liquid filling from bottom, white sparkle when full, emptied shows dark cracked interior',
    'Shield gauge — hexagonal bar, steel-blue fill, shield icon, shatters visually when depleted, reforms over time',
    'Hunger clock — circular dial, bone icon at center, dial fills clockwise, warning glow at low levels',
    'Dual resource bar — two bars stacked vertically, top red health bottom blue mana, single dark iron frame containing both',
    'Segmented armor bar — row of separate shield-shaped segments, each one cracks when that segment is depleted, dark iron material',
    'Faith power meter — ornate religious-themed bar, golden cross at cap, divine light leaking from edges at full, dims to dark at empty',
    'Tech energy cell — sci-fi adjacent dark metal housing, green energy core visible through hexagonal cells, cells going dark as depleted',
    'Combo multiplier display — large gothic number display, multiplier number grows and changes color, warning pulse when about to drop',
    'Ward charge counter — three circular charge indicators in a row, each a glowing gem that dims when the ward absorbs a hit',
  ],
  'Actions & Abilities':[
    'Skill button — square dark iron button with beveled edge, icon recess in center, cooldown circle overlay, glows when ready, dimmed on cooldown',
    'Quick slot bar — horizontal strip of four connected skill button slots, dark iron connecting bar, number labels above each',
    'Flask slot — potion bottle shape cutout in dark iron frame, fill level indicator, cork visible at top, small bubbles in liquid',
    'Charge ability button — large round glowing button that charges from empty with expanding ring, fully charged state emits light pulses',
    'Passive skill node — hexagonal gem-like node, fills with color when skill assigned, dim when empty, connecting line to adjacent nodes',
    'Combo counter — stylized number display, dark metal frame, number grows larger with each hit, flashes gold at maximum combo',
    'Hotbar action strip — horizontal row of 8 action slots, dark iron frame per slot, active slot highlighted with purple glow, number keys labeled',
    'Parry window indicator — brief bright flash indicator at edge of screen showing optimal parry timing, gold ring that appears and fades',
    'Dodge dash charge — row of three circular charge dots, each lights up when a charge recharges, pulses when all three are full',
    'Ultimate ability meter — large dramatic button with charging ring, inner icon glows brighter as it charges, erupts with light when full',
    'Inventory quick-swap — two large overlapping square slots for weapon and offhand, swap arrow between them, item art in each slot',
    'Channel bar — horizontal progress bar appearing above character portrait, shows remaining channel time, interruption causes it to shatter',
  ],
  'Panels & Windows':[
    'Inventory window — dark stone and iron panel, 6x5 grid of item slots, worn leather texture on header bar, skull buttons at corners',
    'Map panel — parchment-colored background with dark burnt edges, player dot, fog of war, dark iron frame, compass rose',
    'Dialogue box — wide rectangular panel at screen bottom, stone texture background, speaker portrait window on left, gothic iron frame',
    'Boss health bar — extra wide dramatic horizontal bar, ornate gothic frame, boss name above, phase segment markers along its length',
    'Level up panel — large centered panel with radiant golden glow, character silhouette in center, two selectable upgrade cards below',
    'Character sheet panel — tall vertical panel, portrait window at top, stat rows below, dark stone texture, decorative iron border',
    'Skill tree panel — large panel with connected node network, dark background, glowing lines connecting skill nodes, current tier highlighted',
    'Loot notification — small horizontal popup in corner, item icon, item name and rarity color, brief slide-in animation, auto-dismiss',
    'Merchant shop window — wide panel split into two halves, left player inventory right merchant stock, gold icon and amount at bottom',
    'Quest log panel — scroll-like panel with worn parchment center, header banner, list of active quests with status markers, quest-giver name tags',
    'Crafting window — dark iron panel with two ingredient slots plus a combine button, result preview slot, smoke effect when combining',
    'Equipment comparison panel — side-by-side stat comparison of equipped vs looted item, green text for upgrades red for downgrades',
    'Bestiary entry — large panel with enemy silhouette on left, stat blocks on right, discovered attack patterns listed, lore text at bottom',
    'World map panel — full parchment-colored map with painted region illustrations, explored areas clear fog-of-war on unexplored',
    'Achievement popup — banner sliding in from top, achievement icon, title, and brief description, golden border, auto-dismiss timer bar',
  ],
  'HUD Elements':[
    'Minimap frame — circular minimap with elaborate dark iron compass rose frame, cardinal direction marks, current area name below',
    'XP bar — very thin bar at screen bottom, dark purple fill slowly charging, subtle glow when level is nearly complete',
    'Checkpoint marker — save point indicator, chalice or bonfire icon, soft warm glow pulse, text label indicating active or inactive',
    'Death counter — grim reaper skull icon with number beside it, dark metal frame, grows more cracked with each death',
    'Currency counter — coin icon with animated shine, number display, dark gothic frame, brief flash animation when amount changes',
    'Area name banner — dramatic full-screen-width banner, gothic serif text, dark background panel, subtitle text below',
    'Enemy HP indicator — thin horizontal bar above enemy sprite, fills red, phase-change threshold segments, enemy name above',
    'Status effect icons — row of small circular icons with symbol inside, one per active status, pulse animation on application, timer ring draining',
    'Stealth indicator — eye icon that opens and closes indicating detection level, color shifts from green to yellow to red',
    'Compass bar — horizontal strip at top of screen with cardinal directions, quest objective markers appearing as arrows, current heading highlighted',
    'Interactable prompt — floating icon above interactable objects, button symbol, brief pulse animation, text label below icon',
    'Damage number popups — numbers floating upward from hit point, normal white, critical yellow larger, heal green, miss grey',
    'Timer display — large countdown clock in corner, dramatic gothic frame, glows red when below 30 seconds, ticking visual',
    'Direction arrow — screen-edge arrow pointing toward active objective or player when off-screen, glowing color matches quest type',
  ],
};

  const VFX_PRE={
  'Melee Impacts':[
    'Sword slash impact — sharp white-yellow diagonal slash mark, three to five high-speed motion streaks, tiny stone chip particles',
    'Heavy hammer ground slam — massive circular shockwave ring radiating from contact, cracks spreading like spiderweb in stone, large dust cloud',
    'Shield bash shockwave — wide circular concussive blast ring, compressed air distortion wave, starburst of white light at center, ground cracks, dust',
    'Parry spark burst — tight starburst of bright white-gold sparks at contact point, sparks scatter outward and downward, ring of impact energy',
    'Critical hit burst — large explosive starburst of golden-white energy, dramatic radial lines extending far outward, shockwave distortion ring',
    'Axe cleave arc — wide sweeping red-orange arc following axe swing path, sharp leading edge, dissipating trail, blood droplets scattering from point',
    'Dagger rapid strike — three overlapping quick slash marks close together, white-blue energy, rapid staccato motion lines, tiny sparks',
    'Spear thrust impact — elongated single bright spike of impact energy, radiating lines all perpendicular to thrust direction, dust cloud from hit',
    'Fist punch shockwave — circular compressed air shockwave radiating from punch, knuckle imprint dust cloud, concentric rings at impact',
    'Backstab flash — bright white flash explosion at hit point, expanding red-black energy ring, blood droplets, dramatic silence-before-the-flash quality',
    'Chain weapon wrap — multi-link energy chain wrapping around impact point, each link glowing, wrap tightening into compact energy burst',
    'Crushing blow — floor-level ground crack pattern spreading from impact, debris chunks flying outward, enormous dust and rubble cloud',
  ],
  'Magic & Spells':[
    'Arcane explosion burst — tight ring of purple-blue arcane energy radiating outward, magical sigil fragments spinning, bright white core fading to purple',
    'Fireball impact — orange-red expanding fireball with bright yellow-white core, outer flame tendrils splaying, black smoke forming above, ember sparks',
    'Ice nova blast — sharp geometric ice crystal shards exploding outward in starburst, bright blue-white cores, frost spray between shards, frost ring at ground',
    'Void blast — compressed darkness sphere detonating, black core expanding, dark purple energy rings radiating, screaming faces briefly visible in energy',
    'Holy smite — brilliant golden-white column of divine light striking from above, cross-shaped lens flare at impact, white energy ring at ground level',
    'Lightning bolt strike — jagged multi-branching white-blue lightning bolt from above, bright white core with blue-purple secondary arcs, afterglow arc lingering',
    'Poison cloud burst — expanding sphere of toxic sickly green mist, viscous and bubbling, skull-shaped wisps, droplets of green liquid falling from cloud base',
    'Necrotic wave pulse — dark purple-grey death energy radiating outward, green-black edges, small skeleton hands reaching briefly from the wave surface',
    'Frost nova — circular burst of blue-white frost energy, shard-like ice crystal formations on outer ring, frozen breath mist in center',
    'Gravity well — dark sphere pulling inward with spiraling purple-black energy, debris and particles orbiting and being pulled in, warped light lines toward center',
    'Soul drain beam — thin crackling purple beam of energy, soul-shaped particles traveling along beam away from target, faint screaming faces in energy',
    'Earth spike burst — jagged stone spikes erupting upward in star pattern, stone debris flying upward, dust cloud at base, cracked earth rings',
    'Thunder clap — massive expanding circle of pure compressed sound energy, no color just distortion rings, debris caught in pressure wave at the rim',
    'Arcane sigil detonation — glowing rune circle on floor flares to maximum brightness then explodes upward, rune fragments as shrapnel, column of arcane light',
    'Time freeze field — expanding dome of distorted space-time energy, everything inside shown in slow motion, distortion haze at the dome edge',
    'Blood nova — crimson sphere of blood magic detonating, viscous red droplets spraying outward, dark energy rings, veins of blood-energy in the blast',
  ],
  'Projectiles':[
    'Fireball in flight — compact orange-red sphere, bright yellow-white hot core, slightly elongated motion blur, clean flame trail, ember sparks off trailing edge',
    'Shadow bolt in flight — dark purple-black energy projectile with crackling surface, elongated in travel direction, darkness trail, screaming face briefly inside',
    'Holy arrow in flight — glowing golden arrow with bright white tip, small cross-shaped sparkles in light trail, radiant glow around arrowhead',
    'Void orb in flight — dark sphere of compressed nothingness, light bending around it visibly, stars visible through it as portal, swirling void tendrils as wake',
    'Ice spike in flight — sharp geometric ice crystal shard, bright blue-white, frost crystal particles in wake, perfectly sharp tip',
    'Bone shard volley — cluster of three sharp bone fragments flying together, yellowed edges, jagged tips, dark marrow-stained centers, slight rotation in flight',
    'Arcane missile — bright pure blue-white energy bolt, clean and fast, compact with short bright trail, crackling electrical effect on surface',
    'Poison dart — dark grey dart with bulbous green poison coating on tip, green droplets leaving trail, toxic vapor wisping off the tip',
    'Flame arrow in flight — wooden arrow with head wrapped in roaring flame, fire cone trailing backward, sparks flying off, smoke trail',
    'Void tendril projectile — dark writhing tentacle of void energy, lashing forward, grabbing-claw at the tip, reality distorting around it',
    'Crystal shard shot — multi-faceted crystal shard, refracting light into rainbow spectra along trail, sharp pointed end, spinning slowly',
    'Thunder bolt — visible cylinder of compressed air, white-blue crackle along surface, circular shockwave ring at leading edge, boom visual',
    'Seeking soul orb — glowing white-blue orb with small ghostly face inside, slightly erratic flight path, soft glow trail, leaves ghost after-images',
  ],
  'Auras & Buffs':[
    'Holy protection aura — circular dome of soft golden-white radiant light, cross and star particle shapes orbiting outer rim, warm upward glow, pulsing',
    'Berserker rage aura — explosive dark red energy erupting from character silhouette, jagged angular shards breaking off at tips, crackling at edges',
    'Poison status cloud — thin sickly green toxic mist constantly emitting from affected character, skull-shaped wisps, slow dripping of green liquid from base',
    'Speed boost trail — three to four overlapping ghostly afterimage silhouettes, each more faded than last, purple-blue energy',
    'Death aura — dark purple-grey smoke rising around character, skeleton hands reaching upward from smoke at base, skull faces in smoke',
    'Frost armor — angular ice crystal formations around character silhouette, blue-white frost coating, frozen breath clouds rising, crackling cold energy',
    'Arcane empowerment — floating arcane rune circle at feet, glowing purple sigils orbiting the character, arcane light crown at head level',
    'Invincibility flash — entire character emitting white-gold radiant light, alternating bright flash and dimmer state, particles of light radiating outward',
    'Stealth shimmer — character outline visible only as a heat-shimmer distortion, faint edge-detect glow at the silhouette boundary, footstep ripples',
    'Berserk rage building — red energy crackling from fists, veins of energy spreading upward on body, eyes glowing red, hair lifting slightly',
    'Divine blessing — rays of golden light descending onto character, small glowing angel wings appearing briefly, warm radiant shockwave pulsing outward',
    'Elemental absorption — element being absorbed into character, swirling vortex pulled inward toward chest, character briefly takes on element color',
    'Shadow cloak — darkness swirling around and into character, edges blurring into shadow, eyes and teeth the only bright spots',
    'Chain lightning buff — constant small lightning arcs jumping between fingers, crackling surface energy on body, hair standing on end',
  ],
  'Environmental':[
    'Torch flame loop — four-frame loop: tall narrow flame with hot white-yellow core / medium leaning right / short wide orange with ember sparks / medium returning',
    'Portal opening — dark swirling void vortex spiraling inward, deep purple-black center, bright energy ring at outer rim, tendrils reaching outward',
    'Soul release — small glowing blue-white soul orb rising from defeated enemy, gentle organic floating motion, soft corona glow, transparent and fading',
    'Ground crack hazard — stone floor surface cracking open jaggedly, dark void visible below, loose rock fragments falling in, glow from far below',
    'Blood pool spreading — dark crimson viscous liquid spreading outward from a point, slow and heavy-looking, surface catches light with faint reflection',
    'Lava eruption splash — molten orange-red rock bursting upward from crack, large molten globs arcing outward, black cooling crust forming in air, steam above',
    'Healing motes burst — gentle burst of green-gold healing energy motes rising upward, soft glowing particle shapes like tiny leaves or sparkles, warm soothing',
    'Lightning overhead arc — horizontal lightning arc between two points, multiple branching secondary arcs, intense white core with blue-purple glow, fading afterglow',
    'Magic circle activation — ornate circular rune pattern on floor lighting up segment by segment, full glow at activation, vertical light pillar erupting',
    'Rain of blood — dark crimson droplets falling densely, heavy streaks, splashing on surfaces, accumulating in shallow pools, oppressive atmosphere',
    'Bioluminescent bloom — clusters of small glowing teal-cyan orbs expanding outward, organic pulsing light, spore-like particles drifting, alien and beautiful',
    'Void rift tear — reality tearing open at a point, dark void with stars visible through the tear, crackling dark energy at tear edges, growing slowly',
    'Explosion with shockwave — initial white flash, expanding fireball with black smoke, visible pressure wave ring just ahead of the fire, debris outward',
    'Crystal shatter burst — crystalline object exploding, hundreds of sharp faceted shards flying outward, each catching light differently, tinkling light trail',
    'Water splash impact — circular water splash from impact on water surface, individual water droplets arcing upward, concentric ring waves spreading',
    'Smoke bomb burst — compact grey-white smoke cloud rapidly expanding from single point, billowing outward, wispy tendrils at edges, opaque center',
    'Chain reaction explosion — three explosions in sequence at different points, each one triggering the next, debris from first caught in blast of second',
  ],
  'Status Effects':[
    'Burning on fire — continuous flame on and around character, orange-red flickering fire, black smoke rising, ember sparks floating upward, char marks appearing',
    'Frozen solid — character encased in blue-white ice, frost crystal formations growing outward from body, frozen cracking sounds suggested by crack lines',
    'Electrocuted — blue-white lightning arcing over entire body, hair and loose items standing on end, shaking motion lines, bright white flashes',
    'Poisoned — green bubbles rising from body, sickly green aura, small skull shapes in the green mist, character outline briefly green',
    'Petrified — stone texture spreading over character starting from feet, grey stone color replacing normal palette, crack lines spreading',
    'Cursed — dark purple-black energy chains coiled around character, shadow hands gripping limbs, dark dripping energy from the chains, dim red eyes in shadow',
    'Confused — stars and birds circling head, wobbly motion lines, cross-eyes expression, spiral eyes effect, question marks in aura',
    'Bleeding — regular spurts of blood droplets, wounds briefly visible, crimson drips leaving trail on ground, weakening glow on body',
    'Silenced — speech bubble with gag rope, grey-out of spell effects, mouth covered by energy seal, rune lock floating at throat',
    'Enraged — entire body outlined in blazing red aura, speed lines everywhere, clenched fists, steam from ears, damage numbers larger',
  ],
};

  const BIOME_DATA={
  'Grassy Plains':{pal:'#1a3a0a,#3a6b1a,#6aaa2a,#c8e890,#f5f0d0',atmo:'sunny open meadow, rolling hills, wildflowers, warm golden light',tiles:[
    {n:'floor-grass-mid',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: bright green grass, medium blades, small wildflowers scattered. Front face: dark rich soil with visible roots and embedded pebbles. '+BMEQ},
    {n:'floor-dirt-path',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: worn dirt path, light sandy brown, foot-traffic compacted, small pebble texture. Front face: compacted tan soil. '+BMEQ},
    {n:'floor-clover',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: bright grass mixed with clover leaf clusters, varied blade heights. Front face: dark loamy earth. '+BMEQ},
    {n:'wall-earthen',d:'WALL tile — vertical surface. Earthy embankment wall, layered soil strata, exposed roots, embedded round stones, dangling grass blades from the top edge. '+BMEQ},
    {n:'wall-hedge',d:'WALL tile — vertical surface. Dense leafy hedge wall, tightly packed dark green leaves, small white flowers, birds nest visible in the foliage. '+BMEQ},
    {n:'platform-grass-top',d:'PLATFORM tile — flat grassy ledge. Flat top surface of bright green grass. Front face: two layers of dark soil with embedded pebbles, dangling grass roots from underside. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE. Left end of a grass platform: irregular cut edge, soil exposed on left face, grass continuing across the top. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE. Right end of a grass platform: same treatment as left edge, mirrored. '+BMEQ},
    {n:'platform-hill-slope-L',d:'SLOPED PLATFORM — left-leaning slope. Grassy slope angled 30 degrees up-left, grass blades growing perpendicular to slope, soil front face. '+BMEQ},
    {n:'platform-hill-slope-R',d:'SLOPED PLATFORM — right-leaning slope. Grassy slope angled 30 degrees up-right, mirror of left slope. '+BMEQ},
    {n:'ceiling-root',d:'CEILING tile. Underside of elevated earth: exposed roots hanging downward, dark soil, occasional small rock falling from it, grass visible at the very top edge. '+BMEQ},
    {n:'pit-gap',d:'PIT HAZARD. Gap between grass platforms: broken earth edges on both sides, dark abyss center, a few blades of grass bending over the edge. '+BMEQ},
    {n:'decor-flowers',d:'SCATTER DECORATION — standalone. Cluster of wildflowers: red poppies, white daisies, yellow buttercups mixed together on short stems. '+BMEQ},
    {n:'decor-fence-post',d:'SCATTER DECORATION — standalone. Worn wooden fence post, slightly tilted, weathered grey wood grain, iron nail at top, small mushroom at base. '+BMEQ},
  ]},
  'Dark Forest':{pal:'#0a1a06,#1a3a0e,#2a5a18,#4a8a30,#8ac860',atmo:'ancient dense woodland, deep shadow, mossy roots, shafts of light',tiles:[
    {n:'floor-forest-leaf',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: forest floor leaf litter, orange-brown fallen leaves, pine needles, small twig fragments. Front face: dark humus-rich soil, white fungal threads visible. '+BMEQ},
    {n:'floor-mossy-earth',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: thick dark green moss covering damp earth, surface slightly spongy-looking with soft texture. Front face: very dark water-saturated soil. '+BMEQ},
    {n:'wall-tree-trunk',d:'WALL tile — vertical surface. Enormous ancient tree trunk wall, deeply furrowed dark bark, vertical bark strips, knot holes, moss patches, small fungi growing at base. '+BMEQ},
    {n:'wall-root-mesh',d:'WALL tile — vertical surface. Dense intertwined tree root wall, thick gnarled roots filling the entire tile, dark gaps between roots, soil packed in crevices. '+BMEQ},
    {n:'platform-log',d:'PLATFORM tile — fallen log. Flat bark-covered top surface. End face showing circular tree rings, dark heartwood center, bark edge around circumference, mushrooms on the underside. '+BMEQ},
    {n:'platform-root',d:'PLATFORM tile — large exposed root. Flat top surface of rough bark-covered root. Front face: root cross-section showing wood grain, dangling rootlets below. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — root platform. Left terminus of exposed root: irregular organic end, wood grain exposed on left face. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — root platform. Right terminus of exposed root: mirrored. '+BMEQ},
    {n:'ceiling-canopy',d:'CEILING tile. Dense canopy overhead: overlapping large dark leaves blocking sky, thin light shafts breaking through gaps, dripping moisture marks. '+BMEQ},
    {n:'pit-root-gap',d:'PIT HAZARD. Gap between root platforms: root edges framing the pit, absolute dark below, a single glowing mushroom visible far down. '+BMEQ},
    {n:'decor-mushroom-cluster',d:'SCATTER DECORATION — standalone. Three glowing mushrooms of different heights, pale caps with bioluminescent spots, short pale stems, spore wisps drifting. '+BMEQ},
    {n:'decor-hollow-log',d:'SCATTER DECORATION — standalone. Hollow log section, dark opening, moss on exterior, fungal bracket shelves on side. '+BMEQ},
  ]},
  'Cave / Underground':{pal:'#0a0a12,#1a1a2a,#3a3a5a,#6a6a9a,#a0a0c8',atmo:'deep underground cavern, stalactites, mineral veins, cold darkness',tiles:[
    {n:'floor-cave-rock',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: rough cave rock, varied grey tones, shallow puddles in depressions, small pebble debris. Front face: rough rock cross-section showing stone layers. '+BMEQ},
    {n:'floor-gravel',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: loose gravel, small angular rock fragments of varied sizes, darker patches of damp gravel. Front face: gravel and soil mix cross-section. '+BMEQ},
    {n:'wall-cave-rough',d:'WALL tile — vertical surface. Raw cave wall, highly irregular rock surface, deep crevices, dark recesses, calcium deposit streaks running vertically. '+BMEQ},
    {n:'wall-mineral-vein',d:'WALL tile — vertical surface. Cave wall with prominent glowing mineral veins running diagonally, blue-white crystal deposits in cracks, grey rock background. '+BMEQ},
    {n:'platform-stalactite-base',d:'PLATFORM tile — stone ledge. Flat rough rock top. Front face: stalactite forming on underside, pointing straight down, mineral drip deposit. '+BMEQ},
    {n:'platform-stalagmite',d:'PLATFORM tile — wide stalagmite top. Flat mineral-crusted top surface. Front face: layered mineral deposit rings widening toward the base. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — cave ledge. Irregular broken rock left face, same top rock surface. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — cave ledge. Mirrored right face. '+BMEQ},
    {n:'ceiling-stalactite',d:'CEILING tile. Cave ceiling with stalactites pointing straight down, varied lengths, mineral deposit rings, drip marks on tips. '+BMEQ},
    {n:'pit-deep',d:'PIT HAZARD. Deep shaft opening, rough broken rock edges on both sides, absolute blackness, distant glowing crystals barely visible far below. '+BMEQ},
    {n:'decor-crystal-cluster',d:'SCATTER DECORATION — standalone. Cluster of glowing blue-white crystals of different heights, sharp faceted faces, bright inner glow, small crystal shards at base. '+BMEQ},
    {n:'decor-bone-pile',d:'SCATTER DECORATION — standalone. Small pile of old bones and a cracked skull, yellowed, partially buried in cave gravel. '+BMEQ},
  ]},
  'Snowy Tundra':{pal:'#c8e8f8,#a8c8e8,#6898c8,#2858a8,#0a2858',atmo:'frozen arctic wilderness, deep snow drifts, ice, howling wind',tiles:[
    {n:'floor-snow',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: compacted snow surface, slight texture with wind-blown ripple marks, faint bluish tint in shadows. Front face: snow depth cross-section with compressed layers. '+BMEQ},
    {n:'floor-ice',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: solid blue-white ice, slightly transparent surface showing air bubbles frozen inside, faint crack network. Front face: ice block cross-section. '+BMEQ},
    {n:'wall-ice-cliff',d:'WALL tile — vertical surface. Sheer ice wall, smooth face with deep blue inner color, frozen cracks branching, small air bubbles visible inside. '+BMEQ},
    {n:'wall-snowy-rock',d:'WALL tile — vertical surface. Rocky cliff face with heavy snow accumulated on ledges and in cracks, grey rock showing through, icicles forming at base. '+BMEQ},
    {n:'platform-snow-mound',d:'PLATFORM tile — snow mound. Flat snow top surface, slightly domed with windblown texture. Front face: packed snow layers, ice layer visible at base. '+BMEQ},
    {n:'platform-ice-ledge',d:'PLATFORM tile — ice ledge. Flat top: semi-transparent blue-white ice, slightly slippery-looking surface. Front face: layered ice cross-section with dark blue deeper layers. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — snow. Irregular snow overhang on left, wind-carved rounded edge. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — snow. Mirrored right edge. '+BMEQ},
    {n:'ceiling-icicle',d:'CEILING tile. Ice cave ceiling with long icicles hanging straight down, perfectly transparent at tips, varied lengths, drip marks below. '+BMEQ},
    {n:'pit-crevasse',d:'PIT HAZARD. Deep ice crevasse: sharp ice-wall edges on both sides, deep blue darkness below, ice shelf fragments on the edges. '+BMEQ},
    {n:'decor-frozen-tree',d:'SCATTER DECORATION — standalone. Small leafless tree completely encased in ice, bare branches with thick ice coating, frozen at an angle from wind. '+BMEQ},
    {n:'decor-snowdrift',d:'SCATTER DECORATION — standalone. Wind-carved snow drift, smooth curved shape, slight blue shadow on sheltered side. '+BMEQ},
  ]},
  'Volcanic / Lava':{pal:'#1a0500,#3a0a00,#7a2000,#c85000,#ff8c00',atmo:'active volcanic zone, rivers of lava, ash fall, heat shimmer',tiles:[
    {n:'floor-volcanic-rock',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: black volcanic basalt, rough texture, cooling cracks with faint orange glow in the cracks. Front face: dark basalt cross-section. '+BMEQ},
    {n:'floor-ash',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: grey volcanic ash, foot-impression detail, small ember glow in surface cracks. Front face: ash layers over dark rock. '+BMEQ},
    {n:'wall-lava-rock',d:'WALL tile — vertical surface. Volcanic rock wall, rough black basalt, lava flow channels dried on the surface, orange mineral inclusions, heat cracks. '+BMEQ},
    {n:'wall-lava-channel',d:'WALL tile — vertical surface. Rock wall with active lava channel running diagonally across it, bright orange-red lava core, black cooling crust at edges of the channel. '+BMEQ},
    {n:'platform-basalt',d:'PLATFORM tile — basalt ledge. Flat rough black top, heat-cracked surface with ember glow in deepest cracks. Front face: volcanic rock layering with lava glow beneath. '+BMEQ},
    {n:'platform-cooled-lava',d:'PLATFORM tile — cooled lava flow. Flat top: rippled cooled black lava with lava-rope surface texture. Front face: cross-section showing thin cooled shell over still-warm orange core. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — volcanic. Irregular broken basalt left face, heat-glow at underside. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — volcanic. Mirrored. '+BMEQ},
    {n:'ceiling-hanging-lava',d:'CEILING tile. Volcanic cave ceiling: black basalt with lava stalagmites forming downward, bright orange drip tips, ash marks below. '+BMEQ},
    {n:'pit-lava',d:'PIT HAZARD — lava pit. Opening in rock floor, broken sharp basalt edges, roiling orange-red lava visible below, heat shimmer above the surface. '+BMEQ},
    {n:'decor-lava-pool',d:'SCATTER DECORATION — standalone. Small circular lava pool, roiling orange-red surface, black cooling rim, slow bubbles, glow on surrounding rock. '+BMEQ},
    {n:'decor-fire-geyser',d:'SCATTER DECORATION — standalone. Volcanic gas vent, jet of orange flame erupting from a fissure in the rock, ash and sparks flying upward. '+BMEQ},
  ]},
  'Ocean / Coast':{pal:'#001a2a,#003a5a,#006a9a,#40a0d0,#90d8f0',atmo:'coastal shore, crashing waves, sea cliffs, salty spray',tiles:[
    {n:'floor-sand',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: golden sandy beach, fine grain texture, small shells and pebbles embedded, wet near-shore darkened patches. Front face: sand and shell layer cross-section. '+BMEQ},
    {n:'floor-wet-sand',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: wet sand at waterline, darker, reflective sheen, wave-drag ripple marks, small pebbles. Front face: damp sand. '+BMEQ},
    {n:'wall-sea-cliff',d:'WALL tile — vertical surface. Coastal sea cliff, horizontal sedimentary layers in grey-tan, wave erosion at the base forming undercutting, seabird nests in crevices. '+BMEQ},
    {n:'wall-coral',d:'WALL tile — vertical surface. Coral reef wall, dense branching and plate coral formations in orange, pink, purple, small fish shapes visible between branches. '+BMEQ},
    {n:'platform-rock',d:'PLATFORM tile — coastal rock. Flat top: wave-smoothed grey rock, tidal pools in surface depressions, barnacles on front face, seaweed at base. '+BMEQ},
    {n:'platform-driftwood',d:'PLATFORM tile — driftwood plank. Flat top: weathered bleached driftwood, smooth water-polished surface. Front face: silvery wood grain, rope end tied around it. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — coastal rock. Wave-eroded left face of coastal rock platform. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — coastal rock. Mirrored. '+BMEQ},
    {n:'ceiling-cave-sea',d:'CEILING tile — sea cave. Dark wet ceiling, stalactite mineral deposits, seaweed hanging, barnacles, salt crystal formations. '+BMEQ},
    {n:'pit-deep-water',d:'PIT HAZARD — deep water. Dark blue water surface at floor level, surface ripple, depth below gradually darkening to absolute black abyss. '+BMEQ},
    {n:'decor-seashells',d:'SCATTER DECORATION — standalone. Cluster of varied sea shells, spiral nautilus, scallop, conch shapes, warm tan-cream colors, sand grains stuck to them. '+BMEQ},
    {n:'decor-sea-chest',d:'SCATTER DECORATION — standalone. Barnacle-encrusted treasure chest, iron hinges rusted, small crabs visible on the lid, seaweed draped over it. '+BMEQ},
  ]},
  'Desert Ruins':{pal:'#2a1a00,#5a3a00,#9a6a20,#d4a840,#f5e8a0',atmo:'ancient abandoned desert ruins, scorching sun, sand dunes, crumbled stone',tiles:[
    {n:'floor-sand-stone',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: ancient sandstone pavers, wide flat slabs with wind-eroded joints, fine sand blown into the cracks. Front face: layered sandstone and sand. '+BMEQ},
    {n:'floor-desert-sand',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: windswept desert sand, ripple pattern, a few pebbles, small sand dunes forming at edges. Front face: loose sand cross-section with dense base. '+BMEQ},
    {n:'wall-sandstone',d:'WALL tile — vertical surface. Ancient sandstone wall, horizontal bedding layers, wind erosion rounding all edges, faded carved relief barely visible, sand filling the grooves. '+BMEQ},
    {n:'wall-ruins-crumbled',d:'WALL tile — vertical surface. Crumbled ruin wall section, blocks missing or collapsed, rubble at base, desert sand packed into gaps, ancient carved motif partially visible. '+BMEQ},
    {n:'platform-sandstone',d:'PLATFORM tile — sandstone slab. Flat sandy stone top, wind-eroded texture. Front face: horizontal bedding strata lines, carved inscription worn to near-invisibility. '+BMEQ},
    {n:'platform-ruin-block',d:'PLATFORM tile — fallen pillar section. Flat circular carved top. Front face: ornate column relief carving worn by wind, sand packed in carved grooves. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — sandstone. Wind-rounded left face, crumbling corner. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — sandstone. Mirrored. '+BMEQ},
    {n:'ceiling-temple',d:'CEILING tile. Ancient temple ceiling: flat stone with carved hieroglyphic-like symbols, sand hanging loose from cracks, thin roots from above. '+BMEQ},
    {n:'pit-sand-trap',d:'PIT HAZARD — sand pit. Opening revealing shifting sand below, eroded stone edges, sand flowing into the pit constantly. '+BMEQ},
    {n:'decor-broken-column',d:'SCATTER DECORATION — standalone. Shattered ancient column, drum sections toppled and half-buried in sand, carved relief on the largest piece, sand piled against it. '+BMEQ},
    {n:'decor-cactus',d:'SCATTER DECORATION — standalone. Tall desert cactus, main trunk with two upward arms, sharp spine clusters, dried blossom at tip. '+BMEQ},
  ]},
  'Haunted / Undead':{pal:'#0a0a0a,#1a0a1a,#3a1a3a,#6a2a6a,#b06ab0',atmo:'cursed graveyard and undead ruins, purple death energy, fog, bone',tiles:[
    {n:'floor-grave-dirt',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: disturbed grave dirt, loose dark earth, bone fragments embedded in surface, fresh scratch marks. Front face: dark soil with bones and old coffin wood fragments. '+BMEQ},
    {n:'floor-black-stone',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: polished black stone with dried purple energy veins in the cracks. Front face: dark stone with purple mineral sheen. '+BMEQ},
    {n:'wall-graveyard-stone',d:'WALL tile — vertical surface. Grey stone cemetery wall, mossy, cracked, old blood stains, crow silhouette carved in relief. '+BMEQ},
    {n:'wall-bones',d:'WALL tile — vertical surface. Wall made of stacked skulls and long bones, yellowed and dark, marrow staining, some skulls facing outward. '+BMEQ},
    {n:'platform-gravestone',d:'PLATFORM tile — large gravestone top. Flat worn stone top. Front face: ornate gravestone front with worn inscription, skull carving at top, cracked corner. '+BMEQ},
    {n:'platform-coffin',d:'PLATFORM tile — coffin lid. Flat dark wood top. Front face: coffin side showing tarnished handles, wood grain, one hinge broken. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — graveyard stone. Cracked left edge of stone platform. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — graveyard stone. Mirrored. '+BMEQ},
    {n:'ceiling-crypt',d:'CEILING tile. Crypt ceiling: dark stone with carved skull faces looking down, iron chain mounting points, purple mist pooling at the ceiling. '+BMEQ},
    {n:'pit-grave',d:'PIT HAZARD — open grave. Rectangular pit, freshly dug earth walls, dark below, a skeletal hand reaching up from the depth. '+BMEQ},
    {n:'decor-tombstone',d:'SCATTER DECORATION — standalone. Weathered crooked tombstone, carved text worn illegible, cracked top, lichen-covered, one withered black flower leaning against it. '+BMEQ},
    {n:'decor-ghost-wisp',d:'SCATTER DECORATION — standalone. Floating ethereal wisp, translucent white-purple ghost shape, hollow dark eye sockets, trailing mist below, faint glow. '+BMEQ},
  ]},
  'Mushroom Forest':{pal:'#0a1a0a,#1a2a1a,#2a4a2a,#60a060,#a0f0a0',atmo:'alien fungal forest, bioluminescent mushrooms, spore mist, strange glow',tiles:[
    {n:'floor-mycelium',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: dense white mycelium threads covering dark earth, glowing faintly, small mushroom caps emerging. Front face: mycelium-threaded dark soil. '+BMEQ},
    {n:'floor-spore-dust',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: pale bluish spore dust layer, footprint impressions, glow from below, luminescent particles floating. Front face: spore layer over dark substrate. '+BMEQ},
    {n:'wall-giant-trunk',d:'WALL tile — vertical surface. Giant mushroom trunk wall, smooth pale organic surface, subtle vertical striations, small mushroom buds growing from surface, faint bioluminescent dots. '+BMEQ},
    {n:'wall-spore-sacs',d:'WALL tile — vertical surface. Wall covered in bulbous spore sac clusters, round glowing sacs of varied size, some burst with spore cloud residue. '+BMEQ},
    {n:'platform-cap',d:'PLATFORM tile — giant mushroom cap. Flat top: smooth waxy pale blue-white cap surface, slightly dome-curved. Front face underside: pink-white gill formations. Thick stem below. '+BMEQ},
    {n:'platform-cap-edge-L',d:'PLATFORM LEFT EDGE — mushroom cap. Left drooping organic curved edge of cap, gills visible on underside. '+BMEQ},
    {n:'platform-cap-edge-R',d:'PLATFORM RIGHT EDGE — mushroom cap. Mirrored right drooping edge. '+BMEQ},
    {n:'ceiling-cap-underside',d:'CEILING tile. Underside of enormous mushroom cap: dense gill formations radiating from center, glowing spores drifting downward. '+BMEQ},
    {n:'pit-spore-pit',d:'PIT HAZARD — spore pit. Opening in floor, mycelium edges framing it, glowing spore cloud filling the darkness below. '+BMEQ},
    {n:'decor-glow-mushroom',d:'SCATTER DECORATION — standalone. Three bioluminescent mushrooms of different heights, bright cyan-white glow, spore puffs drifting from gills, glowing ring around base. '+BMEQ},
    {n:'decor-spore-pod',d:'SCATTER DECORATION — standalone. Bulging spore pod, skin stretched tight, about to burst, single tear with spore cloud leaking out, bioluminescent. '+BMEQ},
    {n:'decor-fungal-web',d:'SCATTER DECORATION — standalone. Thin white fungal filament web stretched between two mushroom stems, dew drops on threads, glowing faintly. '+BMEQ},
  ]},
  'Sky / Floating Islands':{pal:'#80b8f0,#a8d0f8,#d0e8ff,#f8fbff,#ffd080',atmo:'high altitude floating islands, clouds, wind, sunlight above clouds',tiles:[
    {n:'floor-cloud-solid',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: solidified white-grey cloud with puffy surface texture. Front face: fluffy dense cloud cross-section, darker inside. '+BMEQ},
    {n:'floor-island-grass',d:'FLOOR tile — seamlessly tileable. Flat horizontal top: lush floating island grass, extra vivid green, small flowers. Front face: thin earth layer over floating stone, roots hanging free at base. '+BMEQ},
    {n:'wall-cloud-pillar',d:'WALL tile — vertical surface. Vertical column of dense cloud, puffy billowing edges, light grey shadowed sections, blue sky visible at top. '+BMEQ},
    {n:'wall-sky-stone',d:'WALL tile — vertical surface. Floating island cliff face, worn pale limestone, wind erosion, waterfall of clouds spilling over the edge. '+BMEQ},
    {n:'platform-cloud',d:'PLATFORM tile — solid cloud. Flat bouncy-looking top. Front face: dense cloud side, darker core, lighter wispy edges. '+BMEQ},
    {n:'platform-sky-island',d:'PLATFORM tile — sky island chunk. Flat grassy top. Front face: pale stone with roots hanging free, clouds drifting past. '+BMEQ},
    {n:'platform-edge-L',d:'PLATFORM LEFT EDGE — sky island. Eroded stone left face, cloud wisp at base. '+BMEQ},
    {n:'platform-edge-R',d:'PLATFORM RIGHT EDGE — sky island. Mirrored. '+BMEQ},
    {n:'ceiling-cloud-underbelly',d:'CEILING tile. Underside of thick cloud layer, flat dark grey base, lighter towards edges, rain drops forming at the bottom. '+BMEQ},
    {n:'pit-sky-gap',d:'PIT HAZARD — sky gap. Void between floating platforms, open sky with clouds visible far below, dizzying depth. '+BMEQ},
    {n:'decor-wind-chime',d:'SCATTER DECORATION — standalone. Bamboo wind chime hanging from sky island edge, gentle bend from wind, warm color in golden light. '+BMEQ},
    {n:'decor-cloud-puff',d:'SCATTER DECORATION — standalone. Free-floating decorative cloud puff, small, perfectly round, bright white, soft shadow underneath. '+BMEQ},
  ]},
};


/* ── THEME PACKAGES ── */
  const THEMES=[
  {id:'dark-gothic',name:'Dark Gothic',emoji:'🏰',world:'dark gothic castle ruins, ancient and crumbling',ref:'Castlevania, Dark Souls',pal:'dark gothic muted palette',hex:'#0a0008 shadow, #3a1a2a mid, #8a4a6a highlight',atmo:'torchlit stone, deep shadow, ancient evil, oppressive atmosphere'},
  {id:'metroidvania',name:'Metroidvania',emoji:'🌑',world:'alien underground labyrinth, isolated and atmospheric',ref:'Hollow Knight, Ori and the Blind Forest',pal:'strictly 16-color palette',hex:'#050510 shadow, #1a1a4a mid, #6a8aff highlight',atmo:'bioluminescent caves, ancient civilization ruins, haunting and lonely'},
  {id:'dark-fantasy',name:'Dark Fantasy',emoji:'⚔️',world:'cursed dark fantasy realm, war and corruption',ref:'Dead Cells, Blasphemous',pal:'dark gothic muted palette',hex:'#0e0800 shadow, #5a2800 mid, #c87028 highlight',atmo:'blood and iron, cursed land, grotesque monsters, desperate survival'},
  {id:'cyberpunk',name:'Cyberpunk',emoji:'🌆',world:'neon megacity dystopia, corporate surveillance',ref:'Katana Zero, VA-11 Hall-A',pal:'high contrast black and neon palette',hex:'#050508 shadow, #1a0a3a mid, #ff00ff highlight',atmo:'rain-slicked streets, neon signs, corporate oppression, underground rebels'},
  {id:'forest-spirit',name:'Forest Spirit',emoji:'🌿',world:'ancient enchanted forest, nature spirits and old magic',ref:'Ori and the Blind Forest, Owlboy',pal:'warm earthy fantasy palette',hex:'#081408 shadow, #2a5a1a mid, #90e050 highlight',atmo:'dappled light through canopy, ancient spirits, organic and mystical'},
  {id:'underwater',name:'Sunken Kingdom',emoji:'🌊',world:'ancient sunken underwater civilization, deep sea ruins',ref:'Aquaria, Subnautica',pal:'cold desaturated icy palette',hex:'#000a18 shadow, #0a3a5a mid, #20b0e0 highlight',atmo:'bioluminescent depths, crushing pressure, lost civilization, aquatic wonder and dread'},
  {id:'volcanic',name:'Volcanic Hell',emoji:'🌋',world:'active volcanic hellscape, fire and molten rock',ref:'Metroid, Cuphead',pal:'dark gothic muted palette',hex:'#0a0000 shadow, #7a1500 mid, #ff6000 highlight',atmo:'rivers of lava, ash fall, heat shimmer, demonic creatures, scorched survival'},
  {id:'frozen-tundra',name:'Frozen Tundra',emoji:'❄️',world:'frozen arctic wasteland, ancient ice civilization',ref:'Shovel Knight, Celeste',pal:'cold desaturated icy palette',hex:'#050510 shadow, #2a3a5a mid, #a0c8ff highlight',atmo:'howling blizzard, ancient frozen ruins, survival against cold, crystalline beauty'},
  {id:'haunted',name:'Haunted',emoji:'👻',world:'haunted mansion and cursed graveyard, gothic horror',ref:'Luigi\'s Mansion, Yoku\'s Island',pal:'dark gothic muted palette',hex:'#08040c shadow, #2a1a3a mid, #9060c0 highlight',atmo:'creaking floorboards, flickering candles, restless spirits, Victorian decay'},
  {id:'alien-world',name:'Alien World',emoji:'👽',world:'alien planet with incomprehensible biology and ruins',ref:'Axiom Verge, Alien Soldier',pal:'vibrant saturated palette',hex:'#000a05 shadow, #0a3a1a mid, #00ff90 highlight',atmo:'wrong-colored sky, alien flora, ancient alien ruins, xenobiology, cosmic wonder'},
  {id:'steampunk',name:'Steampunk',emoji:'⚙️',world:'Victorian steampunk city, clockwork and steam power',ref:'Bioshock Infinite, Cuphead',pal:'warm earthy fantasy palette',hex:'#140a00 shadow, #6a3a10 mid, #c89040 highlight',atmo:'brass and iron, steam vents, clockwork mechanisms, Victorian industry'},
  {id:'nightmare',name:'Nightmare',emoji:'😱',world:'nightmare realm, wrong physics and body horror',ref:'Scary Stories, Darkwood',pal:'dark gothic muted palette',hex:'#050008 shadow, #1a0a28 mid, #7a20c0 highlight',atmo:'wrong anatomy, impossible geometry, dread and confusion, nothing is safe'},
];

let activeLock=null;

function initThemePills(){
  const container=document.getElementById('theme-pills');
  if(!container)return;
  container.innerHTML=THEMES.map(t=>`<div class="theme-pill${activeLock&&activeLock.id===t.id?' sel':''}" onclick="applyThemePreset('${t.id}')">${t.emoji} ${t.name}</div>`).join('');
}

function applyThemePreset(id){
  const t=THEMES.find(x=>x.id===id);if(!t)return;
  document.getElementById('tl_world').value=t.world;
  document.getElementById('tl_ref').value=t.ref;
  document.getElementById('tl_pal').value=t.pal;
  document.getElementById('tl_hex').value=t.hex;
  document.getElementById('tl_atmo').value=t.atmo;
  document.querySelectorAll('.theme-pill').forEach(p=>p.classList.remove('sel'));
  document.querySelectorAll('.theme-pill').forEach(p=>{if(p.textContent.includes(t.name))p.classList.add('sel');});
  updateThemePreview();
}

function onThemeInput(){updateThemePreview();}

function updateThemePreview(){
  const box=document.getElementById('theme-preview-box');
  const world=document.getElementById('tl_world').value.trim();
  const ref=document.getElementById('tl_ref').value.trim();
  const pal=document.getElementById('tl_pal').value;
  const hex=document.getElementById('tl_hex').value.trim();
  const atmo=document.getElementById('tl_atmo').value.trim();
  if(!world&&!ref&&!hex&&!atmo){box.style.display='none';return;}
  const hexSwatches=hex.match(/#[0-9a-fA-F]{3,6}/g)||[];
  const swatchHtml=hexSwatches.map(h=>`<span class="swatch" style="background:${h}"></span>${h}`).join(' ');
  box.style.display='block';
  box.innerHTML=`<strong style="color:var(--pu2)">Preview injection:</strong><br>${world?`🌍 ${world}<br>`:''}${ref?`🎨 ${ref}<br>`:''}${pal?`🎨 ${pal}<br>`:''}${atmo?`✨ ${atmo}<br>`:''}${hexSwatches.length?`🎨 ${swatchHtml}`:''}`;
}

function lockTheme(){
  const world=document.getElementById('tl_world').value.trim();
  const ref=document.getElementById('tl_ref').value.trim();
  const pal=document.getElementById('tl_pal').value;
  const hex=document.getElementById('tl_hex').value.trim();
  const atmo=document.getElementById('tl_atmo').value.trim();
  if(!world&&!hex&&!atmo){fl('Fill in at least one field to lock a theme!');return;}
  activeLock={world,ref,pal,hex,atmo};
  // Inject into global fields
  if(world)document.getElementById('g_world').value=world;
  if(ref)document.getElementById('g_ref').value=ref;
  if(hex)document.getElementById('g_hex').value=hex;
  if(pal&&document.getElementById('g_pal')){
    const sel=document.getElementById('g_pal');
    for(let i=0;i<sel.options.length;i++){if(sel.options[i].text===pal){sel.selectedIndex=i;break;}}
  }
  const status=document.getElementById('lock-status');
  if(status){status.className='lock-active';status.innerHTML='🔒 Theme locked';}
  fl('Theme locked! All prompts will share this visual identity.');
  initThemePills();
}

function clearThemeLock(){
  activeLock=null;
  ['tl_world','tl_ref','tl_hex','tl_atmo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const pal=document.getElementById('tl_pal');if(pal)pal.selectedIndex=0;
  document.getElementById('theme-preview-box').style.display='none';
  document.querySelectorAll('.theme-pill').forEach(p=>p.classList.remove('sel'));
  const status=document.getElementById('lock-status');
  if(status){status.className='lock-inactive';status.textContent='No theme locked';}
  fl('Theme lock cleared.');
}

function saveCustomTheme(){
  const world=document.getElementById('tl_world').value.trim();
  const name=world?world.split(',')[0].slice(0,20):'Custom';
  const t={id:'custom-'+Date.now(),name,emoji:'⭐',world,ref:document.getElementById('tl_ref').value.trim(),pal:document.getElementById('tl_pal').value,hex:document.getElementById('tl_hex').value.trim(),atmo:document.getElementById('tl_atmo').value.trim()};
  THEMES.push(t);initThemePills();
  fl(`"${name}" saved as custom theme!`);
}

function getThemeLockStr(){
  if(!activeLock)return '';
  const parts=[];
  if(activeLock.atmo)parts.push(activeLock.atmo);
  if(activeLock.world)parts.push(`visual world: ${activeLock.world}`);
  if(activeLock.ref)parts.push(`style reference: ${activeLock.ref}`);
  if(activeLock.hex)parts.push(`shared palette: ${activeLock.hex}`);
  if(activeLock.pal)parts.push(activeLock.pal);
  parts.push('CONSISTENCY: this asset must share the same visual language, color palette, outline weight, and atmosphere as all other assets in this set');
  return parts.join(', ');
}

/* ── WEAPON & ITEM PRESETS ── */
  const WEAPON_PRE={
  'Swords & Blades':[
    'Longsword — classic double-edged straight longsword, crossguard with slight flare, leather-wrapped grip, plain but well-made, warrior\'s blade',
    'Greatsword — enormous two-handed greatsword, wide fuller groove down blade, large heavy crossguard, wrapped leather grip with pommel, imposing scale',
    'Rapier — slender elegant thrusting sword, intricate swept hilt guard, narrow fluted blade, duelist\'s weapon, ornate and precise',
    'Claymore — Scottish two-handed claymore, distinctive V-shaped crossguard angled toward blade, wide blade, leather grip, ancient warrior\'s weapon',
    'Katana — Japanese longsword, slight curve to blade, circular tsuba guard, silk-wrapped handle, beautiful and deadly',
    'Falchion — single-edged curved sword, wide toward the tip for chopping power, simple crossguard, practical mercenary weapon',
    'Runed Blade — sword with glowing arcane runes etched along the blade, faint magical light emanating from the runes, enchanted appearance',
    'Cursed Sword — blackened blade with cracks leaking dark energy, dark evil runes, wrapped in shadow, cursed and corrupted weapon',
    'Flame Sword — sword with blade wreathed in magical fire, flames running along the entire blade length, heat shimmer, magical orange-red glow',
    'Ice Sword — sword made of or coated in magical ice, frost patterns on blade, cold blue-white magical glow, ice crystals forming at edges',
    'Soul Reaver — enormous dark jagged sword, looks made of crystallized dark energy, wisps of soul energy trailing from blade, terrifying',
    'Broken Hero Sword — once-magnificent sword now shattered and cracked, held together by magic or wrapping, the pommel still ornate, tragic beauty',
    'Bone Sword — blade carved from a single enormous bone, yellowed and cracked, carved runes along the length, necromantic weapon',
    'Crystal Shard Sword — blade made from a massive faceted crystal shard, transparent body catching light beautifully, razor sharp edges',
  ],
  'Axes & Hammers':[
    'Battle Axe — single-headed battle axe, wide curved blade, medium-length shaft, spiked back counterweight, warrior\'s primary weapon',
    'War Hammer — massive two-handed war hammer, large flat striking head, side spike on hammer head, long shaft, crushing weapon',
    'Dual Hatchets — pair of matching small throwing-and-melee hatchets, short handles, dual-wield combat weapons, well-balanced',
    'Great Axe — enormous two-handed great axe, two crescent blades top and bottom, long pole, devastating cleaving weapon',
    'Thor\'s Maul — short-handled massive hammer with disproportionately enormous square head, divine lightning runes, magical glow',
    'Pickaxe Weapon — mining pickaxe repurposed for combat, one pointed pick end one flat mattock end, worn handle, improvised but effective',
    'Volcanic Axe — axe with blade made of volcanic rock and iron, lava running along the edge, heat shimmer, fire elemental enchantment',
    'Bone Crusher Mace — large headed mace completely covered in bone spikes, crude iron construction, brutal and heavy, impact damage implied',
    'Ancient Stone Axe — primitive large stone axe head bound to wooden shaft with leather wrappings, Neolithic-era weapon, enormous weight',
  ],
  'Ranged Weapons':[
    'Longbow — elegant tall wooden longbow, recurved at tips, wood grain visible, nocked arrow, archer\'s primary weapon, natural materials',
    'Crossbow — compact mechanical crossbow, wooden stock, metal prod, loaded bolt ready to fire, cranking mechanism visible, precise',
    'Repeating Crossbow — multi-shot crossbow with bolt magazine on top, mechanical loading system, rapid fire implied, engineered complexity',
    'Elven Shortbow — slender elegant bow with natural wood, vine wrapping, faintly glowing string, graceful flowing curves, magical',
    'Heavy War Bow — massive reinforced war bow, thick limbs, double string, enormous draw weight implied by scale, military siege weapon',
    'Flintlock Pistol — ornate single-shot flintlock pistol, curved grip, brass hardware, hammer cocked, black powder era firearm',
    'Blunderbuss — wide-mouth flare barrel blunderbuss shotgun, short and devastating, brass hardware, pirate-era weapon',
    'Sniper Rifle Fantasy — long elegant magical rifle, crystal lens scope, rune-carved barrel, impossible accuracy enchantment glowing',
    'Throwing Knives — set of three balanced throwing knives on a display rack, leaf-shaped blades, minimal handle, precision weapons',
    'Shuriken Set — four pointed throwing star shurikens in a fan arrangement, polished dark metal, razor edges, ninja weapons',
  ],
  'Staves & Wands':[
    'Wizard Staff — tall gnarled wooden staff, large magical orb in iron claw at top, crackling arcane energy, old and powerful',
    'Battle Staff — reinforced iron-tipped staff, both ends weapons, balanced for combat and magic, martial and magical hybrid',
    'Necromancer Staff — dark carved bone staff, skull atop it with glowing eye sockets, purple necrotic energy, dark magic focus',
    'Crystal Staff — staff topped with enormous natural crystal formation, light refracting through crystal, pure magical power',
    'Druid\'s Walking Stick — natural branch staff, living leaves still growing, flower buds at top, vines twisting around it, nature magic',
    'Wand — slender elegant magical wand, carved from dark wood, gemstone at tip glowing, precise spell-casting tool',
    'Tome Staff — large magical book chained to a staff at the top, pages perpetually turning in magical wind, spell formulae visible',
    'Storm Staff — staff crackling with lightning constantly, miniature thunderstorm around the head, wind magic visuals, weather wizard',
    'Fire Staff — staff with contained fireball at the tip, flames licking the upper shaft, ember sparks drifting, pyromancer weapon',
  ],
  'Shields':[
    'Kite Shield — classic kite-shaped knight\'s shield, heraldic design on face, battered edge showing battle use, sturdy iron rim',
    'Tower Shield — enormous full-body tower shield, flat rectangular, iron reinforcements, viewing slit near top, defensive wall',
    'Round Shield — Norse-style round wooden shield, iron boss center, painted face, leather grip, simple and effective',
    'Magic Barrier — not a physical shield but a summoned magical force field, glowing energy disc, rune patterns visible in the field',
    'Bone Shield — shield made from a giant creature\'s scapula bone, carved handles, natural cracks repaired with iron rivets, primitive',
    'Mirror Shield — polished reflective shield, perfect mirror surface, deflects magic, divine gleam, legendary quality',
    'Spiked Shield — round shield covered in iron spikes, offensive defensive hybrid, every edge sharpened, aggressive design',
  ],
  'Daggers & Knives':[
    'Rogue Dagger — thin double-edged assassin\'s dagger, serrated upper edge, slim profile, leather grip, concealment-focused design',
    'Boot Knife — small concealable knife, plain blade, minimal handle, designed to fit inside a boot, last resort weapon',
    'Ritual Knife — ornate curved ceremonial blade, inscribed with dark symbols, handle wrapped in dark leather, used in dark rituals',
    'Poison Dagger — thin blade with groove along center for poison delivery, dark staining on blade from poisons, glass vial in handle',
    'Butterfly Knife — balisong butterfly knife, split handle closing over blade, show-off weapon, quick deployment implied',
    'Elven Moonblade — elegant thin elven blade, slight curve, moonstone in pommel glowing silver, magical starlight patterns on blade',
    'Vorpal Blade — plain looking but almost magically sharp dagger, edge appears slightly luminous, enchanted cutting enchantment',
  ],
  'Polearms':[
    'Spear — classic infantry spear, leaf-shaped iron spearhead, long wooden shaft, counterweight butt spike, versatile and ancient',
    'Halberd — combination polearm, axe blade plus spearpoint plus hook, long shaft, Swiss mercenary weapon, multiple attack options',
    'Scythe — death\'s scythe weapon version, long curved blade on long handle, slightly intimidating, reimagined as a reach weapon',
    'War Pike — extra-long heavy pike, small crossguard behind the head, infantry formation weapon, length is its power',
    'Glaive — elegant single-edged blade on a pole, graceful curves, reach weapon with finesse, decorative fuller groove on blade',
    'Trident — three-pronged trident, elegant tines, aquatic or gladiatorial weapon, Neptune\'s weapon, marine imagery',
  ],
  'Special & Magic Weapons':[
    'Flaming Whip — multi-tailed whip with each tail ending in flame, fire trailing through the air, coiled and ready, demonic weapon',
    'Chain Flail — heavy iron ball on chain attached to wooden handle, the ball covered in spikes, swinging motion implied, devastating',
    'Boomerang — returning thrown weapon, curved wooden form, painted tribal designs, comes back on a miss, warrior\'s tool',
    'Gauntlet Blades — fingerless gauntlet with three forward-extending blades from the knuckles, wolverine-style, melee weapon',
    'Living Weapon — weapon that is partially alive, eye visible on the blade, the weapon is semi-aware, strange magic pulsing',
    'Gravity Hammer — enormous hammer that warps space slightly, gravitational lensing effect visible around the head, sci-fantasy',
    'Shadow Claws — darkness condensed into claw shapes worn over the hands, shadow energy trails from each finger, assassin weapon',
    'Void Lance — long lance of pure compressed void, nothingness given weapon form, stars visible through it, ultimate destruction',
    'Blessed Mace — golden mace with holy symbol on head, divine light emanating, angel feather embedded in handle, paladin weapon',
  ],
  'Consumables & Items':[
    'Health Potion — classic round glass bottle of red liquid, bubbling slightly, cork stopper, warm red glow, vital healing item',
    'Mana Potion — blue counterpart to health potion, swirling arcane particles inside liquid, glowing blue, magic restoration',
    'Antidote — green flask, skull-and-crossbones label, counteracts poison, murky bubbling liquid, apothecary styling',
    'Bomb — black iron sphere with lit fuse, classic cartoon bomb style, dangerous and obvious, explosive timing',
    'Smoke Bomb — small cloth bag sealed with wax, grey wisps leaking from it, tactical escape tool, ninja equipment',
    'Elixir of Power — ornate stoppered vial, golden-orange liquid with sparkles inside, obviously powerful, legendary item',
    'Scroll — rolled parchment tied with ribbon, wax seal, magical runes visible on the end, single-use spell storage',
    'Magic Key — ornate oversized skeleton key, glowing slightly, opens magical locks, fantasy adventure key item',
    'Treasure Gem — large faceted gemstone, deep ruby red or sapphire blue, clearly valuable, quest item or currency',
    'Ancient Coin — large gold coin, profile of a forgotten king, worn edges, clearly old and valuable, currency or quest item',
    'Crystal Ball — glass orb on a simple stand, swirling mist inside, fortune-telling or communication device, mystical',
    'Lantern — iron and glass lantern on a handle, warm flickering flame inside, casts light in darkness, exploration tool',
    'Compass — brass pocket compass, cracked glass face, needle pointing north, always reliable navigation tool, worn',
    'Lock Pick Set — slim leather roll containing several thin metal picks of varying shapes, rogue\'s professional tools',
  ],
};

function rWeapon(){
  document.getElementById('gen-btn').className='btn btn-p';
  let h=`<div class="note am">Weapon and item prompts are tuned for standalone isolated sprites — single item on transparent background, game-ready pickup or equipment art.</div>`;
  h+=`<div class="g3">
<div class="fld"><label class="fl">Item description</label></div></div>`;
  h=`<div class="fld"><label class="fl">Item name / description</label><textarea id="wp_desc" rows="2" placeholder="Describe your weapon or item, or click a preset below…"></textarea></div>`;
  h+=`<div class="g3">
<div class="fld"><label class="fl">Rarity / quality</label><select id="wp_rar">
  <option>common — plain, worn, practical</option>
  <option selected>uncommon — well-crafted, some detail</option>
  <option>rare — ornate, magical details, glowing trim</option>
  <option>epic — elaborate, clearly powerful, glowing effects</option>
  <option>legendary — over-the-top, unmistakably legendary, intense magical aura</option>
  <option>cursed — dark, corrupted, wrong energy, disturbing</option>
  <option>divine — holy light, angelic, pure divine power</option>
</select></div>
<div class="fld"><label class="fl">Material</label><select id="wp_mat">
  <option>iron and steel</option>
  <option>dark iron, blackened</option>
  <option>bronze, ancient</option>
  <option>silver, polished</option>
  <option>gold-trimmed</option>
  <option>bone and sinew</option>
  <option>crystal and glass</option>
  <option>living wood and vine</option>
  <option>void energy, crystallized</option>
  <option>divine light, solidified</option>
  <option>ice and frost</option>
  <option>magma and volcanic rock</option>
</select></div>
<div class="fld"><label class="fl">Magical element</label><select id="wp_el">
  <option value="">none — purely physical</option>
  <option>fire — flames and embers</option>
  <option>ice — frost and cold</option>
  <option>lightning — crackling arcs</option>
  <option>arcane — purple-blue magical energy</option>
  <option>holy — golden divine light</option>
  <option>shadow — dark void energy</option>
  <option>poison — toxic green glow</option>
  <option>nature — living vines and leaves</option>
  <option>blood — crimson energy</option>
  <option>necrotic — death energy, green-black</option>
  <option>time — clock imagery, temporal distortion</option>
</select></div>
</div>
<div class="g2">
<div class="fld"><label class="fl">View angle</label><select id="wp_view">
  <option selected>flat side profile view, facing right</option>
  <option>slight 3/4 angle showing depth</option>
  <option>diagonal hero pose angle</option>
  <option>top-down view</option>
</select></div>
<div class="fld"><label class="fl">Extra details</label><input type="text" id="wp_ex" placeholder="e.g. cracked blade, chain wrapped handle, skull pommel…"/></div>
</div>`;
  h+=`<div style="margin-top:8px">`;
  for(const[cat,presets] of Object.entries(WEAPON_PRE)){
    h+=`<div class="tag-group"><div class="tg-lbl">${cat}</div><div class="tag-row">`;
    presets.forEach(p=>h+=`<span class="tag" onclick="fillTA('wp_desc','${esc(p)}')">${p.split(' — ')[0]}</span>`);
    h+=`</div></div>`;
  }
  h+=`</div>`;
  document.getElementById('dyn-card').innerHTML=`<div class="card-lbl">Weapon & Item options <span class="badge bdg-a">standalone sprites</span></div>${h}`;
}


/* ══════════════════════════════════════════════════
   MUSIC PROMPT GENERATOR
   ══════════════════════════════════════════════════ */

  const MUSIC_PLATFORMS=[
  {id:'suno',    name:'Suno AI',      url:'https://suno.com',          note:'Paste into Style of Music box. Use the Lyrics field for mood descriptions.'},
  {id:'udio',    name:'Udio',         url:'https://www.udio.com',      note:'Paste into the prompt box. Udio responds well to genre + mood + instrument combos.'},
  {id:'stableaudio', name:'Stable Audio', url:'https://www.stableaudio.com', note:'Paste as the prompt. Works best with concise descriptive language.'},
  {id:'musicgen',name:'MusicGen',     url:'https://huggingface.co/spaces/facebook/MusicGen', note:'Paste as prompt. Keep under 200 characters for best results.'},
];

  const MUSIC_PRESETS={
  'Main Theme & Title':[
    {name:'Epic Fantasy Title',         mood:'majestic, triumphant, adventurous',    genre:'orchestral fantasy',  instr:'full orchestra, choir, French horn lead, strings, timpani drums',       tempo:'moderate 90 BPM', key:'D major', tags:'title screen, main theme, hero journey, sweeping'},
    {name:'Dark Gothic Main Theme',     mood:'ominous, brooding, ancient evil',      genre:'dark orchestral',     instr:'pipe organ, cello section, choir in minor, distant bells, bassoon',      tempo:'slow 60 BPM',     key:'D minor', tags:'dark fantasy, foreboding, castle, ancient'},
    {name:'Metroidvania Atmosphere',    mood:'lonely, mysterious, isolated',         genre:'ambient orchestral',  instr:'solo violin, ambient pads, echo piano, sparse percussion, wind sounds',  tempo:'slow 55 BPM',     key:'A minor', tags:'exploration, atmosphere, alien, cavern, eerie'},
    {name:'Cyberpunk Main Title',       mood:'rebellious, high-energy, futuristic',  genre:'synthwave electronic',instr:'heavy synth bass, arpeggiated leads, 808 drums, distorted guitar stabs', tempo:'fast 130 BPM',    key:'F minor', tags:'neon, city, futuristic, dystopia'},
    {name:'Cozy Village Main Theme',    mood:'warm, welcoming, cheerful',            genre:'folk orchestral',     instr:'acoustic guitar, flute, light percussion, accordion, pizzicato strings',  tempo:'moderate 100 BPM',key:'G major', tags:'town, safe zone, village, home'},
    {name:'Pixel Art Retro Title',      mood:'nostalgic, exciting, adventurous',     genre:'chiptune',            instr:'square wave lead, triangle bass, noise drums, arpeggios, NES style',      tempo:'upbeat 120 BPM',  key:'C major', tags:'8-bit, NES, retro, game, pixel'},
    {name:'Underwater Kingdom Theme',   mood:'mysterious, serene, ancient wonder',   genre:'ambient orchestral',  instr:'waterphone, harp arpeggios, flute, whale song samples, reverb-heavy',    tempo:'slow 65 BPM',     key:'B minor', tags:'ocean, sunken, aquatic, deep sea'},
    {name:'Void / Space Main Theme',    mood:'vast, unsettling, cosmic horror',      genre:'dark ambient',        instr:'drone pads, reversed orchestral, distant choir, sub-bass rumble, silence', tempo:'ambient no fixed',key:'atonal',  tags:'void, space, cosmic, eldritch, alone'},
  ],
  'Combat & Battle':[
    {name:'Boss Battle Epic',           mood:'intense, desperate, powerful',         genre:'orchestral metal',    instr:'full orchestra + electric guitar, double kick drums, choir screaming, brass stabs', tempo:'fast 160 BPM', key:'B minor', tags:'boss fight, climactic, all-out'},
    {name:'Final Boss Confrontation',   mood:'apocalyptic, terrifying, inevitable',  genre:'dark orchestral metal',instr:'full choir, massive orchestra, heavy distorted guitar, war drums, organ', tempo:'variable dramatic',key:'D minor', tags:'final boss, endgame, climax, last stand'},
    {name:'Regular Enemy Combat',       mood:'urgent, aggressive, focused',          genre:'action orchestral',   instr:'driving strings, brass stabs, snare heavy drums, electric bass pulse',    tempo:'fast 140 BPM',    key:'E minor', tags:'combat, encounter, fight, tension'},
    {name:'Dungeon Crawl Battle',       mood:'tense, dangerous, underground',        genre:'dark orchestral',     instr:'low brass, staccato strings, war drum hits, bass clarinet, tense pizzicato',tempo:'medium 110 BPM', key:'C minor', tags:'dungeon, underground, trap, danger'},
    {name:'Underwater Boss Fight',      mood:'crushing pressure, monstrous, deep',   genre:'ambient orchestral heavy',instr:'low brass, waterphone, distorted choir, sub-bass pulses, delayed drums', tempo:'slow heavy 80 BPM',key:'F minor', tags:'underwater boss, leviathan, ocean monster'},
    {name:'Arena Gladiator Battle',     mood:'crowd energy, glorious, brutal',       genre:'epic orchestral',     instr:'trumpets, war drums, crowd ambience, heroic brass fanfare, clashing rhythm', tempo:'driving 130 BPM', key:'A major', tags:'arena, gladiator, crowd, glory, combat'},
    {name:'Stealth Mission Tension',    mood:'nervous, careful, quiet danger',       genre:'minimal electronic',  instr:'sparse synth pads, quiet hi-hat tick, bass pulse, tension strings',         tempo:'slow 70 BPM',     key:'C# minor', tags:'stealth, sneaking, tense, quiet danger'},
    {name:'Victory Fanfare',            mood:'triumphant, celebratory, short',       genre:'orchestral fanfare',  instr:'brass fanfare, timpani roll, snare, trumpet lead, short and punchy',       tempo:'energetic 120 BPM',key:'C major', tags:'victory, win, fanfare, completion'},
    {name:'Defeat / Game Over',         mood:'somber, reflective, sad',              genre:'sad orchestral',      instr:'solo piano descending, muted strings, distant bells, fade to silence',     tempo:'slow 50 BPM',     key:'A minor', tags:'game over, death, defeat, sad'},
    {name:'Rage / Berserk Theme',       mood:'pure aggression, blood rage, berserker',genre:'extreme metal',      instr:'blast beat drums, distorted guitar wall, screaming brass, no melody just chaos', tempo:'frantic 200 BPM',key:'power chords', tags:'rage, berserker, chaos, aggression'},
  ],
  'Exploration & World':[
    {name:'Open World Exploration',     mood:'free, wonder, discovery',              genre:'orchestral adventure',instr:'acoustic guitar, light strings, flute, soft percussion, open and airy',   tempo:'moderate 95 BPM', key:'A major', tags:'open world, exploration, travel, freedom'},
    {name:'Dangerous Cave / Dungeon',   mood:'eerie, cautious, underground dread',   genre:'ambient dark',        instr:'drone strings, drip sound effects, distant echoes, minimal bass pulse',    tempo:'slow ambient',    key:'chromatic', tags:'cave, dungeon, underground, cautious'},
    {name:'Ancient Ruins',              mood:'mysterious, ancient, forgotten glory', genre:'world orchestral',    instr:'duduk, taiko drums, ambient strings, choral hum, stone echo reverb',        tempo:'slow 65 BPM',     key:'E minor', tags:'ruins, ancient, lost civilization, mystery'},
    {name:'Snowy Tundra',               mood:'cold, desolate, survival, bleak beauty',genre:'ambient orchestral', instr:'solo cello, wind ambience, sparse piano, distant choir, deep cold pads',    tempo:'slow 60 BPM',     key:'G minor', tags:'snow, ice, cold, tundra, survival'},
    {name:'Lush Forest',                mood:'peaceful, alive, natural wonder',      genre:'nature orchestral',   instr:'flute, birds ambience, harp, pizzicato strings, light percussion, breeze',  tempo:'flowing 80 BPM',  key:'F major', tags:'forest, nature, peaceful, green, alive'},
    {name:'Cursed / Haunted Area',      mood:'unsettled, wrong, oppressive dread',   genre:'horror ambient',      instr:'reversed piano, dissonant strings, breathing sounds, random impacts',        tempo:'arrhythmic',      key:'dissonant', tags:'haunted, cursed, horror, wrong feeling'},
    {name:'Volcanic / Hellscape',       mood:'scorching, dangerous, apocalyptic',    genre:'industrial metal',    instr:'industrial percussion, low brass, distorted bass, steam and fire SFX',      tempo:'heavy 100 BPM',   key:'B minor', tags:'volcano, lava, hellscape, fire, danger'},
    {name:'Sky / Floating Islands',     mood:'soaring, free, above the clouds',      genre:'light orchestral',    instr:'flute lead, harp, light strings pizzicato, wind chimes, open reverb',        tempo:'floating 110 BPM',key:'D major', tags:'sky, clouds, floating, aerial, freedom'},
    {name:'Desert Ancient Ruins',       mood:'scorching, ancient, mystical sand',    genre:'middle eastern orchestral',instr:'oud, duduk, taiko, sand percussion, ambient heat shimmer strings',     tempo:'moderate 85 BPM', key:'E minor harmonic', tags:'desert, ancient, sand, ruins, mystical'},
    {name:'Ocean / Coastal',            mood:'vast, free, salty air',                genre:'celtic orchestral',   instr:'tin whistle, bodhrán drum, fiddle, waves ambience, male choir',             tempo:'flowing 100 BPM', key:'G major', tags:'ocean, coast, sea, freedom, celtic'},
  ],
  'Ambient & Atmospheric':[
    {name:'Town / Safe Zone',           mood:'peaceful, safe, warmth',               genre:'ambient folk',        instr:'acoustic guitar fingerpicking, distant village sounds, soft piano, birds',   tempo:'relaxed 75 BPM',  key:'C major', tags:'town, safe, home, NPC, peaceful'},
    {name:'Tavern / Inn Music',         mood:'jolly, drunk, lively but cozy',        genre:'folk tavern',         instr:'acoustic guitar, fiddle, hand drum, clinking ambience, sing-along melody',   tempo:'bouncy 115 BPM',  key:'A major', tags:'tavern, inn, ale, lively, folk'},
    {name:'Tense Investigation',        mood:'suspicious, careful, thriller',        genre:'minimal thriller',    instr:'sparse piano, tense strings pizzicato, muted trumpet, clock ticking SFX',    tempo:'slow tense 70 BPM',key:'C# minor', tags:'mystery, investigation, noir, careful'},
    {name:'Sad / Emotional Story Beat', mood:'melancholy, emotional, bittersweet',   genre:'emotional piano',     instr:'solo piano, cello joining, sparse strings, silence used as instrument',       tempo:'slow 55 BPM',     key:'A minor', tags:'sadness, story, emotional, loss, memory'},
    {name:'Dream / Memory Sequence',    mood:'ethereal, hazy, nostalgic blur',       genre:'ambient dream',       instr:'reversed choir, music box, slow piano, tape warble effect, slow strings',    tempo:'drifting ambient', key:'lydian mode', tags:'dream, memory, flashback, ethereal, hazy'},
    {name:'Horror / Tension Build',     mood:'dread, paranoia, something is wrong',  genre:'psychological horror',instr:'dissonant strings cluster, breathing, heartbeat bass, silence then impact',   tempo:'building slow',   key:'atonal',  tags:'horror, dread, paranoia, stalker, dark'},
    {name:'Healing / Rest Area',        mood:'restorative, calm, gentle hope',       genre:'gentle ambient',      instr:'singing bowls, soft piano, gentle choir, nature sounds, warm pads',           tempo:'very slow 50 BPM',key:'F major', tags:'heal, rest, checkpoint, safe, restore'},
    {name:'Flashback / Origin Story',   mood:'nostalgic, simpler time, bittersweet', genre:'simple folk',         instr:'music box melody, simple acoustic guitar, sparse arrangement, childlike',    tempo:'gentle 80 BPM',   key:'G major', tags:'flashback, past, origin, nostalgia, simple'},
  ],
  'Special Moments':[
    {name:'Level Up / Power Surge',     mood:'exciting, empowering, brief burst',    genre:'orchestral stinger',  instr:'ascending brass, harp gliss, timpani hit, brief triumphant stinger',         tempo:'fast burst',      key:'C major', tags:'level up, power, stinger, short, exciting'},
    {name:'Puzzle / Mystery Solve',     mood:'clever, satisfying, discovery click',  genre:'chamber music',       instr:'piano, marimba, light strings, ascending resolution, satisfying cadence',   tempo:'moderate rhythmic',key:'E major', tags:'puzzle, solve, clever, discovery, eureka'},
    {name:'Tragic Death / Sacrifice',   mood:'gut-punch sadness, heroic loss',       genre:'tragic orchestral',   instr:'full orchestra swelling then cutting to silence, solo cello, choir lament',   tempo:'slow building',   key:'D minor', tags:'death, sacrifice, tragedy, hero falls, tears'},
    {name:'Secret Area Discovery',      mood:'wonder, reward, sparkle',              genre:'magical orchestral',  instr:'harp gliss, celeste, light choir, magical shimmer, ascending melody',          tempo:'quick magical',   key:'B major', tags:'secret, discovery, hidden, reward, sparkle'},
    {name:'Cutscene: Villain Reveal',   mood:'menacing, cold, theatrical evil',      genre:'dramatic orchestral', instr:'bass choir, low brass stab, dissonant strings, ominous silence, organ',      tempo:'dramatic slow',   key:'B minor', tags:'villain, reveal, menace, theatrical, fear'},
    {name:'Cutscene: Hope Returns',     mood:'uplifting after darkness, dawn',       genre:'uplifting orchestral',instr:'solo violin rising, full orchestra swell, choir entering, triumphant build',  tempo:'building to fast', key:'D major', tags:'hope, dawn, turning point, uplift, inspiring'},
    {name:'Credits Roll',               mood:'reflective, complete, emotional journey',genre:'orchestral suite',  instr:'piano with orchestra, themes from game reprise, gentle and full',             tempo:'moderate 85 BPM', key:'G major', tags:'credits, ending, reflection, journey, complete'},
    {name:'Menu / Pause Screen',        mood:'neutral, unobtrusive, loopable',       genre:'ambient minimal',     instr:'gentle piano loop, soft pads, minimal, not distracting from reading',         tempo:'slow loopable',   key:'C major', tags:'menu, pause, neutral, loopable, background'},
  ],
  'Genre Specials':[
    {name:'Chiptune / 8-bit Adventure', mood:'classic, nostalgic, energetic',        genre:'chiptune NES-style',  instr:'square wave, triangle bass, noise channel drums, arpeggio chords, 4-channel limit', tempo:'120 BPM loop', key:'C major', tags:'8-bit, chiptune, NES, retro, pixel art'},
    {name:'16-bit SNES RPG',            mood:'epic quest, slightly grandiose, warm',  genre:'chiptune SNES-style', instr:'SNES soundfont, sampled orchestra, FM synthesis, classic RPG sound',         tempo:'moderate 100 BPM',key:'D major', tags:'16-bit, SNES, RPG, classic, JRPG'},
    {name:'Lo-fi Study / Chill Zone',   mood:'relaxed, focused, nostalgic warm',      genre:'lo-fi hip hop',       instr:'muffled drum loop, jazz piano samples, vinyl crackle, bass, ambient',      tempo:'chill 75 BPM',    key:'Eb major', tags:'lo-fi, chill, focus, study, relaxed'},
    {name:'Heavy Metal Dungeon',        mood:'aggressive, powerful, relentless',      genre:'metal',               instr:'distorted guitar riff, double kick drums, bass, no orchestra, pure metal',    tempo:'fast 150 BPM',    key:'E minor', tags:'metal, dungeon, aggressive, guitar, heavy'},
    {name:'Jazz Bar / Noir City',       mood:'cool, mysterious, urban night',         genre:'jazz noir',           instr:'jazz piano, muted trumpet, upright bass, brushed snare, saxophone',           tempo:'swing 90 BPM',    key:'G minor', tags:'jazz, noir, city, night, bar, cool mystery'},
    {name:'Celtic Folk Adventure',      mood:'epic journey, proud, ancestral',        genre:'celtic folk',         instr:'uilleann pipes, tin whistle, fiddle, bodhran, male choir, acoustic guitar',    tempo:'driving 120 BPM', key:'D dorian', tags:'celtic, folk, adventure, proud, journey'},
    {name:'Eastern Fantasy',            mood:'mysterious, exotic, ancient east',      genre:'eastern orchestral',  instr:'erhu, koto, shakuhachi, taiko drums, guqin, chinese orchestral',              tempo:'moderate 95 BPM', key:'pentatonic', tags:'eastern, japan, china, ancient, exotic, mysterious'},
    {name:'Gothic Choir Horror',        mood:'religious dread, ancient evil hymn',    genre:'gothic choral',       instr:'pipe organ, SATB choir, tolling bells, gregorian chant style, no percussion',  tempo:'slow ceremonial',  key:'D minor', tags:'gothic, choir, organ, religious dread, hymn'},
  ],
};

  global.PF_DATA = {
    LOCK, STAND, FLY, ATK, BOSS_SCREAM, SWIM, F2DS, F2DT, ISO, NEG_FLAT,
    BGQ, FGQ, VFXQ, BMEQ, NEG_BASE, AS,
    CHAR_PRE, ENEMY_PRE, PLAT_PRE, PROP_PRE, BG_PRE, FG_PRE, UI_PRE, VFX_PRE,
    BIOME_DATA, THEMES, WEAPON_PRE, MUSIC_PLATFORMS, MUSIC_PRESETS
  };
})(typeof window !== "undefined" ? window : globalThis);
