# NGE-005 Run Identity And Archetypes

## Goal

Make each run form an identity early through loadouts, routes, relics, and trait weighting.

## Acceptance

- Starting loadouts/classes have distinct first-floor decisions.
- Build archetypes influence draft weighting and shop stock.
- Inventory/results summarize the active archetype clearly.
- Archetype effects are deterministic under seeded runs.

## Implemented Slices

- Starting loadouts now bias deterministic shop stock toward their playstyle: Memory Scout sees peek tools, Route Tactician sees row/swap tools, Cursebreaker sees hazard/trait control, and Vaultbreaker sees key insurance while locked exits still take priority.
- Starting loadouts now also bias route reward drafts, so between-floor choices reinforce the selected archetype instead of being route-only.
- Inventory trait-build guidance now includes archetypes implied by the selected starting loadout, before relics are drafted.
- Game-over build recap now persists and summarizes the selected starting loadout, so results carry the run identity forward.
- Relic draft context now carries the selected starting loadout, giving matching trait-build relics early reason copy and bounded draft weight before those traits appear on the board.
- Board trait generation now accepts starting loadout identity and seeds deterministic trait pair/pool bias for Memory Scout, Route Tactician, Cursebreaker, and Vaultbreaker paths.
- Treasure and boss relic archetypes now have direct bounded payoffs: Shrine Echo echoes the first treasure chest into Favor, and Chapter Compass adds score to claimed boss trophy caches.
