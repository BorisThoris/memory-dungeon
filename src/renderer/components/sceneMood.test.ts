import { describe, expect, it } from 'vitest';
import { COMBO_HEAT_THEMES } from '../../shared/combo-heat-rules';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { blackHoleKeyFor, deriveSceneMood, latestMissEvent, voidReturnKeyFor } from './sceneMood';

const theme = (id: string) => COMBO_HEAT_THEMES.find((candidate) => candidate.id === id)!;
const turn = (before: number, after: number, outcome: 'match' | 'mismatch', level = 4): BoardTurnResolvedEvent =>
    createBoardTurnResolvedEventFixture({
        commandId: `cmd-${before}-${after}-${outcome}`,
        outcome,
        announcement: { currentStreakBefore: before, currentStreakAfter: after, level } as never
    }) as BoardTurnResolvedEvent;
const run = (level = 4, status: 'playing' | 'levelComplete' | 'memorize' = 'playing') =>
    ({ status, board: { level } }) as never;

describe('what the room becomes', () => {
    it('is the dungeon, graded by the temper as the combo climbs', () => {
        const cold = deriveSceneMood({ combo: 0, latestLoss: null, run: run(), storeOpen: false, temper: theme('ember') });
        expect(cold).toMatchObject({ plate: 'dungeon', blackHoleKey: null, frost: 0, storm: 0, hueDeg: 0, saturate: 1, brightness: 1, prismatic: false });
        const frost = deriveSceneMood({ combo: 20, latestLoss: null, run: run(), storeOpen: false, temper: theme('frost') });
        expect(frost.frost).toBeGreaterThan(0.8);
        // The room freezes in order: snow settles first, the pane follows, the cracks run last.
        expect(frost.snow).toBe(1);
        expect(frost.ice).toBeGreaterThan(0.8);
        expect(frost.iceCracks).toBeGreaterThan(0.5);
        expect(frost.iceGlow).toBeGreaterThan(0);
        const chill = deriveSceneMood({ combo: 3, latestLoss: null, run: run(), storeOpen: false, temper: theme('frost') });
        expect(chill.snow).toBeGreaterThan(0);
        expect(chill.iceCracks).toBe(0);
        expect(deriveSceneMood({ combo: 20, latestLoss: null, run: run(), storeOpen: false, temper: theme('ember') }).snow).toBe(0);
        expect(frost.saturate).toBeLessThan(1);
        expect(frost.hueDeg).toBeGreaterThan(0);
        const storm = deriveSceneMood({ combo: 10, latestLoss: null, run: run(), storeOpen: false, temper: theme('storm') });
        expect(storm.storm).toBeGreaterThan(0);
        expect(storm.frost).toBe(0);
        expect(storm.wet).toBeGreaterThan(0);
        expect(frost.wet).toBe(0);
        expect(deriveSceneMood({ combo: 3, latestLoss: null, run: run(), storeOpen: false, temper: theme('prismatic') }).prismatic).toBe(true);
    });

    it('opens a black hole when a combo of Inferno or better dies, and holds it for the floor', () => {
        const loss = turn(20, 0, 'mismatch');
        expect(blackHoleKeyFor(run(), loss)).toMatch(/^void:/);
        expect(deriveSceneMood({ combo: 0, latestLoss: loss, run: run(), storeOpen: false, temper: theme('frost') })).toMatchObject({ plate: 'void', frost: 0, saturate: 0.8 });
        // A small combo lost is a miss, not a collapse; a match is never one.
        expect(blackHoleKeyFor(run(), turn(9, 0, 'mismatch'))).toBeNull();
        expect(blackHoleKeyFor(run(), turn(20, 21, 'match'))).toBeNull();
        // The stairs close it: another floor, or the floor cleared.
        expect(blackHoleKeyFor(run(5), loss)).toBeNull();
        expect(blackHoleKeyFor(run(4, 'levelComplete'), loss)).toBeNull();
        // The floor after is the return: once, keyed to the loss, and not the floor after that.
        expect(voidReturnKeyFor(run(5, 'memorize'), loss)).toMatch(/^return:/);
        expect(voidReturnKeyFor(run(6), loss)).toBeNull();
        expect(voidReturnKeyFor(run(5), turn(9, 0, 'mismatch'))).toBeNull();
        expect(deriveSceneMood({ combo: 0, latestLoss: loss, run: run(5), storeOpen: false, temper: theme('ember') }).voidReturnKey).toMatch(/^return:/);
    });

    it('is the shop while the store is open, whatever else is going on', () => {
        const mood = deriveSceneMood({ combo: 20, latestLoss: turn(20, 0, 'mismatch'), run: run(4, 'levelComplete'), storeOpen: true, temper: theme('frost') });
        expect(mood).toMatchObject({ plate: 'shop', frost: 0, storm: 0, hueDeg: 0, prismatic: false });
        // The shop stays frozen on a frost run: its own snow mask, the same pane.
        expect(mood.snow).toBe(1);
        expect(mood.ice).toBeGreaterThan(0);
    });

    it('finds the latest miss on the journal', () => {
        expect(latestMissEvent([])).toBeNull();
        const first = turn(3, 0, 'mismatch');
        const second = turn(6, 0, 'mismatch');
        expect(latestMissEvent([first, turn(0, 1, 'match'), second, turn(0, 1, 'match')])).toBe(second);
    });
});
