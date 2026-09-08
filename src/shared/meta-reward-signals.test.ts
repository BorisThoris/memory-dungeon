import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './game-core';
import {
    getCodexRewardSignal,
    getCollectionRewardSignal,
    getInventoryRewardSignal,
    getInventoryRewardSignals,
    getMetaProgressionRunImpactRows
} from './meta-reward-signals';
import { createDefaultSaveData } from './save-data';

describe('REG-011 meta reward signals', () => {
    it('gives collection a durable next reward and progress meter from save data', () => {
        const save = createDefaultSaveData();
        save.playerStats = { ...save.playerStats!, sharpFloors: 4 };

        const signal = getCollectionRewardSignal(save);
        expect(signal.id).toBe('collection_profile_level');
        expect(signal.progress).toBeDefined();
        expect(signal.cta).toBe('Clear one more Sharp floor for 1 honor mark.');
        expect(signal.body).toMatch(/honor marks/i);
        expect(signal.body).toMatch(/Adept tier at profile level 3/i);
    });

    it('gives inventory and codex active return reasons without new persistence', () => {
        const inventory = getInventoryRewardSignal(createNewRun(0));
        expect(inventory.id).toBe('inventory_build_value');
        expect(inventory.cta).toMatch(/floor/i);

        const codex = getCodexRewardSignal();
        expect(codex.id).toBe('codex_learning_goal');
        expect(codex.cta).toMatch(/Guides|Tables/i);
    });

    it('ignores malformed inventory mutator arrays before building copy', () => {
        const inventory = getInventoryRewardSignal({
            ...createNewRun(0),
            activeMutators: Number.NaN as unknown as RunState['activeMutators']
        });

        expect(inventory.title).toBe('0 active mutator(s) shaping this build');
        expect(inventory.body).toContain('0 active mutator(s)');
    });

    it('normalizes malformed inventory stats before building copy', () => {
        const run = {
            ...createNewRun(0),
            lives: Number.POSITIVE_INFINITY,
            stats: Number.NaN as unknown as RunState['stats']
        };

        const [buildValue, runProgress] = getInventoryRewardSignals(run);
        if (!buildValue || !runProgress) {
            throw new Error('Expected inventory build and run progress reward signals');
        }

        expect(buildValue.body).toContain('0 shard(s)');
        expect(runProgress.body).toContain('0 life/lives remaining');
        expect(`${buildValue.body} ${runProgress.body}`).not.toMatch(/NaN|Infinity/);
    });

    it('translates permanent profile unlocks into next-run impact rows', () => {
        const save = createDefaultSaveData();
        save.playerStats = { ...save.playerStats!, sharpFloors: 7 };

        const rows = getMetaProgressionRunImpactRows(save);
        // The relic shrine's extra pick led this list until the draft went (Gen 175).
        expect(rows.some((row) => row.id === 'upgrade_relic_shrine_extra_pick')).toBe(false);
        expect(rows[0]).toMatchObject({ id: 'upgrade_scholar_prep_slot', lane: 'Run setup' });
        expect(rows.some((row) => row.tone === 'deferred')).toBe(true);
        expect(rows.some((row) => row.tone === 'cosmetic')).toBe(true);
    });
});
