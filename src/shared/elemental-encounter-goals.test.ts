import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-build-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { deepenFloorDeck } from './realm-rules';
import { inspectBoardFairness } from './board-inspection';
import { createNewRun } from './run-creation-rules';
import { createRunFromShareKey } from './run-from-share-key';
import { describeRunShareKey, encodeRunShareKey, parseRunShareKey } from './run-share-key';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { featuredRecipePairKeys } from './secondary-objective-rules';
import { REALM_IDS } from './contracts';

describe('current elemental encounters and seeded camp recipes', () => {
    it('plays the guaranteed recipe through generated encounters without a carried burst consuming it', () => {
        for (const level of [5, 7]) for (const seed of [1, 17, 42001]) for (const realmId of REALM_IDS) {
            const base = createNewRun(0, { runSeed: seed });
            let run = finishMemorizePhase(advanceToNextLevel({ ...base, status: 'levelComplete',
                board: { ...base.board!, level: level - 1 },
                nextRealm: { realmId, severity: 'raging' },
                elementStreak: { suit: 'ember', links: 200 }, elementResonance: { ember: 50 },
                stats: { ...base.stats, currentStreak: 20 } }));
            expect(run.elementStreak).toBeNull();
            expect(run.elementResonance?.ember).toBe(50);
            expect(run.stats.currentStreak).toBeGreaterThan(0);
            const keys = [...featuredRecipePairKeys(run.board!)];
            for (const key of keys) {
                const pair = run.board!.tiles.filter(tile => tile.pairKey === key);
                // The existing flip-order lock may mark one half; open with its partner.
                const ordered = run.stickyBlockIndex != null && run.board!.tiles[run.stickyBlockIndex]?.id === pair[0]!.id ? [...pair].reverse() : pair;
                run = resolveBoardTurn(flipTile(flipTile(run, ordered[0]!.id), ordered[1]!.id));
            }
            expect(level === 5 ? run.amplifiedGoalThisFloor : run.calmGoalThisFloor).toBe(true);
        }
    });
    it('supplies every featured recipe across seeds and late cycles, even with deep attunement', () => {
        for (let seed = 0; seed < 40; seed++) for (const level of [5, 7, 17, 19, 41, 43]) {
            const entry = pickFloorScheduleEntry(seed, 64, level, 'endless');
            expect(['amplified_reaction', 'calm_reaction']).toContain(entry.featuredObjectiveId);
            const board = buildBoard(level, { runSeed: seed, runRulesVersion: 64, ...entry, activeMutators: entry.mutators });
            const pairs = new Map(board.tiles.map(tile => [tile.pairKey, tile.suit]));
            const suits = [...pairs.values()];
            const primer = entry.featuredObjectiveId === 'calm_reaction' ? 'tide' : 'ember';
            const catalyst = entry.featuredObjectiveId === 'calm_reaction' ? 'bone' : 'tide';
            expect(suits.filter(suit => suit === primer).length).toBeGreaterThanOrEqual(2);
            expect(suits).toContain(catalyst);
            const deep = deepenFloorDeck(board, 'ember', 100, seed, 64);
            const deepSuits = [...new Map(deep.tiles.map(tile => [tile.pairKey, tile.suit])).values()];
            expect(deepSuits.filter(suit => suit === primer).length).toBeGreaterThanOrEqual(2);
            expect(deepSuits).toContain(catalyst);
            expect(inspectBoardFairness(board).hasCompletionRoute).toBe(true);
            expect(buildBoard(level, { runSeed: seed, runRulesVersion: 64, ...entry, activeMutators: entry.mutators })).toEqual(board);
        }
    });
    it('keeps historical encounter objectives and default share key shape', () => {
        expect(pickFloorScheduleEntry(1, 63, 5, 'endless').featuredObjectiveId).not.toBe('amplified_reaction');
        expect(encodeRunShareKey({ variant: 'classic', rulesVersion: 63, seed: 17, campPreference: 'score' })).toBe('md1:classic:63:17');
    });
    it('carries each camp preference through exact-seed share and restart identity', () => {
        for (const campPreference of ['survive', 'study', 'score'] as const) {
            const run = createNewRun(0, { runSeed: 17, campPreference });
            const recipe = describeRunShareKey(run);
            if ('refusal' in recipe) throw new Error(recipe.refusal);
            const key = parseRunShareKey(encodeRunShareKey(recipe.key))!;
            expect(createRunFromShareKey(key, 0).campPreference).toBe(campPreference);
        }
    });
});
