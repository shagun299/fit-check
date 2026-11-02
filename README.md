# FitCheck

A local-first personal gym, nutrition and body-recomposition tracker built with HTML, CSS and vanilla JavaScript.

## Features

- Daily dashboard for calories, protein, carbs, fat, water and weekly consistency.
- Food library with common Indian foods and estimated per-serving macros.
- Custom foods, saved meal presets, meal diary and a simple future meal planner.
- Workout routine builder with five exercise options for chest, back, shoulders, biceps, triceps, legs and core.
- Individual working-set logging with reps and weight per set.
- Built-in 60, 90 and 120-second rest timer.
- Private compressed progress photo check-ins stored in this browser.
- Previous-session comparison, heaviest recorded set by exercise, personal records and workout calendar.
- Editable workout history and reusable routines.
- Weigh-ins, body measurements, private progress photo check-ins, weight chart and weekly insights.
- Daily, weekday and one-time reminders with browser notifications while FitCheck is open.
- Dark and light themes.
- Responsive phone, tablet and desktop layouts.
- JSON export/import backup and a basic offline app shell.

## Run locally

Open `index.html` in a browser. For install/offline features and notifications, use a local static server or publish with GitHub Pages.

## Publish with GitHub Pages

1. Open this repository.
2. Go to **Settings → Pages**.
3. Under Build and deployment, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**, then save.
5. Open https://shagun299.github.io/fit-check/ after the deployment finishes.

## Privacy and data

The source code is public because the repository is public. Your meals, workouts, routines, reminders and measurements are stored in local browser storage and are not committed to GitHub.

- Data does not automatically sync between devices or browsers.
- Export a JSON backup before switching browsers or clearing site data.
- Food library values are estimates per serving. Check package labels or a reliable nutrition source for accuracy.
- Browser reminder checks work while FitCheck is open. This static version cannot send scheduled alerts with the browser completely closed.
- Calorie, macro and hydration targets are editable placeholders, not individualized medical advice.

## Project files

- `index.html` – app structure
- `style.css` – responsive theme and layout
- `app.js` – workouts, nutrition, reminders, analytics and local storage
- `manifest.webmanifest` – installable app metadata
- `sw.js` – offline app-shell caching
- `icon.svg` – app icon
