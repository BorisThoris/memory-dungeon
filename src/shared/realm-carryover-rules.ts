import type { BoardState, RealmId, RunState, Tile } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';
import { elementWouldLand } from './element-alchemy-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { reconcileRealmHolds } from './realm-hold-policy';

/**
 * What a realm floor leaves behind (2026-10-01): consequences that follow the player down the
 * stairs, so how a realm was played matters past its own clear.
 *
 * - **Smoke.** Every fire that burnt out on a floor hangs in the next room: the study window is
 *   cut by a share per burnout, up to three. A player who let the Cinder Deep burn studies the next
 *   board through smoke.
 * - **Chill.** A floor that froze four cards or more sends the cold on: the next floor opens with
 *   at least two complete pairs frozen, if another pair can remain playable.
 * - **Attunement, the realm's depth.** Every clear in a realm attunes the player to it by a level,
 *   two when the floor was clean by that realm's own measure, and every other realm fades by one.
 *   Since 2026-10-02 it has no cap: keep walking through the same realm's door and it stacks without
 *   end. A level is a quarter more gold on that realm's clears up to three and a twentieth after
 *   (`attunementGoldBonus`); the realm's element takes over a pair of the floor a level
 *   (`deepenFloorDeck` in `realm-rules.ts`) and resonates more (`realmResonanceBonus`); and the
 *   realm bites back sooner (`realmBacklashRuns`) and its raging weather reaches further
 *   (`realmDepthReach`). It turns the route into a build - go deeper where you are, or start again
 *   behind another door.
 */
export const SMOKE_STUDY_CUT_PER_BURNOUT = 0.12;
export const SMOKE_MAX = 3;
export const CHILL_FROZEN_THRESHOLD = 4;
export const CHILL_CARDS = 2;
export const CHILL_FROST_TURNS = 2;
/** Gold a level adds to the realm's clears: the full step for the first levels, the deep step after, without end. */
export const ATTUNEMENT_GOLD_STEP = 0.25;
export const ATTUNEMENT_FULL_STEP_LEVELS = 3;
export const ATTUNEMENT_DEEP_GOLD_STEP = 0.05;
/** Levels a clear earns in its realm, the extra a clean one earns, and what every other realm fades by. */
export const ATTUNEMENT_PER_CLEAR = 1;
export const ATTUNEMENT_CLEAN_BONUS = 1;
export const ATTUNEMENT_FADE = 1;
/** Depth at which a wild realm, and then even a calm one, strikes back at a miss. */
export const DEPTH_BACKLASH_WILD = 3;
export const DEPTH_BACKLASH_CALM = 6;
/** Levels of depth for one more card of reach in raging weather, and for one more stack a pair of the realm's element. */
export const DEPTH_PER_REACH = 4;
export const DEPTH_PER_RESONANCE = 3;

/** The share of gold a depth adds to its realm's clears. */
export const attunementGoldBonus = (level: number): number => {
    const depth = runNonNegativeInteger(level);
    return (
        ATTUNEMENT_GOLD_STEP * Math.min(ATTUNEMENT_FULL_STEP_LEVELS, depth) +
        ATTUNEMENT_DEEP_GOLD_STEP * Math.max(0, depth - ATTUNEMENT_FULL_STEP_LEVELS)
    );
};

/** Whether the realm answers a miss with its backlash: always raging, wild from depth 3, calm from depth 6. */
export const realmBacklashRuns = (severity: 'calm' | 'wild' | 'raging', depth: number): boolean =>
    severity === 'raging' ||
    (severity === 'wild' && runNonNegativeInteger(depth) >= DEPTH_BACKLASH_WILD) ||
    runNonNegativeInteger(depth) >= DEPTH_BACKLASH_CALM;

/** Cards of reach the depth adds to raging weather. */
export const realmDepthReach = (depth: number): number => Math.floor(runNonNegativeInteger(depth) / DEPTH_PER_REACH);

/** Stacks the depth adds to every pair matched of the realm's own element. */
export const realmResonanceBonus = (depth: number): number => Math.floor(runNonNegativeInteger(depth) / DEPTH_PER_RESONANCE);

/** Each realm's measure of a clean floor: the thing that realm punishes, not done. */
export const REALM_CLEAN_MEASURE: Readonly<Record<RealmId, string>> = {
    frost: 'no card frozen',
    ember: 'no fire burnt out',
    tide: 'cleared within par',
    storm: 'cleared within par',
    grove: 'two vines cut'
};

export const realmFloorWasClean = (
    run: Pick<RunState, 'realmFrozenThisFloor' | 'realmBurnoutsThisFloor' | 'realmVinesCutThisFloor'>,
    realmId: RealmId,
    turnsTaken: number,
    parTurns: number
): boolean => {
    switch (realmId) {
        case 'frost':
            return runNonNegativeInteger(run.realmFrozenThisFloor ?? 0) === 0;
        case 'ember':
            return runNonNegativeInteger(run.realmBurnoutsThisFloor ?? 0) === 0;
        case 'tide':
        case 'storm':
            return runNonNegativeInteger(turnsTaken) <= runNonNegativeInteger(parTurns);
        case 'grove':
            return runNonNegativeInteger(run.realmVinesCutThisFloor ?? 0) >= 2;
    }
};

export const realmAttunementLevel = (run: Pick<RunState, 'realmAttunement'>, realmId: RealmId | null): number =>
    realmId ? runNonNegativeInteger(run.realmAttunement?.[realmId] ?? 0) : 0;

export interface RealmCarryover {
    realmSmoke: number;
    realmChill: number;
    realmAttunement: Partial<Record<RealmId, number>>;
    /** The realm this clear attuned the player to (a level gained), or null. */
    attuned: RealmId | null;
}

/** What a realm floor's clear sends on. A run with no realm sends nothing. */
export const realmCarryoverAtClear = (
    run: RunState,
    realmId: RealmId | null,
    turnsTaken: number,
    parTurns: number
): RealmCarryover => {
    const attunement: Partial<Record<RealmId, number>> = { ...(run.realmAttunement ?? {}) };
    if (!realmId) {
        return { realmSmoke: 0, realmChill: 0, realmAttunement: attunement, attuned: null };
    }
    const clean = realmFloorWasClean(run, realmId, turnsTaken, parTurns);
    const before = realmAttunementLevel(run, realmId);
    // Every other realm fades; this one deepens, twice as fast when it was played clean.
    for (const other of Object.keys(attunement) as RealmId[]) {
        if (other === realmId) continue;
        const faded = Math.max(0, runNonNegativeInteger(attunement[other] ?? 0) - ATTUNEMENT_FADE);
        if (faded > 0) attunement[other] = faded;
        else delete attunement[other];
    }
    const attuned: RealmId | null = realmId;
    attunement[realmId] = before + ATTUNEMENT_PER_CLEAR + (clean ? ATTUNEMENT_CLEAN_BONUS : 0);
    return {
        realmSmoke: Math.min(SMOKE_MAX, runNonNegativeInteger(run.realmBurnoutsThisFloor ?? 0)),
        realmChill: runNonNegativeInteger(run.realmFrozenThisFloor ?? 0) >= CHILL_FROZEN_THRESHOLD ? CHILL_CARDS : 0,
        realmAttunement: attunement,
        attuned
    };
};

/** The study window through the smoke: a share off per burnout, never under the floor's minimum. */
export const applyRealmSmokeToStudy = (ms: number, smoke: number | undefined, minimumMs: number): number => {
    const level = Math.min(SMOKE_MAX, runNonNegativeInteger(smoke ?? 0));
    if (level === 0) return ms;
    return Math.max(minimumMs, Math.floor(ms * (1 - SMOKE_STUDY_CUT_PER_BURNOUT * level)));
};

/**
 * The cold carried in: `chill` seeded face-down cards start frozen. Never a frost or fire card: a
 * card is untouched by its own element and by the one it puts out (`element-alchemy-rules.ts`).
 */
export const applyRealmChill = (board: BoardState, chill: number | undefined, runSeed: number, rulesVersion: number): BoardState => {
    const count = runNonNegativeInteger(chill ?? 0);
    if (count === 0) return board;
    const rng = createMulberry32(hashStringToSeed(`realm-chill:${Math.floor(runSeed)}:${rulesVersion}:${board.level}`));
    const candidates = board.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey) && elementWouldLand(tile, 'bone')).map((tile) => tile.id);
    // Seed requested pairs; the cohort policy expands them without revealing a singular pair.
    const chosen: string[] = [];
    const keys = new Set<string>();
    for (const id of shuffleWithRng(rng, candidates)) {
        if (chosen.length >= count) break;
        const tile = board.tiles.find((candidate) => candidate.id === id)!;
        if (keys.has(tile.pairKey)) continue;
        keys.add(tile.pairKey);
        chosen.push(id);
    }
    const tiles = board.tiles.map((tile): Tile => (chosen.includes(tile.id) ? { ...tile, frost: CHILL_FROST_TURNS } : tile));
    reconcileRealmHolds(tiles, board.columns, board.tiles);
    return { ...board, tiles };
};
