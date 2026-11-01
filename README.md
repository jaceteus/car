# Rally Rush

A dependency-free, retro top-down racing game in HTML, CSS and JavaScript. It is inspired by the slippery, arcade feel of classic DOS racers like *Slicks 'n' Slide*, and includes a full car garage plus an open airfield for free testing.

## Play online

GitHub Pages: <https://jaceteus.github.io/car/>

## Start the game (Windows)

Double-click **`start-game.bat`**.

The script starts a tiny PowerShell local web server and opens the game in your default browser. A minimised server window stays open while you play; close it when you are done. No Python, Node.js or other runtime is required — Windows PowerShell is enough.

If you prefer, you can also open `index.html` directly. The game is fully offline, with no external assets or dependencies.

Or start the server manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1
```

Then open <http://127.0.0.1:8123/>.

## Deploying updates

GitHub Pages is configured to publish from the `main` branch.

Double-click **`deploy.bat`** (or run `deploy.ps1`) to publish the current files. The script creates a commit through the GitHub API, so local Git is not required. It asks for a GitHub token with **Contents: Read and write** permission, or uses the `GITHUB_TOKEN` environment variable when present.

The token is used only for that run and is never written to the repository. GitHub Pages rebuilds automatically after the commit.

## Controls

| Action | Keys |
| --- | --- |
| Throttle | `W` / `Up` |
| Brake / reverse | `S` / `Down` |
| Steer | `A` `D` / `Left` `Right` |
| Handbrake | `Space` |
| Reset car / return to spawn | `R` |
| Pause | `Esc` |
| Mute | `M` |
| Confirm / race again | `Enter` |

## Features

- Five hand-built circuits: Pine Valley, Sunburn Strip, Dockside, Midnight Run and Sidewinder.
- **Garage:** choose a Formula, Rally, Supra MK4 or Lamborghini, then paint it with a preset colour or your own custom colour. Each car has different speed, grip and off-road behaviour, with stat bars shown in the garage.
- **Test Airfield:** a large open runway/apron facility with no rivals, no laps and no racing line. It includes a skid pad, parked aircraft and live telemetry for top speed, drift angle and surface.
- Retro top-down pixel-style presentation, rendered entirely in Canvas, with distinct bodywork for every car type.
- Slippery drift handling with a handbrake, tyre marks, dust and collision sparks.
- Three AI rivals with selectable Rookie, Pro and Ace skill levels.
- Two-, three- or five-lap races, lap timing, live standings and persistent track records.
- Procedural engine audio, tyre squeal and race beeps using the Web Audio API.
- Car choice, paint, settings and local records are saved in `localStorage`.
- No build step and no third-party libraries.

## Project layout

```text
.
├── index.html       # Game shell and menus
├── style.css        # Retro UI and responsive layout
├── game.js          # Physics, AI, track art, audio and game flow
├── server.ps1       # Tiny local static web server
├── start-game.bat   # Windows launcher
└── README.md
```

## Notes

- The game is tuned for a desktop browser with a keyboard. It also scales down for smaller screens.
- If your browser blocks `localStorage` (for example in a strict private mode), the game still works but records will not persist.
- Modern Chrome, Edge or Firefox is recommended.
