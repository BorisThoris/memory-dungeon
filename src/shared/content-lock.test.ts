import { afterEach, describe, expect, it } from 'vitest';
import {
    activateContentLockFromEnv,
    createContentLock,
    DEMO_MODE_IDS,
    filterMutatorsByContentLock,
    filterRelicPoolByContentLock,
    getActiveContentLock,
    getDemoMutatorPool,
    getDemoRelicPool,
    isDemoBuild,
    isModeAvailableInBuild,
    resolveBuildFlavour,
    setActiveContentLock
} from './content-lock';
import { FULL_CONTENT_LOCK } from './content-lock-state';
import { MUTATOR_IDS } from './contracts';
import { createNewRun } from './game-core';
import { RELIC_POOL, rollRelicOptions } from './relics';
import { RUN_MODE_CATALOG, getRunModeDefinition, runModesByGroup } from './run-mode-catalog';

describe('content lock', () => {
    afterEach(() => {
        setActiveContentLock(FULL_CONTENT_LOCK);
    });

    it('resolves the flavour from the environment and defaults to full', () => {
        expect(resolveBuildFlavour('demo')).toBe('demo');
        expect(resolveBuildFlavour(' DEMO ')).toBe('demo');
        expect(resolveBuildFlavour('full')).toBe('full');
        expect(resolveBuildFlavour(undefined)).toBe('full');
        expect(resolveBuildFlavour('anything else')).toBe('full');
    });

    it('caps breadth in the demo, never run length', () => {
        const demo = createContentLock('demo');
        expect(demo.flavour).toBe('demo');
        expect([...demo.availableModeIds!]).toEqual([...DEMO_MODE_IDS]);
        expect(demo.relicPool!.length).toBeGreaterThan(0);
        expect(demo.relicPool!.length).toBeLessThan(RELIC_POOL.length);
        expect(demo.mutatorPool!.length).toBeGreaterThan(0);
        expect(demo.mutatorPool!.length).toBeLessThan(MUTATOR_IDS.length);
        expect(demo.steamAchievementsEnabled).toBe(false);
        expect(demo.fullGameLedger.length).toBeGreaterThan(0);
        // No floor or run limits exist anywhere on the lock.
        expect(Object.keys(demo)).not.toEqual(expect.arrayContaining(['maxFloor', 'maxRuns']));
    });

    it('leaves the full build untouched', () => {
        const full = createContentLock('full');
        expect(full.availableModeIds).toBeNull();
        expect(full.relicPool).toBeNull();
        expect(full.mutatorPool).toBeNull();
        expect(full.steamAchievementsEnabled).toBe(true);
        expect(filterRelicPoolByContentLock(RELIC_POOL, full)).toEqual([...RELIC_POOL]);
        expect(filterMutatorsByContentLock(MUTATOR_IDS, full)).toEqual([...MUTATOR_IDS]);
    });

    it('locks every mode but Classic in the demo catalog while keeping it visible', () => {
        activateContentLockFromEnv('demo');
        expect(isDemoBuild()).toBe(true);
        expect(isModeAvailableInBuild('classic')).toBe(true);
        expect(isModeAvailableInBuild('daily')).toBe(false);
        const catalogIds = RUN_MODE_CATALOG.map((mode) => mode.id);
        for (const id of catalogIds) {
            const def = getRunModeDefinition(id)!;
            expect(def).not.toBeNull();
            expect(def.availability === 'available').toBe(id === 'classic');
        }
        const coreModes = runModesByGroup('core');
        expect(coreModes.map((mode) => mode.id)).toEqual(RUN_MODE_CATALOG.filter((mode) => mode.group === 'core').map((mode) => mode.id));
    });

    it('drafts only demo relics and rolls only demo mutators in the demo', () => {
        activateContentLockFromEnv('demo');
        const demoPool = new Set(getDemoRelicPool());
        const run = createNewRun(0, { runSeed: 4_242 });
        for (let tier = 0; tier < 4; tier += 1) {
            for (const id of rollRelicOptions(run, tier, tier * 3 + 3)) {
                expect(demoPool.has(id)).toBe(true);
            }
        }
        const demoMutators = new Set(getDemoMutatorPool());
        expect(filterMutatorsByContentLock(MUTATOR_IDS).every((id) => demoMutators.has(id))).toBe(true);
        expect(getActiveContentLock().steamAchievementsEnabled).toBe(false);
    });
});
