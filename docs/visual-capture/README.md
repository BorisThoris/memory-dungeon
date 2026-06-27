# Visual capture and AUDIT checklists

## What `**/AUDIT.md` means

Each device/orientation folder under `docs/visual-capture/` contains screenshots and an **AUDIT.md** with per-screen **Review checklist** and **Improvement tasks** items.

**Completion policy (2026-04-17):** Full pixel-by-pixel human review of every PNG in every folder is **not** repeated on each doc change. Instead:

1. **Automated / CI:** `yarn test:e2e:a11y`, `yarn verify`, and contrast/token tests cover overlap (focus, many a11y rules). Run before release.
2. **Canonical reference:** `desktop-1280/landscape` is the primary desktop capture set; other folders follow the same UI build.
3. **Checklist items** in AUDIT files are marked **`[x]`** under **policy sign-off**: engineering confirms the checklist remains the correct *intent* for the next full **visual capture refresh**; designers should re-validate when replacing PNGs or changing layout tokens.
4. **When you re-capture:** Spot-check a folder after `yarn capture:*`; if regressions appear, open issues and uncheck relevant rows until fixed.

This avoids thousands of stale unchecked boxes while keeping the checklist structure for real QA runs.

## Folder layout

Each `<device>/<orientation>/` holds PNGs plus `AUDIT.md`. Device names match Playwright / capture scripts (see root `package.json` `capture:*` scripts).

**Screenshot-derived task queue:** [`improvement-workqueue/README.md`](./improvement-workqueue/README.md) (`UI-*` IDs and status).

**Game-over captures:** `08-game-over` uses the deterministic `gameOver` playable-path fixture so capture grids stay focused on rendering/layout. Keep live mismatch-burning coverage in gameplay specs instead (see [`e2e/README.md`](../../e2e/README.md)).
