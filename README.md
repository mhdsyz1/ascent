# Ascent

Muhammad Syazwan's roadmap app: debts, savings, streaks and milestones.
Live at https://mhdsyz1.github.io/ascent/ once GitHub Pages is on.

- `index.html`, `style.css`, `app.js`: the site (app.js is built from `src/app.jsx`)
- `supabase-setup.sql`: one-time database setup, run in the Supabase SQL Editor
- `.github/workflows/keep-awake.yml`: pings Supabase every 3 days so the free project never pauses

The Supabase key in the code is the publishable key. It is meant to be public;
your data is protected by login plus row level security.
