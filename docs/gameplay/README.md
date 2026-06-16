# Gameplay documentation

## Authoritative catalog (complete coverage)

**[GAMEPLAY_MECHANICS_CATALOG.md](./GAMEPLAY_MECHANICS_CATALOG.md)** is the **full matrix** of gameplay mechanics: every major rule cluster, store actions, settings that affect play, input channels, and read-only UI. **§14 + Appendices A–D** list **every field** on `RunState`, `RunTimerState`, `SessionStats`, `BoardState`, and **`Tile`** from `src/shared/contracts.ts`. **Start here** to verify nothing is missing.

**[GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md)** is the **rollup** of polish needs, partial implementations, and doc/UX risks—synthesized from each epic’s refinement notes (not a second source of truth).

Epics below are **narrative deep dives** + refinement notes; they must stay consistent with the catalog when mechanics change.

---

## Epic index

| Epic | Topic |
|------|--------|
| [GAMEPLAY_MECHANICS_CATALOG](./GAMEPLAY_MECHANICS_CATALOG.md) | **Master checklist** — all mechanics mapped to code and epics |
| [GAMEPLAY_EPIC_ACCEPTANCE_REPORT](./GAMEPLAY_EPIC_ACCEPTANCE_REPORT.md) | **Closure report** — converted theory epics mapped to implementation and test coverage |
| [GAMEPLAY_POLISH_AND_GAPS](./GAMEPLAY_POLISH_AND_GAPS.md) | **Polish / partial / risky** — consolidated from epics |
| [hazard-tile-matrix](./hazard-tile-matrix.md) | Hazard tile taxonomy, safe-target rules, objective impact, and live-copy contract |
| [epic-core-memory-loop](./epic-core-memory-loop.md) | Flips, match/mismatch, gambit, wild, decoy, resolve timing |
| [epic-run-session-flow](./epic-run-session-flow.md) | Memorize/play/resolving, pause, advance, relic gate, undo, debug peek |
| [epic-board-rendering-assists](./epic-board-rendering-assists.md) | WebGL board, findables/shifting spotlight, pair-distance hints, focus assist, presentation mutator **3D tints** |
| [epic-mutators](./epic-mutators.md) | All mutator IDs, daily table, endless floor schedule |
| [epic-scoring-objectives](./epic-scoring-objectives.md) | Match score, floor clear, flip par, boss multiplier, penalties |
| [epic-lives-and-pressure](./epic-lives-and-pressure.md) | Lives, guard, combo shards, echo, gauntlet timer, score parasite |
| [epic-powers-and-interactions](./epic-powers-and-interactions.md) | Peek, shuffle, region shuffle, tile swap, destroy, pin, stray, undo, flash pair |
| [epic-relics](./epic-relics.md) | Relic pool, milestones, `applyRelicImmediate` |
| [epic-route-world-pipeline](./epic-route-world-pipeline.md) | Route choice as next-floor world generation: Safe/Greed/Mystery profiles, card families, side-room hooks |
| [epic-modes-and-runs](./epic-modes-and-runs.md) | Game modes, practice/scholar/pin vow/wild, puzzles, import/export |
| [epic-meta-progression](./epic-meta-progression.md) | Achievements, telemetry, saves, `powersUsedThisRun` |
| [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) | Scholar / pin vow `activeContract` |
| [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) | Symbol bands, atomic variants, generation |
| [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) | Board presentation, shuffle stagger, flip pop, tilt, reduce motion |
| [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) | How-to, powers FTUE, Codex, tutorial **WebGL pair badges** |
| [epic-audio-feedback](./epic-audio-feedback.md) | Volume settings + **procedural gameplay SFX** |
| [epic-readonly-meta-ui](./epic-readonly-meta-ui.md) | Codex, Collection, Inventory (no rule changes) |
| [epic-choose-your-path](./epic-choose-your-path.md) | Choose Your Path: layout/zoom, drag-first library, magnifier search, cross-platform interaction, catalog, a11y, QA |

---

## How each doc is structured

- **Scope** — intent.
- **Implementation status** — shippable / functional / partial.
- **Rough edges** — stubs, drift, risks.
- **Primary code** — files to read.

**Refinement legend:**

| Level | Meaning |
|-------|--------|
| **Shippable** | Rules + feedback loop complete for typical players. |
| **Functional** | Core works; polish or edge cases incomplete. |
| **Partial** | Stub, hidden feature, or divergence from copy. |
| **Risky** | Comment/code mismatch or easy to misuse. |

---

## Maintenance

1. Change **[GAMEPLAY_MECHANICS_CATALOG](./GAMEPLAY_MECHANICS_CATALOG.md)** when adding or removing a mechanic.
2. Update the relevant **epic** (or add one if the catalog gains a new section).
3. Adjust **[GAMEPLAY_POLISH_AND_GAPS](./GAMEPLAY_POLISH_AND_GAPS.md)** when a polish gap closes or a new one appears (keep it a rollup, not a duplicate catalog).
4. Update the relevant epic’s **## Tasks (polish backlog)** checkboxes when work ships; add new tasks there first, then reflect in the polish doc if needed.
5. Keep this **README** index in sync.
