import { describe, expect, it } from 'vitest';
import { COMBO_HEAT_STAGE_FROM } from './combo-heat-rules';
import { createNewRun, finishMemorizePhase } from './game';
import { missesLeft } from './miss-bank';
import {
    canIgniteZone,
    igniteZone,
    isZoneActive,
    resolveZone,
    ZONE_PAIRS_AT_INFERNO,
    ZONE_PAIRS_AT_LEGENDARY,
    ZONE_PAIRS_CAP,
    zoneFlipsLeft,
    zoneFlipTile,
    zonePairsForCombo
} from './zone-rules';
import type { RunState } from './contracts';

const hotRun = (combo: number): RunState => {
    const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 90_210 }));
    return { ...run, stats: { ...run.stats, currentStreak: combo } };
};

const hiddenIds = (run: RunState): string[] => (run.board?.tiles ?? []).filter((tile) => tile.state === 'hidden').map((tile) => tile.id);

describe('the Zone', () => {
    it('opens only from Inferno, for three pairs, four at Legendary, one more per ascension, six at most', () => {
        expect(zonePairsForCombo(0)).toBe(0);
        expect(zonePairsForCombo(COMBO_HEAT_STAGE_FROM.blazing)).toBe(0);
        expect(zonePairsForCombo(COMBO_HEAT_STAGE_FROM.inferno)).toBe(ZONE_PAIRS_AT_INFERNO);
        expect(zonePairsForCombo(COMBO_HEAT_STAGE_FROM.legendary)).toBe(ZONE_PAIRS_AT_LEGENDARY);
        expect(zonePairsForCombo(50)).toBe(ZONE_PAIRS_AT_LEGENDARY + 1);
        expect(zonePairsForCombo(10_000)).toBe(ZONE_PAIRS_CAP);
        expect(canIgniteZone(hotRun(15))).toBe(false);
        expect(canIgniteZone(hotRun(16))).toBe(true);
    });

    it('burns the combo to open, and refuses a board with a card already up or a Zone already open', () => {
        const run = hotRun(16);
        const zone = igniteZone(run);
        expect(zone.zone).toEqual({ pairs: 3 });
        expect(zone.stats.currentStreak).toBe(0);
        expect(zone.zonesThisRun).toBe(1);
        expect(zone.powersUsedThisRun).toBe(true);
        expect(canIgniteZone(zone)).toBe(false);
        expect(igniteZone(zone)).toBe(zone);
        const [first] = hiddenIds(run);
        const oneUp = { ...run, board: { ...run.board!, flippedTileIds: [first!] } };
        expect(canIgniteZone(oneUp)).toBe(false);
        const cold = hotRun(3);
        expect(igniteZone(cold)).toBe(cold);
    });

    it('keeps every turned card up with nothing resolving, and closes on the last allowed card', () => {
        let run = igniteZone(hotRun(16));
        const ids = hiddenIds(run);
        expect(zoneFlipsLeft(run)).toBe(6);
        for (let index = 0; index < 5; index += 1) {
            run = zoneFlipTile(run, ids[index]!);
            expect(run.status).toBe('playing');
            expect(run.board!.flippedTileIds).toHaveLength(index + 1);
            expect(isZoneActive(run)).toBe(true);
        }
        // A card already up, or one that is not on the board, is refused.
        expect(zoneFlipTile(run, ids[0]!)).toBe(run);
        expect(zoneFlipTile(run, 'no-such-card')).toBe(run);
        const closed = zoneFlipTile(run, ids[5]!);
        expect(isZoneActive(closed)).toBe(false);
        expect(closed.board!.flippedTileIds).toEqual([]);
        expect(closed.lastZone?.pairs).toBe(3);
        expect(closed.status === 'playing' || closed.status === 'gameOver' || closed.status === 'levelComplete').toBe(true);
    });

    it('matches every complete pair first, then charges the leftovers as misses, then pays the bonus', () => {
        let run = igniteZone(hotRun(16));
        const tiles = run.board!.tiles;
        const byPair = new Map<string, string[]>();
        for (const tile of tiles) if (tile.state === 'hidden') byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile.id]);
        const pairs = [...byPair.values()].filter((ids) => ids.length === 2);
        // Two full pairs up, then one card each of two other pairs: a miss's worth of leftovers.
        for (const id of [...pairs[0]!, ...pairs[1]!, pairs[2]![0]!, pairs[3]![0]!]) run = zoneFlipTile(run, id);
        expect(isZoneActive(run)).toBe(false);
        // Floor one's real board pops: a leftover the pop took is not played, so the miss count is
        // what the board left standing, and every miss the Zone played is on the stats.
        expect(run.lastZone).toMatchObject({ matched: 2, bonus: 400 });
        expect(run.lastZone!.missed).toBeLessThanOrEqual(1);
        expect(run.board!.tiles.filter((tile) => pairs[0]!.includes(tile.id) || pairs[1]!.includes(tile.id)).every((tile) => tile.state === 'matched')).toBe(true);
        expect(run.stats.mismatches).toBe(run.lastZone!.missed);
        expect(run.stats.currentStreak).toBe(run.lastZone!.missed > 0 ? 0 : run.stats.currentStreak);
        expect(run.zonePairsThisRun).toBe(2);
        expect(run.stats.totalScore).toBeGreaterThanOrEqual(400);
    });

    it('a perfect Zone leaves a combo of its pairs standing and spends no miss', () => {
        let run = igniteZone(hotRun(16));
        const before = missesLeft(run);
        const byPair = new Map<string, string[]>();
        for (const tile of run.board!.tiles) if (tile.state === 'hidden') byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile.id]);
        const pairs = [...byPair.values()].filter((ids) => ids.length === 2).slice(0, 3);
        for (const id of pairs.flat()) run = zoneFlipTile(run, id);
        expect(run.lastZone).toMatchObject({ pairs: 3, missed: 0, bonus: 100 * run.lastZone!.matched * run.lastZone!.matched });
        expect(run.lastZone!.matched).toBeGreaterThanOrEqual(1);
        expect(run.stats.currentStreak).toBeGreaterThanOrEqual(run.lastZone!.matched);
        expect(missesLeft(run)).toBeGreaterThanOrEqual(before ?? 0);
        // Ending early with nothing up is a Zone of nothing: closed, no bonus.
        const early = resolveZone(igniteZone(hotRun(16)));
        expect(isZoneActive(early)).toBe(false);
        expect(early.lastZone).toMatchObject({ matched: 0, missed: 0, bonus: 0 });
        expect(resolveZone(early)).toBe(early);
    });
});
