import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { runGameplayCoreSimulation } from './gameplay-core-simulation';

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const initialRun = (seed: number): RunState => ({
    status: 'playing',
    board: {
        level: 1,
        pairCount: 3,
        columns: 3,
        rows: 2,
        tiles: [
            tile('echo-a', 'echo', 'echo'),
            tile('echo-b', 'echo', 'echo'),
            tile('conduit-a', 'conduit', 'conduit'),
            tile('conduit-b', 'conduit', 'conduit'),
            tile('plain-a', 'plain'),
            tile('plain-b', 'plain')
        ],
        flippedTileIds: [],
        matchedPairs: 0,
        floorArchetypeId: null,
        featuredObjectiveId: null
    } satisfies BoardState,
    runSeed: seed,
    runRulesVersion: 1,
    peekCharges: 0,
    recallFocus: 3,
    rewardPerkIds: [],
    relicIds: [],
    powersUsedThisRun: false,
    forgottenTileIdsThisFloor: [],
    peekRevealedTileIds: [],
    stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 }
} as unknown as RunState);

describe('seeded gameplay core simulation', () => {
    it('is deterministic, replayable, schema-valid, and invariant-clean', () => {
        const first = runGameplayCoreSimulation(initialRun(7241), { seed: 7241, steps: 128 });
        const second = runGameplayCoreSimulation(initialRun(7241), { seed: 7241, steps: 128 });

        expect(first).toEqual(second);
        expect(first.commands).toHaveLength(128);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.acceptedCommandIds.length + first.rejectedCommandIds.length).toBe(128);
        expect(Object.keys(first.commandTypeCounts)).toEqual(
            expect.arrayContaining([
                'bonus_reward.echo_conduit_lens',
                'relic.peek_charge_plus_one',
                'reward_perk.echo_conduit_double',
                'board.peek'
            ])
        );
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
