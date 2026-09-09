import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { runGameplayCoreSimulation } from './gameplay-core-simulation';
import { WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const initialRun = (seed: number): RunState => ({
    status: 'resolving',
    board: {
        level: 1,
        pairCount: 3,
        columns: 3,
        rows: 3,
        tiles: [
            tile('echo-a', 'echo', 'echo'),
            tile('echo-b', 'echo', 'echo'),
            tile('conduit-a', 'conduit', 'conduit'),
            tile('conduit-b', 'conduit', 'conduit'),
            { ...tile('plain-a', 'plain'), state: 'flipped' },
            tile('plain-b', 'plain'),
            { ...tile('wild', WILD_PAIR_KEY), state: 'flipped' }
        ],
        flippedTileIds: ['plain-a', 'wild'],
        matchedPairs: 0,
        floorArchetypeId: null,
        featuredObjectiveId: null
    } satisfies BoardState,
    runSeed: seed,
    runRulesVersion: 1,
    practiceMode: true,
    wildMenuRun: true,
    wildTileId: 'wild',
    wildMatchesRemaining: 1,
    peekCharges: 0,
    flashPairCharges: 1,
    flashPairRevealedTileIds: [],
    undoUsesThisFloor: 1,
    strayRemoveCharges: 1,
    strayRemoveArmed: true,
    recallFocus: 3,
    powersUsedThisRun: false,
    forgottenTileIdsThisFloor: [],
    pinnedTileIds: [],
    peekRevealedTileIds: [],
    stats: { totalScore: 0, currentLevelScore: 0, currentStreak: 2 }
} as unknown as RunState);

describe('seeded gameplay core simulation', () => {
    /*
     * The seed is a sample, not a contract: the command list below is what 384 steps must reach.
     * Adding content shifts the RNG stream, and 7241 became the one seed in a dozen that stops
     * producing `board.pin_toggle` (its bucket only ever lands on steps with no pinnable tile, at
     * any step count). Re-sample rather than lower the coverage list.
     */
    it('is deterministic, replayable, schema-valid, and invariant-clean', () => {
        const first = runGameplayCoreSimulation(initialRun(7243), { seed: 7243, steps: 384 });
        const second = runGameplayCoreSimulation(initialRun(7243), { seed: 7243, steps: 384 });

        expect(first).toEqual(second);
        expect(first.commands).toHaveLength(384);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.acceptedCommandIds.length + first.rejectedCommandIds.length).toBe(384);
        expect(Object.keys(first.commandTypeCounts)).toEqual(
            expect.arrayContaining([
                'trait.conduit_echo_peek',
                'findable.score_glint',
                'board.peek',
                'board.pin_toggle',
                'board.stray_remove',
                'board.gambit_commit',
                'board.shuffle',
                'board.region_shuffle',
                'board.tile_swap',
                'board.flash_pair',
                'board.undo_resolve',
                'board.destroy_pair',
                'floor.advance',
                'wild_match.consume',
                'board.turn_resolve'
            ])
        );
        expect(first.commandTypeCounts['wild_match.consume']).toBe(1);
        expect(first.commandTypeCounts['board.turn_resolve']).toBe(1);
        expect(first.commandTypeCounts['floor.advance']).toBe(1);
        expect(first.eventTypeCounts['wild_match.consumed']).toBe(1);
        expect(first.eventTypeCounts['board.turn_resolved']).toBe(1);
        expect(first.finalRun.wildMatchesRemaining).toBe(0);
    });

    it('sweeps distinct seeds without negative inventory or replay drift', () => {
        const reports = [11, 29, 47, 83, 131].map((seed) =>
            runGameplayCoreSimulation(initialRun(seed), { seed, steps: 96, invalidTraitChance: 0.35 })
        );

        expect(reports.every((report) => report.replayDeterministic)).toBe(true);
        expect(reports.flatMap((report) => report.invariantViolations)).toEqual([]);
        expect(new Set(reports.map((report) => JSON.stringify(report.commandTypeCounts))).size).toBeGreaterThan(1);
        expect(reports.some((report) => report.rejectedCommandIds.length > 0)).toBe(true);
    });
});
