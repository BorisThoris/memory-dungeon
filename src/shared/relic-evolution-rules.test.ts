import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { automaticCampReward } from './automatic-camp-rules';
import { buildBoard } from './board-generation';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { applyMissBudget, missesLeft } from './miss-bank';
import {
    applyEvolution,
    availableEvolutions,
    EVOLUTION_PRICE,
    EVOLUTIONS,
    footprintTurns,
    misersVaultCatches,
    MISERS_VAULT_GOLD,
    KEYSTONE_HEART_PAIRS
} from './relic-evolution-rules';
import { heldPairCount, releaseHold, startHold } from './hold-rules';
import { campUpgradeIdsFor, relicRank } from './run-relic-rules';
import { storeOffer } from './run-store-rules';

const maxedRun = (extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
    return {
        ...base,
        status: 'playing',
        runRulesVersion: GAME_RULES_VERSION,
        relics: ['long_look', 'deep_pockets', 'gilded_chain', 'tallow_candle'] as RunState['relics'],
        storePurchases: { long_look: 3, deep_pockets: 3, gilded_chain: 3, tallow_candle: 3 },
        gold: 100,
        blueprints: ['lantern_of_recall'],
        ...extra
    };
};

describe('relic evolutions (DGE-014)', () => {
    it('sells the Tallow Candle in ranks from rules 77', () => {
        expect(campUpgradeIdsFor({ runRulesVersion: GAME_RULES_VERSION })).toContain('tallow_candle');
        expect(campUpgradeIdsFor({ runRulesVersion: 76 })).not.toContain('tallow_candle');
        const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
        const row = storeOffer({ ...base, gold: 50, storeStock: undefined, runRulesVersion: GAME_RULES_VERSION }).find((candidate) => candidate.id === 'tallow_candle');
        expect(row?.kind).toBe('relic');
        expect(relicRank(maxedRun(), 'tallow_candle')).toBe(3);
    });

    it('offers an evolution only with its blueprint and both ingredients at rank 3', () => {
        expect(availableEvolutions(maxedRun()).map((recipe) => recipe.id)).toEqual(['lantern_of_recall']);
        expect(availableEvolutions(maxedRun({ blueprints: [] }))).toEqual([]);
        expect(availableEvolutions(maxedRun({ storePurchases: { long_look: 2, deep_pockets: 3, gilded_chain: 3, tallow_candle: 3 } }))).toEqual([]);
        expect(availableEvolutions(maxedRun({ runRulesVersion: 76 }))).toEqual([]);
        expect(EVOLUTIONS).toHaveLength(6);
    });

    it('the camp buys it first, and one it cannot pay for is gone for the run', () => {
        const atCamp = { ...maxedRun(), status: 'levelComplete' as const, board: { ...maxedRun().board!, level: 27 } };
        const bought = automaticCampReward(atCamp).run;
        expect(bought.evolutions).toEqual(['lantern_of_recall']);
        expect(bought.gold).toBe(100 - EVOLUTION_PRICE);
        const poor = automaticCampReward({ ...atCamp, gold: 5 }).run;
        expect(poor.evolutions ?? []).toEqual([]);
        expect(poor.declinedEvolutions).toEqual(['lantern_of_recall']);
        expect(availableEvolutions(poor)).toEqual([]);
        // The first ingredient is spent: no second evolution may stand on Long Look.
        const both = maxedRun({ blueprints: ['lantern_of_recall', 'cartographers_thread'], evolutions: ['lantern_of_recall'] });
        expect(availableEvolutions(both).map((recipe) => recipe.id)).toEqual([]);
        expect(applyEvolution(both, 'cartographers_thread')).toBeNull();
    });

    it("Miser's Vault pays the run-ending miss in gold, once a floor", () => {
        const vaulted = maxedRun({ evolutions: ['misers_vault'], gold: 25, missBank: [], misersVaultUsedThisFloor: false });
        expect(misersVaultCatches(vaulted)).toBe(true);
        const missed = { ...vaulted, stats: { ...vaulted.stats, mismatches: vaulted.stats.mismatches + 1, tries: vaulted.stats.tries + 1 } };
        const caught = applyMissBudget(vaulted, missed);
        expect(caught.status).toBe('playing');
        expect(caught.gold).toBe(25 - MISERS_VAULT_GOLD);
        expect(caught.misersVaultUsedThisFloor).toBe(true);
        const again = applyMissBudget(caught, { ...caught, stats: { ...caught.stats, mismatches: caught.stats.mismatches + 1, tries: caught.stats.tries + 1 } });
        expect(again.status).toBe('gameOver');
        expect(missesLeft(caught)).toBe(0);
    });

    it('Keystone Heart refills a miss when a Hold of ten pairs or more is released', () => {
        const board = buildBoard(13, { runSeed: 7777, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] });
        const holding = (evolutions: string[]): RunState => {
            let run: RunState = startHold(maxedRun({ board, evolutions, holdLinks: 6, missBank: [{ floor: 13, misses: 2 }] }));
            for (let n = 0; n < KEYSTONE_HEART_PAIRS && run.status === 'playing'; n += 1) {
                // Any pair whose two cards both turn (a trait can refuse a flip).
                const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden' && !tile.pairKey.startsWith('__'));
                let next: RunState | null = null;
                for (const first of hidden) {
                    const second = hidden.find((other) => other.id !== first.id && other.pairKey === first.pairKey);
                    if (!second) continue;
                    const flipped = flipTile(flipTile(run, first.id), second.id);
                    if (flipped.board!.flippedTileIds.length === 2) {
                        next = resolveBoardTurn(flipped);
                        break;
                    }
                }
                if (!next) break;
                run = next;
            }
            return run;
        };
        const keyed = holding(['keystone_heart']);
        const plain = holding([]);
        expect(heldPairCount(keyed)).toBeGreaterThanOrEqual(KEYSTONE_HEART_PAIRS);
        const before = missesLeft(keyed) ?? 0;
        expect(missesLeft(releaseHold(keyed)!.run)).toBe(before + 1);
        expect(missesLeft(releaseHold(plain)!.run)).toBe(missesLeft(plain));
    });

    it("the Cartographer's Thread makes footprints last three turns", () => {
        expect(footprintTurns(maxedRun())).toBe(1);
        expect(footprintTurns(maxedRun({ evolutions: ['cartographers_thread'] }))).toBe(3);
    });

    it('Lantern of Recall keeps the light through the next flip', () => {
        const board = buildBoard(13, { runSeed: 7777, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] });
        const lit = board.tiles.filter((tile) => tile.state === 'hidden').slice(0, 2).map((tile) => tile.id);
        const other = board.tiles.find((tile) => tile.state === 'hidden' && !lit.includes(tile.id))!;
        const recall = maxedRun({ board, evolutions: ['lantern_of_recall'], lanternLitTileIds: lit });
        expect(flipTile(recall, other.id).lanternLitTileIds).toEqual(lit);
        expect(flipTile(maxedRun({ board, lanternLitTileIds: lit }), other.id).lanternLitTileIds).toEqual([]);
        expect(resolveBoardTurn).toBeTypeOf('function');
    });
});
