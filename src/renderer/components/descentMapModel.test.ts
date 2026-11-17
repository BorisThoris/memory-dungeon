import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from '../../shared/contracts';
import { descentMapFor } from './descentMapModel';

const at = (level: number, runRulesVersion: number | undefined = GAME_RULES_VERSION) =>
    ({ board: { level } as RunState['board'], stats: { highestLevel: level } as RunState['stats'], runRulesVersion });

describe('descentMapFor', () => {
    it('draws the forty-floor Descent as its four acts, with their bosses', () => {
        const map = descentMapFor(at(1));
        expect(map.wardenFloor).toBe(40);
        expect(map.acts.map((act) => [act.id, act.firstLevel, act.lastLevel, act.bossName])).toEqual([
            ['gate', 1, 8, null],
            ['living_dungeon', 9, 16, 'The Keeper of Halls'],
            ['deep', 17, 26, 'The Cartographer'],
            ['abyss', 27, 40, 'The Warden']
        ]);
        expect(map.acts.map((act) => act.state)).toEqual(['current', 'ahead', 'ahead', 'ahead']);
        expect(map.next).toEqual({ name: 'The Living Dungeon', floorsAway: 8 });
    });

    it('counts to a boss on its own floor, and to the Living Dungeon on the floor after the Gate', () => {
        expect(descentMapFor(at(8)).next).toEqual({ name: 'The Living Dungeon', floorsAway: 1 });
        expect(descentMapFor(at(14)).next).toEqual({ name: 'The Keeper of Halls', floorsAway: 2 });
        expect(descentMapFor(at(16)).next).toEqual({ name: 'The Keeper of Halls', floorsAway: 0 });
        expect(descentMapFor(at(40)).next).toEqual({ name: 'The Warden', floorsAway: 0 });
    });

    it('fills the act being played by the floors cleared in it, and the ones behind in full', () => {
        const map = descentMapFor(at(14));
        expect(map.acts.map((act) => act.state)).toEqual(['cleared', 'current', 'ahead', 'ahead']);
        expect(map.acts[0]!.cleared).toBe(1);
        expect(map.acts[1]!.cleared).toBeCloseTo(5 / 8);
        expect(map.acts[2]!.cleared).toBe(0);
    });

    it('reads Endless past the Warden', () => {
        const map = descentMapFor(at(41));
        expect(map.endless).toBe(true);
        expect(map.acts.every((act) => act.state === 'cleared')).toBe(true);
    });

    it('draws a run from before rules 93 as sixty floors', () => {
        const map = descentMapFor(at(30, 80));
        expect(map.wardenFloor).toBe(60);
        expect(map.acts.find((act) => act.state === 'current')?.id).toBe('deep');
        expect(map.next).toEqual({ name: 'The Cartographer', floorsAway: 10 });
    });
});
