import { describe, expect, it } from 'vitest';
import { createNewRun } from './game';
import { rollRealmDoors } from './realm-rules';
import { DREAD_PRICES, DREAD_TIERS, countDreadFloor, dreadAt, dreadForRun, dreadTier } from './dread-rules';
import type { RealmDoor, RealmId, RealmSeverity } from './contracts';

describe('Dread (DGE-003)', () => {
    it('reads eight named tiers, in order, from one table', () => {
        expect(DREAD_TIERS.map((tier) => tier.name)).toEqual([
            'Quiet',
            'Stirring',
            'Restless',
            'Hungry',
            'Awake',
            'Watching',
            'It knows you',
            'It is coming'
        ]);
        for (let i = 1; i < DREAD_TIERS.length; i += 1) expect(DREAD_TIERS[i]!.from).toBeGreaterThan(DREAD_TIERS[i - 1]!.from);
    });

    it('names the next tier before it arrives, and the fraction climbs toward it', () => {
        const reading = dreadTier(20);
        expect(reading.tier.name).toBe('Stirring');
        expect(reading.next.name).toBe('Restless');
        expect(reading.fraction).toBeCloseTo((20 - 8) / (30 - 8));
        expect(dreadTier(29.9).tier.name).toBe('Stirring');
        expect(dreadTier(30).tier.name).toBe('Restless');
    });

    it('rises with the floor and with every raging or wild floor entered, never with play', () => {
        expect(dreadAt(2, 0, 0)).toBe(6);
        expect(dreadAt(2, 1, 0)).toBeCloseTo(6 * 1.15);
        expect(dreadAt(2, 0, 1)).toBeCloseTo(6 * 1.05);
        expect(countDreadFloor({}, 'raging')).toEqual({ dreadRagingFloors: 1, dreadWildFloors: 0 });
        expect(countDreadFloor({ dreadRagingFloors: 2, dreadWildFloors: 1 }, 'wild')).toEqual({ dreadRagingFloors: 2, dreadWildFloors: 2 });
        expect(countDreadFloor({ dreadRagingFloors: 2, dreadWildFloors: 1 }, 'calm')).toEqual({ dreadRagingFloors: 2, dreadWildFloors: 1 });
    });

    it('brings Stirring on the third floor of every run, whatever the realms', () => {
        for (const raging of [0, 1, 2]) {
            expect(dreadTier(dreadAt(2, raging, 0)).tier.id, `floor 2, ${raging} raging`).toBe('quiet');
            expect(dreadTier(dreadAt(3, 0, 0)).tier.id).toBe('stirring');
        }
    });

    it('never stands still to floor 1000, and past the last tier keeps counting', () => {
        for (let seed = 1; seed <= 5; seed += 1) {
            let raging = 0;
            let wild = 0;
            let realm: RealmId = 'ember';
            let last = -Infinity;
            let lastBeyond = 0;
            for (let level = 1; level <= 1000; level += 1) {
                if (level > 1) {
                    const door: RealmDoor = rollRealmDoors(seed, level - 1, realm)[0]!;
                    realm = door.realmId;
                    const severity: RealmSeverity = door.severity;
                    if (severity === 'raging') raging += 1;
                    if (severity === 'wild') wild += 1;
                }
                const dread = dreadAt(level, raging, wild);
                expect(dread, `seed ${seed} floor ${level}`).toBeGreaterThan(last);
                const reading = dreadTier(dread);
                expect(reading.beyond).toBeGreaterThanOrEqual(lastBeyond);
                last = dread;
                lastBeyond = reading.beyond;
            }
            expect(dreadTier(last).tier.id).toBe('coming');
            expect(lastBeyond).toBeGreaterThan(10);
        }
    });

    it('is written on the run as it enters each floor, the first one included', () => {
        const run = createNewRun(0, { runSeed: 4401, realm: { realmId: 'ember', severity: 'raging' } });
        expect(run.dreadRagingFloors).toBe(1);
        expect(dreadForRun(run)).toBeCloseTo(3 * 1.15);
    });

    it('prices the composition rows the board builder will spend Dread on (DGE-009)', () => {
        const prices = Object.values(DREAD_PRICES);
        expect(prices.every((price) => price > 0)).toBe(true);
        expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    });
});
