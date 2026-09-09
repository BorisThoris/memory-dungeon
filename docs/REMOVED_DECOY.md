# Removed: the glass decoy, the glass floor, and the glass witness

Gen 196. Rules version 44 → 45. Encyclopedia version 37 → 38.

This is the record of the last of the fake cards. It exists so that nobody re-derives the
mechanic from first principles in six months, discovers it was here, and wonders why it left.

## What it was

Three pieces of one idea, all named for glass.

**The `glass_floor` mutator.** Scheduled on floor 7 and floor 19 of every run cycle, on every
seed — twenty of two hundred and forty floors in the census. When it was active, board generation
added one extra card to the deal beyond the pair budget.

**The glass decoy card.** That extra card carried the pair key `__decoy__` and had no partner
anywhere on the board. It was a singleton, like the wild joker, the exit, the shop door and the
lever before it. It could be flipped, it could be peeked, it could not be destroyed, it could not
be strayed, and it never matched anything. Board completion ignored it: a floor was clear when
every real pair was clear, whether the decoy was still face-down or not.

**The `glass_witness` featured objective.** Worth 55 score. It paid out if the decoy never
appeared in a mismatch for the whole floor — never got dragged into a failed flip, never got
caught in a failed gambit. One touch and the witness was failed for the floor, silently, with the
score simply not arriving at the end.

Around those three pieces sat the guards: `decoyFlippedThisFloor` and `glassDecoyActiveThisFloor`
on `RunState`, a `decoyTouched` input on the mismatch transition, a `boardHasGlassDecoy` and a
`decoyTileIds` reader on board inspection, a `decoy_flipped_or_cleared_before_completion` fairness
issue code, a targeting exclusion in destroy and in stray, a proximity-hint exclusion, a solver
exclusion, a purple corner ring on the card back, and an accessibility label that read
"Decoy trap tile".

## Why it went

Because the player asked for it to go, in the same breath as the levers, the shops, the exits, the
fakes and the traps: *"Remove all the dungeon type cards, i feel they just break the flow."*

The flow argument is the whole argument, and it is worth stating properly rather than treating the
instruction as arbitrary.

Every card on this board is a promise that it has a partner somewhere. That promise is what makes
the memory read work: you flip a card, you learn a fact, and the fact is *useful* — it is half of a
pair you will complete later. The decoy broke the promise. It put one card on the board whose only
function was to teach you a fact that was worth nothing, and then to punish you for having learned
it in the ordinary way, by flipping it.

Worse, it did not punish you visibly. The `glass_witness` payout was a number that failed to arrive
at the end of a floor. There was no beat at the moment the decoy was touched. A player who lost the
witness on turn three found out about it forty seconds later, as an absence.

And it was in tension with everything Gen 143 onward built. The cascade rewards committing to a
region: you learn a clump, you break it, the pop carries, the ripple carries further. The decoy
made one card in a clump a landmine, and the correct play against a landmine is to slow down and
avoid the region — the exact opposite of the behaviour the chain ladder pays for. Two systems on
the same board, pulling the player in opposite directions, and only one of them had a meter.

## What it cost to remove

Nothing measurable. That is itself the finding.

The decoy was dealt on 20 of 240 census floors and behind a mutator on two floors of a
twelve-floor cycle. Removing it does not move the pair curve (it was extra, on top of the budget),
the chain ladder, the pop, the ripple, the drop, or the severance drop. The occupancy census does
not lose a counter, because the decoy never had one — which is the sort of thing the Gen 194
accountability audit exists to notice.

Floor 7 keeps its identity. It is still a `boss` floor, still `trap_hall`, still carries
`sticky_fingers`. That mutator is the honest version of the same pressure: a miss costs you a tile
you had already learned, which is a real consequence of a real mistake, applied to a real pair. The
floor's featured objective became `scholar_style` — clear the floor without spending shuffle or
destroy — which asks the same question the witness was reaching for (can you get through this floor
cleanly?) without needing a fake card to ask it.

## The rule this leaves behind

**Every card on the board has a partner.** The wild joker is the single remaining exception, and it
is an exception in the player's favour: it matches *anything*, so learning it is worth more than
learning an ordinary card, not less.

If a future mechanic wants to add a card that does not pair, it has to clear that bar first: it must
make the player's read *more* valuable, not worthless. A card that makes learning it a liability is
the shape this game has now rejected six times — the lever, the shop door, the exit, the trap, the
fake, and now the decoy.

## Where the pieces went

- `glass_floor` — dropped from `MUTATOR_IDS`, the catalog, and the floor schedule.
- `glass_witness` — dropped from `FeaturedObjectiveId`, the objective tables, and the score
  constants (`GLASS_WITNESS_BONUS_SCORE`).
- `__decoy__` / `DECOY_PAIR_KEY` — deleted from `tile-identity.ts`.
- `__exit__` / `EXIT_PAIR_KEY` — deleted in the same pass. The exit card left with the dungeon
  layer at Gen 173; the key had survived as a filter guard on cards nothing could deal any more,
  which is a mechanic zeroed rather than removed. `SINGLETON_UTILITY_PAIR_KEYS` now holds exactly
  one key, the wild joker, and `tile-identity.test.ts` pins that count.
- `decoyFlippedThisFloor`, `glassDecoyActiveThisFloor` — dropped from `RunState`. Old saves
  carrying them are read through the existing unknown-field tolerance; no migration is required
  because neither field was ever read at load.
- The `sys_glass_witness_and_cursed_last` Codex topic became `sys_cursed_last`; the
  `board_glass_decoy` topic is gone.
- `destroyBlockedDecoyBack` — the whole renderer prop chain (bezel, rows, readability, markers,
  scene group) went with it. It had already been hard-wired to `false` at Gen 176 and was drawing
  nothing.
