# FitCheck

A responsive, personal-first gym and nutrition tracker built with HTML, CSS and vanilla JavaScript.

## Features

- Dashboard with visual food photography and 20 rotating training / nutrition notes.
- Google sign-in and a private per-user cloud data model (Firebase setup required once).
- Cross-device syncing for profile, meals, workouts, water, weight, reminders, routines, measurements and progress photos.
- First-login migration: existing local records are merged into the signed-in account rather than silently discarded.
- 61 Indian and everyday foods with estimated calories, protein, carbs, fat, fibre and selected vitamins/minerals.
- Food selection pre-fills the nutrition form; quantity scales both macros and listed micronutrients.
- Food diary entries can be removed. Water intake can be reduced by one 250 ml glass or reset for the day.
- Custom foods, saved meal presets and a future meal planner.
- Workout routine builder with five exercise options for chest, back, shoulders, biceps, triceps, legs and core.
- Set-by-set workout logging, previous-session comparison, personal records and a calendar.
- Built-in 60, 90 and 120-second rest timer.
- Weigh-ins, body measurements, progress photos and weight trend.
- Dark and light themes, responsive phone/tablet/desktop layouts.
- JSON export/import backup.

## Run and publish

The app is static. Open `index.html` through a local static server or publish the repository with GitHub Pages.

For GitHub Pages: repository **Settings → Pages → Deploy from a branch → main → /(root)**. The expected URL is https://shagun299.github.io/fit-check/.

## One-time Google + cloud setup

The Google sign-in and cloud-sync code is in the repository, but it will remain in local-only mode until you connect a Firebase project. Firebase configuration values are public web-app identifiers, not passwords or service-account secrets.

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. In Project Overview, add a **Web app** and copy its Firebase config.
3. Open `firebase-config.js` in this repository and replace the placeholder values with the values from your Firebase Web app config. Keep the field names unchanged.
4. In **Authentication → Sign-in method**, enable **Google**.
5. In **Authentication → Settings → Authorized domains**, add `shagun299.github.io` (and your local development hostname if testing locally).
6. In **Firestore Database**, create a database. Keep production/locked rules.
7. In **Storage**, create the default bucket if you want progress-photo syncing.
8. From a terminal with the Firebase CLI installed, run:
   ```bash
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage
   ```
   Select the same Firebase project when the CLI asks.
9. Wait for the GitHub Pages deployment, refresh FitCheck and choose **Connect Google**. Use the same Google account on every device.

The `firestore.rules` and `storage.rules` files restrict each account to its own UID folder. Do not replace them with public read/write rules.

### Important Storage billing note

Firebase Authentication and Firestore can be used within their applicable no-cost quotas. Firebase Cloud Storage now requires the pay-as-you-go **Blaze** plan to provision/use a Storage bucket. It has no-cost usage allowances but can bill for usage beyond the free allowance, so configure budget alerts and do not enable photo cloud sync unless you are comfortable linking a billing account. This requirement is documented by Firebase and took effect for all projects on February 3, 2026.

## Privacy and data

- Your Google account's UID determines its private Firestore path: `users/{uid}/fitcheck/main`.
- Firestore and Storage rules allow a signed-in user to access only their own records and progress-photo folder.
- Existing local data is merged on first login. If another Google account was previously used on the same browser, FitCheck avoids mixing that account's local state into the new account.
- Until Firebase is configured, records are stored only in that browser. They will not sync across devices yet.
- Export a JSON backup before clearing browser data or switching accounts.
- Food values are rounded estimates for the shown serving. Brands, portion size and preparation method affect actual nutrition; check packaging where applicable.
- FitCheck is a personal tracking tool, not medical advice. Targets are editable starting points, not individual prescriptions.
- Browser reminders run while FitCheck is open; this static version cannot deliver recurring reminders while the browser is fully closed.

## Project files

- `index.html` – app structure and navigation
- `style.css` – responsive theme, typography and layout
- `app.js` – workouts, nutrition, reminders, analytics and local storage
- `food-data.js` – starter Indian food nutrition library
- `firebase-config.js` – Firebase Web app configuration placeholders
- `cloud-sync.js` – Google sign-in, private Firestore sync and optional photo uploads
- `firestore.rules`, `storage.rules`, `firebase.json` – account-level security and deployment config
- `sw.js` – offline app-shell caching
- `manifest.webmanifest`, `icon.svg` – installable app metadata and icon
