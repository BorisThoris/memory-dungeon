# WIP assets (non-shipped / reference)

Material in this tree is for **design iteration, QA captures, and import sources**. Shipped game art lives under `src/renderer/assets/` and runtime-safe `public/` URLs. `public/wip-assets/` mirrors design-review SVGs for local previews only; production builds prune it unless `VITE_KEEP_WIP_PUBLIC_ASSETS=1` is set.

| Path | Purpose |
|------|---------|
| **`card-sources/`** | Original PNG/SVG exports (e.g. AI outputs) before normalization; not imported by the app. |
| **`card-des/`** | Ad-hoc card reference PNGs. |
| **`validation/`** | Screenshots from `yarn capture:ui-vs-assets` (board vs source assets). |
| **`png/`**, **`svg/`**, `crops.json`, `index.json` | Output from `yarn wip:extract-endproduct` (`scripts/extract-endproduct-wip-assets.mjs`). |
| [`GAMEPLAY_ENDPRODUCT_TARGET_BRIEF.md`](./GAMEPLAY_ENDPRODUCT_TARGET_BRIEF.md) | Fixed-target brief for gameplay-panel image refinement and parity review. |

Card texture tooling: **`scripts/card-pipeline/`** (`imagegen`, normalize, trim, etc.).
