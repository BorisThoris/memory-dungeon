import { hasRewardPerk } from './bonus-rewards';
import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

export type HazardBanisherFloorStartOutcome =
    | 'inactive'
    | 'contract_blocked'
    | 'hazard_removed'
    | 'destroy_charge_granted';

export interface HazardBanisherFloorStartResult {
    run: RunState;
    outcome: HazardBanisherFloorStartOutcome;
    targetPairKey: string | null;
    hazardKind: string | null;
    affectedTileIds: string[];
}

/** Pure floor-start payoff for the durable Hazard Banish reward perk. */
export const resolveHazardBanisherFloorStart = (run: RunState): HazardBanisherFloorStartResult => {
    if (!hasRewardPerk(run, 'hazard_banish_per_floor')) {
        return { run, outcome: 'inactive', targetPairKey: null, hazardKind: null, affectedTileIds: [] };
    }
    if (run.activeContract?.noDestroy) {
        return { run, outcome: 'contract_blocked', targetPairKey: null, hazardKind: null, affectedTileIds: [] };
    }

    const target = run.board?.tiles.find(
        (tile) => tile.tileHazardKind != null && tile.state !== 'matched' && tile.state !== 'removed'
    );
    if (!target || !run.board || !target.tileHazardKind) {
        return {
            run: {
                ...run,
                destroyPairCharges: runNonNegativeInteger(run.destroyPairCharges) + 1
            },
            outcome: 'destroy_charge_granted',
            targetPairKey: null,
            hazardKind: null,
            affectedTileIds: []
        };
    }

    const affectedTileIds = run.board.tiles
        .filter(
            (tile) => tile.pairKey === target.pairKey && tile.tileHazardKind === target.tileHazardKind
        )
        .map((tile) => tile.id);
    return {
        run: {
            ...run,
            board: {
                ...run.board,
                tiles: run.board.tiles.map((tile) =>
                    affectedTileIds.includes(tile.id) ? { ...tile, tileHazardKind: undefined } : tile
                )
            }
        },
        outcome: 'hazard_removed',
        targetPairKey: target.pairKey,
        hazardKind: target.tileHazardKind,
        affectedTileIds
    };
};
