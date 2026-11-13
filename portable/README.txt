WCA Stage - portable
====================

Start
  Windows: double-click start.bat
  Linux:   sh start.sh

The app opens in its own browser window. Close the window "WCA Stage server"
(Windows) or the browser window (Linux) to stop it.

TV screens
  Any smart TV, phone or laptop on the same Wi-Fi can show the projector.
  Press "TV screens" on the control screen. It shows the address to type in
  the TV's browser (for example 192.168.1.23:5173) and what to check if the
  TV cannot connect. On Windows, allow Node.js when the firewall asks.
  TV screens can only watch. They cannot change anything.

Folders
  data\      app data (schedule log, incidents, announcements, saved competitions)
             and the browser profile. Copy the whole folder to move or back up.
  reports\   reports written automatically while the app runs:
             reports\<competition>\schedule-log.csv   planned vs actual start times
             reports\<competition>\incidents.md       incidents
  app\       the app itself
  server\    small local server (plain Node.js)
  node\      bundled Node.js for Windows and Linux

Updating to a new version
  Unzip the new version into its own folder. Then copy the data\ folder from
  the old WCA-Stage folder into the new one, replacing the empty one. It holds
  your saved competitions, schedule logs, incidents and your WCA login.
  Close the old version first: only one copy can run at a time.

Notes
  - Public competition data works without login.
  - Press "Log in with WCA" to load the competitions you manage.
    If the app asks for a client ID instead, create an OAuth application at
    https://www.worldcubeassociation.org/oauth/applications/new
    with redirect URI http://localhost:5173/auth/callback and scopes
    "public manage_competitions", then paste its UID.
  - Linux works best with Chromium (sudo apt install chromium).
  - Close the app before unplugging a USB stick.
