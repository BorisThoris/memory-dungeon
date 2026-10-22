import { describe, expect, it } from 'vitest';
import { createNewRun } from './game';
import { createDefaultSaveData } from './save-data';
import { recordDescent } from './descent-record';
import { getMemorizeDurationForRun } from './scoring-rules';
import { missesLeft } from './miss-bank';
import { storeOffer } from './run-store-rules';
import { describeRunShareKey, encodeRunShareKey, parseRunShareKey } from './run-share-key';
import { createRunFromShareKey } from './run-from-share-key';
import { DEPTH_RUNGS, depthHas, depthRung, MAX_DEPTH, runDepth } from './depth-rules';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { missBankCap } from './miss-bank';
import { storePrice } from './run-store-rules';
import { dealWanderers } from './wanderer-rules';
import { dealMasks } from './mask-rules';
import { dealSleepers } from './sleeper-rules';
import { keeperSwapEvery } from './keeper-rules';
import { cartographerTurnEvery } from './cartographer-rules';
import { wardenRedealEvery, wardenTestHolds } from './warden-rules';
import { holdSegmentsFor } from './hold-rules';
import { carveLinksFor } from './carve-rules';
import { pickLearnedRule } from './learned-rule-rules';
import { normalizeDescentRecord } from './descent-record';
import { summarizeDescent } from './descent-run-summary';
import { getProfileSummaryRows } from './profile-summary';

const run = (depth: number) => createNewRun(0, { runSeed: 7777, gameMode: 'endless', depth });

describe('the Depths (DGE-025)', () => {
    it('one rule a rung, cumulative, and Depth 0 is the game as it was', () => {
        expect(DEPTH_RUNGS.map((rung) => rung.depth)).toEqual(DEPTH_RUNGS.map((_, i) => i + 1));
        expect(runDepth(run(0))).toBe(0);
        expect(depthRung(run(0))).toBeNull();
        expect(depthHas(run(3), 'short_study')).toBe(true);
        expect(depthHas(run(3), 'no_calm_door')).toBe(false);
        expect(depthRung(run(2))!.id).toBe('no_misses_sold');
        expect(runDepth(run(MAX_DEPTH + 5))).toBe(MAX_DEPTH);
        expect(createNewRun(0, { runSeed: 7777, gameMode: 'endless' })).toEqual(run(0));
    });

    it('each rung changes the constant it names', () => {
        expect(getMemorizeDurationForRun(run(1), 1)).toBeLessThan(getMemorizeDurationForRun(run(0), 1));
        expect(storeOffer({ ...run(2), gold: 999 }).some((row) => row.id === 'miss')).toBe(false);
        expect(storeOffer({ ...run(1), gold: 999 }).some((row) => row.id === 'miss')).toBe(true);
        expect(missesLeft(run(3))).toBe(2);
        expect(missesLeft(run(2))).toBe(3);
    });

    it('every later rung changes the constant it names, from its own Depth on', () => {
        const at = (depth: number) => ({ depth });
        expect(missBankCap({ ...run(5), relics: [] })).toBe(missBankCap({ ...run(4), relics: [] }) - 1);
        expect(storePrice(at(6), 'peek')).toBeGreaterThan(storePrice(at(5), 'peek'));
        const board = (level: number) => buildBoard(level, { runSeed: 7777, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] });
        const seeded = { runSeed: 7777, rulesVersion: GAME_RULES_VERSION };
        const count = (b: ReturnType<typeof board>, flag: 'wanderer' | 'sleeper' | 'mask') => new Set(b.tiles.filter((t) => (flag === 'mask' ? t.mask != null : t[flag])).map((t) => (flag === 'mask' ? t.id : t.pairKey))).size;
        expect(count(dealWanderers(board(8), { ...seeded, depth: 6 }), 'wanderer')).toBe(0);
        expect(count(dealWanderers(board(8), { ...seeded, depth: 7 }), 'wanderer')).toBe(2);
        expect(keeperSwapEvery(at(8))).toBe(3);
        expect(keeperSwapEvery(at(7))).toBe(4);
        expect(cartographerTurnEvery(at(9))).toBe(2);
        expect(wardenRedealEvery(at(10))).toBe(4);
        expect(count(dealMasks(board(15), { ...seeded, depth: 10 }), 'mask')).toBe(0);
        expect(count(dealMasks(board(15), { ...seeded, depth: 11 }), 'mask')).toBe(2);
        expect(count(dealSleepers(board(30), { ...seeded, depth: 11 }), 'sleeper')).toBe(0);
        expect(count(dealSleepers(board(30), { ...seeded, depth: 12 }), 'sleeper')).toBe(2);
        expect(holdSegmentsFor(at(13))).toBe(7);
        expect(holdSegmentsFor(at(12))).toBe(6);
        expect(carveLinksFor(at(14))).toBe(3);
        expect(run(15).shuffleCharges).toBe(0);
        expect(run(14).shuffleCharges).toBe(1);
        expect(count(dealSleepers(board(45), { ...seeded, depth: 16 }), 'sleeper')).toBe(3);
        expect(count(dealMasks(board(30), { ...seeded, depth: 17 }), 'mask')).toBe(3);
        const resonant = { runSeed: 7777, runRulesVersion: GAME_RULES_VERSION, elementResonance: { tide: 5 } };
        expect(pickLearnedRule({ ...resonant, depth: 17 }, 30)).toBeNull();
        expect(pickLearnedRule({ ...resonant, depth: 18 }, 30)).not.toBeNull();
        expect(count(dealWanderers(board(15), { ...seeded, depth: 19 }), 'wanderer')).toBe(3);
        const calmWarden = { runRulesVersion: GAME_RULES_VERSION, realmSeverity: 'calm' as const, board: { ...board(60), floorArchetypeId: 'warden_hall' as const } };
        expect(wardenTestHolds({ ...calmWarden, depth: 19 })).toBe(false);
        expect(wardenTestHolds({ ...calmWarden, depth: 20 })).toBe(true);
        expect(MAX_DEPTH).toBe(20);
    });

    it('the Warden felled at Depth n opens n + 1, and the share key carries the Depth', () => {
        const won = { ...run(2), runEndReason: 'warden_cleared' as const };
        expect(recordDescent(createDefaultSaveData(), won).playerStats!.descent!.bestDepth).toBe(3);
        const key = describeRunShareKey(run(3));
        if (!('key' in key)) throw new Error('no key');
        const text = encodeRunShareKey(key.key);
        expect(text).toMatch(/:d3$/);
        expect(parseRunShareKey(text)!.depth).toBe(3);
        expect(createRunFromShareKey(parseRunShareKey(text)!, 0).depth).toBe(3);
        expect(parseRunShareKey('md1:classic:70:1234')).toEqual({ rulesVersion: 70, seed: 1234, variant: 'classic' });
        expect(parseRunShareKey('md1:classic:70:1234:survive')!.campPreference).toBe('survive');
    });

    it('the results say the Depth and the one it opened; the Profile the deepest open', () => {
        const record = normalizeDescentRecord({ ...createDefaultSaveData().playerStats?.descent, bestDepth: 2, deepestFloor: 60, wardenClears: 1 });
        const won = { ...run(2), runEndReason: 'warden_cleared' as const, stats: { ...run(2).stats, highestLevel: 60 } };
        const descent = summarizeDescent(won, record);
        expect(descent.depth).toBe(2);
        expect(descent.firsts).toContain('Depth 3 opened');
        expect(summarizeDescent({ ...won, depth: 1 }, record).firsts).not.toContain('Depth 2 opened');
        const save = recordDescent(createDefaultSaveData(), won);
        expect(getProfileSummaryRows(save).find((row) => row.id === 'descent')!.source).toContain('Depth 3 open');
        expect(getProfileSummaryRows(createDefaultSaveData()).find((row) => row.id === 'descent')!.source).not.toContain('Depth');
    });
});
