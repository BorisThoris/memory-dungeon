import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { missBankCap } from './miss-bank';
import { buyStoreItem, rollStoreStock, STOP_RELIC_OFFER, storeOffer } from './run-store-rules';
import {
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
