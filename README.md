# Ascent

A personal roadmap app: money, investing, career and life goals in one place.
Live at https://mhdsyz1.github.io/ascent/

- `index.html`, `style.css`, `app.js`, `sw.js`: the site (`app.js` is built from `src/app.jsx`)
- `manifest.webmanifest`, `icon-*.png`, `ascent-*.jpg`: install icon and images
- `.github/workflows/keep-awake.yml`: pings the database every few days so it never pauses

The database key in the code is the publishable key, which is meant to be public.
All data is protected by sign-in and row level security.
Database scripts are kept offline on purpose.
