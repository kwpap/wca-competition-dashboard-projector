# WCA Stage

WCA Stage runs the schedule of a WCA speedcubing competition from a touch screen and shows it on a projector. It is built for the stage manager: one tap when a group starts, and the app keeps the delay, the people and the projector up to date.

It works offline once a competition is loaded. It also runs as a portable folder from a USB stick on Windows and Linux, with nothing to install.

## Download

Get the latest portable app from **[Releases](https://github.com/kwpap/wca-competition-dashboard-projector/releases/latest)**:

1. Download `WCA-Stage-<version>.zip` and unzip it, for example onto a USB stick.
2. Windows: double-click `start.bat`. Linux: run `sh start.sh`.

Node.js is included. No install, no build.

## Contents

- [Download](#download)
- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start for development](#quick-start-for-development)
- [WCA login setup (OAuth)](#wca-login-setup-oauth)
- [Using the app at a competition](#using-the-app-at-a-competition)
- [Building for production](#building-for-production)
- [Portable app](#portable-app)
- [Building everything from scratch](#building-everything-from-scratch)
- [Testing](#testing)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Translations](#translations)
- [Troubleshooting](#troubleshooting)
- [Privacy and security](#privacy-and-security)
- [License](#license)

## Features

**Control screen (touch friendly)**

- "Proceed now" starts the next group. The app records the actual start time and shows the delay.
- −5, −1, +1 and +5 buttons fix the start time when you pressed late. "Undo" removes the last start.
- "Stop for today" ends the day. The next "Proceed now" clears it.
- Each group shows its competitors, judges, scramblers and runners from the WCIF assignments. Tap a person to see personal bests, assignments and results.
- A "Previous round" column shows who advanced and who just missed.
- The current group card has a time bar along its top edge, split into one segment per attempt plus one.
- The next group shows its planned time and its expected or actual start time.
- "Need for" calls judges, runners or scramblers to the stage. "Names" calls specific people, starting with the ones Groupifier assigned. "Specify" asks people to contact the Delegates.
- Incidents with @-mentions of people, events, rounds and groups. They export as Markdown.
- A schedule log of planned and actual start times. It exports as CSV.
- Projector announcements: your own messages, quiet templates and automatic record announcements (world, continental and national).
- Options: languages, projector timings, countdown length, festive style, time bar, noise meter and how many "just missed" people to show.
- **PDF reports** from Options: schedule adherence (planned vs. actual per day), the incident log, and all records and personal records with their attempt times.

**Projector window**

- The current group with its time limit, cutoff and advancement rule, plus a time bar.
- The next group and its time.
- World, continental and national records for the current event.
- "Estimated time to advance" for rounds that have a next round. Round 1 uses personal bests. Later rounds use each competitor's first-round result. Both assume a 2% improvement.
- A results carousel from WCA Live. New results come first, then today's rounds, then other days. Each event shows only its latest round. During lunch, breaks and other activities without an event, the results fill the screen and show every attempt.
- A bottom banner that rotates announcements, a "get ready" notice and record announcements.
- Staff calls that flash over the screen.
- An optional noise meter. It shows "Please keep quiet!" when the room stays louder than its usual level.
- A **countdown** before each day: "Starting in HH:MM:SS" until the first activity. It is a "Countdown" activity in the schedule, 15 minutes long by default.
- An end-of-day screen with the next day's first activity.
- A **competition finale** after the last activity. It is a full-screen carousel of:
  - the podium of every final,
  - the new world, continental and national records, with fireworks,
  - the competition in numbers (competitors, countries, newcomers, solves, hours of solving, PRs),
  - highlights (fastest 3x3 single and average, best newcomer, most PRs),
  - a thank-you to the organizers, Delegates and volunteers.
- The countdown and the finale have a plain, light look by default. Turn on **Festive style** in Options for a dark theme with glows, confetti and fireworks.

**Languages**: English and Greek. The control screen and the projector can use different languages.

## How it works

- The app is a React single-page app. It loads the competition from the WCA API as WCIF (WCA Competition Interchange Format) and results from [WCA Live](https://live.worldcubeassociation.org).
- All state lives in the browser's `localStorage`. The control and projector windows sync through it, so they must run in the same browser profile on the same PC.
- A small local Node.js server also saves the state as JSON files in `data/state/`, and writes reports to `reports/<competition>/`. The dev server and the portable app both include it.
- Without the local server (for example on a static web host) the app still works, but only in that browser.
- Scrambles are removed from the WCIF before anything is saved. They never reach the screen or the disk.

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.19+ or 22.12+ (24 recommended) | Vite 8 needs it. npm comes with Node. |
| Browser | Chrome, Edge or Chromium | The portable launchers open one of these in app mode. |
| Internet | For setup, loading a competition and live results | The app runs offline once the competition is loaded. |
| WCA OAuth app | Optional | Only needed to log in and load your own competitions. Public data works without it. |

## Quick start for development

```bash
git clone https://github.com/kwpap/wca-competition-dashboard-projector.git
cd wca-competition-dashboard-projector
npm ci
npm run dev
```

Open <http://localhost:5173>.

No WCA login is needed to try the app. Type a competition ID in the "open a competition from public WCA data" field on the start page, for example `SalonicaAutumnOpen2026`, and press **Open**.

To log in with a WCA account, set up OAuth first (next section).

### npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server with hot reload and the local API on port 5173. |
| `npm run typecheck` | Type-checks the whole project. It emits no files. |
| `npm run build` | Type-checks, then builds the app into `dist/`. |
| `npm run preview` | Serves `dist/` for a quick look. It has no local API, so nothing gets saved to `data/`. |
| `npm run portable` | Builds the app, then creates the portable folder `release/WCA-Stage/`. |

## WCA login setup (OAuth)

You need this only to load competitions you manage, including the private WCIF. Public data works without it.

1. Sign in at <https://www.worldcubeassociation.org> and create an OAuth application at <https://www.worldcubeassociation.org/oauth/applications/new>.
2. Set:
   - **Redirect URI**: `http://localhost:5173/auth/callback`
   - **Scopes**: `public manage_competitions`
3. Give the app the application's UID, in one of two ways:
   - **On the login page**: paste the UID into the client ID field. The app keeps it in the browser. This is the way for the downloaded portable app.
   - **At build time**: copy `.env.example` to `.env.local`, set `VITE_WCA_CLIENT_ID`, and restart `npm run dev` or rebuild. A built-in ID hides the field.

For testing against the WCA staging site, set `VITE_WCA_ORIGIN=https://staging.worldcubeassociation.org` and register the OAuth application there.

Released builds contain no client ID. Each organizer uses their own WCA application. Port 5173 must stay fixed because it is part of the redirect URI.

## Using the app at a competition

1. **Before the competition** (with internet): open the app, log in or type the competition ID, and open the competition. The WCIF and the records are now saved on this PC.
2. Generate group assignments first (Groupifier, Delegate Dashboard or AGE). Press **Refresh from WCA** on the control screen after any change on the WCA website.
3. **On the day**: choose the room if the venue has more than one. Press **Open projector**, drag that window to the projector and press **F11** for full screen.
4. **Each morning**: the first activity of the day is "Countdown". Press **Proceed now** to start it, and the projector counts down to the first real activity. The delay stays at 0 while it runs. Change its length in Options under "Countdown before each day".
5. Press **Proceed now** each time a group starts. If you pressed late, use −5, −1, +1 or +5.
6. Browse groups with the arrow keys or a swipe. Use Ctrl+arrows to jump between events. "Back to now" returns to the running group.
7. Press **Stop for today** after the last group of the day.
8. **End of the competition**: the app adds a "Competition finale" activity after the last activity of every room. Press **Proceed now** to start it, and the projector switches to the finale. "Stop for today" on the last day shows the finale too.
9. **Noise meter** (optional): turn it on in Options. Allow the microphone in the projector window. If the browser blocks audio, click once inside the projector window. Alerts start after a 2-minute warm-up while it learns the room level.

Reports update automatically while you work:

- `reports/<competition>/schedule-log.csv`: planned and actual start times.
- `reports/<competition>/incidents.md`: incidents.

Press **Generate PDF reports** in Options for printable reports, for example after the competition. The browser downloads three files, and the local server also saves them to `reports/<competition>/`:

- `schedule-adherence.pdf`: one page per day with a summary (activities started, first and last start, average difference, largest delay, on-time share) and a table of planned and actual starts and lengths.
- `incidents.pdf`: every incident with its time, the running activity and its references.
- `records.pdf`: world, continental and national records, then every personal record, with all attempts. In averages of 5, the best and worst attempts are in parentheses. Record tags come from WCA Live.

## Building for production

```bash
npm run build
```

This type-checks the code and writes a static build to `dist/`. You can host `dist/` on any static web server. Configure the server to return `index.html` for unknown paths, because the app uses client-side routes such as `/control/<id>`.

A static host has no local API. The app then keeps its data only in the browser, and reports are not written to disk. For competitions, use the portable app instead.

## Portable app

The portable app is a folder that holds the built app, the local server and Node.js for Windows and Linux (x64). Copy it to a USB stick or any PC. Nothing needs installing.

### Build it

```bash
npm run portable
```

The result is `release/WCA-Stage/`:

```
WCA-Stage/
  start.bat        Windows launcher
  start.sh         Linux launcher
  README.txt       Short guide for users
  app/             The built app (from dist/)
  server/          server.mjs and api.mjs (plain Node.js, no dependencies)
  node/win/        node.exe for Windows
  node/linux/bin/  node for Linux
  data/            App data and the browser profile (created on first run)
  reports/         Reports (created on first run)
```

Notes:

- The script bundles the **same Node.js version that runs the build**. It downloads the Windows and Linux binaries from nodejs.org on the first build and caches them in `.cache/node/`. Later builds work offline.
- Rebuilding replaces the app, server, Node and launchers, and **keeps `data/` and `reports/`**. You can update an existing release folder in place.
- To skip bundling Node (smaller folder, but the target PC must have Node 18+):
  ```bash
  npm run build
  node scripts/build-portable.mjs --no-node
  ```
- You can build on Windows or Linux. Extracting the Linux binary uses `tar`, which ships with Windows 10 and newer.

### Publish a release

A GitHub Action (`.github/workflows/release.yml`) builds the portable folder, zips it and publishes it on the [Releases](https://github.com/kwpap/wca-competition-dashboard-projector/releases) page. Start it by pushing a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Or open **Actions → Release portable app → Run workflow** and type a tag.

Releases contain no WCA OAuth client ID. Each user pastes the UID of their own WCA application on the login page.

### Run it

- **Windows**: double-click `start.bat`. It starts the server in a minimized window and opens the app in Edge or Chrome app mode. Close the "WCA Stage server" window to stop.
- **Linux (Debian 10 or newer)**: run `sh start.sh`. It works best with Chromium (`sudo apt install chromium`). Closing the browser window stops the server.
- The app runs at <http://localhost:5173> and listens on 127.0.0.1 only.
- The launchers use their own browser profile in `data/`, so the app keeps its state even if the PC's normal browser is cleared.

### Move or back up a competition

Copy the whole `data/` folder. It holds the saved competition, the log, incidents, announcements and settings. Close the app before you unplug a USB stick.

## Building everything from scratch

These steps take a fresh PC to a working portable folder.

### Windows 10 or 11

1. Install Node.js 24 LTS from <https://nodejs.org> (the "Windows Installer"). Keep the default options.
2. Open a new PowerShell window and check:
   ```powershell
   node -v
   npm -v
   ```
3. Get the code:
   ```powershell
   git clone https://github.com/kwpap/wca-competition-dashboard-projector.git
   cd wca-competition-dashboard-projector
   ```
4. In the project folder:
   ```powershell
   npm install
   copy .env.example .env.local
   notepad .env.local
   ```
   Set `VITE_WCA_CLIENT_ID`, or leave it empty to use public data only.
5. Check the code and build:
   ```powershell
   npm run typecheck
   npm run build
   npm run portable
   ```
6. Test the result: double-click `release\WCA-Stage\start.bat`.

### Debian or Ubuntu

The `nodejs` package in Debian 12 is version 18, which is too old for Vite 8. Install a newer Node first, for example with [NodeSource](https://github.com/nodesource/distributions):

```bash
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

Or use [nvm](https://github.com/nvm-sh/nvm) without root: `nvm install 24`.

Then build:

```bash
sudo apt install -y git
git clone https://github.com/kwpap/wca-competition-dashboard-projector.git
cd wca-competition-dashboard-projector
npm install
cp .env.example .env.local
nano .env.local          # set VITE_WCA_CLIENT_ID, or leave it empty
npm run typecheck
npm run build
npm run portable
sh release/WCA-Stage/start.sh
```

### What each step produces

| Step | Output |
| --- | --- |
| `npm install` | `node_modules/` |
| `npm run typecheck` | Nothing (it reports errors only) |
| `npm run build` | `dist/` (static app) |
| `npm run portable` | `release/WCA-Stage/` (portable folder) and `.cache/node/` (downloaded Node binaries) |
| Running the app | `data/state/*.json` and `reports/<competition>/` |

### What goes into git

Only source code and docs are in the repository. Everything else is built or created on each machine:

| Folder or file | In git | Where it comes from |
| --- | --- | --- |
| `src/`, `server/`, `scripts/`, `portable/`, config files | yes | Source code |
| `package-lock.json` | yes | Pins exact dependency versions. Install with `npm ci`. |
| `.env.example` | yes | Template for `.env.local` |
| `.env.local` | **no** | Your WCA OAuth client ID |
| `node_modules/` | **no** | `npm ci` |
| `dist/` | **no** | `npm run build` |
| `release/`, `.cache/` | **no** | `npm run portable`. Share the portable folder as a zip on a GitHub release, not in the repository. |
| `data/`, `reports/` | **no** | Created while the app runs. `release/WCA-Stage/data/` also holds a browser profile with your WCA login. Never share it. |

## Testing

The repository has no automated test suite yet. Use the checks below before every release.

### 1. Type check

```bash
npm run typecheck
```

TypeScript runs in strict mode with unused-variable checks. The check must finish with no errors.

### 2. Translation keys

Both language files must have the same keys. Run this from the project root:

```bash
node -e "const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const r=n=>new Set(f(require('./src/i18n/'+n+'.json')));const en=r('en'),el=r('el');console.log('en',en.size,'el',el.size,'missing in el',[...en].filter(k=>!el.has(k)),'missing in en',[...el].filter(k=>!en.has(k)))"
```

Both "missing" lists must be empty.

### 3. Build

```bash
npm run build
```

### 4. Manual test in the browser

Start `npm run dev` and open a competition from public data. Check both screens in **English and Greek** (Options, then Language). Greek texts are longer, so test widths of 1280, 1366 and 1920 px.

Control screen:

- "Proceed now", the −5/+5 adjustments, "Undo" and "Stop for today".
- The delay badge, the time bar on the current card and the planned and expected times on the next card.
- Browsing with arrow keys and Ctrl+arrows.
- "Need for": role buttons, "Names" (assigned people start selected) and "Specify".
- Incidents with @-mentions, the log and its CSV export.
- Announcements: custom messages, templates and records.
- Options: "Generate PDF reports" downloads three PDFs and saves them to `reports/<competition>/`. Open them and check the Greek text too.

Projector:

- The current and next group, the time bar segments, records and the advancement estimate.
- The results carousel (one round per event), the banner rotation and staff calls.
- The countdown: start the "Countdown" activity of a day and check the "Starting in" clock.
- The end-of-day screen after "Stop for today".
- The finale: start it from the last activity and watch every slide type (podium, records, numbers, highlights, thanks).
- The control and projector windows stay in sync.

### 5. Browser automation (optional)

Scripted checks work well with [puppeteer-core](https://pptr.dev) and an installed Chrome:

```bash
npm install --no-save puppeteer-core
```

```js
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/open/SalonicaAutumnOpen2026');
await page.waitForSelector('.slot-card');
await page.screenshot({ path: 'control.png' });
await browser.close();
```

Tips:

- Under `npm run dev`, a page can import pure modules directly to test logic:
  ```js
  const code = await page.evaluate(async () => {
    const { parseActivityCode } = await import('/src/model/activityCode.ts');
    return parseActivityCode('333-r1-g2');
  });
  console.log(code); // { eventId: '333', roundNumber: 1, groupNumber: 2, ... }
  ```
- Test the noise meter with Chrome's fake microphone. Use a WAV file with a quiet part and a loud part:
  ```
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream
  --use-file-for-fake-audio-capture=<file.wav> --autoplay-policy=no-user-gesture-required
  ```
- Tests write to the real `data/state/` and `reports/` folders. Delete the files they create afterwards.

### 6. Portable smoke test

1. Run `npm run portable`.
2. Start `release/WCA-Stage/start.bat` (Windows) or `sh release/WCA-Stage/start.sh` (Linux).
3. Open a competition, press "Proceed now" and add an incident.
4. Check that `release/WCA-Stage/data/state/` and `release/WCA-Stage/reports/<competition>/` now hold files.
5. Close the app, start it again, and check that the state is still there.
6. Delete `release/WCA-Stage/data/` and `reports/` contents before you hand the folder out.

To run the portable server while the dev server uses port 5173, set another port: `PORT=5174` (Linux) or `$env:PORT=5174` (PowerShell). OAuth login only works on 5173.

## Configuration

### Environment variables (`.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_WCA_CLIENT_ID` | empty | UID of your WCA OAuth application. When empty, the login page asks each user for their own. |
| `VITE_WCA_ORIGIN` | `https://www.worldcubeassociation.org` | WCA site for the API and login. Use the staging site for tests. |

Vite builds these values into the app. Rebuild after a change.

### Tuning constants (`src/config.ts`)

| Constant | Default | Purpose |
| --- | --- | --- |
| `RESULTS_POLL_MS` | 20 s | How often the control window polls WCA Live. |
| `GET_READY_MS` | 5 min | When the "get ready" notice appears before the next group. |
| `RESULTS_ROWS_PER_PAGE` | 13 | Rows per results page on the projector. |
| `RESULTS_ROWS_PER_PAGE_WIDE` | 11 | Rows per page when the results fill the screen during breaks. |
| `RESULTS_FADE_MS` | 0.5 s | Fade between result pages. |
| `RESULTS_FRESH_MS` | 90 s | How long a new result stays highlighted. |
| `RESULTS_PRIORITY_MS` | 10 min | A round with changes this recent gets high priority. |
| `LOW_PRIORITY_EVERY` | 4 | Every 4th normal pick shows a round from another day. |
| `FINALE_SLIDE_MS` | 10 s | How long each slide of the competition finale stays. |

Noise meter timings and the sensitivity levels sit at the top of `src/model/noiseDetector.ts`.

Users change everything else in the app's **Options** window.

## Project structure

```
src/
  main.tsx            Startup: loads saved state from the local server, then renders the app
  App.tsx             Routes: /, /competitions, /open/:id, /control/:id, /projector/:id
  config.ts           WCA URLs and tuning constants
  api/                WCA REST API, WCA Live GraphQL, OAuth login
  model/              Pure logic (schedule, people, advancement, estimates, noise, carousel order)
  pages/              The screens
  components/         UI parts
  hooks/              Clock tick, results polling, microphone, keyboard and swipe navigation
  state/              localStorage keys, synced storage hook, local server mirroring
  incidents/          Incident editor, mentions, Markdown export
  reports/            Schedule log CSV, automatic report saving, PDF reports (pdfmake)
  i18n/               en.json, el.json
  format/             Time and result formatting
  types/wcif.ts       WCIF types used by the app
server/
  api.mjs             Local API: saves state and reports (used by dev and portable)
  server.mjs          Portable server: serves the app and the API
scripts/
  build-portable.mjs  Assembles release/WCA-Stage
portable/             Launchers and README.txt copied into the portable folder
```

The local API has three routes:

| Route | Purpose |
| --- | --- |
| `GET /api/state` | Returns all saved state as `{ key: value }`. |
| `PUT /api/state/:key` | Saves one state value as `data/state/<key>.json` (`:` becomes `~`). |
| `PUT /api/reports/:competition/:file` | Saves a `.csv`, `.md` or `.pdf` report. |

## Translations

The texts live in `src/i18n/en.json` and `src/i18n/el.json`. Both files must have the same keys.

To add a language:

1. Copy `en.json` to `<code>.json` (for example `de.json`) and translate the values.
2. Import it in `src/i18n/index.ts`, and add it to `resources` and `LANGUAGES`.
3. Run the key check from the Testing section.

Event names, record texts and templates are translated when shown. A record announcement then appears in the projector's language even if the control screen uses another one.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Port 5173 is already in use` | Another copy of the app or the dev server is running. Close it. The port is fixed because of the OAuth redirect URI. |
| The login page asks for a client ID | Paste the UID of your WCA OAuth application (see [WCA login setup](#wca-login-setup-oauth)), or set `VITE_WCA_CLIENT_ID` in `.env.local` and rebuild. |
| Login fails or loops | The redirect URI of the OAuth app must be exactly `http://localhost:5173/auth/callback`. |
| "Your WCA session expired" on Refresh | Log in again. Competitions opened from public data cannot use "Refresh from WCA". Open them again from the start page instead. |
| "No assignments found" | Generate groups with Groupifier, Delegate Dashboard or AGE, then press "Refresh from WCA". |
| No results on the projector | The competition must exist on WCA Live under the same WCA ID. Otherwise the app falls back to results in the WCIF, which have no record tags. |
| Projector shows "Open this competition on the control screen first" | Both windows must run in the same browser profile. Open the projector with the "Open projector" button. |
| The noise meter does nothing | Turn it on in Options, allow the microphone, then click once in the projector window. Options shows the live level. |
| Only one PDF downloads | The browser asks once to allow multiple downloads. Allow it. The three files are in `reports/<competition>/` either way, when the local server runs. |
| The records PDF has no records | Record tags come from WCA Live. Competitions that WCA Live does not list have no tags. |
| Linux: `start.sh` cannot run Node from a USB stick | FAT32 and exFAT drop the executable flag. The launcher copies Node to `/tmp` for that case. Otherwise install Node with apt. |
| `npm run portable` fails to download Node | The first build needs internet access to nodejs.org. Later builds use `.cache/node/`. |

## Privacy and security

- **Scrambles are never stored or shown.** The app removes scramble sets from the WCIF right after download.
- The WCA login token stays in the browser's `localStorage` only. It never goes to `data/`.
- The local server listens on 127.0.0.1, so other PCs on the network cannot reach it.
- `data/` holds registrant names, WCA IDs and incidents. Treat it as personal data, and delete it after the competition if you do not need it.

## License

[MIT](LICENSE)
