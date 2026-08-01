THE BLACK PINE
==============

TO PLAY, DOUBLE-CLICK:   play-windows.bat        (Windows)
                         play-mac-linux.command  (macOS / Linux)

Do NOT double-click index.html. It will show the title and then sit on the
loading screen forever.

That is not a bug in the game. Browsers refuse to let a page opened from a
file:// path fetch its own data, and this one has to fetch a 37 MB engine
before it can start. Nothing can be done about that from inside the page --
it has to be served over http instead of opened from disk. The page will tell
you so after a few seconds if you try it.

play-windows.bat serves this folder and opens your browser. It needs nothing
installed: it uses Windows PowerShell, which every Windows machine already has.
Leave the black console window open while you play, and close it when you are
done.

If you would rather do it by hand, from a terminal in this folder:

    python3 -m http.server 8000

then open http://localhost:8000

To put it online instead, upload this zip to itch.io as an HTML project --
index.html is already at the root of the zip, which is what itch.io requires.
Set: Kind of project = HTML, "This file will be played in the browser",
viewport 1280 x 720, fullscreen button enabled, mobile friendly enabled.

---

Headphones recommended. The game is mostly quiet on purpose.

On a phone, hold it sideways -- the touch controls put a thumb in each bottom
corner, and portrait squeezes them into the play area. It works either way.

First load takes a moment: the entire world, every texture and every sound is
generated on your machine at startup rather than downloaded.
