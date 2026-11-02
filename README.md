# FitCheck

A personal gym, nutrition and progress tracker built with plain HTML, CSS and JavaScript.

## Features

- Daily dashboard for calories, protein, carbs, fat and water.
- Food diary with meal type, time and macro values.
- Workout log with muscle focus, session duration, exercises, sets, reps and load.
- Weigh-in history and a simple weight-trend chart.
- Editable profile and daily targets.
- JSON export/import so you can back up or move your records.
- Responsive layout and basic offline app-shell caching.

## Run locally

Open `index.html` in a browser. For install/offline features, use a local static server or publish with GitHub Pages.

## Publish with GitHub Pages

1. Open this repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**, then save.
5. After GitHub finishes publishing, open:

   https://shagun299.github.io/fit-check/

The site code is public because the repository is public. Your personal entries are **not** written to GitHub: meals, workouts, weigh-ins and settings are stored in local browser storage on the device/browser you use.

## Important data note

- Data does not automatically sync between devices or browsers.
- Export a JSON backup from **Settings → Your data** before clearing browser storage or switching devices.
- Import that backup on another browser to restore it.
- Clearing browser/site data may erase the locally stored records.
- Calorie, macro and water targets are editable starter values, not medical or individualized recommendations.

## Project files

- `index.html` – app structure
- `style.css` – responsive visual design
- `app.js` – tracking, calculations and local storage
- `manifest.webmanifest` – installable app metadata
- `sw.js` – app-shell cache for offline launch
