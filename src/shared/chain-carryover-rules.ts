/**
 * The chain follows you down the stairs. The ladder does not.
 *
 * Until Gen 262 a floor clear zeroed the streak: the last pair of floor N resolved with a chain of
 * nine standing, the stairs took it, and floor N+1 opened cold. That is the one moment in the run
 * where the player did everything right and the game answered by taking the thing they built - a
 * miss only *halves* the chain (`turn-mismatch-rules.ts`) and a clear wiped it, so success was
 * punished harder than failure. So the chain carries. What it may not carry is a **rung**.
 *
 * **The cap is measured, and it is small, and both of those are the finding.**
 *
 * Clean is the rung where a break starts to ripple (`chunk-break-rules.ts`), so every link handed
 * to a floor for free is a break that reaches further than it would have, earlier than it would
 * have, on a board the player has not begun to read. That cost was measured against the curve and
 * the census rather than guessed at:
 *
 * - Capping at one short of **Sharp** (the first cut, on the reasoning that Sharp and Fever are
 *   the rungs the run counts and pays for) ended floors 7, 9, 18, 19 and 30 in under two turns
 *   against a band that wants at least two. The narrow-palette floors went first - 20 floors of
 *   two suits or fewer spent 0.286 of their par against 32 wider floors' 0.514 - because on those
 *   boards almost everything can chain. A floor that is over in 1.9 turns is not a floor.
 * - Capping at one short of **Clean** still left that gap at 0.166 over a band of 0.12, and took
 *   the peek from 0.908 of floors to 0.892 against a core bar of 0.9: floors were ending before
 *   their own systems got a turn.
 * - **One link** holds every band. The curve, the cascade bands, the long-run depth and the run
 *   census all pass.
 *
 * So the rule is one link, and the honest way to read it is not "some of your chain survives" but
 * **the clear is itself the first link of the next floor's chain**. The floor you just finished
 * counts as a match toward the floor you are starting. A player arrives one match from Clean
 * instead of three, feels it on the very first pair they turn over, and no tier is ever handed to
 * a board that did not earn it.
 *
 * A bigger carry is available to anyone who wants it, but it is not free and it is not a tuning
 * knob: it costs floor length, and the floor curve and the occupancy census would have to be
 * re-banded with it, deliberately, as their own change.
 *
 * The cascade momentum (`chunkPairsThisChain`) does not carry at all. It counts pairs that chunks
 * broke on a board that no longer exists, measured against that board's pair count; carrying it
 * would also route momentum around this cap.
 */
import { CHAIN_TIER_CLEAN_FROM } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The most chain a floor boundary carries: one link, which is two short of the Clean rung.
 *
 * Written against the Clean rung rather than as a bare `1` because what the number means is "the
 * carry stops below the first tier, with room to spare"; if the ladder's bottom rung ever moves,
 * this moves with it rather than silently becoming a different rule.
 */
export const CHAIN_CARRYOVER_CAP = CHAIN_TIER_CLEAN_FROM - 2;

/**
 * The chain floor N+1 opens with, given the chain standing when floor N's last pair went.
 *
 * Pure, total and defined for junk input: a malformed streak reads as 0 rather than carrying NaN
 * into the next floor's ladder.
 */
export const carriedChainForNextFloor = (chainAtClear: number): number =>
    Math.min(runNonNegativeInteger(chainAtClear), CHAIN_CARRYOVER_CAP);
