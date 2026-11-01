import { describe, expect, it } from 'vitest';
import { createNewRun } from '../shared/game';
import { withFastDescent } from '../shared/descent-pace-rules';
import { describeRunShareKey } from '../shared/run-share-key';
import { createDefaultSaveData } from '../shared/save-data';
import { createRestartRun } from './store/runStartState';
import { comboCashInRequested, fastDescentRequested } from './testPace';

describe('the test pace switch', () => {
    it('is on for the test deployment and for ?pace=fast, and off everywhere else', () => {
        expect(fastDescentRequested({ hostname: 'memory-dungeon-test.example.workers.dev', search: '' })).toBe(true);
        expect(fastDescentRequested({ hostname: '127.0.0.1', search: '?pace=fast' })).toBe(true);
        expect(fastDescentRequested({ hostname: '127.0.0.1', search: '?hallRoom=pairs&pace=fast' })).toBe(true);
        expect(fastDescentRequested({ hostname: 'memory-dungeon-git.pages.dev', search: '' })).toBe(false);
        expect(fastDescentRequested({ hostname: '127.0.0.1', search: '?pace=slow' })).toBe(false);
        expect(fastDescentRequested(undefined)).toBe(false);
    });

    it('keeps the pace through Play again, and gives a test-pace run no share key', () => {
        const fast = withFastDescent(createNewRun(0, { runSeed: 5150 }));
        const again = createRestartRun(fast, createDefaultSaveData());
        expect(again.descentPace).toBe('fast');
        expect(again.achievementsEnabled).toBe(false);
        expect(createRestartRun(createNewRun(0, { runSeed: 5150 }), createDefaultSaveData()).descentPace ?? null).toBeNull();
        expect('refusal' in describeRunShareKey(fast)).toBe(true);
        expect('key' in describeRunShareKey(createNewRun(0, { runSeed: 5150 }))).toBe(true);
    });
});

describe('the cash-in prototype switch', () => {
    it('is on only for ?combo2=1, and a restart keeps it', () => {
        expect(comboCashInRequested({ search: '?combo2=1' })).toBe(true);
        expect(comboCashInRequested({ search: '?pace=fast&combo2=1' })).toBe(true);
        expect(comboCashInRequested({ search: '' })).toBe(false);
        expect(comboCashInRequested({ search: '?combo2=0' })).toBe(false);
        expect(createRestartRun({ ...createNewRun(0, { runSeed: 5150 }), comboCashIn: true }, createDefaultSaveData()).comboCashIn).toBe(true);
        expect(createRestartRun(createNewRun(0, { runSeed: 5150 }), createDefaultSaveData()).comboCashIn ?? null).toBeNull();
    });
});
