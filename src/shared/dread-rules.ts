import type { RealmSeverity, RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Dread (DGE-003, 2026-10-19): one number that says how bad the dungeon has become, and eight
 * named tiers the player reads on the run bar before they arrive.
 *
 * Dread is a function of where the run is, never of how it is played (thesis 25.13): it grows
 * with the floor and is multiplied by every raging floor (x1.15) and wild floor (x1.05) the run
 * has entered. Realm severities are seeded at each clear (`rollRealmDoors`), and a sway tip keeps
 * the severity, so no match or miss moves it. It never resets in a run and never stands still:
 * past the last tier it keeps counting doublings, the way the combo keeps climbing (`comboDepth`).
 *
 * Probe 2026-10-19 (200 seeds): median Dread 19 at floor 5, 73 at 12, 310 at 24, 1450 at 40 and
 * 7200 at 60, so the tiers are geometric. Floor 2 always reads under 8 (6 x 1.15^2 = 7.9) and
 * floor 3 always over it, so Stirring arrives on the third floor of every run.
 */

export const DREAD_PER_FLOOR = 3;
export const DREAD_RAGING_MULTIPLIER = 1.15;
export const DREAD_WILD_MULTIPLIER = 1.05;

export interface DreadTierDefinition {
    readonly id: DreadTierId;
    readonly name: string;
    /** The Dread at which the tier begins. */
    readonly from: number;
}

export type DreadTierId = 'quiet' | 'stirring' | 'restless' | 'hungry' | 'awake' | 'watching' | 'knows' | 'coming';

/** The one table the HUD, the Codex and the results screen read. */
export const DREAD_TIERS: readonly DreadTierDefinition[] = [
    { id: 'quiet', name: 'Quiet', from: 0 },
    { id: 'stirring', name: 'Stirring', from: 8 },
    { id: 'restless', name: 'Restless', from: 30 },
    { id: 'hungry', name: 'Hungry', from: 75 },
    { id: 'awake', name: 'Awake', from: 160 },
    { id: 'watching', name: 'Watching', from: 320 },
    { id: 'knows', name: 'It knows you', from: 1500 },
    { id: 'coming', name: 'It is coming', from: 7000 }
];

/**
 * What one floor would cost to compose (DGE-003's priced table). Not read by the board builder
 * yet: composing floors from a Dread budget changes generation, a `GAME_RULES_VERSION` bump the
 * ticket batches with DGE-009, whose Wanderer, Mask and Sleeper are the rows that make it matter.
 */
export const DREAD_PRICES = {
    pair: 1,
    wanderer: 4,
    mask: 6,
    sleeper: 9,
    stacked_mutator: 12,
    boss_rule: 20
} as const;

/** The run's count of floors entered in a raging and a wild realm, the first floor included. */
export const dreadFloorCounts = (run: Pick<RunState, 'dreadRagingFloors' | 'dreadWildFloors'>): { raging: number; wild: number } => ({
    raging: runNonNegativeInteger(run.dreadRagingFloors),
    wild: runNonNegativeInteger(run.dreadWildFloors)
});

/** The counts after a floor in `severity` is entered. */
export const countDreadFloor = (
    run: Pick<RunState, 'dreadRagingFloors' | 'dreadWildFloors'>,
    severity: RealmSeverity | null | undefined
): Pick<RunState, 'dreadRagingFloors' | 'dreadWildFloors'> => {
    const { raging, wild } = dreadFloorCounts(run);
    return {
        dreadRagingFloors: raging + (severity === 'raging' ? 1 : 0),
        dreadWildFloors: wild + (severity === 'wild' ? 1 : 0)
    };
};

export const dreadAt = (floor: number, raging: number, wild: number): number =>
    DREAD_PER_FLOOR *
    Math.max(1, runNonNegativeInteger(floor)) *
    DREAD_RAGING_MULTIPLIER ** runNonNegativeInteger(raging) *
    DREAD_WILD_MULTIPLIER ** runNonNegativeInteger(wild);

/** The run's Dread: its floor, raised by the raging and wild floors it has entered. */
export const dreadForRun = (run: Pick<RunState, 'board' | 'dreadRagingFloors' | 'dreadWildFloors'>): number => {
    const { raging, wild } = dreadFloorCounts(run);
    return dreadAt(run.board?.level ?? 1, raging, wild);
};

export interface DreadReading {
    readonly tier: DreadTierDefinition;
    readonly index: number;
    /** The tier after this one; past the last tier, the last tier again, one doubling further. */
    readonly next: DreadTierDefinition;
    /** 0..1 of the way to the next tier (or the next doubling past the last). */
    readonly fraction: number;
    /** Doublings past the last tier's start: 0 until "It is coming", then 1, 2, ... without end. */
    readonly beyond: number;
}

/** The tier a Dread reads as, and how far it is to the next. */
export const dreadTier = (dread: number): DreadReading => {
    const value = Number.isFinite(dread) ? Math.max(0, dread) : 0;
    let index = 0;
    for (let i = 0; i < DREAD_TIERS.length; i += 1) if (value >= DREAD_TIERS[i]!.from) index = i;
    const tier = DREAD_TIERS[index]!;
    const last = index === DREAD_TIERS.length - 1;
    if (!last) {
        const next = DREAD_TIERS[index + 1]!;
        return { tier, index, next, fraction: Math.min(1, (value - tier.from) / (next.from - tier.from)), beyond: 0 };
    }
    const doublings = Math.log2(value / tier.from);
    return { tier, index, next: tier, fraction: doublings - Math.floor(doublings), beyond: Math.floor(doublings) };
};
