@echo off
rem Starts WCA Stage from this folder. All data stays in data\ and reports\.
setlocal
cd /d "%~dp0"

set "URL=http://localhost:5173"

rem Double-clicking start.bat inside the zip runs it from a temp folder without the rest of the app.
if not exist "%~dp0server\server.mjs" (
  echo WCA Stage cannot start: the app files are not next to start.bat.
  echo Unzip the whole folder first: right-click the zip, choose "Extract All", then run start.bat there.
  pause
  exit /b 1
)

set "NODE=%~dp0node\win\node.exe"
if not exist "%NODE%" set "NODE=node"
if "%NODE%"=="node" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo WCA Stage cannot start: node\win\node.exe is missing and Node.js is not installed.
    pause
    exit /b 1
  )
)

echo Starting WCA Stage...
start "WCA Stage server" /min "%NODE%" "%~dp0server\server.mjs"

rem The first start can take several seconds: Windows scans the new node.exe and may ask about the firewall.
rem Opening the browser too early shows "This site can't be reached".
where curl >nul 2>&1
if errorlevel 1 (
  timeout /t 5 /nobreak >nul
  goto open
)
set /a TRIES=0
:wait
curl -s -o nul "%URL%/api/screens" && goto open
set /a TRIES+=1
if %TRIES% geq 30 (
  echo The server did not answer within 30 seconds. Check the "WCA Stage server" window for an error.
  pause
  goto open
)
timeout /t 1 /nobreak >nul
goto wait

:open
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --user-data-dir="%~dp0data\browser-windows" --app=%URL% --no-first-run
) else if exist "%CHROME%" (
  start "" "%CHROME%" --user-data-dir="%~dp0data\browser-windows" --app=%URL% --no-first-run
) else (
  start "" %URL%
)
