import {
    REALM_IDS,
    type BoardState,
    type RealmDoor,
    type RealmId,
    type RealmSeverity,
    type RunState,
    type TileSuit
} from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { attunementGoldBonus } from './realm-carryover-rules';
import { SUIT_REALM } from './realm-sway-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';

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
 * - every card is made of its suit's element (`element-alchemy-rules.ts`): a card is untouched by
 *   its own element (it drinks it and is empowered) and by the one its element puts out, and the
 *   sway of the player's matches can turn the floor into another realm (`realm-sway-rules.ts`);
 * - at every floor clear the player walks through one of three **doors**: a realm and how hard
 *   its weather blows. Harder weather comes sooner and pays more gold at the clear. The realm the
 *   floor ended in is always one of the doors, so a floor tipped is a route chosen.
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
    /** The realm's peak: what every third weather of a floor becomes, and what it does. */
    peak: string;
    peakRule: string;
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
        peak: 'Whiteout',
        peakRule: 'Every face-down card is snowed over: no suit on the board can be read.',
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
        peak: 'Firestorm',
        peakRule: 'A new fire, and every fire on the board spreads to a neighbour at once.',
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
        peak: 'Spring Tide',
        peakRule: 'Two columns run at once.',
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
        peak: 'Thunderclap',
        peakRule: 'A whole row of face-down cards is lit until your next flip. Nothing moves.',
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
        peak: 'Bloom',
        peakRule: 'The vines flower: every bloom cut pays three gold.',
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

/**
 * Whether the realm's weather runs on its own clock (2026-10-01). Once the matched groups cast the
 * elements (`element-group-rules.ts`), the owner kept the clock only where it is the extra danger:
 * a raging floor. On a calm or wild floor everything that happens to the board comes from the cards.
 */
export const realmWeatherClockRuns = (severity: RealmSeverity): boolean => severity === 'raging';

/** True on the resolved turns the realm's weather comes. `turnsThisFloor` is the count after the turn. */
export const isRealmWeatherTurn = (realmId: RealmId, severity: RealmSeverity, turnsThisFloor: number): boolean => {
    if (!realmWeatherClockRuns(severity)) return false;
    const turns = runNonNegativeInteger(turnsThisFloor);
    return turns > 0 && turns % realmIntervalFor(realmId, severity) === 0;
};

/** Turns until the next weather, counted from the turns taken so far; what the HUD shows. */
export const turnsUntilRealmWeather = (realmId: RealmId, severity: RealmSeverity, turnsThisFloor: number): number => {
    const interval = realmIntervalFor(realmId, severity);
    const turns = runNonNegativeInteger(turnsThisFloor);
    return interval - (turns % interval);
};

/** A confluence floor pays this multiple of the clear's gold, whatever its severity. */
export const CONFLUENCE_GOLD_MULTIPLIER = 2;
/** The first floor a confluence door can lead to, and the chance a clear offers one. */
export const CONFLUENCE_FIRST_FLOOR = 4;
export const CONFLUENCE_CHANCE = 0.34;

/** The gold a floor's clear pays in this realm's weather: the door's multiplier, rounded half up. */
export const realmClearGold = (baseGold: number, severity: RealmSeverity | null, confluence = false, attunement = 0): number =>
    Math.floor(
        runNonNegativeInteger(baseGold) *
            ((confluence ? CONFLUENCE_GOLD_MULTIPLIER : severity ? REALM_SEVERITIES[severity].goldMultiplier : 1) +
                attunementGoldBonus(attunement)) +
            0.5
    );

/** A confluence floor's second realm, or null: never the same realm as the first. */
export const runRealmSecondaryId = (run: Pick<RunState, 'realmId' | 'realmSecondaryId'>): RealmId | null =>
    isRealmId(run.realmSecondaryId) && run.realmSecondaryId !== run.realmId ? run.realmSecondaryId : null;

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
 * that cleared. The realm the floor ended in is always one of them (a floor tipped by the sway is a
 * route picked); the other two are realms the floor was not in.
 */
export const rollRealmDoors = (runSeed: number, clearedLevel: number, endedIn: RealmId | null): RealmDoor[] => {
    const rng = createMulberry32(hashStringToSeed(`realm-doors:${Math.floor(runSeed)}:${Math.floor(clearedLevel)}`));
    const others = shuffleWithRng(rng, REALM_IDS.filter((id) => id !== endedIn));
    const realms: RealmId[] = endedIn ? [endedIn, others[0]!, others[1]!] : others.slice(0, REALM_DOOR_COUNT);
    const severities = shuffleWithRng(rng, ['calm', 'wild', 'raging'] as RealmSeverity[]);
    const doors: RealmDoor[] = realms.map((realmId, index) => ({ realmId, severity: severities[index] ?? 'wild' }));
    // Shown in a seeded order, so the realm the floor ended in is not always the first door.
    const shown = shuffleWithRng(rng, doors);
    /*
     * A confluence: from the fourth floor, about one clear in three turns its wild door into two
     * realms at once - the weather alternates between them, both answer the player, and the clear
     * pays double. Drawn after the doors, so the doors themselves are the same with or without it.
     */
    if (clearedLevel + 1 >= CONFLUENCE_FIRST_FLOOR && rng() < CONFLUENCE_CHANCE) {
        const wild = shown.findIndex((door) => door.severity === 'wild');
        const host = shown[wild];
        if (host) {
            const partners = REALM_IDS.filter((id) => id !== host.realmId);
            shown[wild] = { ...host, confluence: partners[pickRngIndex(rng, partners.length)]! };
        }
    }
    return shown;
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
    return {
        ...run,
        nextRealm: {
            realmId: door.realmId,
            severity: door.severity,
            ...(isRealmId(door.confluence) && door.confluence !== door.realmId ? { confluence: door.confluence } : {})
        }
    };
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
    const secondary = runRealmSecondaryId(run);
    return current ? { realmId: current, severity: runRealmSeverity(run), ...(secondary ? { confluence: secondary } : {}) } : null;
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
    | 'realmBacklashesThisFloor'
    | 'realmTipsThisFloor'
    | 'elementCastsThisFloor'
    | 'elementEmpoweredThisFloor'
    | 'elementNeutralizedThisFloor'
    | 'elementReactionsThisFloor'
    | 'realmStillTurns'
    | 'lastRealmEvent'
    | 'realmLitTileIds'
    | 'realmPeaksThisFloor'
> => ({
    realmWeatherThisFloor: 0,
    realmReactionsThisFloor: 0,
    realmDousedThisFloor: 0,
    realmBurnoutsThisFloor: 0,
    realmVinesCutThisFloor: 0,
    realmFrozenThisFloor: 0,
    realmBacklashesThisFloor: 0,
    realmTipsThisFloor: 0,
    elementCastsThisFloor: 0,
    elementEmpoweredThisFloor: 0,
    elementNeutralizedThisFloor: 0,
    elementReactionsThisFloor: 0,
    realmStillTurns: 0,
    lastRealmEvent: null,
    realmLitTileIds: [],
    realmPeaksThisFloor: 0
});

/** The share of a floor's pairs a realm's element can take over, however deep the player is. */
export const DEEP_DECK_SHARE = 0.5;

/**
 * The deeper the player is in a realm, the more of the floor is made of it (2026-10-02): the
 * realm's element takes over one more pair for every level of depth, up to half the floor's pairs.
 * The pairs it takes are seeded; a pair keeps its symbol and its cells, only its element turns. The
 * storm has no element, so its floors are dealt as they come.
 */
export const deepenFloorDeck = (board: BoardState, realmId: RealmId, depth: number, runSeed: number, rulesVersion: number): BoardState => {
    const element = (Object.keys(SUIT_REALM) as TileSuit[]).find((suit) => SUIT_REALM[suit] === realmId);
    const levels = runNonNegativeInteger(depth);
    if (!element || levels === 0) return board;
    const real = board.tiles.filter((tile) => tile.suit != null && !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey));
    const suitByPair = new Map<string, TileSuit>();
    for (const tile of real) suitByPair.set(tile.pairKey, tile.suit!);
    const own = [...suitByPair.values()].filter((suit) => suit === element).length;
    const take = Math.min(levels, Math.floor(suitByPair.size * DEEP_DECK_SHARE) - own);
    if (take <= 0) return board;
    const rng = createMulberry32(hashStringToSeed(`realm-deck:${Math.floor(runSeed)}:${rulesVersion}:${board.level}`));
    const taken = new Set(shuffleWithRng(rng, [...suitByPair.keys()].filter((pairKey) => suitByPair.get(pairKey) !== element)).slice(0, take));
    return { ...board, tiles: board.tiles.map((tile) => (taken.has(tile.pairKey) ? { ...tile, suit: element } : tile)) };
};

/**
 * A floor about to be played in a realm: its board, and the run fields that say where it is. A run without realms gets its board back and nothing to write.
 */
export const enterRealmFloor = (
    run: Pick<RunState, 'runSeed' | 'runRulesVersion' | 'realmAttunement'>,
    board: BoardState,
    door: RealmDoor | null
): { board: BoardState; fields: Partial<RunState> } => {
    if (!door || !usesRealms(run)) {
        return { board, fields: {} };
    }
    return {
        board: deepenFloorDeck(board, door.realmId, runNonNegativeInteger(run.realmAttunement?.[door.realmId] ?? 0), run.runSeed, run.runRulesVersion),
        fields: {
            realmId: door.realmId,
            realmSeverity: door.severity,
            realmSecondaryId: isRealmId(door.confluence) && door.confluence !== door.realmId ? door.confluence : null,
            realmDoors: null,
            nextRealm: null,
            ...freshRealmFloorCounters()
        }
    };
};
