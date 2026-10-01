import type { BoardState, RealmId, RunState, Tile } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';
import { elementWouldLand } from './element-alchemy-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * What a realm floor leaves behind (2026-10-01): consequences that follow the player down the
 * stairs, so how a realm was played matters past its own clear.
 *
 * - **Smoke.** Every fire that burnt out on a floor hangs in the next room: the study window is
 *   cut by a share per burnout, up to three. A player who let the Cinder Deep burn studies the next
 *   board through smoke.
 * - **Chill.** A floor that froze four cards or more sends the cold on: the next floor opens with
 *   two cards already frozen, whatever realm it is in.
 * - **Attunement.** A realm floor cleared clean by that realm's own measure attunes the player to
 *   it, up to three: every level is a quarter more gold on that realm's clears, and the travel doors
 *   say so. It turns the route into a build - stay in the realm you have mastered, or chase the
 *   doors that pay.
 */
export const SMOKE_STUDY_CUT_PER_BURNOUT = 0.12;
export const SMOKE_MAX = 3;
export const CHILL_FROZEN_THRESHOLD = 4;
export const CHILL_CARDS = 2;
export const CHILL_FROST_TURNS = 2;
export const ATTUNEMENT_MAX = 3;
export const ATTUNEMENT_GOLD_STEP = 0.25;

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
    realmId ? Math.min(ATTUNEMENT_MAX, runNonNegativeInteger(run.realmAttunement?.[realmId] ?? 0)) : 0;

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
    const attunement = { ...(run.realmAttunement ?? {}) };
    if (!realmId) {
        return { realmSmoke: 0, realmChill: 0, realmAttunement: attunement, attuned: null };
    }
    const clean = realmFloorWasClean(run, realmId, turnsTaken, parTurns);
    const before = realmAttunementLevel(run, realmId);
    const attuned = clean && before < ATTUNEMENT_MAX ? realmId : null;
    if (attuned) attunement[realmId] = before + 1;
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
    // Never both halves of one pair, so the chill delays a pair rather than locking it.
    const chosen: string[] = [];
    const keys = new Set<string>();
    for (const id of shuffleWithRng(rng, candidates)) {
        if (chosen.length >= count) break;
        const tile = board.tiles.find((candidate) => candidate.id === id)!;
        if (keys.has(tile.pairKey)) continue;
        keys.add(tile.pairKey);
        chosen.push(id);
    }
    return {
        ...board,
        tiles: board.tiles.map((tile): Tile => (chosen.includes(tile.id) ? { ...tile, frost: CHILL_FROST_TURNS } : tile))
    };
};
