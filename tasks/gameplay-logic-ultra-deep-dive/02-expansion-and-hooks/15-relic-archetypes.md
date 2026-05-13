# Pass 15: Relic Archetypes And Long-Run Identity

## Design Map
- Relic system has 16 relics, rarity/weights, archetype tags, contextual draft reasons, filters, offer services, and build profile derivation.
- Stronger current hooks: `wager_surety`, `parasite_ledger`, `chapter_compass`, `region_shuffle_free_first`, `pin_cap_plus_one`, Favor-to-extra-pick.
- Weakest relics are plain capacity/counter bumps unless UI/action consequences become explicit.

## Weak Spots
- Warden needs survival causality.
- Saboteur needs trap-specific previews and forfeit language.
- Vaultbreaker needs treasure/key/lock/shop decisions.
- Slayer needs visible pre-boss/post-boss payoff.
- Gambit needs route/wager manipulation, not just safer risk.
- Seer needs pin/peek success feedback and solver guardrails.
- Catalyst needs spend verbs and “engine online” state.

## Task Candidates
- Relic role audit v2: classify every relic by changed decision.
- Trap Cartographer: first armed trap each floor marked after memorize.
- Pin Lattice: matching a pinned pair refunds one limited pin placement per floor.
- Cache Insurance: first damaged/destroyed cache loses less value once per floor.
- Boss Rehearsal: pre-boss preview or boss-prep draft bias.
- Guard Conversion: capped unused guard -> small shard/Favor signal.
- Parasite Dividend: clean parasite objective -> shard/Favor tick.

## Verification
- Relic draft tests, exploit one-shot checks, balance smoke, HUD/inventory/Codex build snapshots.

## Refinement Notes
- `Confirmed`: relic archetype infrastructure, summaries, decision verbs, role audit rows, and build profiles already exist.
- `Outdated`: "Relic role audit v2" should become a decision-impact acceptance pass, not a new baseline audit.
- `Confirmed`: several weakest relics are still mostly capacity/counter bumps unless UI/action consequences make the changed decision visible.
- `Likely`: Slayer, Gambit, and Catalyst weak spots are partly stale because some payoff hooks exist, but boss-specific and engine-state presentation remain deferred.
- Acceptance should require each relic to name the changed decision, UI surface, and regression proving the consequence is visible.
