# End-to-end tests (Playwright)

Specs live in this directory and run against the Vite dev server (`playwright.config.ts`).

The default Playwright config uses one worker. The app shares a strict-port Vite/WebGL target, and broad parallel runs can cause misleading startup, navigation, and WebGL timeouts even when the same specs pass in shards. Use the curated shard scripts for speed, or set `PLAYWRIGHT_WORKERS=N` and `PLAYWRIGHT_FULLY_PARALLEL=1` only for intentional stress/diagnostic runs.

## Relic draft overlay

The milestone relic draft (`data-testid="game-relic-offer-overlay"`) is covered by deterministic Playwright fixture flow in `e2e/playable-path-interludes.spec.ts`. The manual checklist in [`docs/epics/relic-draft-fluid-system/05-ui-ultra-refinement.md`](../docs/epics/relic-draft-fluid-system/05-ui-ultra-refinement.md) remains useful for final presentation review, but relic draft is no longer a manual-only playable-path gap.

## Traces and videos on failure

Config uses `trace: 'retain-on-failure'` and `video: 'retain-on-failure'` so passing runs stay light while failed attempts still upload Playwright traces/videos. Download artifacts from the CI job (or open `test-results/` after a local failure) and run `npx playwright show-trace path/to/trace.zip` to inspect.

## Playable-path runtime tiers

Use the named package scripts from the repo root so local and CI runs share the same Playwright file lists.

- `yarn test:e2e:playable-path:audit` runs the fast playable-path navigation audit. Use it for quick local checks and light PR coverage when a change could affect menu, mode shell, in-run pause/settings, floor-clear navigation, or compact classic-start flow.
- `yarn test:e2e:playable-path:readability` runs the focused gameplay HUD/board/action-dock bounds suite across phone, short landscape, tablet, and desktop viewports.
- `yarn test:e2e:playable-path:full` runs the full playable-path sweep: navigation, mode matrix, interlude/post-run coverage, and gameplay readability. Use it before merging changes that affect mode starts, floor-clear decisions, shop/route/side-room interludes, game-over actions, first-run onboarding, or active gameplay layout.
- `yarn test:e2e:browser-smoke` runs the fast release-smoke browser path: clean demo startup on desktop/mobile, core playable-path navigation, and 3D board nonblank/bounds smoke. Use it when a change needs live renderer proof without the full renderer QA surface.
- `yarn test:e2e:browser-smoke:full` adds the slower route/interlude/readability/HUD shard on top of the fast smoke. Use the shard scripts (`test:e2e:browser-smoke:core` and `test:e2e:browser-smoke:routes`) when local command timeouts are tight.
- `yarn test:e2e:blueprint` runs the dev-only system diagram explorer smoke at `/__blueprint`.
- `yarn test:e2e:renderer-qa` remains the curated full renderer QA entry point for CI and release-candidate checks. It aliases `yarn test:e2e:renderer-qa:full`, which sequences the shard scripts below so long local runs can be resumed from the failed shard instead of restarting the whole renderer surface.
- `yarn test:e2e:renderer-qa:layout` covers mobile layout, gameplay readability, and long-run HUD bounds.
- `yarn test:e2e:renderer-qa:navigation` covers shell navigation, playable-path navigation, and mode starts.
- `yarn test:e2e:renderer-qa:interludes` covers route/shop/side-room/relic interludes plus Scholar and Wild starts.
- `yarn test:e2e:renderer-qa:3d` covers the 3D board value, WebGL fallback/recovery, tile face, and raycast contracts.
- Keep renderer QA shards sequential on the shared strict Vite port. Running multiple Playwright shards at once can overload the dev server and produce misleading navigation timeouts.
- Renderer layout coverage includes the 844x390 short-height settings page and run-settings modal path; keep that viewport in `e2e/mobile-layout.spec.ts` when changing settings chrome.
- `yarn test:e2e:visual:smoke` captures the 16-screen visual baseline across phone portrait, phone landscape, tablet portrait, and desktop landscape. Use `test:e2e:visual:smoke:shard1`, `shard2`, and `shard3` for parallel/local shard runs when the full visual smoke is too slow.

CI guidance:

- For fast PR feedback, run `yarn test:e2e:playable-path:audit` alongside type/lint/unit checks when the touched area is renderer navigation or gameplay shell behavior.
- For renderer-gated PRs and pre-release verification, run `yarn test:e2e:browser-smoke` for fast live gameplay smoke, `yarn test:e2e:browser-smoke:full` when time allows, and `yarn test:e2e:renderer-qa` for the complete renderer contract surface; existing jobs using `renderer-qa` do not need to change.
- Keep visual captures on their dedicated visual scripts instead of folding them into renderer QA.

Known PPI-010 note: playable-path specs carry one retry at the describe level to absorb current animation/first-floor timing variance; treat repeated retry passes as a signal to inspect the attached trace/video. Route, shop, side-room, relic draft, game over, fresh-profile, and active-run readability paths now use deterministic dev fixtures where appropriate.

## `visual-screens.standard.spec.ts` - game over (`08-game-over`)

The visual baseline opens the deterministic `gameOver` playable-path fixture. Keep live mismatch-burning coverage in gameplay-oriented specs so visual smoke stays focused on rendering and layout capture.

## `visual-screens.*.spec.ts` - shop (`07a-shop-screen`)

The shop capture opens the deterministic `floorClearWithShop` fixture, then uses the floor summary's Visit shop action. Do not depend on a fresh level-1 clear naturally offering a shop; current route-choice floors can present Safe, Greed, or Mystery choices instead.

## `ui-screenshots.spec.ts`

- **Purpose:** Local-only UI capture: drives the app through intro -> menu -> classic run, then writes full-page PNGs for a couple of viewport sizes.
- **Artifacts:** Creates `tmp/ui-capture/` under the repo root (the `tmp/` tree is gitignored). Safe to delete between runs.
- **CI policy:** Prefer the curated renderer QA command (`yarn test:e2e:renderer-qa` in the root `package.json`) for automated gates so this spec is not relied on in CI. If you run `yarn test:e2e` or `playwright test` in CI, this file will execute and write under `tmp/`; ensure the job allows ephemeral disk writes and does not expect deterministic screenshots without a dedicated visual baseline workflow.
