import { describe, expect, it } from 'vitest';
import { createNewRun } from './game-core';
import {
    getCodexRewardSignal,
    getCollectionRewardSignal,
    getInventoryRewardSignal,
    getMetaProgressionRunImpactRows
} from './meta-reward-signals';
import { createDefaultSaveData } from './save-data';

describe('REG-011 meta reward signals', () => {
    it('gives collection a durable next reward and progress meter from save data', () => {
        const save = createDefaultSaveData();
        save.playerStats = { ...save.playerStats!, dailiesCompleted: 4 };

        const signal = getCollectionRewardSignal(save);
        expect(signal.id).toBe('collection_profile_level');
        expect(signal.progress).toBeDefined();
        expect(signal.cta).toBe('Clear one more Daily Challenge for 1 honor mark.');
        expect(signal.body).toMatch(/honor marks/i);
        expect(signal.body).toMatch(/Adept tier at profile level 3/i);
    });

    it('gives inventory and codex active return reasons without new persistence', () => {
        const inventory = getInventoryRewardSignal(createNewRun(0));
        expect(inventory.id).toBe('inventory_build_value');
        expect(inventory.cta).toMatch(/floor|relic/i);

        const codex = getCodexRewardSignal();
        expect(codex.id).toBe('codex_learning_goal');
        expect(codex.cta).toMatch(/Guides|Tables/i);
    });

    it('translates permanent profile unlocks into next-run impact rows', () => {
        const save = createDefaultSaveData();
        save.playerStats = { ...save.playerStats!, dailiesCompleted: 7 };

        const rows = getMetaProgressionRunImpactRows(save);
        expect(rows[0]).toMatchObject({
            id: 'upgrade_relic_shrine_extra_pick',
            lane: 'Relic draft',
            impact: '+1 pick when unlocked',
            boardMoment: 'More relic choice at milestone floors',
            nextAction: 'Claim now',
            tone: 'ready'
        });
        expect(rows.some((row) => row.tone === 'deferred')).toBe(true);
        expect(rows.some((row) => row.tone === 'cosmetic')).toBe(true);
    });
});
