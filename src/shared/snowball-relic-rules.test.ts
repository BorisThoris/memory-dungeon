import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap } from './miss-bank';
import { buyStoreItem, rollStoreStock, STOP_RELIC_OFFER, storeOffer } from './run-store-rules';
import {
    applyFusion,
    AWAKENED_HALO_CAP,
    AWAKENED_INTEREST_BONUS,
    AWAKENING_FROM,
    awakenGrownRelics,
    COIN_AWAKENS_AT,
    CROWN_AWAKENS_AT,
    DIAL_AWAKENS_AT,
    DIAL_STEP,
    HALO_AWAKENS_AT,
    HEART_AWAKENS_AT,
    isAwake,
    snowballRelicTitle,
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
        const plain = { ...run, fusions: [] };
        expect(resolveBoardTurn(flipTile(flipTile(run, a.id), b.id)).gold).toBe((resolveBoardTurn(flipTile(flipTile(plain, a.id), b.id)).gold ?? 0) + 1);
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

describe('relics that grow awaken (rules 103)', () => {
    const at = (extra: Partial<RunState> = {}): RunState => playing({ runRulesVersion: AWAKENING_FROM, ...extra });

    it('a held relic awakens on the run its mark is reached on, says so on the clear, and stays awake', () => {
        const run = at({ relics: ['cinder_heart', 'tide_heart'], elementMatchesThisRun: { ember: HEART_AWAKENS_AT, tide: HEART_AWAKENS_AT - 1 }, lastLevelResult: { level: 2 } as RunState['lastLevelResult'] });
        const woke = awakenGrownRelics(run);
        expect(woke.awakened).toEqual(['cinder_heart']);
        expect(woke.lastLevelResult?.awakened).toEqual(['cinder_heart']);
        expect(snowballRelicTitle(woke, 'cinder_heart', 'Cinder Heart')).toBe('Inferno Heart');
        expect(relicScoreFactors(woke).find((entry) => entry.id === 'cinder_heart')!.factor).toBeCloseTo(1 + HEART_STEP * 2 * HEART_AWAKENS_AT);
        // Awake for the run: nothing awakens twice, and a clear that wakes nothing says nothing.
        expect(awakenGrownRelics(woke)).toBe(woke);
        // Not held, or before rules 103: no awakening.
        expect(awakenGrownRelics({ ...run, relics: [] })).toEqual({ ...run, relics: [] });
        expect(awakenGrownRelics({ ...run, runRulesVersion: AWAKENING_FROM - 1 }).awakened).toBeUndefined();
    });

    it('the Halo, the Dial, the Crown and the Coin each awaken stronger', () => {
        const all = at({ relics: ['minted_halo', 'frenzy_dial', 'glass_crown', 'interest_coin'], gold: HALO_AWAKENS_AT, flurryGrabsThisRun: DIAL_AWAKENS_AT, cleanFloorStreak: CROWN_AWAKENS_AT });
        expect(COIN_AWAKENS_AT).toBeLessThanOrEqual(HALO_AWAKENS_AT);
        const woke = awakenGrownRelics(all);
        expect(woke.awakened).toEqual(['minted_halo', 'frenzy_dial', 'glass_crown', 'interest_coin']);
        expect(relicScoreFactors({ ...woke, gold: 9_999 }).find((entry) => entry.id === 'minted_halo')!.factor).toBe(1 + AWAKENED_HALO_CAP);
        expect(relicScoreFactors(woke).find((entry) => entry.id === 'frenzy_dial')!.factor).toBeCloseTo(1 + DIAL_STEP * 2 * DIAL_AWAKENS_AT);
        // The Diamond Crown halves a broken streak instead of losing it.
        expect(nextCleanFloorStreak({ ...woke, cleanFloorStreak: 5 }, false)).toBe(2);
        expect(nextCleanFloorStreak({ ...all, cleanFloorStreak: 5 }, false)).toBe(0);
        // The Treasury Coin's cap is five higher, Compound Coin's too.
        expect(interestFor({ ...woke, gold: 9_999 })).toBe(INTEREST_CAP + AWAKENED_INTEREST_BONUS);
        expect(interestFor({ ...woke, gold: 9_999, fusions: ['compound_coin'] })).toBe(COMPOUND_INTEREST_CAP + AWAKENED_INTEREST_BONUS);
        expect(isAwake(all, 'minted_halo')).toBe(false);
    });

    it('a real floor clear awakens a relic whose mark the floor reached', () => {
        const run = at({ relics: ['cinder_heart'], elementMatchesThisRun: { ember: HEART_AWAKENS_AT + 5 } });
        let cleared: RunState = run;
        for (const pair of new Set(run.board!.tiles.map((tile) => tile.pairKey))) {
            const [a, b] = cleared.board!.tiles.filter((tile) => tile.pairKey === pair && tile.state === 'hidden');
            if (!a || !b) continue;
            cleared = resolveBoardTurn(flipTile(flipTile(cleared, a.id), b.id));
            if (cleared.status !== 'playing') break;
        }
        expect(cleared.status).toBe('levelComplete');
        expect(isAwake(cleared, 'cinder_heart')).toBe(true);
        expect(cleared.lastLevelResult?.awakened).toEqual(['cinder_heart']);
    });
});
