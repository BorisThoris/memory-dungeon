import { afterEach, describe, expect, it } from 'vitest';
import {
    activateContentLockFromEnv,
    createContentLock,
    DEMO_MODE_IDS,
    filterMutatorsByContentLock,
    getActiveContentLock,
    getDemoMutatorPool,
    isDemoBuild,
    isModeAvailableInBuild,
    resolveBuildFlavour,
    setActiveContentLock
} from './content-lock';
import { FULL_CONTENT_LOCK } from './content-lock-state';
import { MUTATOR_IDS } from './contracts';
import { getFloorArchetypeProgressionRows } from './floor-mutator-schedule';
import { RUN_MODE_CATALOG, getRunModeDefinition, runModesByGroup } from './run-mode-catalog';

describe('content lock', () => {
    afterEach(() => {
        setActiveContentLock(FULL_CONTENT_LOCK);
    });

    it('keeps the written-out demo pools in step with the catalogs they came from', () => {
        // content-lock.ts is a leaf module so the renderer entry cannot reorder the shared
        // graph's import cycles; these assertions are what keeps the lists honest.
        const actOne = new Set<string>();
        for (const row of getFloorArchetypeProgressionRows()) {
            if (row.cycleFloor <= 4) {
                row.mutators.forEach((id) => actOne.add(id));
            }
        }
        expect(new Set(getDemoMutatorPool())).toEqual(actOne);
        expect(getDemoMutatorPool().every((id) => MUTATOR_IDS.includes(id))).toBe(true);
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
        expect(full.mutatorPool).toBeNull();
        expect(full.steamAchievementsEnabled).toBe(true);
        expect(filterMutatorsByContentLock(MUTATOR_IDS, full)).toEqual([...MUTATOR_IDS]);
    });

    it('rolls only demo mutators in the demo', () => {
        activateContentLockFromEnv('demo');
        const demoMutators = new Set(getDemoMutatorPool());
        expect(filterMutatorsByContentLock(MUTATOR_IDS).every((id) => demoMutators.has(id))).toBe(true);
        expect(getActiveContentLock().steamAchievementsEnabled).toBe(false);
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

});
