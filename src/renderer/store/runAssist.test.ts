import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { normalizeRunHistory } from '../../shared/run-history-log';
import { trackRunAssist, withRunAssist } from './runAssist';

const run = (status: RunState['status']): RunState => ({ ...createNewRun(0, { runSeed: 77 }), status });

describe('an assisted run', () => {
    it('is any run that had pair-distance hints on at some point, and stays so', () => {
        trackRunAssist(null, run('playing'), false);
        expect(withRunAssist(run('gameOver')).assisted).toBeUndefined();
        trackRunAssist(run('playing'), run('playing'), true);
        trackRunAssist(run('playing'), run('playing'), false);
        expect(withRunAssist(run('gameOver')).assisted).toBe(true);
    });

    it('starts clean on the next run, from the menu or straight after game over', () => {
        trackRunAssist(null, run('playing'), true);
        trackRunAssist(run('playing'), run('gameOver'), false);
        trackRunAssist(run('gameOver'), run('memorize'), false);
        expect(withRunAssist(run('gameOver')).assisted).toBeUndefined();
    });

    it('keeps the label in the saved history, and nothing on older rows', () => {
        const row = { endedAtIso: '2026-11-18T00:00:00.000Z', highestLevel: 4, mode: 'Classic', shareKey: null, totalScore: 900 };
        expect(normalizeRunHistory([{ ...row, assisted: true }, row]).map((record) => record.assisted)).toEqual([true, undefined]);
    });
});
