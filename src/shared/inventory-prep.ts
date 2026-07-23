import type { RunState } from './contracts';
import { getRunInventoryLoadoutRows, getRunInventoryRows } from './run-inventory';
import { normalizeSessionStats } from './session-stats-rules';

export interface InventoryPrepRow {
    id: 'run_prep' | 'loadout_capacity' | 'mutable_windows' | 'empty_state';
    label: string;
    title: string;
    value: string;
    detail: string;
    actionHint: string;
    status: 'ready' | 'in_progress' | 'empty';
    localOnly: true;
}

export const getInventoryPrepRows = (run: RunState | null): InventoryPrepRow[] => {
    if (!run) {
        return [
            {
                id: 'empty_state',
                label: 'Prep status',
                title: 'Run prep starts at Choose Path',
                value: 'No active run',
                detail: 'Inventory stays read-only until a local run exists; no online loadout service is required.',
                actionHint: 'Start a local mode to populate run prep.',
                status: 'empty',
                localOnly: true
            }
        ];
    }

    const inventory = getRunInventoryRows(run);
    const loadout = getRunInventoryLoadoutRows(run);
    const mutable = inventory.filter((row) => row.kind === 'consumable' && row.available).length;
    const stats = normalizeSessionStats(run.stats);
    return [
        {
            id: 'run_prep',
            label: 'Prep status',
            title: 'Run prep snapshot',
            value: `${run.gameMode} | floor ${run.board?.level ?? stats.highestLevel}`,
            detail: 'Mode, floor, lives, achievements, and power-use state are visible before returning to play.',
            actionHint: 'Offline ready: continue the active run.',
            status: 'ready',
            localOnly: true
        },
        {
            id: 'loadout_capacity',
            label: 'Loadout capacity',
            title: 'Loadout capacity',
            value: `${loadout.length} fixed row(s)`,
            detail: 'Relics, mutators, and contracts are locked to their authored change windows.',
            actionHint: 'Change windows are relic drafts, mode setup, or floor schedules only.',
            status: loadout.length > 0 ? 'in_progress' : 'empty',
            localOnly: true
        },
        {
            id: 'mutable_windows',
            label: 'Mutable windows',
            title: 'Mutable windows',
            value: `${mutable} usable consumable row(s)`,
            detail: 'Each row names whether it changes mid-run, on floor rewards, in shops/rests, or only during drafts.',
            actionHint: 'Use charges in play; rest/shop/draft rows update between floor decisions.',
            status: mutable > 0 ? 'ready' : 'empty',
            localOnly: true
        }
    ];
};
