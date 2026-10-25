// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';
import { describe, expect, it } from 'vitest';
import { createNewRun } from './game';
import { emptyDescentRecord } from './descent-record';
import { summarizeDescent } from './descent-run-summary';
import { parseRunShareKey } from './run-share-key';
import { buildRunShareText } from './run-share-text';

const runAt = (level: number, extra: Record<string, unknown> = {}) => {
    const base = { ...createNewRun(0, { runSeed: 4242 }), runRulesVersion: CLASSIC_DESCENT_RULES };
    return { ...base, board: { ...base.board!, level }, stats: { ...base.stats, highestLevel: level }, ...extra };
};

describe('the Descent on the results screen (DGE-007)', () => {
    it('names the act and how far the run fell short of the next boss', () => {
        const at38 = summarizeDescent(runAt(38), null);
        expect(at38.actTitle).toBe('The Deep');
        expect(at38.next).toEqual({ name: 'The Cartographer', floorsShort: 2 });
        expect(summarizeDescent(runAt(40), null).next).toEqual({ name: 'The Cartographer', floorsShort: 0 });
        expect(summarizeDescent(runAt(60, { runEndReason: 'warden_cleared' }), null).next).toBeNull();
    });

    it('a first is measured against the record the run began with', () => {
        const record = { ...emptyDescentRecord(), deepestFloor: 20, deepestActId: 'living_dungeon' as const, deepestDreadTierId: 'restless' as const };
        const firsts = summarizeDescent(runAt(30), record).firsts;
        expect(firsts).toContain('first time in The Deep');
        expect(firsts).toContain('deepest yet, past floor 20');
        expect(summarizeDescent(runAt(18), record).firsts).toEqual([]);
        expect(summarizeDescent(runAt(60, { runEndReason: 'warden_cleared' }), record).firsts).toContain('the first Warden felled');
        expect(summarizeDescent(runAt(30), null).firsts).toEqual([]);
    });

    it('the share sentence carries the act and the Dread, and its key still parses', () => {
        const text = buildRunShareText(runAt(38)).text;
        expect(text).toMatch(/floor 38 \(The Deep, Dread [^)]+\)/);
        expect(parseRunShareKey(text)).not.toBeNull();
        expect(parseRunShareKey('Memory Dungeon — Classic: floor 4, 100 points. Same run: md1:classic:70:1234')).toEqual({ rulesVersion: 70, seed: 1234, variant: 'classic' });
    });
});
