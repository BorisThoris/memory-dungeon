import type { MutatorId } from './contracts';
import {
    FULL_CONTENT_LOCK,
    resolveBuildFlavour,
    setActiveContentLock,
    type BuildFlavour,
    type ContentLock
} from './content-lock-state';

/**
 * Demo vs full build content lock. One source of truth for what the demo flavour ships,
 * derived from `docs/STEAM_DEMO_CYCLE.md` §4: cap breadth, never run length.
 *
 * - Run length: uncapped in both flavours. Nothing here limits floors or runs.
 * - Modes: the demo ships the Classic dungeon run only; every other mode stays visible and
 *   is labelled "in the full game" by the Choose Your Path screen.
 * - Mutators: Act I of the endless cycle. Findables are untouched: they carry the depth.
 * - Steam achievements are off in the demo (Valve's recommendation); saves never carry over.
 *
 * The pools are written out rather than derived so this module imports no rules module. The
 * renderer entry activates the lock before the app graph loads, and `src/shared` has import
 * cycles that make evaluation order fragile; a leaf module cannot disturb them.
 * `content-lock.test.ts` asserts these lists still match the catalogs they came from.
 */

export type { BuildFlavour, ContentLock } from './content-lock-state';
export {
    filterMutatorsByContentLock,
    getActiveContentLock,
    isDemoBuild,
    isModeAvailableInBuild,
    resolveBuildFlavour,
    setActiveContentLock
} from './content-lock-state';

export const DEMO_MODE_IDS = ['classic'] as const;

/** Cycle floors whose mutators the demo may roll: Act I of the endless cycle. */
export const DEMO_MUTATOR_CYCLE_FLOORS = 4;

/** The mutators Act I schedules. */
export const DEMO_MUTATOR_IDS: readonly MutatorId[] = [
    'wide_recall',
    'short_memorize',
    'findables_floor',
    'silhouette_twist'
];

export const FULL_GAME_LEDGER: readonly string[] = [
    'Four more modes: Daily Challenge, Gauntlet, Puzzle sets and Meditation',
    'Endless Mode with the full twelve-floor cycle of mutators',
    'Steam achievements and the complete collection'
];


export const getDemoMutatorPool = (): MutatorId[] => [...DEMO_MUTATOR_IDS];

export const getFullGameLedger = (): readonly string[] => FULL_GAME_LEDGER;

export const createContentLock = (flavour: BuildFlavour): ContentLock =>
    flavour === 'demo'
        ? {
              flavour,
              availableModeIds: new Set<string>(DEMO_MODE_IDS),
              mutatorPool: getDemoMutatorPool(),
              steamAchievementsEnabled: false,
              fullGameLedger: FULL_GAME_LEDGER
          }
        : FULL_CONTENT_LOCK;

/** Resolve the flavour from an environment value and make it the active lock. */
export const activateContentLockFromEnv = (raw: string | undefined | null): ContentLock => {
    const lock = createContentLock(resolveBuildFlavour(raw));
    setActiveContentLock(lock);
    return lock;
};
