import type { MutatorId, RelicId } from './contracts';

/**
 * The active content lock: what this build flavour ships. This module carries no game imports
 * so rules modules (relics, floor schedule, mode catalog) can read the lock without a cycle;
 * `content-lock.ts` builds the demo and full locks from the catalogs.
 */

export type BuildFlavour = 'demo' | 'full';

export interface ContentLock {
    flavour: BuildFlavour;
    /** Mode ids the player can start. `null` means every catalog mode. */
    availableModeIds: ReadonlySet<string> | null;
    /** Relic ids drafts may offer. `null` means the full pool. */
    relicPool: readonly RelicId[] | null;
    /** Mutator ids floors may roll. `null` means the full catalog. */
    mutatorPool: readonly MutatorId[] | null;
    steamAchievementsEnabled: boolean;
    /** Shown on the run-end screen and locked mode cards in the demo. */
    fullGameLedger: readonly string[];
}

export const FULL_CONTENT_LOCK: ContentLock = {
    flavour: 'full',
    availableModeIds: null,
    relicPool: null,
    mutatorPool: null,
    steamAchievementsEnabled: true,
    fullGameLedger: []
};

export const resolveBuildFlavour = (raw: string | undefined | null): BuildFlavour =>
    raw?.trim().toLowerCase() === 'demo' ? 'demo' : 'full';

let activeLock: ContentLock = FULL_CONTENT_LOCK;

/** Set once at startup by the renderer (from `VITE_BUILD_FLAVOUR`) or the main process. */
export const setActiveContentLock = (lock: ContentLock): void => {
    activeLock = lock;
};

export const getActiveContentLock = (): ContentLock => activeLock;

export const isDemoBuild = (): boolean => activeLock.flavour === 'demo';

export const isModeAvailableInBuild = (modeId: string, lock: ContentLock = activeLock): boolean =>
    lock.availableModeIds === null || lock.availableModeIds.has(modeId);

export const filterRelicPoolByContentLock = (ids: readonly RelicId[], lock: ContentLock = activeLock): RelicId[] =>
    lock.relicPool ? ids.filter((id) => lock.relicPool!.includes(id)) : [...ids];

export const filterMutatorsByContentLock = (ids: readonly MutatorId[], lock: ContentLock = activeLock): MutatorId[] =>
    lock.mutatorPool ? ids.filter((id) => lock.mutatorPool!.includes(id)) : [...ids];
