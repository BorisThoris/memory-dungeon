import {
    REALM_IDS,
    type BoardState,
    type RealmDoor,
    type RealmId,
    type RealmSeverity,
    type RunState
} from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { seatRealmOmen } from './realm-omen-rules';

/**
 * The realms: where a floor is played, and what the place does to the board while it is played.
 *
 * The owner's brief (2026-09-30): environments have to be a prominent factor, they have to change
 * how a floor plays rather than how it looks, and the player should choose where to go next the
 * way Shape of Dreams hands out its paths. So:
 *
 * - every floor is in a realm, and every realm has **weather** that iterates during play on the
 *   clock the player winds (resolved turns, match or miss), the way the restless floor does:
 *   a blizzard slides a row and snows the backs over, wildfire lights a card on a fuse, the tide
 *   runs a column down, lightning swaps two cards and leaves them lit, vines hold cards down;
 * - each realm also answers the player's own turns: a miss in the frost freezes the two cards it
 *   showed, a match beside a vine cuts it, a burning card matched in time is doused for gold;
 * - an **omen** pair on the board (`realm-omen-rules.ts`) is an environment card: matching it
 *   sets off a reaction and turns the floor into the omen's realm for the rest of the floor;
 * - at every floor clear the player walks through one of three **doors**: a realm and how hard
 *   its weather blows. Harder weather comes sooner and pays more gold at the clear. The realm the
 *   floor ended in is always one of the doors, so an omen matched is a route chosen.
 *
 * Seeded throughout, so a shared seed is the same weather for everyone who plays it.
 */

/** Realms play from this rules version on; a replay of an older run has none. They change no board generation, so they did not need a bump of their own. */
export const REALM_RULES_VERSION = 51;

export interface RealmDefinition {
    id: RealmId;
    title: string;
    /** The place, as the travel door names it. */
    place: string;
    /** The weather's name, as the HUD counts down to it. */
    weather: string;
    /** Resolved turns between weather at `wild`; calm adds one, raging takes one away. */
    interval: number;
    /** What the door says the realm does, in one line each. */
    rules: readonly [string, string];
    /** Scene tint for the room: hue rotation in degrees and saturation, applied to the backdrop. */
    hueDeg: number;
    saturate: number;
    /** The realm's colour, for its marks and its door. */
    color: string;
}

export const REALMS: Readonly<Record<RealmId, RealmDefinition>> = {
    frost: {
        id: 'frost',
        title: 'Frost',
        place: 'The Frozen Reach',
        weather: 'Blizzard',
        interval: 4,
        rules: [
            'A miss freezes both cards for two turns: no turning them until the ice goes.',
            'Blizzards slide a row with the wind and snow over the backs.'
        ],
        hueDeg: 170,
        saturate: 0.7,
        color: '#9fdcff'
    },
    ember: {
        id: 'ember',
        title: 'Ember',
        place: 'The Cinder Deep',
        weather: 'Wildfire',
        interval: 3,
        rules: [
            'Wildfire lights a card on a three-turn fuse. Match it in time: doused, gold.',
            'A fuse that runs out burns a gold and spreads to a neighbour.'
        ],
        hueDeg: -12,
        saturate: 1.35,
        color: '#ff8a3d'
    },
    tide: {
        id: 'tide',
        title: 'Tide',
        place: 'The Drowned Vault',
        weather: 'Current',
        interval: 3,
        rules: [
            'The current runs one column down a step, and sweeps across the room.',
            'Watch the column it names: the cards in it all move together.'
        ],
        hueDeg: 150,
        saturate: 1.05,
        color: '#4fd6c8'
    },
    storm: {
        id: 'storm',
        title: 'Storm',
        place: 'The Thunder Spire',
        weather: 'Lightning',
        interval: 4,
        rules: [
            'Lightning swaps two hidden cards and leaves both lit until your next flip.',
            'What it shows you is where they landed. Look fast.'
        ],
        hueDeg: -70,
        saturate: 1.1,
        color: '#b69bff'
    },
    grove: {
        id: 'grove',
        title: 'Grove',
        place: 'The Overgrown Crypt',
        weather: 'Overgrowth',
        interval: 3,
        rules: [
            'Vines creep over a card: it cannot be turned while they hold.',
            'A match beside vines cuts them, a gold for every vine.'
        ],
        hueDeg: 60,
        saturate: 1.15,
        color: '#8fd66a'
    }
};

export interface RealmSeverityDefinition {
    id: RealmSeverity;
    title: string;
    /** Added to the realm's interval. */
    intervalDelta: number;
    /** Multiplies the gold the floor's clear pays. */
    goldMultiplier: number;
    /** How many cards one weather event takes. */
    reach: number;
}

export const REALM_SEVERITIES: Readonly<Record<RealmSeverity, RealmSeverityDefinition>> = {
    calm: { id: 'calm', title: 'Calm', intervalDelta: 1, goldMultiplier: 1, reach: 1 },
    wild: { id: 'wild', title: 'Wild', intervalDelta: 0, goldMultiplier: 1.25, reach: 1 },
    raging: { id: 'raging', title: 'Raging', intervalDelta: -1, goldMultiplier: 1.5, reach: 2 }
};

export const isRealmId = (value: unknown): value is RealmId =>
    typeof value === 'string' && (REALM_IDS as readonly string[]).includes(value);

const isSeverity = (value: unknown): value is RealmSeverity =>
    value === 'calm' || value === 'wild' || value === 'raging';

export const runRealmId = (run: Pick<RunState, 'realmId'>): RealmId | null =>
    isRealmId(run.realmId) ? run.realmId : null;

export const runRealmSeverity = (run: Pick<RunState, 'realmSeverity'>): RealmSeverity =>
    isSeverity(run.realmSeverity) ? run.realmSeverity : 'calm';

export const realmIntervalFor = (realmId: RealmId, severity: RealmSeverity): number =>
    Math.max(2, REALMS[realmId].interval + REALM_SEVERITIES[severity].intervalDelta);

/** True on the resolved turns the realm's weather comes. `turnsThisFloor` is the count after the turn. */
export const isRealmWeatherTurn = (realmId: RealmId, severity: RealmSeverity, turnsThisFloor: number): boolean => {
    const turns = runNonNegativeInteger(turnsThisFloor);
    return turns > 0 && turns % realmIntervalFor(realmId, severity) === 0;
};

/** Turns until the next weather, counted from the turns taken so far; what the HUD shows. */
export const turnsUntilRealmWeather = (realmId: RealmId, severity: RealmSeverity, turnsThisFloor: number): number => {
    const interval = realmIntervalFor(realmId, severity);
    const turns = runNonNegativeInteger(turnsThisFloor);
    return interval - (turns % interval);
};

/** The gold a floor's clear pays in this realm's weather: the door's multiplier, rounded half up. */
export const realmClearGold = (baseGold: number, severity: RealmSeverity | null): number =>
    Math.floor(runNonNegativeInteger(baseGold) * (severity ? REALM_SEVERITIES[severity].goldMultiplier : 1) + 0.5);

/** The realm a run opens in: seeded, calm, so a first floor is a place before it is a problem. */
export const openingRealmDoor = (runSeed: number): RealmDoor => {
    const rng = createMulberry32(hashStringToSeed(`realm-open:${Math.floor(runSeed)}`));
    return { realmId: REALM_IDS[pickRngIndex(rng, REALM_IDS.length)] ?? 'frost', severity: 'calm' };
};

export const usesRealms = (run: Pick<RunState, 'runRulesVersion'>): boolean =>
    runNonNegativeInteger(run.runRulesVersion) >= REALM_RULES_VERSION;

/** How many doors a clear offers. */
export const REALM_DOOR_COUNT = 3;

/**
 * The doors at a floor clear. Three realms, one of each severity, seeded from the run and the floor
 * that cleared. The realm the floor ended in is always one of them (an omen matched is a route
 * picked); the other two are realms the floor was not in.
 */
export const rollRealmDoors = (runSeed: number, clearedLevel: number, endedIn: RealmId | null): RealmDoor[] => {
    const rng = createMulberry32(hashStringToSeed(`realm-doors:${Math.floor(runSeed)}:${Math.floor(clearedLevel)}`));
    const others = shuffleWithRng(rng, REALM_IDS.filter((id) => id !== endedIn));
    const realms: RealmId[] = endedIn ? [endedIn, others[0]!, others[1]!] : others.slice(0, REALM_DOOR_COUNT);
    const severities = shuffleWithRng(rng, ['calm', 'wild', 'raging'] as RealmSeverity[]);
    const doors = realms.map((realmId, index) => ({ realmId, severity: severities[index] ?? 'wild' }));
    // Shown in a seeded order, so the realm the floor ended in is not always the first door.
    return shuffleWithRng(rng, doors);
};

/** The player walks through a door: remembered until the next floor builds in it. */
export const chooseRealmDoor = (run: RunState, index: number): RunState => {
    if (run.status !== 'levelComplete' || !Array.isArray(run.realmDoors)) {
        return run;
    }
    const door = run.realmDoors[Math.floor(index)];
    if (!door || !isRealmId(door.realmId) || !isSeverity(door.severity)) {
        return run;
    }
    return { ...run, nextRealm: { realmId: door.realmId, severity: door.severity } };
};

/** Where the next floor is: the door walked through, or the first door when none was (a shared table). */
export const nextFloorRealmDoor = (run: RunState): RealmDoor | null => {
    if (run.nextRealm && isRealmId(run.nextRealm.realmId) && isSeverity(run.nextRealm.severity)) {
        return run.nextRealm;
    }
    const first = Array.isArray(run.realmDoors) ? run.realmDoors[0] : undefined;
    if (first && isRealmId(first.realmId) && isSeverity(first.severity)) {
        return first;
    }
    const current = runRealmId(run);
    return current ? { realmId: current, severity: runRealmSeverity(run) } : null;
};

/** The per-floor realm counters, zeroed for a floor that is about to build. */
export const freshRealmFloorCounters = (): Pick<
    RunState,
    | 'realmWeatherThisFloor'
    | 'realmReactionsThisFloor'
    | 'realmDousedThisFloor'
    | 'realmBurnoutsThisFloor'
    | 'realmVinesCutThisFloor'
    | 'realmFrozenThisFloor'
    | 'lastRealmEvent'
    | 'realmLitTileIds'
> => ({
    realmWeatherThisFloor: 0,
    realmReactionsThisFloor: 0,
    realmDousedThisFloor: 0,
    realmBurnoutsThisFloor: 0,
    realmVinesCutThisFloor: 0,
    realmFrozenThisFloor: 0,
    lastRealmEvent: null,
    realmLitTileIds: []
});

/**
 * A floor about to be played in a realm: the board with its omen seated, and the run fields that
 * say where it is. A run without realms gets its board back and nothing to write.
 */
export const enterRealmFloor = (
    run: Pick<RunState, 'runSeed' | 'runRulesVersion'>,
    board: BoardState,
    door: RealmDoor | null
): { board: BoardState; fields: Partial<RunState> } => {
    if (!door || !usesRealms(run)) {
        return { board, fields: {} };
    }
    return {
        board: seatRealmOmen(board, door.realmId, run.runSeed, run.runRulesVersion),
        fields: {
            realmId: door.realmId,
            realmSeverity: door.severity,
            realmDoors: null,
            nextRealm: null,
            ...freshRealmFloorCounters()
        }
    };
};
