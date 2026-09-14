# Pass 18: Feedback Language And Causality

## Design Map
- HUD exposes floor, lives, score, objectives, mutators, hazards, Perfect Memory, and secondary stats.
- Board feedback covers focus, states, targeting accents, hazard accents, sticky marks, pair proximity, tutorial markers, and reduced motion.
- Floor-clear causality rows are rich.
- Codex/glossary is centralized in `mechanics-encyclopedia.ts`.
- Runtime audio hooks exist, but dungeon audio coverage includes placeholder mappings.
- A11y surfaces include tile focus labels, board live region, HUD live region, and axe route checks.

## Weak Spots
- Immediate visible causality is thinner than floor-clear retrospective causality.
- Dungeon-specific audio is partly aspirational.
- Touch users miss `title` tooltip detail.
- Perfect Memory lock copy lacks last-action attribution.
- Terminology overlaps: trap, hazard, decoy, trap card, hazard tile.
- Sticky Fingers, Flip Par, and Gambit timing remain clarity edges.

## Task Candidates
- Add an in-run cause strip for last mechanic event.
- Promote hazard/route event text from SR-only live region to visible event chip.
- Add Perfect Memory last-locking-action attribution.
- Convert critical HUD titles into touch-accessible popovers/details.
- Wire or mark dungeon audio coverage rows.
- Do terminology pass.

## Verification
- Unit/component tests for cause attribution.
- E2E for visible event chips.
- Store audio hook tests.
- Keyboard/a11y flows for new surfaces.

## Follow-up refinement — 2026-09-14
- The cause strip and touch HUD detail surfaces are implemented. This pass verified a remaining attribution defect: the Perfect Memory read model inferred chronology from floor flags and aggregate counters, so a later Gambit could replace an earlier Peek as the reported lock source.
- Successful assist transitions now record the first and latest disqualifying action in optional run-local feedback metadata. All ten assist types are covered; rejected actions and pins do not write history. Floor transitions preserve it and new runs start without history.
- HUD, inventory, cause rows, and touch details use the recorded history. Older runs with no history explicitly report an earlier unknown assist rather than guessing from counters.
- Regression coverage: `src/shared/perfect-memory-actions.test.ts`, `src/shared/long-run-feedback.test.ts`, and `src/renderer/components/GameplayHudBar.test.tsx`.
- Eligibility, rewards, generation, and saved progress are unchanged; this is feedback metadata, with no rules/seed or save-schema version bump.
- See [refinement validation](../2026-09-14-refinement-validation.md) for checks and remaining baseline failures.

## Refinement Notes
- `Confirmed`: floor-clear causality rows are strong and visible.
- `Confirmed`: immediate causality is thinner; current board feedback includes SR live text/data attributes but no visible in-run cause strip.
- `Confirmed`: touch users can miss critical detail currently stored in `title` attributes.
- `Confirmed`: Perfect Memory copy lacks first/latest locking-action attribution.
- `Confirmed`: dungeon audio coverage includes placeholder mappings; tests only require known non-silent cues.
- Acceptance should test visible event text, Perfect Memory lock source, touch-accessible HUD detail, audio placeholder policy, and terminology cleanup.
