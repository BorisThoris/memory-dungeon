import { describe, expect, it } from 'vitest';

import { MAX_COMBO_SHARDS, MAX_GUARD_TOKENS } from './contracts';
import { createNewRun } from './game-core';
import {
    applyRelicImmediate,
    grantBonusRelicPickNextOffer
} from './relic-immediate-rules';

describe('relic immediate rules', () => {
    it('normalizes bonus relic pick grants', () => {
        const run = createNewRun(0);

        expect(grantBonusRelicPickNextOffer(run, Number.NaN).bonusRelicPicksNextOffer).toBe(0);
        expect(grantBonusRelicPickNextOffer({ ...run, bonusRelicPicksNextOffer: -2 }, 2.9).bonusRelicPicksNextOffer).toBe(2);
    });

    it('applies immediate charge and ward relic effects', () => {
        const run = createNewRun(0);

        expect(applyRelicImmediate(run, 'extra_shuffle_charge').shuffleCharges).toBe(run.shuffleCharges + 1);
        expect(applyRelicImmediate(run, 'destroy_bank_plus_one').destroyPairCharges).toBe(run.destroyPairCharges + 1);
        expect(applyRelicImmediate(run, 'peek_charge_plus_one').peekCharges).toBe(run.peekCharges + 1);
        expect(applyRelicImmediate(run, 'stray_charge_plus_one').strayRemoveCharges).toBe(run.strayRemoveCharges + 1);
        expect(applyRelicImmediate(run, 'parasite_ward_once').parasiteWardRemaining).toBe(run.parasiteWardRemaining + 1);
    });

    it('caps immediate combo shard and guard token relic effects', () => {
        const run = {
            ...createNewRun(0),
            stats: {
                ...createNewRun(0).stats,
                comboShards: MAX_COMBO_SHARDS,
                guardTokens: MAX_GUARD_TOKENS
            }
        };

        expect(applyRelicImmediate(run, 'combo_shard_plus_step').stats.comboShards).toBe(MAX_COMBO_SHARDS);
        expect(applyRelicImmediate(run, 'guard_token_plus_one').stats.guardTokens).toBe(MAX_GUARD_TOKENS);
    });

    it('adds immediate tactical value to long-term synergy relics', () => {
        const run = createNewRun(0);

        expect(applyRelicImmediate(run, 'chapter_compass').peekCharges).toBe(run.peekCharges + 1);
        expect(applyRelicImmediate(run, 'wager_surety').stats.guardTokens).toBe(run.stats.guardTokens + 1);
        expect(applyRelicImmediate(run, 'parasite_ledger').parasiteWardRemaining).toBe(run.parasiteWardRemaining + 1);
    });
});
