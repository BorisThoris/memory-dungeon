import type { MutatorId, RelicId } from './contracts';
import {
    FULL_CONTENT_LOCK,
    resolveBuildFlavour,
    setActiveContentLock,
    type BuildFlavour,
    type ContentLock
} from './content-lock-state';
import { getFloorArchetypeProgressionRows } from './floor-mutator-schedule';
import { RELIC_POOL, RELIC_POOL_COMFORT } from './relics';

/**
 * Demo vs full build content lock. One source of truth for what the demo flavour ships,
 * derived from `docs/STEAM_DEMO_CYCLE.md` §4: cap breadth, never run length.
 *
 * - Run length: uncapped in both flavours. Nothing here limits floors or runs.
 * - Modes: the demo ships the Classic dungeon run only; every other mode stays visible and
 *   is labelled "in the full game" by the Choose Your Path screen.
 * - Relics: the demo draws from every common relic plus four power relics. Mutators: the
 *   first act of the twelve-floor endless cycle.
 * - Findables, hazards and side rooms are untouched: they carry the depth.
 * - Steam achievements are off in the demo (Valve's recommendation); saves never carry over.
 */

export type { BuildFlavour, ContentLock } from './content-lock-state';
export {
    filterMutatorsByContentLock,
    filterRelicPoolByContentLock,
    getActiveContentLock,
    isDemoBuild,
    isModeAvailableInBuild,
    resolveBuildFlavour,
    setActiveContentLock
} from './content-lock-state';

export const DEMO_MODE_IDS = ['classic'] as const;

/** Power relics that stay in the demo alongside every common relic. */
export const DEMO_POWER_RELIC_IDS: readonly RelicId[] = [
    'destroy_bank_plus_one',
    'combo_shard_plus_step',
    'chapter_compass',
    'shrine_echo'
];

/** Cycle floors whose mutators the demo may roll: Act I of the endless cycle. */
export const DEMO_MUTATOR_CYCLE_FLOORS = 4;

export const getFullGameLedger = (): readonly string[] => [
    'Four more modes: Daily Challenge, Gauntlet, Puzzle sets and Meditation',
    'Endless Mode with the full twelve-floor cycle of mutators',
    `The full relic roster (${RELIC_POOL.length} relics) and every build archetype`,
    'Steam achievements and the complete collection'
];

export const getDemoMutatorPool = (): MutatorId[] => {
    const ids = new Set<MutatorId>();
    for (const row of getFloorArchetypeProgressionRows()) {
        if (row.cycleFloor <= DEMO_MUTATOR_CYCLE_FLOORS) {
            row.mutators.forEach((id) => ids.add(id));
        }
    }
    return [...ids];
};

export const getDemoRelicPool = (): RelicId[] => {
    const ids = new Set<RelicId>([...RELIC_POOL_COMFORT, ...DEMO_POWER_RELIC_IDS]);
    return RELIC_POOL.filter((id) => ids.has(id));
};

export const createContentLock = (flavour: BuildFlavour): ContentLock =>
    flavour === 'demo'
        ? {
              flavour,
              availableModeIds: new Set<string>(DEMO_MODE_IDS),
              relicPool: getDemoRelicPool(),
              mutatorPool: getDemoMutatorPool(),
              steamAchievementsEnabled: false,
              fullGameLedger: getFullGameLedger()
          }
        : FULL_CONTENT_LOCK;

/** Resolve the flavour from an environment value and make it the active lock. */
export const activateContentLockFromEnv = (raw: string | undefined | null): ContentLock => {
    const lock = createContentLock(resolveBuildFlavour(raw));
    setActiveContentLock(lock);
    return lock;
};
