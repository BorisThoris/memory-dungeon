import { describe, expect, it } from 'vitest';
import type { RealmId, RunState } from './contracts';
import { advanceToNextLevel, createNewRun, finishMemorizePhase } from './game-core';
import { flipTile } from './game';
import { reduceGameplayCommand } from './gameplay-core';
import { createGameplayStormGlassCommand } from './gameplay-core-contracts';
import { boardHasTurnablePair } from './realm-weather-rules';
import { applyStormGlass, canBreakStormGlass } from './storm-glass-rules';
import { claimCurio, curioItemsForRules } from './curio-rules';

/** Floor 4 of a fixed seed, held in one realm on a calm floor, a glass in hand. */
const floorIn = (realm: RealmId | null): RunState => {
    let run = finishMemorizePhase(createNewRun(0, { runSeed: 9001, realm: realm ? { realmId: realm, severity: 'calm' } : null }));
    for (let floor = 0; floor < 3; floor += 1) run = finishMemorizePhase(advanceToNextLevel({ ...run, status: 'levelComplete' }));
    return { ...run, realmId: realm ?? undefined, realmSecondaryId: null, stormGlassCharges: 1 } as RunState;
};

describe('the Storm Glass', () => {
    it('calls every realm\'s peak on a calm floor, where the weather clock never runs', () => {
        // Fire's peak is the deal's: a firestorm where it finds open cards, and on a board of only fire and water it
        // charges them instead (`empowered`). Which one a floor gets moves with the seed (rules 71 deals the second).
        const kinds: Record<RealmId, readonly string[]> = { frost: ['whiteout'], ember: ['firestorm', 'empowered'], tide: ['springtide'], storm: ['thunderclap'], grove: ['bloom'] };
        for (const realm of Object.keys(kinds) as RealmId[]) {
            const run = floorIn(realm);
            expect(canBreakStormGlass(run), realm).toBe(true);
            const result = applyStormGlass(run)!;
            expect(kinds[realm], realm).toContain(result.event.kind);
            expect(result.event.tileIds.length, realm).toBeGreaterThan(0);
            expect(result.run.stormGlassCharges).toBe(0);
            expect(result.run.lastRealmEvent).toEqual(result.event);
            // The clock keeps its count: the realm's own weather comes when it would have.
            expect(result.run.realmWeatherThisFloor).toBe(run.realmWeatherThisFloor);
            expect(boardHasTurnablePair(result.run.board!.tiles)).toBe(true);
            expect(result.run.board!.tiles.map((tile) => tile.id).sort()).toEqual(run.board!.tiles.map((tile) => tile.id).sort());
        }
    });

    it('lights the cards a moving storm moved, until the next flip, and nothing a still one touched', () => {
        const tide = applyStormGlass(floorIn('tide'))!;
        expect(tide.run.realmLitTileIds).toEqual(expect.arrayContaining([...tide.litTileIds]));
        const moved = tide.run.board!.tiles.filter((tile, cell) => tile.id !== floorIn('tide').board!.tiles[cell]!.id).map((tile) => tile.id);
        expect(new Set(tide.litTileIds)).toEqual(new Set(moved));
        const frost = applyStormGlass(floorIn('frost'))!;
        expect(frost.litTileIds).toEqual([]);
    });

    it('stays dark off a realm floor, with a card face up, or with no glass in hand', () => {
        expect(canBreakStormGlass(floorIn(null))).toBe(false);
        const tide = floorIn('tide');
        const first = tide.board!.tiles.find((tile) => tile.state === 'hidden')!;
        expect(canBreakStormGlass(flipTile(tide, first.id))).toBe(false);
        expect(canBreakStormGlass({ ...tide, stormGlassCharges: 0 })).toBe(false);
        expect(applyStormGlass(floorIn(null))).toBeNull();
    });

    it('strikes the same way every time from the same run', () => {
        expect(applyStormGlass(floorIn('tide'))!.run.board).toEqual(applyStormGlass(floorIn('tide'))!.run.board);
    });

    it('goes through the gameplay core and journals the storm it called', () => {
        const run = floorIn('storm');
        const result = reduceGameplayCommand(run, createGameplayStormGlassCommand('glass:test'));
        expect(result.accepted).toBe(true);
        expect(result.events.find((event) => event.type === 'realm.weather_called')).toMatchObject({ realmId: 'storm', weatherKind: 'thunderclap', stormGlassChargesBefore: 1, stormGlassChargesAfter: 0 });
        expect(result.events.some((event) => event.type === 'feedback.requested' && event.cue === 'power.storm_glass.used')).toBe(true);
        expect(reduceGameplayCommand(floorIn(null), createGameplayStormGlassCommand('glass:none')).accepted).toBe(false);
    });

    it('joins what a Curio may hold at rules 67, and a rules-66 run draws only crucibles', () => {
        expect(curioItemsForRules(66)).toEqual(['crucible']);
        expect(curioItemsForRules(67)).toEqual(['crucible', 'storm_glass']);
        const old = floorIn('tide');
        const drawn66 = new Set(Array.from({ length: 40 }, (_, claimed) => claimCurio({ ...old, runRulesVersion: 66, curiosClaimedThisRun: claimed }, 4, 'p').lastCurioDrop!.item));
        expect([...drawn66]).toEqual(['crucible']);
        const drawn67 = new Set(Array.from({ length: 40 }, (_, claimed) => claimCurio({ ...old, runRulesVersion: 67, curiosClaimedThisRun: claimed }, 4, 'p').lastCurioDrop!.item));
        expect(drawn67).toEqual(new Set(['crucible', 'storm_glass']));
    });
});

describe('a called current that only met water', () => {
    it('lights nothing it did not move: a card that drank the tide stays where it was, face down', () => {
        const run = { ...floorIn('tide') };
        const result = applyStormGlass(run)!;
        const cellBefore = new Map(run.board!.tiles.map((tile, cell) => [tile.id, cell]));
        for (const id of result.litTileIds) {
            expect(result.run.board!.tiles.findIndex((tile) => tile.id === id), id).not.toBe(cellBefore.get(id));
        }
    });
});

describe('a storm with nothing to touch', () => {
    it('is not offered: fire over a board of water would do nothing, so the glass stays dark', () => {
        const ember = floorIn('ember');
        const allWater: RunState = { ...ember, board: { ...ember.board!, tiles: ember.board!.tiles.map((tile) => ({ ...tile, suit: 'tide' as const })) } };
        expect(applyStormGlass(allWater)).toBeNull();
        expect(canBreakStormGlass(allWater)).toBe(false);
        expect(canBreakStormGlass(ember)).toBe(true);
    });
});
