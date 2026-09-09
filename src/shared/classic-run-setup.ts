import type { ContractFlags, MutatorId, RunState } from './contracts';
import type { CreateRunOptions } from './run-creation-rules';

/**
 * How a Classic run is set up before it starts.
 *
 * The catalog used to answer this question with menu entries: Wild was Classic with three mutators
 * and a joker, Scholar and Pin Vow were Classic with a contract, Practice was Classic with records
 * off, Meditation was Classic with a longer memorize window. Twelve cards, one game — and the
 * player paid for that with a fork in the road every time they sat down, before they knew anything
 * about the run they were about to play.
 *
 * They are choices about *this* run, so they live here, together, in front of the run. Nothing is
 * lost in the move: every field below is an option `createNewRun` already took, and the rules they
 * switch on are the same rules the retired cards switched on.
 *
 * The sheet once offered a clock too, inherited from the Gauntlet card. A timer is the one thing
 * the game's thesis rules out, so that option is gone rather than hidden.
 */

/** Self-imposed restrictions. They make a run harder and are the player's own idea. */
export type ClassicRunVowId = 'scholar' | 'pin_vow';

/** How long the memorize window runs and how much time the board gives. */
export type ClassicRunPacingId = 'standard' | 'calm';

export interface ClassicRunSetup {
    readonly vows: readonly ClassicRunVowId[];
    readonly pacing: ClassicRunPacingId;
    /** The old Wild run: a joker tile, a stray-remove charge and a chaotic mutator set. */
    readonly chaos: boolean;
    /** The old Practice run: nothing this run does is written to the profile. */
    readonly unrecorded: boolean;
    /** Mutators to study on purpose, as the meditation setup sheet offered. */
    readonly focusMutators: readonly MutatorId[];
}

export const DEFAULT_CLASSIC_RUN_SETUP: ClassicRunSetup = {
    chaos: false,
    focusMutators: [],
    pacing: 'standard',
    unrecorded: false,
    vows: []
};

/** The chaotic set the Wild card used to start. */
export const CHAOS_MUTATORS: readonly MutatorId[] = ['sticky_fingers', 'short_memorize', 'findables_floor'];

/**
 * The contract a set of vows adds up to.
 *
 * Vows combine rather than replace one another: taking both means both hold, which is the whole
 * appeal of a vow — the run is exactly as hard as the player asked for.
 */
export const buildVowContract = (vows: readonly ClassicRunVowId[]): ContractFlags | null => {
    if (vows.length === 0) {
        return null;
    }
    const scholar = vows.includes('scholar');
    return {
        maxMismatches: null,
        maxPinsTotalRun: vows.includes('pin_vow') ? 10 : null,
        noDestroy: scholar,
        noShuffle: scholar
    };
};

/** Everything the setup contributes to a run, in the terms `createNewRun` already speaks. */
export const buildClassicRunOptions = (setup: ClassicRunSetup): CreateRunOptions => {
    const contract = buildVowContract(setup.vows);
    const chaosMutators = setup.chaos ? CHAOS_MUTATORS : [];
    const activeMutators = [...new Set([...chaosMutators, ...setup.focusMutators])];
    return {
        ...(contract ? { activeContract: contract } : {}),
        ...(activeMutators.length > 0 ? { activeMutators } : {}),
        // `wildMenuRun` is the flag the HUD identity and the restart precedence read for a wild run;
        // without it a chaos descent said "Classic Dungeon" on the bar and retried as one.
        ...(setup.chaos ? { enableWildJoker: true, initialStrayRemoveCharges: 1, wildMenuRun: true } : {}),
        ...(setup.pacing === 'calm' ? { resolveDelayMultiplier: 1.35 } : {}),
        ...(setup.unrecorded ? { practiceMode: true } : {}),
        // A vow is a claim about how the run was played, so the shuffle it forbids has to be the
        // weaker one too — otherwise "no shuffle" only means "no button".
        ...(contract?.noShuffle ? { weakerShuffleMode: 'rows_only' as const } : {})
    };
};

/**
 * The setup a run was started with, read back from the run's own flags, so a retry restarts the
 * run the player asked for. Restart precedence predates the sheet: it kept a vow or the wild flag
 * and dropped the pace, because each retired card had been one flag and the sheet is several at
 * once. Null for anything that is not a Classic run; the focus mutators are not
 * recoverable from a run (the floor schedule writes the same field) and come back empty.
 */
export const classicRunSetupFromRun = (
    run: Pick<RunState, 'gameMode' | 'activeContract' | 'wildMenuRun' | 'practiceMode' | 'resolveDelayMultiplier'>
): ClassicRunSetup | null => {
    if (run.gameMode !== 'endless') {
        return null;
    }
    const contract = run.activeContract;
    const vows: ClassicRunVowId[] = [];
    if (contract?.noShuffle === true && contract.noDestroy === true) vows.push('scholar');
    if (contract?.maxPinsTotalRun != null) vows.push('pin_vow');
    return {
        chaos: run.wildMenuRun === true,
        focusMutators: [],
        pacing: Number.isFinite(run.resolveDelayMultiplier) && run.resolveDelayMultiplier > 1 ? 'calm' : 'standard',
        unrecorded: run.practiceMode === true,
        vows
    };
};

/** True when the run is the plain descent, with nothing asked of it. */
export const isDefaultClassicRunSetup = (setup: ClassicRunSetup): boolean =>
    setup.vows.length === 0 &&
    setup.focusMutators.length === 0 &&
    setup.pacing === 'standard' &&
    !setup.chaos &&
    !setup.unrecorded;

/** A short line naming what the player asked for, for the HUD and the results screen. */
export const describeClassicRunSetup = (setup: ClassicRunSetup): string[] => {
    const parts: string[] = [];
    if (setup.vows.includes('scholar')) {
        parts.push('Scholar vow');
    }
    if (setup.vows.includes('pin_vow')) {
        parts.push('Pin vow');
    }
    if (setup.chaos) {
        parts.push('Wild');
    }
    if (setup.pacing === 'calm') {
        parts.push('Calm');
    }
    if (setup.unrecorded) {
        parts.push('Unrecorded');
    }
    return parts;
};
