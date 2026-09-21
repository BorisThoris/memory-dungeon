import { VIEW_STATES, type ViewState } from './contracts';

/**
 * What the pad's B button does on every screen the app can show.
 *
 * Deck Verified's controller criterion is that the DEFAULT configuration reaches all content
 * (`docs/RESEARCH_NOTES_2.md` §1), and "all content" is a claim about screens. The release
 * checklist carried that claim as `controller-support` for months while its verifier asserted
 * three facts about `readGamepadActions` — that A maps to confirm, that the d-pad maps to up, that
 * the stick deadzone is positive. Every one of those was true. None of them could have noticed
 * that B opened nothing back up on seven views, because a pure function never sees a screen
 * (Gens 250, 252, 256).
 *
 * So the claim lives here as a row per view, and two different things read it: the checklist test
 * asserts the table is complete and that every row says something, and
 * `e2e/controller-navigation.spec.ts` drives a real pad against the real screens to prove the app
 * agrees with it. A record and a behaviour, rather than a record alone.
 */
export interface ControllerBackRow {
    readonly view: ViewState;
    /** Where B lands, or `null` when B is deliberately not a leave here — then `reason` says why. */
    readonly leavesTo: ViewState | null;
    /** Required when `leavesTo` is null: why this screen does not answer back. */
    readonly reason?: string;
}

export const CONTROLLER_BACK_CONTRACT: Record<ViewState, ControllerBackRow> = {
    boot: {
        view: 'boot',
        leavesTo: null,
        reason: 'A frame before hydration finishes, not a screen a player is ever standing on.'
    },
    menu: {
        view: 'menu',
        leavesTo: null,
        reason: 'The root. Back from the root has nowhere to go; leaving the game is the window close.'
    },
    playing: {
        view: 'playing',
        leavesTo: null,
        reason:
            'The one place B is deliberately not a leave: a stray press must not cost a run. The way out ' +
            'is Start, and the pause menu it opens answers B itself (an OverlayModal with onEscape=resume).'
    },
    modeSelect: { view: 'modeSelect', leavesTo: 'menu' },
    collection: { view: 'collection', leavesTo: 'menu' },
    profile: { view: 'profile', leavesTo: 'menu' },
    inventory: { view: 'inventory', leavesTo: 'menu' },
    codex: { view: 'codex', leavesTo: 'menu' },
    settings: { view: 'settings', leavesTo: 'menu' },
    gameOver: { view: 'gameOver', leavesTo: 'menu' }
};

/** Views whose back path is a leave a player can press. */
export const CONTROLLER_BACK_VIEWS: readonly ViewState[] = VIEW_STATES.filter(
    (view) => CONTROLLER_BACK_CONTRACT[view].leavesTo !== null
);

/** Rows that claim no leave and fail to say why — the only way this table can be wrong on its face. */
export const findUnexplainedControllerExemptions = (): ViewState[] =>
    VIEW_STATES.filter((view) => {
        const row = CONTROLLER_BACK_CONTRACT[view];
        return row.leavesTo === null && (row.reason ?? '').trim().length === 0;
    });
