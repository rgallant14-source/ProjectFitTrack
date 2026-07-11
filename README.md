# FitTrack

A fitness/training tracking PWA for teen athletes, coaches, and clubs. Plain HTML/CSS/JS — no build step, no framework, no dependencies to install.

## Running locally

Browsers block ES modules and service workers on `file://`, so this needs to be served over `http://`, even just locally:

```bash
python3 -m http.server 8000
```

or

```bash
npx serve .
```

Then open `http://localhost:8000`.

## Project structure

```
index.html            App shell, tab bar
manifest.json          PWA install metadata
service-worker.js       Offline caching (bump CACHE_NAME when you change files)
css/styles.css          All styling (design tokens at the top)
js/
  app.js                Router / bootstrap
  store.js               Central state (the "ViewModel" layer) + persistence
  models.js               Data shape factory functions
  mockData.js              Seeded demo data (orgs, roster, workouts, practices)
  dailyContent.js           Dashboard's rotating equipment/quote/highlight content
  notifications.js          Web Notifications wrapper
  components/               Small shared UI helpers (dom.js, icons.js)
  views/                    One file per screen
```

## Current state / known limitations

- **No backend.** All data lives in the browser's `localStorage`. Two people on two different devices won't see each other's data yet (messaging, clips, workouts, etc. only sync within the same browser).
- **Practice schedule is simulated.** There's no live PlayMetrics/TeamSnap integration — see the note in `mockData.js` above `seedPractices()`.
- **Daily "Top Play" highlight is a placeholder rotation**, not a live feed — see `HIGHLIGHTS` in `js/dailyContent.js`. Swap in real video IDs before shipping.
- Login is mocked (`store.js` → `logIn()`), not real auth.

## Suggested next step

Once the feature set feels stable, the natural next step is a real backend (Firebase/Supabase are both reasonable choices) to replace the localStorage layer — see `store.js` for where each piece of state currently lives, since that's roughly the shape the backend/API would need to mirror.
