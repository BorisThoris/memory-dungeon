import { describe, expect, it } from 'vitest';
import { REALM_IDS, type RunState } from './contracts';
import { advanceToNextLevel, buildBoard, createNewRun } from './game';
import {
    REALMS,
    REALM_SEVERITIES,
    chooseRealmDoor,
    enterRealmFloor,
    isRealmWeatherTurn,
    nextFloorRealmDoor,
    openingRealmDoor,
    realmClearGold,
    realmIntervalFor,
    rollRealmDoors,
    turnsUntilRealmWeather
} from './realm-rules';
import { REALM_REACTION_NAMES } from './realm-omen-rules';

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
        // The clock runs on a raging floor only (2026-10-01): elsewhere the cards make the weather.
        expect([1, 2, 3, 4, 5, 6].map((t) => isRealmWeatherTurn('ember', 'raging', t))).toEqual([
            false, true, false, true, false, true
        ]);
        expect([1, 2, 3, 4, 5, 6].some((t) => isRealmWeatherTurn('ember', 'wild', t) || isRealmWeatherTurn('ember', 'calm', t))).toBe(false);
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

    it('sometimes turns the wild door into a confluence from the fourth floor, which pays double', () => {
        const confluences = Array.from({ length: 200 }, (_, seed) => rollRealmDoors(seed, 5, 'frost')).flatMap((doors) =>
            doors.filter((door) => door.confluence)
        );
        expect(confluences.length).toBeGreaterThan(30);
        for (const door of confluences) {
            expect(door.severity).toBe('wild');
            expect(door.confluence).not.toBe(door.realmId);
        }
        expect(Array.from({ length: 100 }, (_, seed) => rollRealmDoors(seed, 1, 'frost')).flat().some((door) => door.confluence)).toBe(false);
        expect(realmClearGold(6, 'wild', true)).toBe(12);
    });

    it('a confluence door builds a floor with two realms', () => {
        const base = createNewRun(0, { runSeed: 12 });
        const cleared: RunState = {
            ...base,
            status: 'levelComplete',
            realmDoors: [{ realmId: 'storm', severity: 'wild', confluence: 'ember' }]
        };
        const next = advanceToNextLevel(chooseRealmDoor(cleared, 0));
        expect(next.realmId).toBe('storm');
        expect(next.realmSecondaryId).toBe('ember');
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

    it('no card carries an omen any more: every floor deals plain elemental cards', () => {
        for (let seed = 0; seed < 10; seed += 1) {
            const run = createNewRun(0, { runSeed: seed, realm: { realmId: 'frost', severity: 'wild' } });
            const board = buildBoard(5, { runSeed: seed, runRulesVersion: run.runRulesVersion });
            expect(enterRealmFloor(run, board, { realmId: 'frost', severity: 'wild' }).board).toBe(board);
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
