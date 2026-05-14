# End-to-end tests (Playwright)

Specs live in this directory and run against the Vite dev server (`playwright.config.ts`).

## Relic draft overlay

The milestone relic draft (`data-testid="game-relic-offer-overlay"`) is covered by deterministic Playwright fixture flow in `e2e/playable-path-interludes.spec.ts`. The manual checklist in [`docs/epics/relic-draft-fluid-system/05-ui-ultra-refinement.md`](../docs/epics/relic-draft-fluid-system/05-ui-ultra-refinement.md) remains useful for final presentation review, but relic draft is no longer a manual-only playable-path gap.

## Traces and videos on failure

Config uses `trace: 'retain-on-failure'` and `video: 'retain-on-failure'` so passing runs stay light while failed attempts still upload Playwright traces/videos. Download artifacts from the CI job (or open `test-results/` after a local failure) and run `npx playwright show-trace path/to/trace.zip` to inspect.

## Playable-path runtime tiers

Use the named package scripts from the repo root so local and CI runs share the same Playwright file lists.

- `yarn test:e2e:playable-path:audit` runs the fast playable-path navigation audit. Use it for quick local checks and light PR coverage when a change could affect menu, mode shell, in-run pause/settings, floor-clear navigation, or compact classic-start flow.
- `yarn test:e2e:playable-path:readability` runs the focused gameplay HUD/board/action-dock bounds suite across phone, short landscape, tablet, and desktop viewports.
- `yarn test:e2e:playable-path:full` runs the full playable-path sweep: navigation, mode matrix, interlude/post-run coverage, and gameplay readability. Use it before merging changes that affect mode starts, floor-clear decisions, shop/route/side-room interludes, game-over actions, first-run onboarding, or active gameplay layout.
- `yarn test:e2e:renderer-qa` remains the curated full renderer QA entry point for CI and release-candidate checks. It currently aliases `yarn test:e2e:renderer-qa:full`, which includes the full playable-path sweep plus the renderer layout, navigation, long-run feedback HUD, scholar, wild-run, tile face, and raycast contracts.
- Renderer layout coverage includes the 844x390 short-height settings page and run-settings modal path; keep that viewport in `e2e/mobile-layout.spec.ts` when changing settings chrome.

CI guidance:

- For fast PR feedback, run `yarn test:e2e:playable-path:audit` alongside type/lint/unit checks when the touched area is renderer navigation or gameplay shell behavior.
- For renderer-gated PRs and pre-release verification, run `yarn test:e2e:renderer-qa`; existing jobs using this command do not need to change.
- Keep visual captures on their dedicated visual scripts instead of folding them into renderer QA.

Known PPI-010 note: playable-path specs carry one retry at the describe level to absorb current animation/first-floor timing variance; treat repeated retry passes as a signal to inspect the attached trace/video. Route, shop, side-room, relic draft, game over, fresh-profile, and active-run readability paths now use deterministic dev fixtures where appropriate.

## `visual-screens.standard.spec.ts` - game over (`08-game-over`)

The default path drives level 1 and burns lives with intentional mismatches (`forceGameOverWithMismatches` in `visualScreenHelpers.ts`). That harness can flake on slow machines when flip animations lag behind Playwright's hidden-tile queries.

If this path flakes on slow machines, raise the scenario timeout or investigate flip animation settlement before changing the path.

## `ui-screenshots.spec.ts`

- **Purpose:** Local-only UI capture: drives the app through intro -> menu -> classic run, then writes full-page PNGs for a couple of viewport sizes.
- **Artifacts:** Creates `tmp/ui-capture/` under the repo root (the `tmp/` tree is gitignored). Safe to delete between runs.
- **CI policy:** Prefer the curated renderer QA command (`yarn test:e2e:renderer-qa` in the root `package.json`) for automated gates so this spec is not relied on in CI. If you run `yarn test:e2e` or `playwright test` in CI, this file will execute and write under `tmp/`; ensure the job allows ephemeral disk writes and does not expect deterministic screenshots without a dedicated visual baseline workflow.
