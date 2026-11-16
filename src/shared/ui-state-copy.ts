import { tr } from './i18n';
export type UiStateKind = 'empty' | 'loading' | 'error' | 'locked';

export interface UiStateCopyRow {
    id:
        | 'inventory_no_run'
        | 'inventory_no_relics'
        | 'inventory_no_mutators'
        | 'inventory_no_contract'
        | 'codex_filter_empty'
        | 'choose_path_locked'
        | 'startup_loading'
        | 'collection_locked_reward'
        | 'save_error_recovery';
    kind: UiStateKind;
    state?: UiStateKind;
    title: string;
    body: string;
    message?: string;
    actionLabel: string;
    action: string;
    localOnly: true;
    onlineAssumption: false;
}

const DEFAULT_UI_STATE_COPY_ROW: UiStateCopyRow = {
    id: 'inventory_no_run',
    kind: 'empty',
    title: tr.s('No active expedition'),
    body: tr.s("Your charges, run upgrades and the floor's mutators show here once a descent is under way."),
    actionLabel: tr.s('Start a run'),
    action: tr.s('Start a run from Choose Your Path'),
    localOnly: true,
    onlineAssumption: false
};

export const UI_STATE_COPY_ROWS: readonly UiStateCopyRow[] = [
    DEFAULT_UI_STATE_COPY_ROW,
    {
        id: 'inventory_no_relics',
        kind: 'empty',
        title: tr.s('No relics claimed yet'),
        body: tr.s('Reach milestone floors to draft relics and turn a run into a build.'),
        actionLabel: tr.s('Reach a milestone'),
        action: tr.s('Keep clearing local floors'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'inventory_no_mutators',
        kind: 'empty',
        title: tr.s('No mutators on this run'),
        body: tr.s('Classic early floors can start clean; daily, wild, and later floors introduce pressure.'),
        actionLabel: tr.s('Try a challenge'),
        action: tr.s('Try Daily or Wild for authored pressure'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'inventory_no_contract',
        kind: 'empty',
        title: tr.s('No scholar contract'),
        body: tr.s('Contract flags appear here when a mode or vow adds local constraints.'),
        actionLabel: tr.s('Choose a vow'),
        action: tr.s('Choose Scholar or Pin vow to add a contract'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'codex_filter_empty',
        kind: 'empty',
        title: tr.s('No Codex topics match'),
        body: tr.s('Clear the filter or switch between Guides and Tables; the Codex is a local reference and never needs a network call.'),
        actionLabel: tr.s('Clear filter'),
        action: tr.s('Clear search or change tab'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'choose_path_locked',
        kind: 'locked',
        title: tr.s('Mode staged for later'),
        body: tr.s('Locked mode cards state whether the ruleset is future content or gated by local save progress.'),
        actionLabel: tr.s('Pick another mode'),
        action: tr.s('Start a Classic run, or set one up from the sheet'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'startup_loading',
        kind: 'loading',
        title: tr.s('Preparing intro assets'),
        body: tr.s('Startup keeps readable copy while assets load and can fall back safely.'),
        actionLabel: tr.s('Wait or skip'),
        action: tr.s('Wait or skip when ready'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'collection_locked_reward',
        kind: 'locked',
        title: tr.s('Reward not earned yet'),
        body: tr.s('Locked collection entries explain the local run, daily, honor, or mastery source instead of implying purchases.'),
        actionLabel: tr.s('Play local modes'),
        action: tr.s('Play local modes to progress'),
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'save_error_recovery',
        kind: 'error',
        title: tr.s('Local save needs attention'),
        body: tr.s('Save warnings focus on local retry, export, or support steps; they do not blame offline play or require accounts.'),
        actionLabel: tr.s('Retry or export'),
        action: tr.s('Retry local save or export data'),
        localOnly: true,
        onlineAssumption: false
    }
];

export const getUiStateCopyRows = (): readonly UiStateCopyRow[] => UI_STATE_COPY_ROWS;

export const getUiStateCopyRow = (id: UiStateCopyRow['id']): UiStateCopyRow => {
    const row = UI_STATE_COPY_ROWS.find((entry) => entry.id === id) ?? DEFAULT_UI_STATE_COPY_ROW;
    return { ...row, state: row.kind };
};

export const getUiStateCopy = getUiStateCopyRow;

export const uiStateCopyHasNoNetworkAssumption = (): boolean =>
    UI_STATE_COPY_ROWS.every((row) => row.localOnly && row.onlineAssumption === false);
