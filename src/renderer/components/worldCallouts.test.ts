import { describe, expect, it } from 'vitest';
import { deriveWorldCallouts, type WorldCalloutRun } from './screenCallouts';
import { worldRailLine, worldTitle } from '../copy/worldReactionCopy';
import { COMBO_HEAT_THEMES } from '../../shared/combo-heat-rules';
import { deriveSceneMood } from './sceneMood';

const state = (level: number, extra: Partial<WorldCalloutRun> = {}, matchedPairs = 0): WorldCalloutRun =>
    ({ board: { level, matchedPairs } as never, world: [], voidSpewsThisFloor: 0, frostFreezesThisFloor: 0, worldShiftsThisFloor: 0, ...extra }) as WorldCalloutRun;

describe('the world, stamped', () => {
    it('stays quiet on the first read and on a restore of the same state', () => {
        expect(deriveWorldCallouts(undefined, state(4, { voidSpewsThisFloor: 1 }))).toEqual([]);
        expect(deriveWorldCallouts(state(4, { voidSpewsThisFloor: 1 }), state(4, { voidSpewsThisFloor: 1 }))).toEqual([]);
    });

    it('stamps the void with the pairs it returned, the world shift with its rules, and the freeze', () => {
        const spat = deriveWorldCallouts(state(4, {}, 5), state(4, { voidSpewsThisFloor: 1 }, 3));
        expect(spat).toEqual([expect.objectContaining({ kind: 'void', size: 'major', title: 'THE VOID SPITS', sub: expect.stringContaining('2 pairs') })]);
        const shifted = deriveWorldCallouts(state(4), state(4, { worldShiftsThisFloor: 1, world: ['tide', 'moss'] }));
        // Tide and moss fuse into a swamp: the stamp names the fusion and its sharper rule.
        expect(shifted[0]).toMatchObject({ kind: 'world', title: 'SWAMP!' });
        expect(shifted[0]!.sub).toContain('two pairs of cards');
        const single = deriveWorldCallouts(state(4), state(4, { worldShiftsThisFloor: 1, world: ['tide'] }));
        expect(single[0]).toMatchObject({ title: 'TIDE WORLD' });
        expect(single[0]!.sub).toContain('trades two cards');
        expect(deriveWorldCallouts(state(4), state(4, { frostFreezesThisFloor: 1 }))[0]).toMatchObject({ kind: 'frozen', title: 'FROZEN' });
        // A new floor's counters start again from zero; one there is a new moment, not a restore.
        expect(deriveWorldCallouts(state(4, { frostFreezesThisFloor: 3 }), state(5, { frostFreezesThisFloor: 1 }))).toHaveLength(1);
    });

    it('stamps a world deepening, and a world holding off a newcomer, once each', () => {
        const deeper = deriveWorldCallouts(state(4, { world: ['tide'], worldDepth: 1, turnsThisFloor: 3 }), state(4, { world: ['tide'], worldDepth: 2, turnsThisFloor: 4 }));
        expect(deeper).toEqual([expect.objectContaining({ kind: 'world', title: 'TIDE DEEPENS' })]);
        const held = deriveWorldCallouts(state(4, { world: ['tide'], worldDepth: 3, turnsThisFloor: 5 }), state(4, { world: ['tide'], worldDepth: 2, turnsThisFloor: 6 }));
        expect(held).toEqual([expect.objectContaining({ title: 'THE WORLD HOLDS' })]);
        expect(deriveWorldCallouts(state(4, { world: ['tide'], worldDepth: 2 }), state(4, { world: ['tide'], worldDepth: 2 }))).toEqual([]);
    });

    it('names the world on the rail', () => {
        expect(worldRailLine([])).toBeNull();
        expect(worldRailLine(['bone'])).toBe('World · Bone');
        expect(worldRailLine(['bone'], 3)).toBe('World · Bone III');
        expect(worldRailLine(['tide', 'bone'], 2)).toBe('World · Blizzard II (Tide × Bone)');
        expect(worldTitle(['ember', 'tide'])).toBe('STEAM!');
        expect(worldTitle(['moss'])).toBe('MOSS WORLD');
    });

    it('brings each element\'s weather into the room', () => {
        const ember = COMBO_HEAT_THEMES.find((theme) => theme.id === 'ember')!;
        const room = (world: Parameters<typeof deriveSceneMood>[0]['world']) =>
            deriveSceneMood({ combo: 0, latestLoss: null, run: { status: 'playing', board: { level: 4 } } as never, storeOpen: false, temper: ember, world });
        expect(room(['moss']).spores).toBeGreaterThan(0);
        expect(room([]).spores).toBe(0);
        expect(room(['tide']).wet).toBeGreaterThan(0);
        expect(room(['tide']).storm).toBeGreaterThan(0);
        expect(room(['bone']).snow).toBeGreaterThan(0);
        // Bone is cold, but the pane over the board stays the frost run's.
        expect(room(['bone']).ice).toBe(0);
        expect(room(['bone']).world).toEqual(['bone']);
    });
});
