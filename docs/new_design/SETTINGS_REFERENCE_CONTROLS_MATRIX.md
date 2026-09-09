# Settings: reference controls vs live model

## Purpose
Classify every control shown in reference comps as **implemented**, **deferred (honest UI)**, or **out of scope** (phase-2 card-theme / difficulty rows align with [`PLAYING_ENDPRODUCT/README.md`](TASKS/PLAYING_ENDPRODUCT/README.md) asset backlog where applicable).

## Live `Settings` fields (summary)
See `src/shared/contracts.ts` and `DEFAULT_SETTINGS` in `src/shared/save-data.ts`. Live controls include volumes, display mode, UI scale, reduce motion, board presentation, resolve delay, shuffle strength, focus assist, echo feedback, distraction channel, shuffle score tax, debug flags, etc.

## Reference-only rows (UI today)
Rendered under **Settings → Controls → “Future tuning (not wired)”** in `SettingsScreen.tsx`:

| Control (reference) | Live behavior | Plan row (`settings-control-model.ts`) | Notes |
|---------------------|---------------|--------------------------------------|--------|
| Difficulty | Disabled placeholder buttons | `difficulty` / `future_rules_variant` | Copy states no live setting; balance curve is fixed. |
| Timer Mode | Disabled placeholder | `timer_mode` / `future_rules_variant` | Not connected to save or rules. |
| Card Theme | Disabled placeholder | `card_theme` / `cosmetic_theme` | Asset slots only; no theme picker in schema. |
| Tutorial Hints | Disabled placeholder | `tutorial_hints` / `future_ui_preference` | Current onboarding flags are persisted (`onboardingDismissed`, `powersFtueSeen`); no independent settings toggle. |

## Honesty rule
If a future build wires any of the above, add the field to `Settings`, migrate save data, and **remove** the disabled placeholder row for that control.

## Related
- [CURRENT_VS_TARGET_GAP_ANALYSIS.md](CURRENT_VS_TARGET_GAP_ANALYSIS.md) — Settings mapping
- Settings shell implementation lives in `SettingsScreen.tsx` / meta docs in [`TASKS_META_AND_SHELL.md`](TASKS/TASKS_META_AND_SHELL.md)
