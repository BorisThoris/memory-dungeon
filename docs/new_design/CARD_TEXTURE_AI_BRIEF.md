# Card textures — AI generation brief

Use this when regenerating **`reference-back.png`** (hidden side) and **`front-face.png`** (face-up panel). Visual language should match shipped backgrounds under `src/renderer/assets/ui/backgrounds/` (cathedral vault, dungeon ring, gold–cyan fantasy UI) and the end-product reference stills in `docs/ENDPRODUCTIMAGE.png` / `docs/ENDPRODUCTIMAGE2.png`.

---

## 1. Resolution (tell every image model explicitly)

| Stage | What to request | Exact values |
|--------|------------------|--------------|
| **In-engine card quad** | Width : height | **0.74 : 1.08** (see `CARD_PLANE_WIDTH` / `CARD_PLANE_HEIGHT` in `src/renderer/components/tileShatter.ts`) |
| **Aspect as decimal** | width ÷ height | **≈ 0.685185** |
| **Shipped PNG (default)** | Final files in repo | **`1403 × 2048`** pixels (height 2048, width rounded from aspect) |
| **Other long edges** | Optional sharper assets | Run `yarn card-texture:ideal <height>` — e.g. 3072 → width scales with same aspect |
| **OpenAI GPT Image (`gpt-image-1`)** | Closest allowed portrait size | **`1024 × 1536`** only (API does not support 1403×2048). Always run `scripts/card-pipeline/normalize-card-texture.ps1` after. |

**Copy-paste line for prompts:**

> Output image must be **portrait**, aspect ratio **approximately 0.74 wide by 1.08 tall** (same as **1403×2048** when exported). If the API only allows **1024×1536**, use that, then the team will letterbox to exact pixels without cropping.

---

## 2. Avoid “cut off” art (safe margins)

Models often center-crop or bias detail to the middle. Ask for **explicit breathing room**:

> Keep all important filigree, gems, and frame corners **at least 8–10% inset from every edge**. The outer band may be softer vignette or repeatable stone texture only. **Do not** place critical motifs flush against the frame.

---

## 3. Style anchors (palette + mood)

Align with `RENDERER_THEME` in `src/renderer/styles/theme.ts`:

- Void / panel: deep midnight **#05050a–#161623**, letterbox fill **#0a0e18**
- Gold trim: **#c3954f**, highlights **#f2d39d**
- Accent: cool **#63a5bb** / **#b8d9e4**
- Mood: dark fantasy, engraved stone and metal, soft mist, premium Steam desktop game — **not** photoreal people, **not** busy text

---

## 4. Prompt starters (paste + edit)

### Card back (`reference-back.png`)

> Portrait fantasy **card back** for a memory game, **0.74:1.08** proportions. Deep blue-black void stone, **antique gold filigree** border, subtle **cyan arcane** glints, symmetrical labyrinth or rune motifs, cathedral-vault atmosphere matching a dark dungeon library. **10% safe margin** on all sides — outer edge is soft vignette only. **No text, logos, or faces.** Single flat illustration (orthographic), game-ready texture.

### Card face (`front-face.png`)

> Portrait **face-up card panel**, same world and palette as the back. **Ornate gold frame** on deep stone; **calm, low-detail center** (roughly half the width) reserved for a glowing rune overlay — avoid busy patterns in the middle. **10% safe margin** from edges. **No text, numbers, logos, or faces.**

---

## 5. Repo commands after generation

```bash
# Print ideal dimensions for any long edge
yarn card-texture:ideal
yarn card-texture:ideal --ai-brief

# GPT Image → tmp, then exact card-plane pixels (contain, no crop)
yarn imagegen -- --resolution card-plane --prompt "…" --out tmp/card-back-raw.png
powershell -ExecutionPolicy Bypass -File scripts/card-pipeline/normalize-card-texture.ps1 -InputPath tmp/card-back-raw.png -OutputPath src/renderer/assets/textures/cards/reference-back.png -LongEdge 2048

yarn imagegen -- --resolution card-plane --prompt "…" --out tmp/card-face-raw.png
powershell -ExecutionPolicy Bypass -File scripts/card-pipeline/normalize-card-texture.ps1 -InputPath tmp/card-face-raw.png -OutputPath src/renderer/assets/textures/cards/front-face.png -LongEdge 2048
```

Requires `OPENAI_API_KEY` for `imagegen`. See also `src/renderer/assets/ASSET_SOURCES.md`.

---

## 6. Local GPU batch (SDXL, offline)

Generate many card backs once on your machine (~36 built-in themed variants), then normalize the same way as API output.

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install -r scripts/card-pipeline/requirements-local-card-backs.txt
yarn card-backs:local
```

Raw PNGs land in `tmp/card-backs-raw/`; normalized **`1403×2048`**-class outputs in `tmp/card-backs-normalized/` (`--long-edge 2048`). Accept the model license on Hugging Face if prompted; gated checkpoints need `HF_TOKEN` or `huggingface-cli login`. Optional custom list: `--manifest scripts/card-pipeline/card-back-prompts.manifest.example.json`.

---

## 7. Face illustration panels (tarot mat only, local SDXL)

Central illustration safe zone matches `CARD_ILLUSTRATION_INSET` in `src/renderer/cardFace/cardIllustrationRect.ts` and static overlay size **1024** card height in `tileTextures.ts`. The generator outputs **panel aspect** rasters (**520×592** px, SDXL-friendly), **not** full card planes — **do not** run `normalize-card-texture.ps1` on these.

```bash
yarn face-panels:local:dry
yarn face-panels:local
```

Outputs: `tmp/face-panels/face-panel-01.png` … `face-panel-80.png` plus `scripts/card-pipeline/generated-face-panels-last-run.json`. Default recipe is **three tiers**: 48 **common**, 24 **uncommon**, 8 **rare** (rarer tiers use slightly longer prompts / more steps). Runtime picks from a **weighted strip** (~70% / ~20% / ~10%) so showcase panels stay special. Copy PNG masters into `src/renderer/assets/cards/illustrations/`, then run `yarn face-panels:export-runtime-webp` so the shipped barrel imports WebP runtime files. Keep prompts short (CLIP ~77-token limit per SDXL encoder).

Treat each output as **standalone artwork**: the bitmap should read as illustration only (full canvas = paint), not a photograph of cardstock, borders, deck chrome, or “a tarot card showing …”. Prompt the **motif/scene/symbol** (relic, crystal, blade, tower, etc.); ornate frame and HUD chrome are drawn in code. After replacing PNGs from a regen, run `yarn build:card-illustration-manifest`, bump illustration schema / gameplay texture version if visuals shift, and `yarn regenerate:illustration-regression` if hashes are enforced.

---

## 8. Local Z-Image-Turbo batches (offline, replaces SDXL for new art)

[Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo) (Tongyi-MAI, **Apache-2.0**, 6B DiT, 8-step distilled) is the current local image model: sharper than SDXL base, follows long natural-language prompts, and needs ~20 GB VRAM in bf16 (the batch script switches on CPU offload automatically below that). Weights land in the Hugging Face cache on first run (~33 GB, no token needed). Turbo runs with `guidance_scale=0`, so there is no negative prompt — put the guards (“no text, no letters, no people…”) in the prompt itself.

```bash
yarn ui-art:local:dry                 # plan for scenes / posters / icon
yarn ui-art:local                     # renders 3 takes per slot into tmp/zimage/ui-backgrounds.zimage.manifest/
# pick takes from contact-sheet.png, record them in ui-backgrounds.zimage.picks.json, then:
yarn ui-art:install && yarn assets:ui-backgrounds:export-runtime-webp

yarn face-panels:local:zimage         # 80 mats, 2 takes each, rendered at 1040×1184
yarn face-panels:install:zimage && yarn face-panels:export-runtime-webp
```

Sides must sit on a 16 px grid (`batch_local_zimage.py` snaps them). Face panels render at ~2.2× (1136×1296), lose a 6% inset on every side (`cropInset`), and are Lanczos-downsampled to the 520×592 masters on install; the tier slot order (01-48 common, 49-72 uncommon, 73-80 rare) is fixed by `weightedFacePanelPool.ts`, so keep the manifest order when editing motifs.

**Shipped set:** the card fronts in the repo are the SDXL gold–cyan panels from §7 — that palette is the intended card style, matching the main-menu shell. The Z-Image batch below is an optional alternative kept for its pipeline; install it only on purpose.

**Prompting lesson (turbo, no CFG):** write only what you want to see. The first panel pass said “tarot-inspired … no frame, no card, no faces” and the model painted framed tarot cards with figures on 40 of 80 slots. The shipped prompts describe “a concept painting that fills the whole image edge to edge … the single inanimate subject”, avoid the words *tarot*, *card* and *frame* entirely, and phrase every motif as an object or scene rather than an archetype.
