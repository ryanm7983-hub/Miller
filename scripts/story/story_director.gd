class_name StoryDirector
extends Node
## Objectives, chapter progression and endings.
##
## The story is driven by *state*, not by a script: every chapter states the
## condition that ends it, and this node re-evaluates those conditions whenever
## something relevant happens. That means the player can do things out of order
## — find the archive before the station, activate posts in any sequence — and
## the game keeps up instead of waiting at a trigger volume.
##
## Reading documents raises the player's sanity floor. That is the game's
## central bargain stated mechanically: understanding what is in the basin makes
## it easier to survive and harder to leave.

const ENDING_COUNT := 4

## Chapters in order. `complete_when` names a predicate below.
const CHAPTERS := [
	{
		"id": "arrival",
		"objective": "Reach Vantry Ranger Station and find out why the network is transmitting.",
		"complete_when": "reached_station",
	},
	{
		"id": "network",
		"objective": "Bring listening posts back online. Three would be enough to triangulate.",
		"complete_when": "posts_online",
	},
	{
		"id": "archive",
		"objective": "Find what the network has been recording.",
		"complete_when": "archive_found",
	},
	{
		"id": "decision",
		"objective": "Decide what to do with the basin's archive.",
		"complete_when": "never",
	},
]

const ENDINGS := {
	"transmit": {
		"title": "TRANSMIT",
		"summary": "You restored the relay and gave the basin an audience.",
		"body": "The carrier caught at 03:02 and held. Somewhere past the ridge a
receiver that had been quiet since 1989 began to resolve a shape, and
somewhere past that, another.

Marsh was right about the mechanism and wrong about everything that follows
from it. The basin is a hole in the shape of a person. You have just told
several thousand people where to find one.

For a long time afterwards you will hear your own name said back to you in
rooms with nobody in them, and you will understand that this is not the
basin's doing any more. It has been handed on.",
	},
	"silence": {
		"title": "SILENCE",
		"summary": "You took the network down and burned the archive.",
		"body": "Nine posts down, then ten, then eleven, and then the resin store at the
adit, which burned with a smell like a church.

The quiet that comes afterwards is not the held breath you walked in on. It
is an ordinary forest at four in the morning, and you stand in it for some
time before you can trust it.

You walk out on the fire road at first light. Halfway down you stop, because
you cannot remember the sound of your mother's voice, and you go on standing
there trying, and it does not come. Whatever was keeping it was keeping it
here. You made a trade and you were not told the price and you would make it
again.",
	},
	"answer": {
		"title": "ANSWER",
		"summary": "You went to the oldest tree in the basin and told it your name.",
		"body": "It is not the largest black pine in the basin and it is not at the centre
of anything. It is only the oldest, and the rings are very close together,
and when you put your hand flat against it the bark is warm the way a throat
is warm.

You say your name once, clearly, the way you would to somebody hard of
hearing.

There is a pause that is not the basin thinking, because the basin does not
think, and then eleven voices say it back in unison and get it exactly right
on the first attempt, which they have never managed before.

The Forestry Service closes work order 41-C as unresolved. In the spring a
survey team recovers forty-one seconds of intelligible speech from a core
sample. The words are yours. Nobody in the basin is listening, so nothing
comes of it, and the rings go on laying down.",
	},
	"walk_out": {
		"title": "WALK OUT",
		"summary": "You left the basin without giving it anything to work with.",
		"body": "You service what you can reach, you do not run the reels, you say nothing
aloud for eleven hours, and at dawn you walk back up the fire road to the
truck.

Behind you the basin holds what it held before you came: loggers, and a
ranger's wife's left boot on a porch board, and a man reading a name off a
page until he had it right.

It does not have you. That is the whole of your achievement and it is worth
more than it sounds. In the file you write [i]source not determined,
recommend permanent decommission[/i], and the file goes into a drawer, and
the drawer is in a building four hundred miles from any pine at all.",
	},
}

var _stats: SurvivalStats
var _world: WorldRoot
var _player: Player


func setup(player: Player, world: WorldRoot) -> void:
	_player = player
	_world = world
	_stats = player.stats

	EventBus.listening_post_activated.connect(func(_id: String) -> void: evaluate())
	EventBus.poi_discovered.connect(func(_id: String, _name: String) -> void: evaluate())
	EventBus.document_collected.connect(_on_document_collected)
	EventBus.document_opened.connect(_on_document_read)
	EventBus.flag_set.connect(func(_flag: String, _value: Variant) -> void: evaluate())
	EventBus.item_added.connect(func(_id: String, _count: int) -> void: evaluate())

	call_deferred("evaluate")


# ---------------------------------------------------------------------------
# Progression
# ---------------------------------------------------------------------------

## Re-derive the current chapter and objective from world state.
func evaluate() -> void:
	var index := _chapter_index(GameState.chapter_id)
	while index < CHAPTERS.size() - 1 and _predicate(String(CHAPTERS[index]["complete_when"])):
		GameState.complete_objective(String(CHAPTERS[index]["id"]))
		index += 1
		GameState.set_chapter(String(CHAPTERS[index]["id"]))
	var chapter: Dictionary = CHAPTERS[index]
	GameState.push_objective(String(chapter["id"]), _objective_text(chapter))


func _chapter_index(chapter_id: String) -> int:
	for i in CHAPTERS.size():
		if CHAPTERS[i]["id"] == chapter_id:
			return i
	return 0


## Objectives that count something say how many are left; a fixed line makes the
## player check a menu to find out whether anything happened.
func _objective_text(chapter: Dictionary) -> String:
	var base := String(chapter["objective"])
	match String(chapter["id"]):
		"network":
			return "%s  (%d of 3)" % [base, mini(GameState.posts_activated(), 3)]
		"decision":
			return base + "  (the relay, the standing ring, or the fire road)"
	return base


func _predicate(name: String) -> bool:
	match name:
		"reached_station":
			return GameState.discovered_pois.has("ranger_station")
		"posts_online":
			return GameState.posts_activated() >= 3
		"archive_found":
			return GameState.has_flag("archive_found") \
					or (GameState.documents.has("note_marsh_2") and GameState.posts_recorded() >= 1)
		"never":
			return false
	return false


# ---------------------------------------------------------------------------
# Knowledge
# ---------------------------------------------------------------------------

func _on_document_collected(document_id: String) -> void:
	AudioDirector.play_2d("pickup", -6.0)
	EventBus.notification_posted.emit("Journal: %s" % DocumentLibrary.get_entry(document_id).get("short", ""))
	evaluate()


## Each document read lifts the floor sanity cannot fall below. Twelve
## documents is a floor of 36 — never safety, but the difference between
## surviving a bad night and not.
func _on_document_read(_document_id: String) -> void:
	if _stats == null:
		return
	_stats.set_sanity_floor(minf(48.0, float(DocumentLibrary.read_count()) * 3.0))


# ---------------------------------------------------------------------------
# Choices and endings
# ---------------------------------------------------------------------------

## Record an irreversible decision. The ending is not chosen here — it is
## derived from the whole run when the player commits.
func make_choice(choice_id: String, option_id: String) -> void:
	GameState.record_choice(choice_id, option_id)
	Log.info("story", "choice %s -> %s" % [choice_id, option_id])


## Which ending the run has earned, given how the player has played it.
func resolve_ending(committed: String) -> String:
	match committed:
		"transmit", "silence", "answer":
			return committed
		_:
			return "walk_out"


func trigger_ending(ending_id: String) -> void:
	var resolved := resolve_ending(ending_id)
	GameState.unlock_ending(resolved)
	GameState.set_flag("ending", resolved)
	Log.info("story", "ending: %s" % resolved)
	EventBus.ending_reached.emit(resolved)


static func ending_entry(ending_id: String) -> Dictionary:
	return ENDINGS.get(ending_id, {
		"title": "NO SIGNAL",
		"summary": "The basin kept you.",
		"body": "The work order stays open. In the spring somebody else is sent, with the
same instructions, and a torch with a better reflector.",
	})


## True once the player has done enough to end the run deliberately.
func can_commit_ending() -> bool:
	return GameState.posts_activated() >= 3
