import { MAX_DEPTH, runDepth } from './depth-rules';
import type { DescentRecordPersisted, RunState, SaveData } from './contracts';
import { DESCENT_ACTS, descentActForFloor } from './floor-mutator-schedule';
import { DREAD_TIERS, dreadForRun, dreadTier } from './dread-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The Descent's record on a profile (DGE-031, 2026-10-20): what the deep-game pack persists, in one
 * schema bump (save schema 10) so the tickets after it add no migrations of their own.
 *
 * - `wardenClears`: runs that cleared the Warden (`warden-rules.ts`); the first one opens Endless,
 *   which is the `descent:endless` unlock tag (DGE-006 reads it).
 * - `deepestFloor`, `deepestActId`: how far down the profile has been, and which act that is.
 * - `deepestDreadTierId`: the worst the dungeon has become for this profile (`dread-rules.ts`).
 * - `bestDepth`: the deepest Depth (DGE-025), zero until Depths exist.
 * Feats and blueprints are unlock tags (`feat:<id>`, `blueprint:<id>`) when their tickets add them,
 * so they need no field here. A shared table and a test-pace run write none of this.
 */
export const ENDLESS_UNLOCK_TAG = 'descent:endless';

const ACT_IDS: ReadonlySet<string> = new Set(DESCENT_ACTS.map((act) => act.id));
const TIER_IDS: readonly string[] = DREAD_TIERS.map((tier) => tier.id);

export const emptyDescentRecord = (): DescentRecordPersisted => ({
    wardenClears: 0,
    deepestFloor: 0,
    deepestActId: null,
    deepestDreadTierId: null,
    bestDepth: 0
});

/** A stored record read back whole: unknown acts and tiers read as none, counts as whole numbers. */
export const normalizeDescentRecord = (input: unknown): DescentRecordPersisted => {
    const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const act = typeof source.deepestActId === 'string' && ACT_IDS.has(source.deepestActId) ? source.deepestActId : null;
    const tier = typeof source.deepestDreadTierId === 'string' && TIER_IDS.includes(source.deepestDreadTierId) ? source.deepestDreadTierId : null;
    return {
        wardenClears: runNonNegativeInteger(source.wardenClears),
        deepestFloor: runNonNegativeInteger(source.deepestFloor),
        deepestActId: act as DescentRecordPersisted['deepestActId'],
        deepestDreadTierId: tier as DescentRecordPersisted['deepestDreadTierId'],
        bestDepth: runNonNegativeInteger(source.bestDepth)
    };
};

/** Whether this profile has cleared the Warden and so opened Endless. */
export const isEndlessUnlocked = (save: Pick<SaveData, 'unlocks'>): boolean => (save.unlocks ?? []).includes(ENDLESS_UNLOCK_TAG);

/**
 * A finished run folded into the profile's record. Only a run that counts: never a shared table or
 * a test-pace run, whose depth was not walked.
 */
export const recordDescent = (save: SaveData, run: RunState): SaveData => {
    if (run.passAndPlay || run.descentPace === 'fast') return save;
    const before = normalizeDescentRecord(save.playerStats?.descent);
    const floor = Math.max(runNonNegativeInteger(run.stats.highestLevel), runNonNegativeInteger(run.board?.level));
    const deeper = floor > before.deepestFloor;
    const reached = dreadTier(dreadForRun(run)).tier.id;
    const worse = before.deepestDreadTierId === null || TIER_IDS.indexOf(reached) > TIER_IDS.indexOf(before.deepestDreadTierId);
    const won = run.runEndReason === 'warden_cleared';
    const descent: DescentRecordPersisted = {
        ...before,
        wardenClears: before.wardenClears + (won ? 1 : 0),
        deepestFloor: deeper ? floor : before.deepestFloor,
        deepestActId: deeper && floor > 0 ? descentActForFloor(floor).id : before.deepestActId,
        deepestDreadTierId: worse ? (reached as DescentRecordPersisted['deepestDreadTierId']) : before.deepestDreadTierId,
        // The Depths (`depth-rules.ts`): the Warden felled at Depth n opens n + 1.
        bestDepth: won ? Math.max(before.bestDepth, Math.min(MAX_DEPTH, runDepth(run) + 1)) : before.bestDepth
    };
    const unlocks = won ? [...new Set([...(save.unlocks ?? []), ENDLESS_UNLOCK_TAG])] : save.unlocks;
    return {
        ...save,
        ...(unlocks ? { unlocks } : {}),
        playerStats: { ...(save.playerStats ?? { bestFloorNoPowers: 0, encorePairKeysLastRun: [] }), descent }
    };
};
