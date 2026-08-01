THE BLACK PINE
==============

Do not open index.html by double-clicking it.

It will show the title and then sit on the loading screen forever. That is not
a bug in the game: browsers refuse to let a page opened from a file:// path
fetch its own data, and this one has to fetch a 37 MB engine before it can
start. The page will tell you so after a few seconds, but it still cannot run.

It needs to be served over http. Any of these work:

  1. Upload this zip to itch.io as an HTML project (index.html is already at
     the root of the zip, which is what itch.io requires). Set:
       Kind of project     HTML
       This file will be   played in the browser
       Viewport            1280 x 720
       Fullscreen button   enabled
       Mobile friendly     enabled

  2. Double-click play-windows.bat, if you have Python or Node.js installed.

  3. From a terminal in this folder:
       python3 -m http.server 8000
     then open http://localhost:8000

Headphones recommended. The game is mostly quiet on purpose.

On a phone, hold it sideways — the touch controls put a thumb in each bottom
corner and portrait squeezes them into the play area. It is playable either way.
