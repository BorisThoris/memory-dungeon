import type { RewardPerkId, RunState, StartingLoadoutId } from './contracts';
import { gainRunInventoryItem } from './run-inventory';

export interface StartingLoadoutDefinition {
    id: StartingLoadoutId;
    label: string;
    summary: string;
    firstFloorDecision: string;
}

export const STARTING_LOADOUTS: Record<StartingLoadoutId, StartingLoadoutDefinition> = {
    memory_scout: {
        id: 'memory_scout',
        label: 'Memory Scout',
        summary: 'Starts with extra information tools for safer early reads.',
        firstFloorDecision: 'Use the extra peek to identify trait clusters before committing flips.'
    },
    route_tactician: {
        id: 'route_tactician',
        label: 'Route Tactician',
        summary: 'Starts with extra board movement and a free first swap each floor.',
        firstFloorDecision: 'Move trait pairs into adjacency before taking route pressure.'
    },
    cursebreaker: {
        id: 'cursebreaker',
        label: 'Cursebreaker',
        summary: 'Starts with protection and a hazard-control toolkit.',
        firstFloorDecision: 'Absorb one mistake while saving destroy pressure for a dangerous pair.'
    },
    vaultbreaker: {
        id: 'vaultbreaker',
        label: 'Vaultbreaker',
        summary: 'Starts with lock insurance and early shop tempo.',
        firstFloorDecision: 'Take Greed or locked routes earlier because one key is already banked.'
    }
};

export const getStartingLoadoutDefinition = (
    id: StartingLoadoutId | null | undefined
): StartingLoadoutDefinition | null => (id ? STARTING_LOADOUTS[id] ?? null : null);

export const applyStartingLoadout = (run: RunState, id: StartingLoadoutId | null | undefined): RunState => {
    if (!id) {
        return run;
    }
    let next: RunState = { ...run, startingLoadoutId: id };
    switch (id) {
        case 'memory_scout':
            next = gainRunInventoryItem(next, 'peek_charge');
            next = gainRunInventoryItem(next, 'flash_pair_charge');
            break;
        case 'route_tactician': {
            next = gainRunInventoryItem(next, 'region_shuffle_charge');
            const perkIds: RewardPerkId[] = [...(next.rewardPerkIds ?? []), 'free_first_swap_per_floor'];
            next = {
                ...next,
                rewardPerkIds: [...new Set(perkIds)]
            };
            break;
        }
        case 'cursebreaker':
            next = gainRunInventoryItem(next, 'guard_token');
            next = gainRunInventoryItem(next, 'destroy_charge');
            break;
        case 'vaultbreaker':
            next = gainRunInventoryItem(next, 'iron_key');
            next = { ...next, shopGold: next.shopGold + 1 };
            break;
        default:
            break;
    }
    return next;
};

export const getRunStartingLoadoutRow = (run: Pick<RunState, 'startingLoadoutId'>): StartingLoadoutDefinition | null =>
    getStartingLoadoutDefinition(run.startingLoadoutId);
