# Portfolio Demo Evidence

This is the compact reviewer path for capturing Memory Dungeon as a portfolio artifact.

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

Visual capture command:

```bash
yarn capture:ui-audit
```

Focused validation before publishing or recording:

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

## Intended Screenshots

- Main menu with Play, profile, collection, codex, and settings entry points.
- Choose Your Path mode library with search active.
- Classic level-one board during memorization or first reveal.
- Active-run Inventory showing run snapshot, build, mutators, and economy.
- In-run Settings dialog with the control center strip and footer actions.
- Post-run Collection or Profile showing latest-run evidence.

## Browser, Electron, and Embed Notes

- Use the browser demo port for portfolio capture: `http://127.0.0.1:4102/`.
- Use `yarn dev` only when validating the full Electron desktop shell; it keeps Vite on `http://127.0.0.1:5173` and launches Electron.
- `yarn build:cloudflare` is renderer-only and writes `dist/`; it does not bundle Electron.
- The Cloudflare Pages demo is intended to be public and iframe-ready. Do not enable Cloudflare Access, and leave frame-blocking headers unset so the portfolio can embed `https://memory-dungeon.pages.dev/`.
- Treat browser capture as the public portfolio path and Electron as a Windows shell validation path.

