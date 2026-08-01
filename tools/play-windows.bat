@echo off
REM Serve this folder over http and open the game.
REM
REM Double-clicking index.html cannot work: browsers refuse `fetch` on a
REM file:// URL and the engine has to fetch its own runtime, so the page sits on
REM the loading screen forever. Anything that serves this folder over http will
REM do; this batch file just finds whatever is already installed.

setlocal
cd /d "%~dp0"
set PORT=8000

where py >nul 2>nul && (
	start "" http://localhost:%PORT%/
	py -3 -m http.server %PORT%
	goto :eof
)
where python >nul 2>nul && (
	start "" http://localhost:%PORT%/
	python -m http.server %PORT%
	goto :eof
)
where npx >nul 2>nul && (
	start "" http://localhost:%PORT%/
	npx --yes http-server -p %PORT% -c-1
	goto :eof
)

echo.
echo   No Python and no Node.js found, so this script cannot serve the folder.
echo.
echo   The game still runs anywhere that serves files over http. The two
echo   easiest options:
echo.
echo     - Upload this zip to itch.io as an HTML project.
echo     - Install Python from python.org, then run this file again.
echo.
pause
