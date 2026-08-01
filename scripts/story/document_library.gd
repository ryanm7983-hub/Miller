class_name DocumentLibrary
extends RefCounted
## Every readable in the game.
##
## Kept as data in one file for the same reasons as `ItemDatabase`: the whole
## story is legible in one place, diffs are readable, and the text — the
## expensive half of localisation — is already isolated.
##
## `body` is BBCode, rendered by `DocumentReader`.
##
## Reading is mechanically significant. Documents raise the player's sanity
## floor (see `StoryDirector`): understanding what is happening in the basin is
## protective, even though what is happening is worse than not knowing.

const ENTRIES := {
"note_arrival": {
	"short": "Work Order 41-C",
	"title": "Work Order 41-C",
	"attribution": "Forestry Service, Acoustic Monitoring",
	"body": "[i]Contractor: R. Aldaugh, field acoustician.[/i]

Eleven passive listening stations were installed in the Black Pine Basin
between 1974 and 1977 and decommissioned in 1989. Power was cut at the relay.
The reels were removed. The stations have no batteries.

On 3 September this office began receiving carrier signal on the basin's
allocated frequency, intermittently, between 02:00 and 04:40.

Attend site. Determine the source. Restore or terminate as appropriate.

[i]Note: the fire road is passable to the trailhead only. Do not attempt the
lower crossing after rain.[/i]",
},

"note_rill_1": {
	"short": "Rill — first page",
	"title": "Ranger's Journal",
	"attribution": "H. Rill, Vantry Station — 4 October 1989",
	"body": "Marsh's people packed out this morning and left me the whole basin and
one radio.

I am supposed to be pleased about the quiet. I have wanted the quiet for two
years. But I walked the Sorrel line this afternoon and the quiet here is not
the absence of sound. It is a held breath. There is a difference and I can
hear it now that there is nobody talking over it.

The posts are still standing. I am supposed to pull them out before the snow.",
},

"note_rill_2": {
	"short": "Rill — torn page",
	"title": "Ranger's Journal",
	"attribution": "H. Rill — 19 November 1989",
	"body": "I have understood something and I am writing it down before I talk myself
back out of it.

The trees are not haunted. The basin is not haunted. The basin [b]keeps[/b].
Marsh had it right in the mechanism and wrong in every single thing that
follows from it. Sap and mineral and the pressure of a hundred winters, and
what goes in comes out again, and it comes out [i]shaped[/i].

Shaped by who is listening.

The first month I heard my wife. Not her voice — her step, the particular
drag of her left boot on the porch board. It followed me from the ridge to
the station and it took me four nights to understand that I was the one
putting her in it. The basin had a hole the shape of a person and I filled it.

Marsh wants to broadcast this. Marsh wants to give the world a hole shaped
like whatever it is missing.

I am going to take the posts down.",
},

"note_rill_3": {
	"short": "Rill — last page",
	"title": "Ranger's Journal",
	"attribution": "H. Rill — undated",
	"body": "Nine down. Two to go and I cannot find the two.

I have stopped speaking out loud. That was the mistake. Every word I have
said out here since October is still out here. It has all of it. It has my
whole voice and it has been practising.

Something came to the station door last night and used my name in my own
mouth and I nearly answered. Nearly. That is what it wants — not to be
answered. To be [i]agreed with[/i].

If you are reading this: do not record anything. Do not play anything back.
Every reel you run is a lesson. And do not, under any circumstance, tell it
what you are called.",
},

"note_marsh_1": {
	"short": "Marsh — survey note",
	"title": "Acoustic Survey, Second Season",
	"attribution": "I. Marsh, principal investigator — 1976",
	"body": "Summary for the committee, in the plainest terms I can manage.

The black pine of this basin lays down resin in a fine annual lamina. The
soil here is unusually rich in a ferrous silicate. Where the two meet — and
in this basin they meet everywhere — the lamina takes an impression of
pressure. Sound is pressure. The rings are a recording.

We have recovered forty-one seconds of intelligible speech from a core taken
at a stump felled in 1953. The words are in Norwegian. Two of the loggers on
the 1953 crew were Norwegian.

The committee will ask what the practical application is. I will tell them
what I have told them: it is not an application. It is a hearing. There are
people in this basin who were never listened to and they are still here, in
the wood, and we have found the door.",
},

"note_marsh_2": {
	"short": "Marsh — annotated",
	"title": "Acoustic Survey, Fourth Season (annotated)",
	"attribution": "I. Marsh, with a second hand in pencil",
	"body": "…the eleven stations now form a continuous passive net across the basin
floor. With the relay restored to full power the net could be made
[b]active[/b] — that is, it could be induced to give back what it holds,
across the whole basin at once, and beyond it.

[i](in pencil, pressing hard)[/i]
[i]Ivo. It does not hold people. It holds the shape people leave. You are
proposing to broadcast a shape and let a hundred thousand strangers fill it
in with whatever is missing from them. — H.R.[/i]

…the objection assumes a malign intent that the mechanism does not support.
The basin is a medium. A medium has no appetite.

[i](in pencil, underlined twice)[/i]
[i]It has learned to say my wife's name. Media do not learn.[/i]",
},

"note_camp": {
	"short": "Company notice",
	"title": "Notice to All Hands",
	"attribution": "Vantry Timber Co. — posted 11 March 1953, never removed",
	"body": "Following the incident at No. 3 the company reminds all hands that the
lower adit is closed and will remain closed.

Wages for the eleven men of the night shift will be paid in full to next of
kin. The company considers the matter concluded and will not entertain
further discussion of noises reported at the shaft head.

Any man found at the adit will be dismissed without pay.

[i](underneath, scratched into the wood with a nail)[/i]
[i]THEY ARE STILL CALLING UP[/i]",
},

"note_cemetery": {
	"short": "Interment record",
	"title": "Interment Record, Vantry Camp",
	"attribution": "water-damaged",
	"body": "…eleven interred 14 March, no remains recovered, stones set in the
customary manner over empty ground.

The company chaplain declined to attend on the grounds that there was nothing
to attend. The men set the stones themselves and stood a while and then, one
of them beginning it and the rest joining, they said the eleven names aloud
in turn, and then again, and then a third time, because it was felt that
saying them once was not enough.

I have thought about that a great deal since. I do not know what we did that
night. I know we did it into the ground.",
},

"note_bunker": {
	"short": "Signal log",
	"title": "Signal Log — Basin Relay",
	"attribution": "operator initials H.R.",
	"body": "[i]Columns: time, frequency, source station, remarks.[/i]

02:14   — 4 — carrier only
02:40   — 7 — carrier only
03:02   — 4 — [b]modulated[/b]. Speech-like. Not intelligible.
03:11   — 9 — modulated. Two voices, overlapping.
03:48   — 4 — modulated. One voice. Mine.

[i]I was asleep at 03:48. I checked the door twice. There is nobody here.[/i]

[i]I am cutting the relay in the morning. If the stations are talking to each
other I would rather they did it without a tower.[/i]",
},

"note_ritual": {
	"short": "Bark bundle",
	"title": "Bound Bark",
	"attribution": "wire, birch, and a knife",
	"body": "[i]Scratched into the inner face, in a hand that ran out of room:[/i]

we set the stones over nothing so we brought them a something
we gave it the names to hold
eleven names is a weight
a weight will keep a thing in one place

do not take the names off it
whoever finds this
[b]do not take the names off it[/b]",
},

"note_mine": {
	"short": "Shift board",
	"title": "Shift Board, No. 3 Adit",
	"attribution": "chalk on slate",
	"body": "NIGHT SHIFT 13/3 — 11 MEN BELOW

[i]Eleven names in a neat column. The bottom row has been rubbed out with a
palm, and rubbed out again, and a twelfth name written in the smear, in a
different hand, much later.[/i]

[i]The twelfth name is yours.[/i]",
},

"note_tower": {
	"short": "Watch log",
	"title": "Fire Watch Log — Sorrel Ridge",
	"attribution": "H. Rill",
	"body": "1 Nov  clear, vis 14 mi, no smoke
2 Nov  clear, vis 14 mi, no smoke
3 Nov  overcast, vis 6 mi, no smoke
4 Nov  fog to the ridge line, vis 400 yd, no smoke
5 Nov  fog, vis 200 yd
6 Nov  fog
7 Nov  fog
8 Nov  I can see the whole basin from up here and I can see that there is no
fog. Vis 14 mi. I am writing fog because when I look down at the trees I
cannot see the trees.
9 Nov  fog
10 Nov  it is not on the glass",
},

# --- tape transcripts, surfaced by the recorder --------------------------
"tape_a": {
	"short": "Reel: MARROW 04",
	"title": "Transcript — MARROW 04",
	"attribution": "recovered from station 4",
	"body": "[i]Fourteen seconds of running water. Then:[/i]

— it's not going to take, Ivo, the ground's too wet here —
— it takes better wet —
— [i](laughter, two people)[/i] —
— it takes better wet, that's the whole —

[i]The recording ends. The last four seconds are the same four seconds
repeated, at slightly different pitch, three times.[/i]",
},

"tape_b": {
	"short": "Reel: SORREL 11",
	"title": "Transcript — SORREL 11",
	"attribution": "recovered from station 11",
	"body": "[i]Wind. A door, twice. Then a man's voice, close to the microphone,
speaking evenly, as though reading:[/i]

— Halden Rill. Halden Rill. Halden Rill. Halden —

[i]It continues for nine minutes. The pronunciation improves.[/i]",
},

"tape_c": {
	"short": "Reel: unmarked",
	"title": "Transcript — unmarked",
	"attribution": "recovered from the standing ring",
	"body": "[i]No wind. No water. No room tone at all — the tape is not silent, it is
[b]empty[/b], which is a different thing and the meter shows it.

Then, at four minutes eleven seconds, very quietly, in your own voice,
a question you have not asked yet.[/i]",
},

"epitaph_eleven": {
	"short": "The eleven stones",
	"title": "The Eleven Stones",
	"attribution": "Vantry Camp Cemetery",
	"body": "[i]Eleven markers in two uneven rows. The names have been cut, and then
somebody has gone along the row with a chisel and taken the names off again,
carefully, one at a time, leaving the dates.

All eleven dates are the same.

The twelfth stone at the end of the row is newer than the others, and blank,
and the ground in front of it has been turned over recently.[/i]",
},
}


static func exists(document_id: String) -> bool:
	return ENTRIES.has(document_id)


static func get_entry(document_id: String) -> Dictionary:
	return ENTRIES.get(document_id, {
		"short": document_id, "title": document_id, "body": "", "attribution": "",
	})


static func title(document_id: String) -> String:
	return String(get_entry(document_id).get("title", document_id))


static func all_ids() -> Array[String]:
	var out: Array[String] = []
	for id: String in ENTRIES:
		out.append(id)
	out.sort()
	return out


## Reading is tracked separately from collecting, because the story systems
## care about what the player actually knows.
static func mark_read(document_id: String) -> void:
	var read: Dictionary = GameState.get_flag("documents_read", {})
	if typeof(read) != TYPE_DICTIONARY:
		read = {}
	if read.has(document_id):
		return
	read[document_id] = true
	GameState.set_flag("documents_read", read)


static func has_read(document_id: String) -> bool:
	var read: Variant = GameState.get_flag("documents_read", {})
	return typeof(read) == TYPE_DICTIONARY and read.has(document_id)


static func read_count() -> int:
	var read: Variant = GameState.get_flag("documents_read", {})
	return read.size() if typeof(read) == TYPE_DICTIONARY else 0
