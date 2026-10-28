import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap } from './miss-bank';
import { buyStoreItem, rollStoreStock, STOP_RELIC_OFFER, storeOffer } from './run-store-rules';
import {
    applyFusion,
    availableFusions,
    COMPOUND_INTEREST_CAP,
    floorKeepsCrown,
    FUSION_PRICE,
    FUSIONS_FROM,
    heartGoldFor,
    BUILD_PAYS_FROM,
    buildPaidGold,
    CROWN_STEP,
    HALO_CAP,
    HEART_STEP,
    interestFor,
    INTEREST_CAP,
    nextCleanFloorStreak,
    relicScoreFactors,
    relicScoreMultiplier,
    SNOWBALL_RELIC_IDS,
    SNOWBALL_RELICS_FROM
} from './snowball-relic-rules';

const RULES = SNOWBALL_RELICS_FROM;
const playing = (extra: Partial<RunState> = {}): RunState => ({ ...finishMemorizePhase(createNewRun(0, { runSeed: 91 })), runRulesVersion: RULES, ...extra });

describe('relics that grow (rules 100)', () => {
    it('a Heart multiplies by its element’s matches this run, and stacks with the others by multiplying', () => {
        const run = playing({ relics: ['cinder_heart', 'minted_halo'], elementMatchesThisRun: { ember: 20 }, gold: 25 });
        expect(relicScoreFactors(run)).toEqual([
            { id: 'cinder_heart', factor: 1 + HEART_STEP * 20 },
            { id: 'minted_halo', factor: 1.5 }
        ]);
        expect(relicScoreMultiplier(run)).toBeCloseTo((1 + HEART_STEP * 20) * 1.5);
        expect(relicScoreFactors({ ...run, gold: 9_999 }).find((entry) => entry.id === 'minted_halo')!.factor).toBe(1 + HALO_CAP);
        expect(relicScoreMultiplier({ ...run, runRulesVersion: RULES - 1 })).toBe(1);
    });

    it('a real match is multiplied, and counted toward its element', () => {
        const base = playing({ relics: ['cinder_heart', 'tide_heart', 'moss_heart', 'bone_heart'], elementMatchesThisRun: { ember: 30, tide: 30, moss: 30, bone: 30 } });
        const plain = playing();
        const pair = (run: RunState) => {
            const a = run.board!.tiles.find((tile) => tile.state === 'hidden' && tile.suit != null)!;
            return [a, run.board!.tiles.find((tile) => tile.id !== a.id && tile.pairKey === a.pairKey)!] as const;
        };
        const [a, b] = pair(base);
        const hearted = resolveBoardTurn(flipTile(flipTile(base, a.id), b.id));
        const unhearted = resolveBoardTurn(flipTile(flipTile(plain, a.id), b.id));
        expect(hearted.stats.totalScore).toBeGreaterThan(unhearted.stats.totalScore * 1.8);
        expect(hearted.elementMatchesThisRun?.[a.suit!]).toBe(31);
        expect(unhearted.elementMatchesThisRun?.[a.suit!]).toBe(1);
    });

    it('the Glass Crown climbs on clean floors, falls to nothing on one that was not, and takes a miss from the bank', () => {
        const crowned = playing({ relics: ['glass_crown'], cleanFloorStreak: 3 });
        expect(relicScoreMultiplier(crowned)).toBeCloseTo(1 + CROWN_STEP * 3);
        expect(nextCleanFloorStreak(crowned, true)).toBe(4);
        expect(nextCleanFloorStreak(crowned, false)).toBe(0);
        expect(missBankCap(crowned)).toBe(missBankCap(playing()) - 1);
    });

    it('the Interest Coin pays a gold for every five held, up to its cap', () => {
        expect(interestFor(playing({ relics: ['interest_coin'], gold: 14 }))).toBe(2);
        expect(interestFor(playing({ relics: ['interest_coin'], gold: 400 }))).toBe(INTEREST_CAP);
        expect(interestFor(playing({ gold: 400 }))).toBe(0);
    });
});

describe('the build pays (rules 101)', () => {
    it('a clear’s gold is multiplied by the build, rounded down, from rules 101 only', () => {
        const run = playing({ runRulesVersion: BUILD_PAYS_FROM, relics: ['cinder_heart'], elementMatchesThisRun: { ember: 50 } });
        expect(buildPaidGold(run, 7)).toBe(Math.floor(7 * (1 + HEART_STEP * 50)));
        expect(buildPaidGold({ ...run, relics: [] }, 7)).toBe(7);
        expect(buildPaidGold({ ...run, runRulesVersion: BUILD_PAYS_FROM - 1 }, 7)).toBe(7);
    });
});

describe('fusions (rules 102)', () => {
    const fusing = (extra: Partial<RunState> = {}): RunState => playing({ runRulesVersion: FUSIONS_FROM, gold: 40, ...extra });

    it('is offered when both parts are held, bought once for its price, and keeps both relics', () => {
        expect(availableFusions(fusing({ relics: ['cinder_heart'] })).map((f) => f.id)).toEqual([]);
        const run = fusing({ relics: ['cinder_heart', 'tide_heart', 'minted_halo'] });
        expect(availableFusions(run).map((f) => f.id)).toEqual(['twin_hearts', 'gilded_heart']);
        const fused = applyFusion(run, 'twin_hearts')!;
        expect(fused.gold).toBe(40 - FUSION_PRICE);
        expect(fused.relics).toEqual(run.relics);
        expect(availableFusions(fused).map((f) => f.id)).toEqual(['gilded_heart']);
        expect(applyFusion({ ...run, gold: FUSION_PRICE - 1 }, 'twin_hearts')).toBeNull();
        expect(availableFusions({ ...run, runRulesVersion: FUSIONS_FROM - 1 })).toEqual([]);
    });

    it('Twin Hearts: every held Heart counts both elements', () => {
        const run = fusing({ relics: ['cinder_heart', 'tide_heart'], elementMatchesThisRun: { ember: 10, tide: 20, moss: 99 } });
        expect(relicScoreFactors({ ...run, fusions: ['twin_hearts'] }).map((f) => f.factor)).toEqual([1 + HEART_STEP * 30, 1 + HEART_STEP * 30]);
        expect(relicScoreFactors(run).map((f) => f.factor)).toEqual([1 + HEART_STEP * 10, 1 + HEART_STEP * 20]);
    });

    it('Gilded Heart: a match of a held Heart’s element pays gold, in play', () => {
        const run = fusing({ relics: ['cinder_heart', 'tide_heart', 'moss_heart', 'bone_heart', 'minted_halo'], fusions: ['gilded_heart'] });
        expect(heartGoldFor(run, 'ember')).toBe(1);
        expect(heartGoldFor({ ...run, fusions: [] }, 'ember')).toBe(0);
        const a = run.board!.tiles.find((tile) => tile.state === 'hidden' && tile.suit != null)!;
        const b = run.board!.tiles.find((tile) => tile.id !== a.id && tile.pairKey === a.pairKey)!;
        expect(resolveBoardTurn(flipTile(flipTile(run, a.id), b.id)).gold).toBe(41);
    });

    it('Storm Crown: a floor of one miss keeps the streak, and the bank has its slot back', () => {
        const crowned = fusing({ relics: ['glass_crown', 'frenzy_dial'] });
        expect(floorKeepsCrown(crowned, 1)).toBe(false);
        const storm = { ...crowned, fusions: ['storm_crown' as const] };
        expect(floorKeepsCrown(storm, 1)).toBe(true);
        expect(floorKeepsCrown(storm, 2)).toBe(false);
        expect(missBankCap(storm)).toBe(missBankCap(playing()));
    });

    it('Compound Coin: interest on every four held, up to fifteen', () => {
        const run = fusing({ relics: ['interest_coin', 'minted_halo'], fusions: ['compound_coin'], gold: 400 });
        expect(interestFor(run)).toBe(COMPOUND_INTEREST_CAP);
        expect(interestFor({ ...run, gold: 14 })).toBe(3);
    });
});

describe('the stop is the player’s (rules 100)', () => {
    it('stocks misses, peeks and a bomb, and three relics from the seed, different from stop to stop', () => {
        const shelves = [3, 6, 9, 12].map((floor) => rollStoreStock(91, floor, [], RULES));
        for (const shelf of shelves) {
            expect(shelf.slice(0, 3)).toEqual(['miss', 'peek', 'bomb']);
            expect(shelf).toHaveLength(3 + STOP_RELIC_OFFER);
        }
        expect(new Set(shelves.map((shelf) => shelf.slice(3).join())).size).toBeGreaterThan(1);
        // A relic that grows, once held, is not offered again.
        for (let floor = 3; floor <= 60; floor += 3) expect(rollStoreStock(91, floor, ['cinder_heart'], RULES)).not.toContain('cinder_heart');
    });

    it('sells a relic that grows once, into a free slot', () => {
        const id = SNOWBALL_RELIC_IDS[0]!;
        const run = playing({ gold: 50, storeStock: ['miss', 'peek', 'bomb', id] });
        expect(storeOffer(run).find((row) => row.id === id)?.blocked).toBeNull();
        const bought = buyStoreItem(run, id)!;
        expect(bought.relics).toContain(id);
        expect(storeOffer(bought).find((row) => row.id === id)?.blocked).toBe('owned');
    });
});
