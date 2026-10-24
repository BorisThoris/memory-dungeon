import { DEPTH_HOLD_SEGMENTS, depthHas } from './depth-rules';
import { spendCarve } from './carve-rules';
import { wardenFellsTo } from './warden-rules';
import { wipeFootprints } from './wanderer-rules';
import { grantMisses, missBankCap } from './miss-bank';
import { hasEvolution, KEYSTONE_HEART_PAIRS } from './relic-evolution-rules';
import { promoteRunBeneath } from './board-layers-rules';
import type { RunState, TileSuit } from './contracts';
import { isBoardComplete } from './board-inspection';
import { chainMomentum, runChainMomentumPairs, runLadderChain } from './chain-tier-rules';
import { resolveChunkBreak } from './chunk-break-rules';
import { elementPopSpec } from './element-resonance-rules';
import { finalizeLevel } from './floor-clear-transition';
import { HOURGLASS_GOLD, HOURGLASS_SCORE } from './odd-card-rules';
import { reconcileRealmHolds } from './realm-hold-policy';
import { runNonNegativeInteger } from './run-number-guards';
import { verbReached } from './verb-staircase-rules';

/**
 * The Hold (DGE-008, 2026-10-20): the verb that defers the payoff and releases it as one.
 *
 * From Act II (floor 13) a meter fills one segment per link of the chain, six to arm. Pressing Hold
 * keeps every pair matched after it on the board, its pop waiting: the match scores, counts and
 * casts as any match does, only its break is held. Release fires every held pair's break at once,
 * one per suit so a fire seed cannot walk into water, at the chain the run holds then, and the
 * multiplier is applied once to each break rather than per pair. A miss while holding drops the
 * oldest half of the stack, and never all of it.
 *
 * The plan asked the Hold to lift the late pop share to 0.6. The probe before this was written
 * (BALANCE_NOTES, "The Hold probe") found deferring a pop cannot: every pair matched by hand while
 * holding is one the release can no longer take. The owner chose to build it as planned; it is a
 * verb of timing and score, the chain clip's mega-cascade, not a share fix.
 *
 * A held pair is `matched`, so the board inspector and the tools that want no card face up are
 * untouched; only its tile ids are kept, in `heldSeedIds`, as the release's seeds.
 */
export const HOLD_METER_SEGMENTS = 6;

/** The Hold's meter for this run: Depth 13 (`depth-rules.ts`) asks seven links. */
export const holdSegmentsFor = (run: Partial<Pick<RunState, 'depth'>> | null | undefined): number => (depthHas(run, 'hold_seven') ? DEPTH_HOLD_SEGMENTS : HOLD_METER_SEGMENTS);

const linksOf = (run: Pick<RunState, 'holdLinks'> & Partial<Pick<RunState, 'depth'>>): number => Math.min(holdSegmentsFor(run), runNonNegativeInteger(run.holdLinks));

/** From floor 5 since rules 89, the Living Dungeon's 13 before (`verb-staircase-rules.ts`). */
export const isHoldUnlocked = (run: Pick<RunState, 'board'> & Partial<Pick<RunState, 'runRulesVersion'>>): boolean => verbReached('hold', run);

/** How full the meter is, 0..1, and whether it is armed. */
export const holdMeter = (run: Pick<RunState, 'holdLinks'> & Partial<Pick<RunState, 'depth'>>): { segments: number; armed: boolean } => ({
    segments: linksOf(run),
    armed: linksOf(run) >= holdSegmentsFor(run)
});

/** Pairs held, waiting for the release. */
export const heldPairCount = (run: Pick<RunState, 'heldSeedIds'>): number => Math.floor((run.heldSeedIds ?? []).length / 2);

const betweenTurns = (run: RunState): boolean => run.status === 'playing' && !!run.board && run.board.flippedTileIds.length === 0;

export const canStartHold = (run: RunState): boolean =>
    betweenTurns(run) && !run.holding && !run.zone && isHoldUnlocked(run) && holdMeter(run).armed;

export const canReleaseHold = (run: RunState): boolean => betweenTurns(run) && run.holding === true;

/** Hold: the matches from here on keep their pops. */
export const startHold = (run: RunState): RunState => (canStartHold(run) ? { ...run, holding: true, heldSeedIds: [] } : run);

/**
 * Applied after every resolved turn, before the Warden's: a held match adds its pair to the stack,
 * an unheld one fills the meter, and a miss halves the stack (or empties the meter). A floor that
 * ends lets the hold go: there is nothing left for it to take.
 */
export const applyHoldTurn = (before: RunState, after: RunState): RunState => {
    if (!before.board || !after.board) return after;
    if (after.status === 'levelComplete' || after.status === 'gameOver') {
        return before.holding || (after.heldSeedIds?.length ?? 0) > 0 ? { ...after, holding: false, heldSeedIds: [] } : after;
    }
    const missed = runNonNegativeInteger(after.stats.mismatches) > runNonNegativeInteger(before.stats.mismatches);
    const matched = after.board.matchedPairs > before.board.matchedPairs;
    if (before.holding) {
        // A held card the turn took off the board (the void's spew lays new pairs into cleared cells) is no seed.
        const stillMatched = (id: string): boolean => after.board!.tiles.find((tile) => tile.id === id)?.state === 'matched';
        if (missed) {
            // The oldest half goes; the stack never empties.
            const pairs = heldPairCount(before);
            const keep = pairs <= 1 ? pairs : Math.ceil(pairs / 2);
            return { ...after, heldSeedIds: (before.heldSeedIds ?? []).slice((pairs - keep) * 2).filter(stillMatched) };
        }
        if (matched) {
            const seeds = before.board.flippedTileIds.filter((id) => after.board!.tiles.find((tile) => tile.id === id)?.state === 'matched');
            return { ...after, heldSeedIds: [...(before.heldSeedIds ?? []).filter(stillMatched), ...seeds] };
        }
        const kept = (before.heldSeedIds ?? []).filter(stillMatched);
        return kept.length === (before.heldSeedIds ?? []).length ? after : { ...after, heldSeedIds: kept };
    }
    if (missed) return linksOf(before) > 0 ? { ...after, holdLinks: 0 } : after;
    return matched ? { ...after, holdLinks: Math.min(holdSegmentsFor(before), linksOf(before) + 1) } : after;
};

/**
 * Release: every held pair's break, one per suit, at the chain the run holds now. The floor can
 * clear on it. Returns null when there is nothing to release.
 */
export const releaseHold = (run: RunState): { run: RunState; pairs: number; score: number; held: number } | null => {
    if (!canReleaseHold(run) || !run.board) return null;
    const held = heldPairCount(run);
    const bySuit = new Map<TileSuit | null, string[]>();
    for (const id of run.heldSeedIds ?? []) {
        const suit = run.board.tiles.find((tile) => tile.id === id)?.suit ?? null;
        bySuit.set(suit, [...(bySuit.get(suit) ?? []), id]);
    }
    const chain = chainMomentum(runLadderChain(run), runChainMomentumPairs(run));
    let board = run.board;
    let score = 0;
    let pairs = 0;
    for (const [suit, ids] of bySuit) {
        const result = resolveChunkBreak({ board, run, matchedTileIds: ids, chain, spec: elementPopSpec(run, suit) });
        board = result.board;
        score += result.score;
        pairs += result.brokenPairKeys.length;
    }
    // The odd cards the release broke (`odd-card-rules.ts`): a Turncoat's promise goes with its card, and
    // an Hourglass broken with sand left is caught, as a match would catch it. The release is no turn,
    // so no sand runs and no Turncoat turns.
    const caught = new Set<string>();
    board = {
        ...board,
        tiles: board.tiles.map((tile) => {
            if (tile.state !== 'removed' || (tile.turncoat == null && tile.hourglass == null)) return tile;
            if (runNonNegativeInteger(tile.hourglass) > 0) caught.add(tile.pairKey);
            const { turncoat: _turncoat, turncoatDealt: _dealt, hourglass: _hourglass, ...plain } = tile;
            return plain;
        })
    };
    score += HOURGLASS_SCORE * caught.size;
    // The realm's holds after the cards they held went: frost and vines still cover whole cohorts and leave a
    // pair that can be turned, as after any break (`realm-hold-policy.ts`).
    const tiles = [...board.tiles];
    reconcileRealmHolds(tiles, board.columns, run.board.tiles, new Set(run.pinnedTileIds ?? []));
    board = { ...board, tiles };
    const released: RunState = {
        ...run,
        board,
        ...(caught.size > 0
            ? {
                  gold: runNonNegativeInteger(run.gold ?? 0) + HOURGLASS_GOLD * caught.size,
                  hourglassesCaughtThisRun: runNonNegativeInteger(run.hourglassesCaughtThisRun ?? 0) + caught.size
              }
            : {}),
        holding: false,
        heldSeedIds: [],
        holdLinks: 0,
        holdsReleasedThisFloor: runNonNegativeInteger(run.holdsReleasedThisFloor) + 1,
        largestHoldThisRun: Math.max(runNonNegativeInteger(run.largestHoldThisRun), pairs),
        largestHeldReleaseThisRun: Math.max(runNonNegativeInteger(run.largestHeldReleaseThisRun), held),
        lastHoldRelease: { pairs: held, level: run.board.level, turn: runNonNegativeInteger(run.turnsThisFloor) },
        stats: {
            ...run.stats,
            totalScore: runNonNegativeInteger(run.stats.totalScore) + score,
            currentLevelScore: runNonNegativeInteger(run.stats.currentLevelScore) + score
        }
    };
    // The released cells, and every cell the break cleared, take what lay beneath them (`board-layers-rules.ts`).
    // Keystone Heart (`relic-evolution-rules.ts`): a release of ten pairs or more refills a miss.
    const refilled = hasEvolution(run, 'keystone_heart') && held >= KEYSTONE_HEART_PAIRS && released.missBank
        ? { ...released, missBank: grantMisses(released.missBank, run.board.level, 1, missBankCap(released)) }
        : released;
    // A carve set before the release shaped its pops (`carve-rules.ts`), and a release that took pairs spends it.
    const risen = promoteRunBeneath(pairs > 0 ? spendCarve(refilled) : refilled);
    // The complete Warden falls to a release of twelve or more (`warden-rules.ts`): that release is the win, pairs left or not.
    if (wardenFellsTo(run, held)) {
        const felled = { ...risen, board: wipeFootprints(risen.board!), wardenFelled: true };
        return { run: finalizeLevel(felled, felled.board!), pairs, score, held };
    }
    return { run: isBoardComplete(risen.board!) ? finalizeLevel(risen, risen.board!) : risen, pairs, score, held };
};
