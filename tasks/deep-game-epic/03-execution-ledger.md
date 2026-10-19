# Execution ledger

Append a row per session. Never mark a ticket complete unless its acceptance criteria are met and the checklist rows in its handoff notes are ticked.

| Date | Ticket | What was done | Verification | Blockers | Next recommended |
| --- | --- | --- | --- | --- | --- |
| 2026-10-19 | pack | Pack written: plateau measurements, research findings, plan, checklist, 32 tickets. No runtime code changed. | `yarn ai:model:check`, `yarn gate:systems` on the docs-only change | None | DGE-001, then DGE-002 and DGE-003 in parallel |
| 2026-10-19 | DGE-001 | Re-measured the four plateau facts on main (rules 69): cycle and boss slot unchanged; the board grows again past floor 60; the pop is still a hill; **runs now end on their own** (15% misses: median floor 20). Recorded defaults for the three open decisions. REG-018/019/020 marked superseded in part. | `yarn sim:pop`, `yarn sim:pop-share`, `yarn sim:run`, `yarn sim:survival [--items]`, `pairsForFloor` | The Warden-floor decision now hinges on fact 4: most players end near floor 20 | DGE-002 and DGE-003 in parallel; read DGE-005 and DGE-032 against the new fact 4 |

## Open decisions for the owner
Defaults recorded 2026-10-19 (DGE-001); the owner has not answered yet, so each ticket takes the default until they do.
- Floor 60 as the Warden's floor, or 48 (four acts of twelve, matching the current cycle length). The plan says 60 to give Act III and IV room; the sim in DGE-032 should say whether average players reach 48 at all. **Default: 60, as the plan says.** Measured since: the median 15%-miss run ends at floor 20 and the 20%-miss run at 11, so neither reaches 48; only the 10%-miss player meets a Warden at either depth.
- Four relic slots or three. Four keeps every current relic purchasable in one run; three forces the choice sooner. **Default: four, as the plan says** (four relics are sold today: Deep Pockets, Gilded Chain, Long Look, Tallow Candle; the Miser's Purse is a curio relic, offered, not sold).
- Whether Endless keeps the board frozen at 24 pairs with Layers supplying depth, or grows toward `LATE_PAIRS_MAX`. DGE-006 proposes growth; DGE-032's Goldilocks probe decides. **Default: growth** - it is what `pairsForFloor` already does past floor 60 since rules 60.
