# FX-016 — Reduce motion vs board / shell effects

**Status (P0):** Policy table maintained here; new motion must add a row or extend an existing one before ship. QA sign-off: verify `data-reduce-motion` branches for new CSS/JS hooks.

Runtime **`settings.reduceMotion`** is mirrored on the app root as **`data-reduce-motion`** (`App.tsx`). CSS under `:global([data-reduce-motion='true'])` tracks that flag; JS props use the boolean directly.

## Board (WebGL + DOM)

| Effect / system | `reduceMotion: false` | `reduceMotion: true` | Notes |
|-----------------|----------------------|----------------------|--------|
| **Board screen-space AA** | Default **`auto`**: native framebuffer AA (`smaa` saved value falls back here while post-FX is disabled) | Default **`auto`**: native framebuffer MSAA | Decoupled via **`settings.boardScreenSpaceAA`** (`auto` / `smaa` / `msaa` / `off`) in Video settings (`TileBoard.tsx`, PERF-002). |
| **TileBoard `Canvas` remount key** | Changes with resolved AA mode (`tile-board-aa-*`) and context-recovery revision, not motion alone | Same | |
| **Viewport pan/zoom easing** | Damped (`TileBoardScene` `useFrame`) | Instant snap to target | `reduceMotion` prop |
| **Shuffle FLIP + motion budget** | Animated | Immediate apply | `TileBoard` `runShuffleAnimation` |
| **Platform tilt field** | Can drive `--tilt-*` on frame | Disabled | `usePlatformTiltField` |
| **Motion permission chip** | May show on touch | Hidden | `TileBoard.module.css` `.motionChip` |
| **DOM fallback: resolve pulses / glow** | CSS animations on match/mismatch | Reduced / disabled | `TileBoard.module.css` `[data-reduce-motion]` |
| **Match particle burst (FX-005)** | Conic “spark” ring on `.hitButtonResolvingMatch` + `.fallbackTile.resolvingMatch .tileFace` | Off (`::before` suppressed) | Pure CSS; no extra Canvas/R3F objects |
| **DOM face-up reveal arc (CARD-002)** | `.tileFace` `domCardFaceReveal` | Disabled | `TileBoard.module.css` |
| **WebGL flip pop impulse (CARD-003)** | Brief uniform scale + forward Z bump on hidden→face-up | Off (timer cleared; no impulse) | `TileBoardScene` `advanceTileBezelFrame` |
| **Matched ✓ scale/fade (FX-011)** | `.fallbackMatchedCheck` + `.hitButtonMatched::after` `matchedCheckPop` | Static (no keyframe animation) | `TileBoard.module.css` |
| **WebGL hover rim lerp (FX-006)** | UV tilt + Z lift + warm `meshBasicMaterial` lerp | Off | `TileBoardScene` `TileBezel` |
| **WebGL face-up lift ease (CARD-010)** | `liftSmoothRef` damp toward target lift | Instant snap | Same |
| **Shuffle Z stagger (FX-013)** | — | Off | Per-tile `shuffleZJitter` only while shuffle window active |
| **Match pair pulse (FX-017)** | Hit layer + DOM pulses | Same reduced rules as other pulses | Stronger `matchPulse` scale when `resolvingSelection === 'match'` |
| **TBF-002 / TBF-004 resolving rim stack** | Crisp inner rim + soft halo ring; rounded-rect inner on medium+ (`tileBoardRimGeometry`), circular on `low` | Same static opacities as non-reduced branch (no sine pulse on rim) | Halo segment count follows `graphicsQuality` |
| **TBF-005 match burst v2** | Up to 3 staggered hue rings (`emeraldBright` / `goldBright` / `cyanBright`); `low` = 1 ring, `medium` = 2, `high` = 3 | Off (timers cleared; meshes hidden) | `advanceTileBezelFrame` |
| **TBF-006 matched ✓ glow plane** | Soft emerald plane behind ✓; subtle sine opacity | Static mid opacity | Same |
| **Matched ember rim** | Rounded-rect edge shader: brief burst on first `matched`, then quieter persistent ember outline on medium/high | Burst still visible, but ember motion is nearly static; `low` keeps static rim + existing matched chrome | `matchedCardRimFireMaterial.ts`, `TileBoardScene.tsx` |
| **TBF-007 keyboard focus ring** | Gold ring + slow sine opacity pulse when focused + pickable | Flat opacity (~0.68) | `advanceTileBezelFrame` |
| **Gambit 3-flip resolving (CARD-012)** | `resolvingGambitSpare` vs match/mismatch | Tint `gambitNeutral` | `tileResolvingSelection.ts` |
| **DOM fallback: focus ring transition** | Transition on | Transition off | Same |
| **Hit layer `data-dom-tile-picks`** | — | `true` when WebGL + reduced (picking path) | `TileBoard.tsx` |

## Game shell / HUD

| Area | Reduced motion |
|------|----------------|
| **GameScreen** rule hint / toast / score pop / floating deck | Lighter animation or static styles | `GameScreen.module.css` |
| **Board presentation** “breathing” stage | Skipped when reduced | `GameScreen.tsx` `boardPresentationClass` |
| **Distraction HUD numeric pulse** | Off when reduced | `GameScreen.tsx` `distractionHudOn` |
| **Score pop dismiss timing** | Shorter | `GameScreen.tsx` effect |

## Menus / overlays

| Surface | Reduced motion |
|---------|----------------|
| **Main menu** bottom/support panels | Static | `MainMenu.module.css` |
| **MainMenuBackground** atmosphere | Fallback | `MainMenuBackground.module.css` |
| **Overlay modal** backdrop/modal motion | Reduced | `OverlayModal.module.css` |
| **Game over** hero/action panels | Reduced | `GameOverScreen.module.css` |
| **Settings** shell modal | Reduced | `SettingsScreen.module.css` |
| **Startup intro** chromatic / CTA / fallback | Reduced | `StartupIntro.module.css` |
| **App** ambient grid / content | Reduced motion variant | `App.module.css` |
| **Panel / UiButton** | Transition trims | `Panel.module.css`, `UiButton.module.css` |
| **AccentBanner** | Reduced | `AccentBanner.module.css` |

## Maintenance

When adding motion, either:

- Respect **`settings.reduceMotion`** in JS, and/or  
- Scope CSS animation under **`[data-reduce-motion='false']`** or provide a static branch for **`true`**.

Update this table when new motion hooks ship.
