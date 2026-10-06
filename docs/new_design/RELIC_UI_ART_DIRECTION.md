# The relic folio

The interface belongs to the same dungeon as the cards: black vellum, aged brass, thorn engraving, oxblood enamel and ember insets. Original painted assets replace plain outlines on the controls and surfaces. Typography, real text, semantic controls and the measured mobile layout remain separate from the decorative artwork.

## Reference study

- [Hades — Supergiant](https://www.supergiantgames.com/games/hades/): illustrated framing gives choices a recognizable identity; bright actions sit inside a dark, readable field.
- [Inscryption — official site](https://www.inscryption.com/): the interface feels like a physical object in the game's world. Apply that material continuity to our folio and seals.
- [Darkest Dungeon — Red Hook](https://www.darkestdungeon.com/darkest-dungeon/): strong ink silhouettes and restrained highlights keep dense information legible against gothic art.

These are visual design observations, not borrowed assets. The palette, serif typography, cathedral, portal, cards and DMC stamps remain Memory Dungeon's existing art direction.

## Surface coverage

| Surface | Treatment |
| --- | --- |
| Main menu | Cathedral exposed more clearly; contents framed as a relic folio; Play is an oxblood seal. |
| Choose Your Path | Original animated portal retained; run choices in the folio; launch controls use painted plaques. |
| Collection, Codex, Profile | Shared painted archive shell, engraved chapter selection, framed entries and records. |
| Inventory | Same archive shell and shared Panel artwork, including over gameplay. |
| Settings | Archive shell, engraved category selection, angular inset toggles/slider handles, painted action buttons. |
| Tutorial Hall | Folio lesson index, engraved lessons and selected categories, framed coaching; real card practice and tap targets retained. |
| Gameplay | Small framed tool dock and item tray, ornamental HUD rules; cards, board, shaders and DMC texts retained. |
| Pause, abandon, shortcuts, run setup, shop and reward dialogs | Shared OverlayModal frame and matching primary/secondary actions; shop purchase plaques. |
| Floor clear, run loading, run end | Framed colophon/loading panel; end panels inherit shared Panel and UiButton art. Existing cinematics remain. |
| Realm travel | Brass framing around existing colored doors, keeping realm identity visible. |
| Startup | Matching Continue plaque; original cinematic retained. |
| Error recovery | Deliberately keeps independent fallback styling so it works if game assets/theme fail. |

## Asset implementation

Assets live in `src/renderer/assets/ui/relic/` and are imported by `styles/relic-art.css`. Both originals were generated using the built-in imagegen tool, then resized and encoded as WebP for production. The vellum tile is a center crop of the frame. Total compressed art is 99,138 bytes. No third-party artwork is shipped.

- `relic-frame-v1.webp`: 768 × 768; 20% nine-slice corners. Frames use pixel border-image widths so ornaments never grow with a wide viewport.
- `relic-command-v1.webp`: 768 × 256; 22% vertical / 24% horizontal slices. Oxblood emphasizes primary actions; smaller cap widths keep short labels clear.
- `relic-vellum-v1.webp`: 308 × 308; tiled full-screen ground avoids stretching the painted texture.

Images add no animation, event handlers, tab stops or accessible names. Real focus outlines and labels remain. Secondary surfaces are quieter than the primary action. Mobile controls retain 44 px targets and existing scrolling. Cards and DMC callout rendering are not changed.

## Visual verification

The isolated, headless browser capture set is `output/playwright/art-ui/` (local QA artifacts, not shipped). Menu destinations and the portal were exercised at 1280×800, 390×844, 320×568 and 568×320. The smallest sizes have no document horizontal overflow and retain visible 44 px Back controls. Settings was also reviewed at the supported maximum UI scale of 1.05×. Guided pair practice was completed through actual highlighted-card taps. Run setup, pause, inventory, Codex, settings, the item tray and elemental guide were exercised through their real navigation.

The `fixture-*` captures render the actual run-end, floor-clear, realm-travel and loading components with deterministic test data; they are component previews rather than claims of playing through those later floors. Reduced-motion media is enabled for this capture set. The first run-end preview lacked its required tilt provider; the corrected fixture includes the real provider and renders successfully. Production sources did not require a behavioral change.

## Final generation prompts

### Frame

Use case: stylized-concept. Asset type: production game UI nine-slice panel texture. Create one square front-facing ornamental frame for an original gothic memory-dungeon indie game. Art direction: hand-painted black lacquer and worn iron with sharp engraved antique brass corners, tiny ember-colored inset gems, restrained asymmetrical scratches and etched thorn/rune details. A deep almost-black quiet center occupying the central 75% of the square, subtly textured like soot-dark vellum, absolutely no words, letters, text, icons or controls inside. Outer frame has a continuous straight thin brass edge exactly reaching all four canvas edges; more intricate artwork confined to the corner 15% regions so the middle stretches cleanly as a nine-slice game panel. Flat orthographic graphic, no perspective, no scene, no mockup, no external shadow or margins. Palette charcoal #131111, muted antique gold #a77b45, ivory highlights, dark oxblood recesses. Distinctive ink outlines and painterly chisel marks, tasteful crafted detail, not shiny photorealistic or generic web UI. 1024x1024 square.

### Command plaque

Use case: stylized-concept. Asset type: one production nine-slice button texture for an original gothic memory dungeon game. Very wide horizontal rectangular button, 3:1 aspect ratio. Straight-on flat orthographic graphic, dark oxblood enamel face surrounded by aged engraved brass and ink-black iron. Painterly and hand-chiseled, bold gothic thorn motifs confined to the left and right end caps, small warm amber diamond gemstone in each end cap. Narrow brass rails along top and bottom; rails run exactly to image edges. Central 65 percent is quiet deep burgundy lacquer with subtle horizontal worn brush texture and ample clear space for a readable label which will be added by code. No text, no lettering, no symbols in center, no mockup, no background scene, no perspective, no outside margins. Sharp silhouette, tiny etched chips, bevel highlights hand-painted in muted antique gold; warm ember at edges, not glossy photorealism. Entire canvas filled by the rectangular button. Matches an antique black-vellum grimoire with brass thorn frames. Clearly designed game art, not generic HTML. 1536x512 landscape.
