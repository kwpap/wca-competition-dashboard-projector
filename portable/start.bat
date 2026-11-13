@echo off
rem Starts WCA Stage from this folder. All data stays in data\ and reports\.
setlocal
cd /d "%~dp0"

set "URL=http://localhost:5173"
set "LOG=%~dp0data\server.log"

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

rem Files unzipped from a download carry a "from the internet" mark.
rem Windows may then hold node.exe behind a hidden "Do you want to run this file?" prompt.
rem Emptying the mark clears it. On FAT32 USB sticks there is no mark, and the line just fails quietly.
echo Preparing WCA Stage...
if exist "%~dp0node\win\node.exe" (type nul > "%~dp0node\win\node.exe:Zone.Identifier") 2>nul

rem curl ships with Windows 10 (1803) and newer.
set "HAVE_CURL=1"
curl --version >nul 2>&1
if errorlevel 1 set "HAVE_CURL="
if not defined HAVE_CURL goto start_server

rem A copy that already runs: this version answers /api/screens, older versions do not.
curl -s -o nul "%URL%/"
if errorlevel 1 goto start_server
curl -s -f -o nul "%URL%/api/screens"
if not errorlevel 1 goto open
echo An older version of WCA Stage is still running.
echo Close its "WCA Stage server" window, then run start.bat again.
pause
exit /b 1

:start_server
echo Starting WCA Stage...
start "WCA Stage server" /min "%NODE%" "%~dp0server\server.mjs"

rem The first start can take several seconds: Windows scans the new node.exe and may ask about the firewall.
if not defined HAVE_CURL (
  timeout /t 5 /nobreak >nul
  goto open
)

set /a TRIES=0
:wait
curl -s -o nul "%URL%/api/screens"
if not errorlevel 1 goto open
set /a TRIES+=1
if %TRIES% geq 45 goto failed
timeout /t 1 /nobreak >nul
goto wait

:failed
echo.
echo WCA Stage did not start. This is what the server reported:
echo ----------------------------------------------------------
if exist "%LOG%" (type "%LOG%") else (echo No log was written: Windows probably blocked node.exe.)
echo ----------------------------------------------------------
echo Look for a "WCA Stage server" window or a Windows security prompt on the taskbar.
echo Send a photo of this window and of data\server.log to get help.
pause
exit /b 1

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
