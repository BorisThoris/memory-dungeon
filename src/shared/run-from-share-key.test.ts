import { describe, expect, it } from 'vitest';
import { createRunFromShareKey } from './run-from-share-key';
import { createGauntletRun, createNewRun, createWildRun } from './run-creation-rules';
import { describeRunShareKey, type RunShareKey } from './run-share-key';
import { describeRunModeIdentity } from './run-mode-identity';

const keyOf = (run: Parameters<typeof describeRunShareKey>[0]): RunShareKey => {
    const described = describeRunShareKey(run);
    if ('refusal' in described) {
        throw new Error(`expected a key, got: ${described.refusal}`);
    }
    return described.key;
};

describe('createRunFromShareKey', () => {
    it('deals the same board a key was made from', () => {
        const original = createWildRun(0);
        const replayed = createRunFromShareKey(keyOf(original), 0);

        expect(replayed.runSeed).toBe(original.runSeed);
        expect(replayed.runRulesVersion).toBe(original.runRulesVersion);
        expect(replayed.board?.tiles.map((tile) => tile.pairKey)).toEqual(
            original.board?.tiles.map((tile) => tile.pairKey)
        );
    });

    it('gives back the mode the key names, not the mode underneath it', () => {
        for (const original of [
            createNewRun(0),
            createWildRun(0),
            createNewRun(0, { practiceMode: true }),
            createNewRun(0, {
                activeContract: { bonusRelicDraftPick: true, maxMismatches: null, noDestroy: true, noShuffle: true }
            }),
            createNewRun(0, {
                activeContract: { maxMismatches: null, maxPinsTotalRun: 10, noDestroy: false, noShuffle: false }
            })
        ]) {
            const replayed = createRunFromShareKey(keyOf(original), 0);
            expect(describeRunModeIdentity(replayed).label, describeRunModeIdentity(original).label).toBe(
                describeRunModeIdentity(original).label
            );
        }
    });

    it('replays a gauntlet against the same clock', () => {
        const replayed = createRunFromShareKey(keyOf(createGauntletRun(0, 900_000)), 0);
        expect(replayed.gauntletSessionDurationMs).toBe(900_000);
    });

    it('honours the rules version in the key, since tile order comes from seed and rules together', () => {
        const current = createNewRun(0);
        const older = createRunFromShareKey({ ...keyOf(current), rulesVersion: current.runRulesVersion - 1 }, 0);

        expect(older.runRulesVersion).toBe(current.runRulesVersion - 1);
        // Same seed, older rules: a different deal, which is the point of recording the version.
        expect(older.runSeed).toBe(current.runSeed);
    });
});
