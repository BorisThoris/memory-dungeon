import { describe, expect, it } from 'vitest';
import { REALM_IDS, type RunState } from './contracts';
import { advanceToNextLevel, buildBoard, createNewRun } from './game';
import {
    REALMS,
    REALM_SEVERITIES,
    chooseRealmDoor,
    isRealmWeatherTurn,
    nextFloorRealmDoor,
    openingRealmDoor,
    realmClearGold,
    realmIntervalFor,
    rollRealmDoors,
    turnsUntilRealmWeather
} from './realm-rules';
import { OMEN_FIRST_FLOOR, REALM_REACTION_NAMES, seatRealmOmen } from './realm-omen-rules';

describe('realms', () => {
    it('every realm is defined, with two rules a door can show', () => {
        for (const id of REALM_IDS) {
            expect(REALMS[id].id).toBe(id);
            expect(REALMS[id].rules).toHaveLength(2);
        }
    });

    it('severity moves the clock and the gold: calm is slower, raging sooner and richer', () => {
        expect(realmIntervalFor('ember', 'calm')).toBe(4);
        expect(realmIntervalFor('ember', 'wild')).toBe(3);
        expect(realmIntervalFor('ember', 'raging')).toBe(2);
        expect(realmClearGold(6, 'calm')).toBe(6);
        expect(realmClearGold(6, 'raging')).toBe(9);
        expect(REALM_SEVERITIES.raging.reach).toBe(2);
        expect([1, 2, 3, 4, 5, 6].map((t) => isRealmWeatherTurn('ember', 'wild', t))).toEqual([
            false, false, true, false, false, true
        ]);
        expect(turnsUntilRealmWeather('ember', 'wild', 0)).toBe(3);
        expect(turnsUntilRealmWeather('ember', 'wild', 2)).toBe(1);
    });

    it('offers three doors, one of each severity, the realm the floor ended in among them', () => {
        for (let level = 1; level < 40; level += 1) {
            const doors = rollRealmDoors(99, level, 'tide');
            expect(doors).toHaveLength(3);
            expect(new Set(doors.map((d) => d.realmId)).size).toBe(3);
            expect(doors.map((d) => d.severity).sort()).toEqual(['calm', 'raging', 'wild']);
            expect(doors.some((d) => d.realmId === 'tide')).toBe(true);
        }
        expect(rollRealmDoors(99, 4, 'tide')).toEqual(rollRealmDoors(99, 4, 'tide'));
    });

    it('a run opens in a seeded, calm realm, and every realm opens some run', () => {
        const run = createNewRun(0, { runSeed: 5 });
        expect(run.realmId).toBe(openingRealmDoor(5).realmId);
        expect(run.realmSeverity).toBe('calm');
        const seen = new Set(Array.from({ length: 60 }, (_, seed) => openingRealmDoor(seed).realmId));
        expect(seen.size).toBe(REALM_IDS.length);
    });

    it('a fixed board has no realm unless it asks for one', () => {
        const fixedBoard = buildBoard(1, { runSeed: 1, runRulesVersion: 51 });
        expect(createNewRun(0, { fixedBoard }).realmId ?? null).toBeNull();
        expect(createNewRun(0, { fixedBoard, realm: { realmId: 'storm', severity: 'wild' } }).realmId).toBe('storm');
    });

    it('the door walked through is where the next floor builds', () => {
        const base = createNewRun(0, { runSeed: 12 });
        const cleared: RunState = {
            ...base,
            status: 'levelComplete',
            realmDoors: rollRealmDoors(12, 1, base.realmId ?? null)
        };
        const chosen = chooseRealmDoor(cleared, 2);
        expect(nextFloorRealmDoor(chosen)).toEqual(cleared.realmDoors![2]);
        const next = advanceToNextLevel(chosen);
        expect(next.realmId).toBe(cleared.realmDoors![2]!.realmId);
        expect(next.realmSeverity).toBe(cleared.realmDoors![2]!.severity);
        expect(next.realmDoors).toBeNull();
        // A door can only be picked at a clear.
        expect(chooseRealmDoor(base, 0)).toBe(base);
    });

    it('omens seat on one plain pair from the third floor, never of the realm itself', () => {
        const early = buildBoard(OMEN_FIRST_FLOOR - 1, { runSeed: 3, runRulesVersion: 51 });
        expect(seatRealmOmen(early, 'frost', 3, 51)).toBe(early);
        for (let seed = 0; seed < 30; seed += 1) {
            const board = seatRealmOmen(buildBoard(5, { runSeed: seed, runRulesVersion: 51 }), 'frost', seed, 51);
            const omens = board.tiles.filter((t) => t.omen);
            expect(omens).toHaveLength(2);
            expect(omens[0]!.pairKey).toBe(omens[1]!.pairKey);
            expect(omens[0]!.omen).not.toBe('frost');
        }
    });

    it('every pair of realms has a reaction name', () => {
        for (const from of REALM_IDS) {
            for (const to of REALM_IDS) {
                expect(REALM_REACTION_NAMES[from][to].length).toBeGreaterThan(2);
            }
        }
    });
});
