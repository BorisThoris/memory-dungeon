import type { CreateRunOptions } from './run-creation-rules';
import {
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createWildRun
} from './run-creation-rules';
import { createDungeonShowcaseRun } from './dungeon-showcase-run-rules';
import type { RunState } from './contracts';
import type { RunShareKey } from './run-share-key';

/**
 * Builds the run a share key describes.
 *
 * The key carries the seed *and* the rules version the run was played under, and both go in: tile
 * order is derived from the pair, so replaying an older key under today's rules would deal a
 * different board and quietly call it the same run. `runRulesVersionOverride` exists for exactly
 * this, and this is the first thing to use it.
 *
 * Every branch routes to the same factory the mode's own menu entry uses, so a shared run and a
 * run started from the library are the same run, not two things that look alike.
 */

const CONTRACT_SCHOLAR = { bonusRelicDraftPick: true, maxMismatches: null, noDestroy: true, noShuffle: true };
const CONTRACT_PIN_VOW = { maxMismatches: null, maxPinsTotalRun: 10, noDestroy: false, noShuffle: false };

export const createRunFromShareKey = (
    key: RunShareKey,
    bestScore: number,
    meta: Partial<CreateRunOptions> = {}
): RunState => {
    const seeded: Partial<CreateRunOptions> = {
        ...meta,
        runRulesVersionOverride: key.rulesVersion,
        runSeed: key.seed
    };

    switch (key.variant) {
        case 'gauntlet':
            return createGauntletRun(bestScore, key.durationMs ?? 0, seeded);
        case 'meditation':
            return createMeditationRun(bestScore, key.mutators ? [...key.mutators] : undefined, seeded);
        case 'pin_vow':
            return createNewRun(bestScore, { ...seeded, activeContract: CONTRACT_PIN_VOW });
        case 'practice':
            return createNewRun(bestScore, { ...seeded, practiceMode: true });
        case 'scholar':
            return createNewRun(bestScore, { ...seeded, activeContract: CONTRACT_SCHOLAR });
        case 'showcase':
            return createDungeonShowcaseRun(bestScore, seeded);
        case 'wild':
            return createWildRun(bestScore, seeded);
        default:
            return createNewRun(bestScore, seeded);
    }
};
