@echo off
REM Double-click this to play. It serves this folder over http and opens your
REM browser.
REM
REM Opening index.html directly cannot work: browsers refuse `fetch` on a
REM file:// URL and the engine has to fetch a 37 MB runtime, so the page stops
REM on the loading screen. Anything that serves this folder over http fixes it;
REM this file just uses whatever is already on the machine, starting with
REM PowerShell, which is on every Windows install.

setlocal
cd /d "%~dp0"

where powershell >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :windows_powershell
where pwsh >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :powershell_7
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :python_launcher
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :python
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :node
goto :nothing_available

:windows_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-local.ps1"
goto :eof

:powershell_7
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-local.ps1"
goto :eof

:python_launcher
start "" http://localhost:8000/
py -3 -m http.server 8000
goto :eof

:python
start "" http://localhost:8000/
python -m http.server 8000
goto :eof

:node
start "" http://localhost:8000/
npx --yes http-server -p 8000 -c-1
goto :eof

:nothing_available
echo.
echo   Could not find PowerShell, Python or Node.js on this machine, which is
echo   unusual - Windows ships with PowerShell.
echo.
echo   The game needs this folder served over http. Any small web server will
echo   do. If you have Python, run:  python -m http.server 8000
echo   and open http://localhost:8000
echo.
pause
