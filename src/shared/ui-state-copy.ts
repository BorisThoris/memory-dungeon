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

export const UI_STATE_COPY_ROWS: readonly UiStateCopyRow[] = [
    {
        id: 'inventory_no_run',
        kind: 'empty',
        title: 'No active expedition',
        body: 'Start a run to see relics, mutators, charges, and route tools.',
        actionLabel: 'Start a run',
        action: 'Start a run from Choose Your Path',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'inventory_no_relics',
        kind: 'empty',
        title: 'No relics claimed yet',
        body: 'Reach milestone floors to draft relics and turn a run into a build.',
        actionLabel: 'Reach a milestone',
        action: 'Keep clearing local floors',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'inventory_no_mutators',
        kind: 'empty',
        title: 'No mutators on this run',
        body: 'Classic early floors can start clean; daily, wild, and later floors introduce pressure.',
        actionLabel: 'Try a challenge',
        action: 'Try Daily or Wild for authored pressure',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'inventory_no_contract',
        kind: 'empty',
        title: 'No scholar contract',
        body: 'Contract flags appear here when a mode or vow adds local constraints.',
        actionLabel: 'Choose a vow',
        action: 'Choose Scholar or Pin vow to add a contract',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'codex_filter_empty',
        kind: 'empty',
        title: 'No Codex topics match',
        body: 'Clear the filter or switch between Guides and Tables; the Codex is a local reference and never needs a network call.',
        actionLabel: 'Clear filter',
        action: 'Clear search or change tab',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'choose_path_locked',
        kind: 'locked',
        title: 'Mode staged for later',
        body: 'Locked mode cards state whether the ruleset is future content or gated by local save progress.',
        actionLabel: 'Pick another mode',
        action: 'Use Classic, Daily, Gauntlet, puzzles, or training modes',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'startup_loading',
        kind: 'loading',
        title: 'Preparing intro assets',
        body: 'Startup keeps readable copy while assets load and can fall back safely.',
        actionLabel: 'Wait or skip',
        action: 'Wait or skip when ready',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'collection_locked_reward',
        kind: 'locked',
        title: 'Reward not earned yet',
        body: 'Locked collection entries explain the local run, daily, honor, or mastery source instead of implying purchases.',
        actionLabel: 'Play local modes',
        action: 'Play local modes to progress',
        localOnly: true,
        onlineAssumption: false
    },
    {
        id: 'save_error_recovery',
        kind: 'error',
        title: 'Local save needs attention',
        body: 'Save warnings focus on local retry, export, or support steps; they do not blame offline play or require accounts.',
        actionLabel: 'Retry or export',
        action: 'Retry local save or export data',
        localOnly: true,
        onlineAssumption: false
    }
];

export const getUiStateCopyRows = (): readonly UiStateCopyRow[] => UI_STATE_COPY_ROWS;

export const getUiStateCopyRow = (id: UiStateCopyRow['id']): UiStateCopyRow => {
    const row = UI_STATE_COPY_ROWS.find((entry) => entry.id === id)!;
    return { ...row, state: row.kind };
};

export const getUiStateCopy = getUiStateCopyRow;

export const uiStateCopyHasNoNetworkAssumption = (): boolean =>
    UI_STATE_COPY_ROWS.every((row) => row.localOnly && row.onlineAssumption === false);
