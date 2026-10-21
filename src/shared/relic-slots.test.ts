import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game';
import { canTakeMisersPurse, takeMisersPurse } from './misers-purse-rules';
import { heldRelicIds, relicRank, relicSlotsFull, RELIC_SLOTS, RELIC_SLOTS_FROM } from './run-relic-rules';
import { storeOffer } from './run-store-rules';

const FULL = ['deep_pockets', 'gilded_chain', 'long_look', 'tallow_candle'] as const;
const runWith = (relics: readonly string[], extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 1313, gameMode: 'endless' }));
    return { ...base, status: 'playing', relics: [...relics] as RunState['relics'], gold: 200, runRulesVersion: GAME_RULES_VERSION, ...extra };
};

describe('the relic slots (DGE-013)', () => {
    it('holds four, and a run under the slots rules is full at four', () => {
        expect(RELIC_SLOTS).toBe(4);
        expect(relicSlotsFull(runWith(FULL))).toBe(true);
        expect(relicSlotsFull(runWith(FULL.slice(0, 3)))).toBe(false);
        expect(relicSlotsFull(runWith(FULL, { runRulesVersion: RELIC_SLOTS_FROM - 1 }))).toBe(false);
    });

    it('on a full set the store sells no new relic, only the ranks of one held', () => {
        // The camp sells its three ranked relics; a fourth is the Purse. No relic row may be a new one.
        const full = runWith(['deep_pockets', 'gilded_chain', 'long_look', 'misers_purse'], { storePurchases: { deep_pockets: 1, gilded_chain: 1, long_look: 1 }, storeStock: undefined });
        const relicRows = storeOffer(full).filter((row) => row.kind === 'relic');
        expect(relicRows.length).toBeGreaterThan(0);
        for (const row of relicRows) expect(heldRelicIds(full).includes(row.id as never) || row.blocked === 'slots').toBe(true);
        // A relic not held is refused for want of a slot.
        const missingOne = runWith(['gilded_chain', 'long_look', 'misers_purse', 'tallow_candle'], { storePurchases: { gilded_chain: 1, long_look: 1 }, storeStock: undefined });
        expect(storeOffer(missingOne).find((row) => row.id === 'deep_pockets')?.blocked).toBe('slots');
    });

    it('the purse on a full set needs a relic to replace, and takes its ranks with it', () => {
        const full = runWith(FULL, { misersPurseOffers: 1, storePurchases: { deep_pockets: 2, gilded_chain: 1, long_look: 3 } });
        expect(canTakeMisersPurse(full)).toBe(true);
        expect(takeMisersPurse(full)).toBeNull();
        const taken = takeMisersPurse(full, 'gilded_chain')!;
        expect(heldRelicIds(taken)).toEqual(['deep_pockets', 'long_look', 'tallow_candle', 'misers_purse']);
        expect(relicRank(taken, 'gilded_chain')).toBe(0);
        expect(relicRank(taken, 'long_look')).toBe(3);
        expect(heldRelicIds(taken).length).toBeLessThanOrEqual(RELIC_SLOTS);
        // Under the slots it needs no replacement.
        expect(takeMisersPurse(runWith(FULL.slice(0, 3), { misersPurseOffers: 1 }))).not.toBeNull();
    });
});
