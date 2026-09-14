# Epic: Meta — achievements, telemetry, saves

## Scope

Steam-style achievements, anonymous telemetry hooks, save schema, and how they interact with run flags (`powersUsedThisRun`, `achievementsEnabled`).

## Implementation status

| System | Status | Notes |
|--------|--------|--------|
| Achievements (7 + Steam) | **Shippable** | `achievements.ts` — first clear, level 5, 1000 score, perfect clear, last-life; plus endless floor 10, seven dailies. **Honors:** local-only titles in [`honorUnlocks.ts`](../../src/shared/honorUnlocks.ts) (`honor:*` tags in `saveData.unlocks`, Collection + main menu). |
| Perfect clear rule | **Functional** | Gated on `!powersUsedThisRun`; see `RunState.powersUsedThisRun` JSDoc in [`contracts.ts`](../../src/shared/contracts.ts) for the full disqualifier list. |
| Unlock delivery | **Shippable** | `evaluateAchievementUnlocks` from `applyResolvedRun`; `desktopClient.unlockAchievement` when available. |
| Telemetry | **Functional** | Privacy-first v1: `trackEvent` / `setTelemetrySink`; production default is intentional no-op, dev installs a console sink in `App.tsx`, and hosts may inject analytics. |
| Save data | **Shippable** | `save-data.ts`, schema version, `normalizeSaveData` merging new settings keys. |
| Encore pair keys | **Functional** | Stored in player stats for encore scoring hook. |

## Rough edges

- **Telemetry:** Product analytics remains host-injected by design; no bundled remote sink ships in-repo.
- **Achievement fairness:** Power descriptions explain disqualification. Perfect Memory feedback records the actual first/latest assist across floors; older runs without history use an explicit unknown-source fallback.

## Primary code

- `src/shared/achievements.ts`, `achievements.test.ts`
- `src/shared/honorUnlocks.ts`, `honorUnlocks.test.ts`
- `src/shared/telemetry.ts`
- `src/shared/save-data.ts`
- `src/renderer/store/useAppStore.ts` — `applyResolvedRun`, `trackEvent` payloads

## Refinement

**Shippable** for achievements + save. **Functional** for privacy-first telemetry: no-op in production unless a host injects a sink, dev console logging when enabled. Perfect-clear rules are documented on `RunState`; action attribution is shared by HUD, inventory, cause rows, and touch details (2026-09-14 refinement).

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §3–4.

- [x] Wire or document `setTelemetrySink` for shipping builds (Electron main dev hook, opt-in file sink, or product “no analytics” stance).
- [x] Improve perfect-clear discoverability: tooltip, achievement description, or rename so players know undo/peek/gambit/stray/etc. disqualify (coordinate with [epic-powers-and-interactions](./epic-powers-and-interactions.md) comment fix).
