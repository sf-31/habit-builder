# Fifteen

One 15-minute task a day. Ten deep breaths, then a timer that fills the screen.

## Editing tasks

Tasks live in `app/tasks.js` and run in order. A missed day doesn't skip anything: the next visit shows the same task. Progress is tracked by each task's `id`, so you can reorder or insert tasks freely. Add `early: true` to a task to show a **Done early** button.

## Run locally

```sh
cd app && python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

```sh
npm install
npx playwright install chromium   # first time only
npm test
```

The tests drive the real page in a headless browser and fail unless every line of `app/js/` and `app/tasks.js` runs. Open `coverage/index.html` after a run to see line-by-line coverage. On GitHub, the tests run before each deploy, and a failure stops the deploy.

## Deploying: test first, then main

1. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions** (one time).
2. Work on the `test` branch and push. The site rebuilds and the test build appears at `https://<user>.github.io/habit-builder/test/`.
3. When you're happy, merge `test` into `main` and push. The main site updates at `https://<user>.github.io/habit-builder/`.

The main site never links to `/test/`. The test build shows a "Test build" tag, isn't indexed by search engines, and stores its data separately, so testing doesn't touch your real history.

## Data

Everything is stored in `localStorage` in the browser you use. Use **Export data** on the report page to save a backup as a JSON file.
