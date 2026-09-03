import type { RunState } from '../../shared/contracts';

/**
 * Every tool the run dock can offer, and which power charge each one spends.
 *
 * The dock is assembled inline in GameScreen from a dozen locals, which is how row shuffle lost its
 * button in the run-shell rebuild and stayed gone: the rules, the command and the store actions all
 * survived, and nothing anywhere said the dock was supposed to have one. This catalog is that
 * statement, and `runShellToolCatalog.test.ts` checks it against the charge fields on RunState —
 * a power a run can hold charges for, with no tool that spends them, is a power a player cannot use.
 *
 * `spends: null` marks a tool with no charge of its own: pin, stray and undo are governed by their
 * own rules rather than a counter.
 */
export type RunShellToolId = 'shuffle' | 'swap' | 'row' | 'pin' | 'destroy' | 'peek' | 'flash' | 'stray' | 'undo';

/** The charge fields on RunState that a dock tool is expected to spend. */
export type RunPowerChargeField = Extract<
    keyof RunState,
    | 'shuffleCharges'
    | 'regionShuffleCharges'
    | 'destroyPairCharges'
    | 'peekCharges'
    | 'flashPairCharges'
    | 'strayRemoveCharges'
>;

export interface RunShellToolSpec {
    readonly id: RunShellToolId;
    readonly label: string;
    /** The RunState charge this tool spends, or null when the power is not charge-gated. */
    readonly spends: RunPowerChargeField | null;
    /** True when the tool is only offered in some runs rather than every one. */
    readonly conditional: boolean;
}

export const RUN_SHELL_TOOL_CATALOG: readonly RunShellToolSpec[] = [
    { conditional: false, id: 'shuffle', label: 'Shuffle', spends: 'shuffleCharges' },
    { conditional: false, id: 'swap', label: 'Swap', spends: 'regionShuffleCharges' },
    // Swap and Row spend the same currency; the game calls it "row/swap" everywhere for that reason.
    { conditional: false, id: 'row', label: 'Row', spends: 'regionShuffleCharges' },
    { conditional: false, id: 'pin', label: 'Pin', spends: null },
    { conditional: false, id: 'destroy', label: 'Destroy', spends: 'destroyPairCharges' },
    { conditional: false, id: 'peek', label: 'Peek', spends: 'peekCharges' },
    // Only Practice and Wild runs carry flash charges, so the dock hides it elsewhere.
    { conditional: true, id: 'flash', label: 'Flash', spends: 'flashPairCharges' },
    { conditional: false, id: 'stray', label: 'Stray', spends: 'strayRemoveCharges' },
    { conditional: false, id: 'undo', label: 'Undo', spends: null }
];

export const runShellToolIds = (): RunShellToolId[] => RUN_SHELL_TOOL_CATALOG.map((tool) => tool.id);

/** The charge fields some dock tool is responsible for spending. */
export const chargeFieldsWithATool = (): RunPowerChargeField[] => [
    ...new Set(RUN_SHELL_TOOL_CATALOG.flatMap((tool) => (tool.spends === null ? [] : [tool.spends])))
];
