# E2E specs and QA matrix

**Runner:** Playwright (`yarn test:e2e`). **Config:** `playwright.config.ts` at repo root (`use.baseURL` is `http://127.0.0.1:5173` against the Vite dev server).

**Seeded saves:** Helpers in `e2e/tileBoardGameFlow.ts` and `e2e/visualScreenHelpers.ts` set `schemaVersion` from **`SAVE_SCHEMA_VERSION`** (`src/shared/contracts.ts`) so `localStorage` fixtures stay aligned with [save-data.ts](../../src/shared/save-data.ts) normalization expectations.

**Curated gate (recommended for CI):** `yarn test:e2e:renderer-qa` — see root `package.json` for exact file list.

Renderer QA shards:

- `yarn test:e2e:renderer-qa:layout` - mobile layout, gameplay readability, long-run HUD bounds.
- `yarn test:e2e:renderer-qa:navigation` - shell navigation, playable-path navigation, mode starts.
- `yarn test:e2e:renderer-qa:interludes` - route/shop/side-room/relic interludes, Scholar, Wild.
- `yarn test:e2e:renderer-qa:3d` - 3D board value, WebGL fallback/recovery, tile face, raycast.

Run these shards sequentially against the shared strict Vite port; concurrent Playwright shards can overload or restart the dev server and create misleading timeout failures.

**Portfolio demo fallback gate:** `yarn audit:renderer-assets`, `yarn portfolio:smoke`, `yarn build:cloudflare`, and `yarn test:e2e:demo-readiness` cover the browser-only embed path. Generated art and audio are enhancement layers: missing mode/background PNGs must render visible inline fallback art, missing music or sampled audio must degrade to silence/procedural SFX without repeated console errors, and the renderer-only Cloudflare build must not require Electron preload, Steam, or desktop save APIs.

## Spec inventory (`e2e/`)

| Spec file | Typical focus |
|-----------|----------------|
| `navigation-flow.spec.ts` | Shell navigation / flow; **Import run JSON** modal (not puzzle import) |
| `blueprint-explorer.spec.ts` | Dev-only `/__blueprint` system diagram explorer smoke (`yarn test:e2e:blueprint`) |
| `mobile-layout.spec.ts` | Mobile breakpoints / layout |
| `scholar-contract.spec.ts` | Scholar contract run |
| `wild-run.spec.ts` | Wild / joker style run |
| `tile-card-face-dom.spec.ts` | Card faces DOM path |
| `tile-card-face-webgl.spec.ts` | Card faces WebGL path |
| `tile-card-face-illustration-regression.spec.ts` | Procedural illustration tiles vs golden fixtures (`yarn test:e2e:illustration-regression`, `yarn regenerate:illustration-regression`) |
| `tile-card-face-illustration-benchmark.spec.ts` | Illustration perf / timing (`yarn benchmark:illustration-regression`) |
| `tile-card-face-overlay-regression.spec.ts` | Overlay tier / illustration overlay path |
| `tile-board-raycast.spec.ts` | Board raycast / input |
| `visual-inventory-capture.spec.ts` | Full device-grid visual inventory |
| `visual-screens.mobile.spec.ts` | Mobile visual baselines |
| `visual-screens.standard.spec.ts` | Standard/desktop visual baselines |
| `visual-endproduct-parity.spec.ts` | End-product parity |
| `ui-design-reference.spec.ts` | UI design reference stills |
| `capture-matched-flame.spec.ts` | Matched flame VFX capture |
| `menu-boot-visual.spec.ts` | Menu boot visuals |
| `settings-viewport-matrix.spec.ts` | Settings × viewport |
| `viewport-fit-stress.spec.ts` | Viewport fit stress |
| `overlay-smoke.spec.ts` | Overlays smoke |
| `a11y-intro-pause.spec.ts` | Intro / pause a11y |
| `a11y-scoped-routes.spec.ts` | Route-scoped a11y smoke (`yarn test:e2e:a11y`); first boot uses a longer timeout and `domcontentloaded` navigation because raster/audio-heavy cold starts can outlive Playwright's default 30s test budget |
| `a11y-toast-gameover.spec.ts` | Toast + game over a11y |
| `hud-inspect.spec.ts` | HUD inspection |
| `logo-intro-sandbox.spec.ts` | Logo intro sandbox |
| `cyp-review-capture.spec.ts` | Choose Your Path “review” layout metrics (inline back, scroller height bounds) |
| `gambit-mismatch-floater.spec.ts` | Gambit third-flip / mismatch floater after triple-no-match resolve (dev `gambitTripleMissSetup` fixture) |
| `procedural-gallery-smoke.spec.ts` | Procedural illustration gallery sandbox (`?devSandbox=1&fx=proceduralGallery`) |
| `ui-screenshots.spec.ts` | Local UI screenshots → `tmp/` (see [e2e/README](../../e2e/README.md)) |

## Helpers (not specs)

`visualScreenHelpers.ts`, `visualScenarioSteps.ts`, `visualScreenScenarios.ts`, `visualInventoryDevices.ts`, `tileBoardGameFlow.ts`, `mobileTouchHelpers.ts`, `startupIntroHelpers.ts`, `pngDiff.ts` — shared steps and diff utilities.

## Related docs

- [visual-capture/README.md](../visual-capture/README.md) — where captures land, device matrix
- [visual-capture/INVENTORY.md](../visual-capture/INVENTORY.md) — generated inventory index
- [VIEWPORT_FIT_UI.md](../VIEWPORT_FIT_UI.md) — viewport behavior
