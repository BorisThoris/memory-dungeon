# Visual System Spec

## Purpose
This document defines the shared art-direction system that the redesign should implement once and reuse across screens.

## Design Intent
The target is a readable fantasy game with a cinematic dungeon atmosphere. Gameplay state must remain clear before the player studies fine detail. Materials and effects support that read.

Key goals:
- Gameplay-first presentation; environment is the supporting layer
- Premium materials and depth
- High-contrast state feedback
- Cohesive cross-screen chrome
- Strong hierarchy between hero content and support information

## Gameplay Read Hierarchy

Apply these rules across card meshes, distant-card atlases, shaders, particles, overlays, and mobile layouts. They follow the shape, value, and detail hierarchy described in [Valve's Illustrative Rendering in Team Fortress 2](https://cdn.steamstatic.com/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf).

1. **Actionability first.** A blocked card has a persistent lock silhouette. Vines use broad crossed bindings; ice uses broken angular edges. A tiny corner icon, tint, or transient particle burst cannot carry this information alone.
2. **Identity second.** Keep element and revealed artwork readable. A peek does not remove a lock; the lock disappears only when the rules release it. Snow conceals identity but must not imply a turn lock by itself.
3. **Rewards and protection third.** Small round reward badges and protection shields stay distinct from full-card binding shapes. Color reinforces each symbol; it never replaces it.
4. **Effects support state.** Bound cards stop their idle sway and suppress decorative charge halos. Impact and release effects may punctuate changes but cannot erase persistent state. The room and elemental ground have lower contrast than the cards.
5. **Scale removes detail, never meaning.** Low quality, distant atlases, reduced motion, study, and peeks retain the same status vocabulary. Validate actual phone sizes, grayscale, crowded boards, and combined statuses, alongside desktop beauty shots.

The same restraint applies to menus: primary actions have the highest contrast, secondary options stay quiet, and ornamental frames never compete with controls or text.

### Screen Space and Feedback

- The HUD owns measured rows. The board and action effects consume the remaining rectangle; neither guesses the HUD's height or reserves it twice.
- Small menus use compact destination tiles. Dialog bodies and reference pages can scroll while their navigation remains reachable. Never squeeze a card below the height required for its contents to preserve an unscrollable layout.
- Preserve the DMC-style action vocabulary: oversized italic ranks, a tilted impact entrance, rich rank colors, speed slashes, a light sweep and sparks. Measure text before animation and reserve space for its impact envelope. The retained WebGL compositor renders only during the current event. A new event replaces the current one without a backlog. Reduced motion and context loss retain readable text without the shader movement.
- UI controls share a bounded canvas particle response to activation. The pool sleeps between inputs, clears when the page is hidden, and is disabled with reduced motion.
- Validate 320×568 and 568×320 alongside larger phones, tablets and desktop, including expanded details, long counters and active run overlays. A page with no horizontal overflow can still contain clipped or overlapping text; inspect the rendered result.

---

## Palette

### Core Tokens
| Token | Role | Notes |
|---|---|---|
| Void Black | Root background and deepest shadow | Near-black charcoal rather than pure black |
| Smoke Blue | Cool support neutral | Used behind cards and chrome |
| Antique Gold | Premium structure and key highlights | Main frame and title accent |
| Brass Bronze | Secondary frame tone | Use where gold must not dominate |
| Ember Orange | Torchlight and danger warmth | Good for play CTA and firelit edges |
| Blood Red | Failure and heart/life emphasis | Use sparingly, mostly semantic |
| Arcane Violet | Daily, relic, mutator, magical content | Also used for featured mode cards |
| Success Green | Match and completion feedback | Reserve for positive state language |
| Parchment Ivory | Primary readable highlight text | For titles, labels, and selected copy |
| Dust Gray | Secondary utility copy | For subtitles and descriptions |

### Semantic Color Rules
- Gold frames structure and premium affordance.
- Violet marks magical or challenge content.
- Green marks success and resolved correctness.
- Red marks failure, loss, or life depletion.
- Orange belongs to warmth, intensity, and firelight.
- Blue-black is a support neutral, not a focus color.

### Color Discipline
- Never use green and red as ambient decoration. Keep them semantic.
- Keep violet reserved enough that daily/challenge content still feels special.
- Let the environment handle broad color mood while the UI uses tighter accents.

---

## Typography

### Target Font Pairing
- Display: classical serif in the spirit of `Cinzel Bold`
- Utility/body: **Source Sans 3** (live implementation; Inter was an early reference only)

### Type Roles
| Role | Use |
|---|---|
| Display XL | Hero logo and marquee titles |
| Display L | Screen titles and mode titles |
| Display M | CTA labels and emphasized stat numerals |
| Label S | Uppercase labels above stats and controls |
| Body M | Standard descriptions and helper copy |
| Body S | Fine print, metadata, and subtitles |

### Typography Rules
- Use uppercase or small-caps styling for labels, not long body copy.
- Large numerals deserve more contrast and spacing than adjacent labels.
- Body copy should stay restrained and readable. The display font should not bleed into utility text.

---

## Material Language

### Primary Materials
- Dark enamel or lacquer
- Aged brass and gold trim
- Worn iron or dark steel support edges
- Stone and dungeon masonry in backgrounds
- Smoky glass or haze for overlays
- Embossed leather-like card surfaces

### Surface Rules
- Panels should have both border definition and interior shading.
- Buttons should read as objects with rim, face, and shadow, not as flat pills.
- Card surfaces should carry texture and edge depth, not only color.
- Chrome should feel crafted, not sterile.

---

## Framing Motifs

### Ornamental Frame Language
- Fine border lines plus thicker outer silhouette
- Corner flourishes or notched edges
- Inner highlight near top edge
- Soft glow or bloom, especially on highlighted elements

### Where to Use Frames
- Main buttons
- HUD segments
- Settings shell
- Info cards
- Mode-selection cards
- Sidebar rails and medallions

### Where Not to Overuse Frames
- Long paragraphs of copy
- Dense data lists
- Invisible layout wrappers

---

## Lighting and Atmosphere

### Scene Lighting
- Background scenes should use diegetic light sources like torches, portals, candles, or magical crystals.
- Scene lighting should frame the primary CTA or gameplay board.
- Vignettes should isolate the focal content without flattening the art.

### UI Lighting
- Use restrained bloom on active, featured, or magical elements.
- Hover and focus should feel luminous, not simply enlarged.
- Use inner highlights to give surfaces depth.

---

## Iconography

### Icon Style
- Filled, engraved, or sculpted icons instead of thin generic line icons
- Icons live inside framed capsules or medallions
- Icons should match the fantasy prop language

### Semantic Icon Categories
- Progression: hearts, crests, shards, coins
- Utility: settings, messages, lore/book
- Navigation: pause, back, close
- Inventory/meta: bag, codex, collection

---

## Spacing and Radius

### Spacing Principles
- Preserve generous breathing room around hero elements.
- Separate hero content from metadata.
- Avoid crowding the board or main CTA stack with small support panels.

### Radius Principles
- Hero buttons and panels can be slightly sharper and more beveled than the current rounded system.
- Tiny circular or medallion treatments are preferred for icon capsules.
- Large shells should use restrained corner rounding so they still feel architectural.

---

## Motion Tone
- Weighty, slightly ceremonial, and magical
- Directional rather than floaty
- Prefer glow, tilt, reveal, and particle payoff over generic scaling
- Failure should feel sharp and brief
- Success should feel luminous and rewarding

Reduced-motion rules are specified in `MOTION_AND_STATE_SPEC.md`.

---

## Responsive Design Rules

### Desktop Priority
The references are clearly desktop-first. Desktop is the target composition standard.

### Tablet and Mobile Adaptation
- Preserve hierarchy before preserving exact geometry.
- Keep hero flow readable even when edge metadata compresses.
- Prefer collapsing secondary meta surfaces before collapsing the primary CTA or board readability.

### What Must Survive Compression
- Main CTA clarity
- Screen title legibility
- Board readability
- Sidebar or menu navigation affordance
- Modal readability

---

## Asset Dependencies
The target look cannot be reached with CSS polish alone. Required asset classes:
- painted or composited background scenes
- logo lockup or logo-support emblem
- premium card back art
- optional card face frames and overlays
- icon family
- display font files
- ornamental separators or frame assets where CSS/SVG alone is insufficient

Detailed asset handling lives in `ASSET_AND_ART_PIPELINE.md`.


## Teaching and gameplay copy

Teach mechanics through the player-facing Tutorial Hall: a small practice board, one highlighted card at a time, and a short result after the move. The Hall covers matching, combo streaks, four elemental casts, and all six elemental combinations through the same turn engine as live play. Practice has local state, pauses a live run, and never awards profile progress.

The main menu links to the Hall. The Casts reference keeps current power and reaction previews visible, with recipe links opening the corresponding lesson. Keep routine controls and status copy brief; leave detailed receipts and the Codex available on demand. Do not show disabled future settings or internal implementation policy in player settings.

Preserve the DMC-style action stamps. New events replace the active stamp immediately; no queued backlog. Tutorial results use the same rendering and reduced-motion settings as gameplay.
