# Portfolio Demo Evidence Page

This is the compact reviewer path for launching, validating, and capturing Memory Dungeon as a portfolio artifact.

## Run and Build Commands

Local browser demo:

```bash
yarn demo:browser
```

Raw renderer command behind the script:

```bash
yarn dev:renderer --host 127.0.0.1 --port 4102
```

Open `http://127.0.0.1:4102/` after the server starts.

Cloudflare Pages build:

```bash
yarn build:cloudflare
```

Portfolio visual capture command:

```bash
yarn capture:ui-audit
```

Focused validation before publishing, embedding, or recording:

```bash
yarn test:e2e:visual:smoke
yarn test:e2e:playable-path:audit
```

## Recommended Demo Path

1. Start from the main menu and show the Play entry plus meta buttons.
2. Open Choose Your Path, use mode search once, then return to the mode shell.
3. Start a Classic run and pause briefly on the level-one board.
4. Open the in-run Inventory and Codex from the toolbar to show active-run context.
5. Open in-run Settings, return to gameplay, then complete the first floor if time allows.
6. From a completed or seeded post-run state, show Collection and Profile with recent-run evidence.

## Intended Demo Screenshots

- Main menu with Play, profile, collection, codex, and settings entry points.
- Choose Your Path mode library with search active.
- Classic level-one board during memorization or first reveal.
- Active-run Inventory showing run snapshot, build, mutators, and economy.
- In-run Settings dialog with the control center strip and footer actions.
- Post-run Collection or Profile showing latest-run evidence.

## Browser, Electron, and Cloudflare Notes

- Use the browser demo port for portfolio capture: `http://127.0.0.1:4102/`.
- Use `yarn dev` when validating the full Electron desktop shell; it keeps Vite on `http://127.0.0.1:5173` and launches Electron.
- `yarn build:cloudflare` is renderer-only and writes `dist/`; it does not bundle Electron, preload scripts, or desktop packaging assets.
- The Cloudflare Pages demo is intended to be public and iframe-ready. Do not enable Cloudflare Access, and leave frame-blocking headers unset so the portfolio can embed `https://memory-dungeon.pages.dev/`.
- Treat browser capture as the public portfolio path and Electron as a Windows shell validation path.
- Before linking the portfolio, confirm the deployed Pages build loads inside the portfolio iframe and that menu, mode selection, gameplay, settings, inventory, and profile/collection routes remain reachable without desktop shell APIs.

## Portfolio Capture Checklist

Use this short list for portfolio screenshots or review clips. The long capture inventories stay in the Playwright specs and generated audit output; this page should only point to the scripts needed to produce them.

### Quick Local Capture

1. Start the browser demo:

   ```bash
   yarn demo:browser
   ```

2. Open `http://127.0.0.1:4102/`.

3. Capture these states at desktop `1440x900` and mobile `390x844`:

   | State | Capture note |
   | --- | --- |
   | Menu | Main menu with the title, primary run actions, and readable background treatment. |
   | Mode select or featured run | Show either the mode selection surface or a featured run card before starting. |
   | Active board | Enter a run and capture the playable board with HUD, hand/memory state, and readable tile art. |
   | Relic offer | Capture the post-floor relic choice state with all offer cards visible. |
   | Floor transition | Capture the route/floor transition or interlude state between boards. |
   | Settings | Open settings from the menu or in-run overlay and capture the controls at desktop size. |
   | Mobile layout | Repeat the strongest menu or active-board shot at `390x844`; use `844x390` as an extra landscape check when mobile fit is in doubt. |

4. For an automated smoke capture of the same visual surfaces, run:

   ```bash
   yarn test:e2e:visual:smoke
   ```

### Full Release/Demo Validation

Run this path before publishing or refreshing portfolio media:

```bash
yarn build:cloudflare
yarn test:e2e:visual:smoke
yarn capture:gameplay-audit
```

`yarn capture:gameplay-audit` writes the detailed gameplay audit under `test-results/gameplay-visual-audit` and uses the existing Playwright capture script instead of duplicating the internal visual inventory here. Use the broader visual inventory only when you need full device-grid evidence:

```bash
yarn capture:visual-inventory
```
## Fast Smoke Gate

Before a quick local portfolio capture pass, run:

```bash
yarn portfolio:smoke
```

This narrow gate runs `yarn typecheck` plus `yarn test:e2e:demo-readiness`, and exits nonzero if the demo readiness Playwright spec fails. Use the broader renderer QA, visual capture, and long-run gates before refreshing release-oriented media or validating riskier gameplay/UI changes.
