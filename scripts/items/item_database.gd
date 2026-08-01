class_name ItemDatabase
extends RefCounted
## Every item in the game, as data.
##
## A static table rather than one `.tres` per item: the set is small enough to
## read in one sitting, diffs are legible, and nothing has to be imported. Text
## lives here too, which is the expensive half of localisation already isolated
## in one file.
##
## Fields:
##   name        display name
##   description shown when the item is inspected
##   category    tool | consumable | key | puzzle | document | ammo
##   size        grid footprint as [width, height]
##   stack       maximum stack size (1 = not stackable)
##   glyph       single character drawn on the inventory tile
##   tint        accent colour key, resolved against UITheme
##   use         what `Inventory.use()` does with it, if anything
##   value       magnitude for the `use` effect
##   note        document id, for readable items
##   essential   true if losing it would soft-lock the run

const DEFS := {
	# --- tools -------------------------------------------------------------
	"recorder": {
		"name": "Field Recorder",
		"description": "A shoulder-slung reel recorder, Vantry Forestry Service issue. "
			+ "The meter still moves when nothing is making a sound.",
		"category": "tool", "size": [2, 2], "stack": 1, "glyph": "R",
		"tint": "cold", "essential": true,
	},
	"flashlight": {
		"name": "Torch",
		"description": "A steel-bodied hand torch. The reflector is pitted; the beam is "
			+ "narrow and yellow and does not reach as far as you would like.",
		"category": "tool", "size": [1, 2], "stack": 1, "glyph": "|",
		"tint": "amber", "essential": true,
	},
	"basin_map": {
		"name": "Basin Survey Map",
		"description": "A 1974 survey of the Black Pine Basin. Someone has inked in "
			+ "eleven small circles that do not correspond to anything printed.",
		"category": "tool", "size": [2, 2], "stack": 1, "glyph": "M", "tint": "bone",
	},

	# --- consumables -------------------------------------------------------
	"battery_cell": {
		"name": "Dry Cell",
		"description": "A fat zinc-carbon cell. Cold to hold. Half of them in the "
			+ "station drawer were already flat.",
		"category": "consumable", "size": [1, 1], "stack": 6, "glyph": "+",
		"tint": "amber", "use": "battery", "value": 45.0,
	},
	"gauze": {
		"name": "Field Dressing",
		"description": "Sterile gauze in a paper packet. Enough for one bad decision.",
		"category": "consumable", "size": [1, 1], "stack": 4, "glyph": "=",
		"tint": "bone", "use": "heal", "value": 35.0,
	},
	"tincture": {
		"name": "Bitter Tincture",
		"description": "A brown glass bottle from the ranger station's medicine tin. "
			+ "Whatever is in it, it makes the trees stop moving at the edges.",
		"category": "consumable", "size": [1, 1], "stack": 3, "glyph": "o",
		"tint": "moss", "use": "sanity", "value": 30.0,
	},
	"coffee": {
		"name": "Flask of Coffee",
		"description": "Still faintly warm, which is the part you keep coming back to.",
		"category": "consumable", "size": [1, 2], "stack": 1, "glyph": "u",
		"tint": "amber", "use": "stamina", "value": 60.0,
	},

	# --- keys --------------------------------------------------------------
	"key_station": {
		"name": "Station Key",
		"description": "A brass key on a leather fob stamped VANTRY 1.",
		"category": "key", "size": [1, 1], "stack": 1, "glyph": "k",
		"tint": "amber", "essential": true,
	},
	"key_cabin": {
		"name": "Bent Key",
		"description": "Iron, and bent — as though it had been turned against something "
			+ "that would not give.",
		"category": "key", "size": [1, 1], "stack": 1, "glyph": "k",
		"tint": "amber", "essential": true,
	},
	"key_mine": {
		"name": "Adit Padlock Key",
		"description": "Heavy, oiled recently. Someone has been down there since the "
			+ "mine closed.",
		"category": "key", "size": [1, 1], "stack": 1, "glyph": "k",
		"tint": "amber", "essential": true,
	},

	# --- puzzle ------------------------------------------------------------
	"fuse": {
		"name": "Ceramic Fuse",
		"description": "30 amp. The relay hut's board is missing three of these.",
		"category": "puzzle", "size": [1, 1], "stack": 3, "glyph": "f",
		"tint": "cold", "essential": true,
	},
	"crank": {
		"name": "Crank Handle",
		"description": "Fits the hand generator at the fire tower, and the one at the relay.",
		"category": "puzzle", "size": [1, 2], "stack": 1, "glyph": "c",
		"tint": "cold", "essential": true,
	},
	"tape_a": {
		"name": "Reel: MARROW 04",
		"description": "A quarter-inch reel, hand-labelled. The tape smells of resin.",
		"category": "puzzle", "size": [1, 1], "stack": 1, "glyph": "t",
		"tint": "cold", "essential": true,
	},
	"tape_b": {
		"name": "Reel: SORREL 11",
		"description": "The label has been written over twice. The layer underneath "
			+ "says something shorter.",
		"category": "puzzle", "size": [1, 1], "stack": 1, "glyph": "t",
		"tint": "cold", "essential": true,
	},
	"tape_c": {
		"name": "Reel: UNMARKED",
		"description": "No label at all. It is heavier than the others.",
		"category": "puzzle", "size": [1, 1], "stack": 1, "glyph": "t",
		"tint": "rust", "essential": true,
	},
	"resin_core": {
		"name": "Resin Core",
		"description": "A finger of amber drilled from a black pine. Held to the light "
			+ "there are rings in it, and the rings are not evenly spaced.",
		"category": "puzzle", "size": [1, 1], "stack": 1, "glyph": "*",
		"tint": "amber", "essential": true,
	},
	"bolt_cutters": {
		"name": "Bolt Cutters",
		"description": "Rusted at the pivot but the jaws still meet.",
		"category": "puzzle", "size": [2, 1], "stack": 1, "glyph": "X",
		"tint": "bone", "essential": true,
	},

	# --- documents ---------------------------------------------------------
	"note_arrival": {
		"name": "Work Order",
		"description": "Your own paperwork, countersigned by someone who has never been here.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_arrival",
	},
	"note_rill_1": {
		"name": "Ranger's Journal, first page",
		"description": "Halden Rill's handwriting, small and level.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_rill_1",
	},
	"note_rill_2": {
		"name": "Ranger's Journal, torn page",
		"description": "The same hand, pressing much harder.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_rill_2",
	},
	"note_rill_3": {
		"name": "Ranger's Journal, last page",
		"description": "Barely legible. The pencil has gone through the paper in places.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "rust", "note": "note_rill_3",
	},
	"note_marsh_1": {
		"name": "Survey Note",
		"description": "Ivo Marsh, acoustic survey, second season.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_marsh_1",
	},
	"note_marsh_2": {
		"name": "Survey Note, annotated",
		"description": "Marsh's typescript, with a second hand correcting it.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_marsh_2",
	},
	"note_camp": {
		"name": "Company Notice",
		"description": "Vantry Timber, posted to the bunkhouse door and never taken down.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_camp",
	},
	"note_cemetery": {
		"name": "Interment Record",
		"description": "A page from a burial register, water-damaged along one edge.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_cemetery",
	},
	"note_bunker": {
		"name": "Signal Log",
		"description": "Columns of times and frequencies. The last column is blank.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "cold", "note": "note_bunker",
	},
	"note_ritual": {
		"name": "Wrapped Bundle",
		"description": "Birch bark bound with wire, with writing scratched into the inside.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "rust", "note": "note_ritual",
	},
	"note_mine": {
		"name": "Shift Board Slate",
		"description": "Names and numbers in chalk. Someone rubbed out the bottom row.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_mine",
	},
	"note_tower": {
		"name": "Watch Log",
		"description": "Weather, visibility, smoke sightings. Then no weather at all.",
		"category": "document", "size": [1, 1], "stack": 1, "glyph": "p",
		"tint": "bone", "note": "note_tower",
	},
}


static func exists(item_id: String) -> bool:
	return DEFS.has(item_id)


static func get_def(item_id: String) -> Dictionary:
	return DEFS.get(item_id, {})


static func display_name(item_id: String) -> String:
	return String(DEFS.get(item_id, {}).get("name", item_id))


static func description(item_id: String) -> String:
	return String(DEFS.get(item_id, {}).get("description", ""))


static func category(item_id: String) -> String:
	return String(DEFS.get(item_id, {}).get("category", "misc"))


static func glyph(item_id: String) -> String:
	return String(DEFS.get(item_id, {}).get("glyph", "?"))


static func tint(item_id: String) -> Color:
	match String(DEFS.get(item_id, {}).get("tint", "bone")):
		"amber": return UITheme.AMBER
		"cold": return UITheme.COLD
		"moss": return UITheme.MOSS
		"rust": return UITheme.RUST
		_: return UITheme.BONE


## Grid footprint in cells.
static func size_of(item_id: String) -> Vector2i:
	var raw: Array = DEFS.get(item_id, {}).get("size", [1, 1])
	return Vector2i(int(raw[0]), int(raw[1]))


static func max_stack(item_id: String) -> int:
	return int(DEFS.get(item_id, {}).get("stack", 1))


static func is_stackable(item_id: String) -> bool:
	return max_stack(item_id) > 1


static func use_effect(item_id: String) -> String:
	return String(DEFS.get(item_id, {}).get("use", ""))


static func use_value(item_id: String) -> float:
	return float(DEFS.get(item_id, {}).get("value", 0.0))


static func is_usable(item_id: String) -> bool:
	return use_effect(item_id) != ""


static func note_id(item_id: String) -> String:
	return String(DEFS.get(item_id, {}).get("note", ""))


static func is_document(item_id: String) -> bool:
	return note_id(item_id) != ""


## Essential items are protected from the "drop to make room" flow: losing one
## in a swamp should not be able to strand a run.
static func is_essential(item_id: String) -> bool:
	return bool(DEFS.get(item_id, {}).get("essential", false))


static func ids_in_category(wanted: String) -> Array[String]:
	var out: Array[String] = []
	for id: String in DEFS:
		if category(id) == wanted:
			out.append(id)
	out.sort()
	return out


static func all_ids() -> Array[String]:
	var out: Array[String] = []
	for id: String in DEFS:
		out.append(id)
	out.sort()
	return out
