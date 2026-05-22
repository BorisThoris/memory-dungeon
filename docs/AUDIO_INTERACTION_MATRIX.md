# Memory Dungeon Audio Interaction Matrix

Authoritative semantic sound map for the renderer. Raw typing, passive scrolling, and in-page anchor jumps stay intentionally silent.

## Legend

| Decision | Meaning |
|----------|---------|
| `reuse` | Reuse an existing shipped cue family |
| `new` | Uses one of the new dedicated 29-target cues |
| `silent` | Intentionally no SFX |

## Runtime coverage contract (REG-037)

Machine-readable mirror: `src/renderer/audio/audioInteractionCoverage.ts`.

- Major startup/menu/settings/gameplay/overlay/meta interactions are represented by semantic rows with call sites.
- Repeated one-shots are capped by category in `gameSfx.ts`, `sampledSfx.ts`, and `uiSfx.ts` (`flip` 5, `match` 4, `mismatch` 4, `power` 5, `pressure` 1, `shuffle` 4, `menu` 3, `ui` 5).
- Every audible row uses sampled WAV/OGG with procedural fallback; passive scroll/in-page anchors remain explicitly silent.
- Reduced-motion visual mode never disables essential audio feedback; rows document `reducedMotionSafe`.

## Matrix

| Screen | Interaction | Trigger location | Decision | Cue | Style | Trim | Type | Base reference |
|--------|-------------|------------------|----------|-----|-------|------|------|----------------|
| Startup intro | Intro completes or skip resolves | `StartupIntro.completeIntro` | `new` | `intro-sting` | ceremonial relic sting | 0.24s | sampled + procedural fallback | `Menu_load.wav` |
| Main menu | Primary/secondary menu navigation | `MainMenu` buttons | `reuse` | `ui-click` / `menu-open` / `ui-back` | marble tap / panel swell / cancel tap | 0.04s–0.16s | sampled + procedural fallback | existing |
| Choose Path | Open mode detail / import modal / meditation setup | `ChooseYourPathScreen` | `reuse` | `menu-open` | meta panel reveal | 0.16s | sampled + procedural fallback | `Menu_load.wav` |
| Choose Path | Close detail/import modal / back to menu | `ChooseYourPathScreen` | `reuse` | `ui-back` | soft cancel tap | 0.08s | sampled + procedural fallback | existing |
| Choose Path | Search toggle / page dot change | `ChooseYourPathScreen` | `reuse` | `ui-click` | light browse click | 0.04s | sampled + procedural fallback | existing |
| Choose Path | Meditation mutator checkbox toggle | `ChooseYourPathScreen.toggleMeditationMutator` | `reuse` | `ui-counter` | tiny selection tick | 0.035s | sampled + procedural fallback | `Menu_counter.wav` |
| Settings | Category/subsection/segmented choices | `SettingsScreen.patchSettings` | `reuse` | `ui-click` | browse click | 0.04s | sampled + procedural fallback | existing |
| Settings | Sliders and boolean toggles | `SettingsScreen.patchSettings` | `reuse` | `ui-counter` | restrained tick, throttled | 0.035s | sampled + procedural fallback | `Menu_counter.wav` |
| Settings | Save/reset/import accept | `SettingsScreen` | `reuse` | `ui-confirm` | affirmative ping | 0.09s | sampled + procedural fallback | existing |
| Settings | Back/discard/cancel | `SettingsScreen` | `reuse` | `ui-back` | cancel tap | 0.08s | sampled + procedural fallback | existing |
| Collection | Back button | `CollectionScreen` | `reuse` | `ui-back` | cancel tap | 0.08s | sampled + procedural fallback | existing |
| Inventory | Back button | `InventoryScreen` | `reuse` | `ui-back` | cancel tap | 0.08s | sampled + procedural fallback | existing |
| Codex | Tab switch / back | `CodexScreen` | `reuse` | `ui-click` / `ui-back` | browse / cancel | 0.04s–0.08s | sampled + procedural fallback | existing |
| Game toolbar | Fit board / helper toggles | `GameLeftToolbar` | `reuse` | `ui-click` | utility click | 0.04s | sampled + procedural fallback | existing |
| Game toolbar | Open settings/codex/inventory/abandon confirm | `GameLeftToolbar` / `GameScreen` | `reuse` | `menu-open` | panel reveal | 0.16s | sampled + procedural fallback | `Menu_load.wav` |
| Gameplay | Tile flip / gambit third flip | `useAppStore.pressTile` | `reuse` | `flip` / `gambit-commit` | tactile wood tick / commit chirp | 0.05s / 0.068s | sampled + procedural fallback | existing |
| Gameplay | Match tiers / mismatch | `playResolveSfx` | `reuse` | `match-tier-low|mid|high` / `mismatch` | reward bloom / soft fail | 0.12s–0.18s | sampled + procedural fallback | existing |
| Gameplay | Final gauntlet countdown | `GameScreen` effect on `gauntletRemainingMs` | `new` | `countdown-pressure` | low countdown pulse | 0.09s | sampled + procedural fallback | portfolio-feedback-pack |
| Gameplay | Arm powers and flash pair | store power actions | `reuse` | `power-arm` | affirmative charge chirp | 0.07s | sampled + procedural fallback | existing |
| Gameplay | Peek / stray / destroy / shuffle / floor clear | existing gameplay actions | `reuse` | existing shipped gameplay cues | existing gameplay style | existing | sampled + procedural fallback | existing |
| Pause | Enter paused state | `useAppStore.pause` | `new` | `pause-open` | low suspend chime | 0.12s | sampled + procedural fallback | `Menu_dong.wav` |
| Pause | Resume by button or `P` | `useAppStore.resume` | `new` | `pause-resume` | short upward release ping | 0.12s | sampled + procedural fallback | `Misc_Checkpoint.wav` |
| Overlays | Open shortcuts / abandon confirm / floor-clear menu branch | `GameScreen` | `reuse` | `menu-open` | modal reveal | 0.16s | sampled + procedural fallback | `Menu_load.wav` |
| Overlays | Close shortcuts / abandon cancel | `GameScreen` | `reuse` | `ui-back` | cancel tap | 0.08s | sampled + procedural fallback | existing |
| Relic draft | Relic offer appears | `GameScreen` effect on `run.relicOffer` | `new` | `relic-offer-open` | mystical reveal swell | 0.18s | sampled + procedural fallback | `Misc_UFO_anim.wav` |
| Relic draft | Pick relic | `useAppStore.pickRelic` | `new` | `relic-pick` | warm reward bloom | 0.16s | sampled + procedural fallback | `Extra_Life_Blob.wav` |
| Endless wager | Arm wager | `useAppStore.acceptEndlessRiskWager` | `new` | `wager-arm` | tense upward spark | 0.14s | sampled + procedural fallback | `Misc_Lightning.wav` |
| Game over | Screen enters | `GameOverScreen` mount | `new` | `game-over-open` | elegant downward close | 0.20s | sampled + procedural fallback | `Misc_Fall.wav` |
| Game over | Main menu button | `GameOverScreen` | `reuse` | `ui-back` | cancel/return tap | 0.08s | sampled + procedural fallback | existing |
| Game over | Copy run export success | `GameOverScreen.copyRunExport` | `new` | `ui-copy` | bright archive tick | 0.08s | sampled + procedural fallback | `Menu_counter.wav` |
| Music | Menu / run ambience | `useGameplayMusic` | `reuse` | `menu-loop` / `run-loop` | loop beds | 30s | sampled loop | existing |
