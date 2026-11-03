WCA Stage - portable
====================

Start
  Windows: double-click start.bat
  Linux:   sh start.sh

The app opens in its own browser window. Close the window "WCA Stage server"
(Windows) or the browser window (Linux) to stop it.

Folders
  data\      app data (schedule log, incidents, announcements, saved competitions)
             and the browser profile. Copy the whole folder to move or back up.
  reports\   reports written automatically while the app runs:
             reports\<competition>\schedule-log.csv   planned vs actual start times
             reports\<competition>\incidents.md       incidents
  app\       the app itself
  server\    small local server (plain Node.js)
  node\      bundled Node.js for Windows and Linux

Notes
  - The app uses http://localhost:5173. This must match the redirect URI of the
    WCA OAuth application: http://localhost:5173/auth/callback
  - Linux works best with Chromium (sudo apt install chromium).
  - Close the app before unplugging a USB stick.
