@echo off
rem Starts WCA Stage from this folder. All data stays in data\ and reports\.
setlocal
cd /d "%~dp0"

set "NODE=%~dp0node\win\node.exe"
if not exist "%NODE%" set "NODE=node"

start "WCA Stage server" /min "%NODE%" "%~dp0server\server.mjs"
timeout /t 1 /nobreak >nul

set "URL=http://localhost:5173"
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
