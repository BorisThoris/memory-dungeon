import { describe, expect, it } from 'vitest';

import { GAME_RULES_VERSION } from './contracts';
import { createNewRun } from './run-creation-rules';
import { finishMemorizePhase, flipTile } from './game';
import { applyBomb, bombTargetTileId } from './board-power-actions';
describe('run creation rules', () => {
    it('gives a normal new run a usable bomb without buying or injecting inventory', () => {
        const run = finishMemorizePhase(createNewRun(0, { runSeed: 20_001 }));
        expect(run.bombCharges).toBe(1);
        const tile = run.board!.tiles.find((candidate) => candidate.state === 'hidden')!;
        const flipped = flipTile(run, tile.id);
        expect(bombTargetTileId(flipped)).toBe(tile.id);
        const after = applyBomb(flipped, tile.id);
        expect(after.bombCharges).toBe(0);
        expect(after.board!.tiles.filter((candidate) => candidate.pairKey === tile.pairKey)
            .every((candidate) => candidate.state === 'removed')).toBe(true);
        expect(after.turnsThisFloor).toBe(run.turnsThisFloor);
        expect(after.missBank).toEqual(run.missBank);
    });

    it('preserves the starting inventory of historical shared runs', () => {
        expect(createNewRun(0, { runRulesVersionOverride: 50 }).bombCharges).toBe(0);
    });

    it('creates a deterministic base run with an initialized board', () => {
        const run = createNewRun(123, {
            runSeed: 20_001,
            runRulesVersionOverride: GAME_RULES_VERSION,
            echoFeedbackEnabled: false
        });

        expect(run.status).toBe('memorize');
        expect(run.stats.bestScore).toBe(123);
        expect(run.board?.level).toBe(1);
        expect(run.findablesTotalThisFloor).toBeGreaterThanOrEqual(0);
        expect(run.timerState.memorizeRemainingMs).toBeGreaterThan(0);
    });


});
