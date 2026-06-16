import { describe, expect, it } from 'vitest';
import type { RelicId, RunState } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import { makePair, makeRun } from '../../shared/test/game-fixtures';
import {
    createRelicOfferServiceSurfaceResult,
    createRelicPickSurfaceResult
} from './relicOfferSurfaceState';

const offeredRun = (): RunState => ({
    ...makeRun([...makePair('A', 'A')]),
    status: 'levelComplete',
    lastLevelResult: {
        clearLifeGained: 0,
        clearLifeReason: 'perfect',
        level: 3,
        livesRemaining: 3,
        mistakes: 0,
        perfect: true,
        rating: 'S',
        scoreGained: 120
    },
    shopGold: 5,
    relicOffer: {
        options: ['extra_shuffle_charge' as RelicId, 'peek_charge_plus_one' as RelicId],
        pickRound: 0,
        picksRemaining: 1,
        tier: 1
    }
});

describe('relicOfferSurfaceState', () => {
    it('ignores missing runs and relics not present in the offer', () => {
        const saveData = createDefaultSaveData();

        expect(createRelicPickSurfaceResult({
            relicId: 'extra_shuffle_charge',
            run: null,
            saveData
        })).toEqual({ kind: 'ignored' });
        expect(createRelicPickSurfaceResult({
            relicId: 'guard_token_plus_one',
            run: offeredRun(),
            saveData
        })).toEqual({ kind: 'ignored' });
    });

    it('ignores corrupted offers that repeat an owned relic', () => {
        const saveData = createDefaultSaveData();
        const run = {
            ...offeredRun(),
            relicIds: ['extra_shuffle_charge' as RelicId]
        };

        expect(createRelicPickSurfaceResult({
            relicId: 'extra_shuffle_charge',
            run,
            saveData
        })).toEqual({ kind: 'ignored' });
    });

    it('accepts a valid pick, clears armed board modes, and updates save stats', () => {
        const saveData = createDefaultSaveData();
        const result = createRelicPickSurfaceResult({
            relicId: 'extra_shuffle_charge',
            run: offeredRun(),
            saveData
        });

        expect(result.kind).toBe('accepted');
        if (result.kind !== 'accepted') {
            return;
        }
        expect(result.patch.run.relicIds).toContain('extra_shuffle_charge');
        expect(result.patch.run.relicOffer).toBeNull();
        expect(result.patch.boardPinMode).toBe(false);
        expect(result.patch.destroyPairArmed).toBe(false);
        expect(result.patch.peekModeArmed).toBe(false);
        expect(result.patch.tileSwapArmed).toBe(false);
        expect(result.patch.tileSwapFirstTileId).toBeNull();
        expect(result.patch.saveData.playerStats?.relicPickCounts?.extra_shuffle_charge).toBe(1);
        expect(result.patch.settings).toBe(result.nextSave.settings);
    });

    it('applies relic offer services only while an offer is open', () => {
        expect(createRelicOfferServiceSurfaceResult({
            run: { ...offeredRun(), relicOffer: null },
            serviceId: 'reroll_offer'
        })).toEqual({ kind: 'ignored' });

        const result = createRelicOfferServiceSurfaceResult({
            run: offeredRun(),
            serviceId: 'reroll_offer'
        });

        expect(result.kind).toBe('applied');
        if (result.kind !== 'applied') {
            return;
        }
        expect(result.patch.run.shopGold).toBe(3);
        expect(result.patch.run.relicOffer?.serviceUses?.reroll_offer).toBe(1);
    });
});
