# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Fifteen": a static, no-build, no-dependency web page (`app/`) that shows one 15-minute task per day. Vanilla JS, no framework, no bundler. Deployed to GitHub Pages. All user data lives in the browser's `localStorage`.

## Commands

```sh
npm install && npx playwright install chromium   # first time
npm test                                         # all Playwright tests + coverage gate
npx playwright test -g "pause freezes"           # single test by title
npx playwright test tests/app.spec.js:219        # single test by line
npm run serve                                    # serves app/ at / and /test/ on :4173
```

There is no lint or build step. `npm run serve` is preferred over `python3 -m http.server` because it also serves the test build at `/test/`.

## Coverage gate (important)

`tests/coverage-teardown.js` **fails the whole run unless line coverage of `app/app.js` and `app/tasks.js` is exactly 100%**. Any new code path in `app.js` needs a test that executes it, including `catch {}` branches and feature-detection fallbacks. Report: `coverage/index.html`.

`coverage-options.js` only counts a `tasks.js` whose source contains `'morning-pages'` — that's how the real task list is distinguished from stand-in lists that tests serve via `page.route('**/tasks.js', ...)`. Don't remove or rename that task id without updating the filter.

## Architecture

- `app/tasks.js` sets `window.TASKS` (ordered array of `{ id, title, hint?, early? }`); `app/app.js` is a single IIFE that reads it. Progress is keyed by task `id`, so ids must never be reused for a different task.
- **Screens are string-rendered**: each `render*`/`breathe`/`runTimer` function builds HTML and calls `paint()`. Modes: `home` → `breathe` → `timer` → `reflect` → back to `home`; plus `report` (`#report` hash). Hash routing is ignored during breathe/timer/reflect.
- **Double-rendered page for the "tide" effect**: `paint()` writes identical HTML into `#dry` and `#wet .wet-inner`. The wet layer is `inert`/`aria-hidden`, clipped by CSS var `--p` (0–1, set via `setP`/`animateP`), and its scroll is synced manually. All event listeners are delegated on `#dry` via `data-act` attributes mapped in the `actions` object; query elements under `#dry` (tests use the `dry()` helper for this).
- **Task selection**: the next task is the first in `TASKS` whose id isn't logged in the current `cycle`. A missed day doesn't skip anything. "Start the list again" increments `cycle`.
- **Session persistence**: the in-progress timer is saved in storage (`session`) with `startedAt`/`pausedAt`/`pausedTotal`/`endedAt`, so reloads resume the timer or jump to the reflect question. Elapsed time is computed from timestamps, not counted. A `setTimeout` backs up `requestAnimationFrame` so the end fires in background tabs.
- **Storage** goes through the `store` wrapper (try/catch'd, JSON). Keys are prefixed `fifteen:` or `fifteen:test:`.
- **Test build**: when the path contains `/test/`, `IS_TEST` switches to a 5-second timer, a separate storage prefix, a "Test build" tag, a task picker on the start screen, and a "Clear test data" button.

## Tests

- `tests/fixtures.js` extends Playwright's `test`: every test collects V8 coverage and installs stubs (AudioContext, Notification, wakeLock, vibrate, visibilityState) that record to `window.__calls`. Configure per-describe with `test.use({ stubs: { ... } })` — options like `permission`, `noAudio`, `chimeThrows`, `wakeThrows`, etc.
- Tests use Playwright's fake clock (`page.clock`); time only moves when a test advances it (see `open`, `advance`, `runOut`, `settle` helpers in `app.spec.js`). Seed storage with `seed()`, which reloads the page.
- `tests/server.js` mirrors the deploy layout (app at `/` and `/test/`).

## Deploy

`.github/workflows/deploy.yml`: pushes to `main` or `test` run the tests, then build a single Pages site from **both** branches — `main/app` at the root and `test/app` at `/test/` (noindexed). Workflow: develop on `test`, merge into `main` when happy.
