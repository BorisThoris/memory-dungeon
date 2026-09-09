# Removed: the settle

> The board no longer repacks itself after a break. Shipped at Gen 190, removed at Gen 192, on the
> player's call. Kept here because the problem it was built for is still open, and whoever picks it
> up next should start from what it cost rather than from the idea.

## What it was

`board-settle-rules.ts` ran after every match resolved. Cards a match or a break had taken left
holes, and the cards still in play fell inward to close them: take the closest gap-and-card pair on
the board, put the card in the gap, and repeat, where a card may only ever move to a cell nearer the
middle than the one it is in. A floor was meant to play like sand collecting in a globe rather than
a grid slowly going hollow.

It came with `boardSettleMotion.ts` and a damped glide window in the scene, so the cards slid to
their new cells rather than appearing in them.

## Why it went

**It moved cards a player had memorised.** That is the one cost a memory game cannot pay, and no
amount of care in the movement rule buys it back. The settle was built to be gentle about it -
globally-closest pairs so a card moves as short a distance as possible, the hole walking outward
rather than a card being flung across the grid - and gentle is still moved. A player who has spent
four flips learning that the ace is third from the left has been told a lie the moment it is second.

There is no version of this that is only a little bit true. Either the grid a player memorises is
the grid they come back to, or it is not.

## What it cost while it was in

Measured over the forty-eight seeds the cascade simulation always uses.

| | Ripple mean | Breaks that rippled | Fever share, reference |
|---|---|---|---|
| Before the settle (Gen 189 boards) | 1.08 | 0.07 | 0.19 |
| With the settle (Gen 190) | 1.00 | **0.00** | 0.19 |
| With the settle, on wider boards (Gen 191) | 1.02 | 0.02 | 0.18 |
| Without it, on wider boards (Gen 192) | 1.16 | **0.16** | 0.17 |

The ripple was the loudest casualty and the clearest signal. A packed board makes the first wave's
clump big enough to swallow the partners that used to seed a second, so the reaction moved into
wave 0 where it has no name and no beat. Removing the settle did not merely restore it: on Gen 191's
wider boards the ripple now fires on 0.16 of breaks at zero misses, more than twice what it managed
before any of this.

Two generations of work were spent chasing that number - Gen 191's pair curve and palette, and a
task filed to change what a wave may take - and the cause turned out to be the settle itself.

## The problem it was for, which is still open

A board that never moves is a board whose clumps only ever shrink. As a floor empties the cascade
decays toward nothing, and the last matches of a floor are worth little to break with. That is real,
and it is measurable: `largest` (the biggest break's share of a floor's score) and the tail of
`breaks/floor` are where it shows.

What is now known about the shape of an answer:

- **It cannot move a card the player could have learned.** That rules out compaction, gravity in any
  direction, and re-dealing. Every one of them is the settle wearing a different hat.
- **It may move cards the player has not seen.** A card that has never been face-up carries no
  memory to break. Nothing in the run state tracks that today.
- **It may change what a wave takes rather than where the cards are.** The reach, the partner rule
  and the drop all decide which cards a break reaches without touching the grid. Gen 192's task list
  keeps this line open.
- **It may add to the board rather than rearrange it.** New cards falling into the holes is a
  different mechanic with a different cost, and it does not lie about the cards already down.

## What went with it

| Module | What it did |
|---|---|
| `src/shared/board-settle-rules.ts` | The settle itself, and `tileIsSettleLive` |
| `src/shared/board-settle-rules.test.ts` | Its properties: inward-only, pure, idempotent, gap-closing |
| `src/renderer/components/boardSettleMotion.ts` | The board signature that told the scene a settle had happened |
| `src/renderer/components/boardSettleMotion.test.ts` | Its tests |

Also removed: the `settleMotionDeadlineMs` prop through the scene chain, `SETTLE_POSITION_LAMBDA`
and `SETTLE_MOTION_BUDGET_MS`, the `board.settle` graph node and its two edges, the Codex entry, and
the release-checklist row with its verifier.

## What stayed

**Cleared cards still leave the board.** A matched pair departs the way a broken one does, rather
than lying face-up in its cell. That was asked for in the same breath as the settle and it is the
half that costs a player nothing: the card is gone, the hole stays where it was, and nothing the
player learned about the grid has changed.
