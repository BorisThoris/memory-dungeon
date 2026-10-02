import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { advanceToNextLevel, buildBoard, createNewRun, getMemorizeDurationForRun } from './game';
import {
    ATTUNEMENT_FULL_STEP_LEVELS,
    attunementGoldBonus,
    realmBacklashRuns,
    realmDepthReach,
    realmResonanceBonus,
    CHILL_CARDS,
    applyRealmChill,
    applyRealmSmokeToStudy,
    realmAttunementLevel,
    realmCarryoverAtClear,
    realmFloorWasClean
} from './realm-carryover-rules';
import { realmClearGold } from './realm-rules';

const base = (extra: Partial<RunState> = {}): RunState => ({ ...createNewRun(0, { runSeed: 31, realm: { realmId: 'ember', severity: 'wild' } }), ...extra });

describe('what a realm floor sends on', () => {
    it('measures a clean floor by what the realm punishes', () => {
        expect(realmFloorWasClean({ realmFrozenThisFloor: 0 }, 'frost', 9, 8)).toBe(true);
        expect(realmFloorWasClean({ realmFrozenThisFloor: 2 }, 'frost', 3, 8)).toBe(false);
        expect(realmFloorWasClean({ realmBurnoutsThisFloor: 1 }, 'ember', 3, 8)).toBe(false);
        expect(realmFloorWasClean({}, 'tide', 8, 8)).toBe(true);
        expect(realmFloorWasClean({}, 'storm', 9, 8)).toBe(false);
        expect(realmFloorWasClean({ realmVinesCutThisFloor: 2 }, 'grove', 20, 8)).toBe(true);
    });

    it('every clear deepens its realm, a clean one twice, with no cap; the others fade; smoke counts burnouts up to three; chill follows four frozen', () => {
        const clean = realmCarryoverAtClear(base({ realmBurnoutsThisFloor: 0 }), 'ember', 5, 8);
        expect(clean.attuned).toBe('ember');
        expect(clean.realmAttunement.ember).toBe(2);
        const deep = realmCarryoverAtClear(base({ realmAttunement: { ember: 40, frost: 3, tide: 1 } }), 'ember', 5, 8);
        expect(deep.realmAttunement).toEqual({ ember: 42, frost: 2 });
        const smoky = realmCarryoverAtClear(base({ realmBurnoutsThisFloor: 5 }), 'ember', 5, 8);
        expect(smoky.realmSmoke).toBe(3);
        expect(smoky.realmAttunement.ember).toBe(1);
        expect(realmCarryoverAtClear(base({ realmFrozenThisFloor: 4 }), 'frost', 5, 8).realmChill).toBe(CHILL_CARDS);
        expect(realmCarryoverAtClear(base({ realmFrozenThisFloor: 3 }), 'frost', 5, 8).realmChill).toBe(0);
    });

    it('depth adds a quarter of the clear’s gold a level to three, a twentieth after, without end', () => {
        expect(realmClearGold(8, 'calm', false, 0)).toBe(8);
        expect(realmClearGold(8, 'calm', false, 2)).toBe(12);
        expect(realmAttunementLevel({ realmAttunement: { frost: 9 } }, 'frost')).toBe(9);
        expect(attunementGoldBonus(ATTUNEMENT_FULL_STEP_LEVELS)).toBeCloseTo(0.75);
        expect(attunementGoldBonus(13)).toBeCloseTo(1.25);
        expect(realmClearGold(10, 'calm', false, 13)).toBe(23);
    });

    it('the deeper the realm, the sooner it strikes back and the further it reaches', () => {
        expect(realmBacklashRuns('raging', 0)).toBe(true);
        expect(realmBacklashRuns('wild', 2)).toBe(false);
        expect(realmBacklashRuns('wild', 3)).toBe(true);
        expect(realmBacklashRuns('calm', 5)).toBe(false);
        expect(realmBacklashRuns('calm', 6)).toBe(true);
        expect(realmDepthReach(3)).toBe(0);
        expect(realmDepthReach(9)).toBe(2);
        expect(realmResonanceBonus(7)).toBe(2);
    });

    it('smoke shortens the study of the floor it hangs in, never under the minimum', () => {
        expect(applyRealmSmokeToStudy(5000, 2, 600)).toBe(3800);
        expect(applyRealmSmokeToStudy(700, 3, 600)).toBe(600);
        const run = base();
        expect(getMemorizeDurationForRun({ ...run, realmSmoke: 1 }, 6)).toBeLessThan(getMemorizeDurationForRun(run, 6));
    });

    it('chill freezes two complete pairs on the next board', () => {
        const board = applyRealmChill(buildBoard(6, { runSeed: 4, runRulesVersion: 51 }), 2, 4, 51);
        const frozen = board.tiles.filter((t) => t.frost);
        expect(frozen).toHaveLength(4);
        expect(new Set(frozen.map(t => t.pairKey)).size).toBe(2);
        for (const tile of frozen) expect(frozen.filter(t => t.pairKey === tile.pairKey)).toHaveLength(2);
    });

    it('carries through the stairs: the chill lands on the next floor and is spent', () => {
        const cleared: RunState = { ...base(), status: 'levelComplete', realmChill: 2, realmDoors: [{ realmId: 'tide', severity: 'calm' }] };
        const next = advanceToNextLevel(cleared);
        expect(next.board!.tiles.filter((t) => t.frost).length).toBe(4);
        expect(next.realmChill).toBe(0);
    });
});
