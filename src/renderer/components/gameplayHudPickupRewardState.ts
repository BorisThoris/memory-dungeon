import { getFindableRows } from '../../shared/findables';
import {
    buildHudPickupChainStackCueModel,
    type HudPickupChainStackCueModel
} from './gameplayHudChainAccentFeedbackModels';

const formatRewardPreviewLabel = (
    label: string,
    rows: readonly { actionLabel?: string; chaseLabel?: string; distanceLabel?: string; label?: string; rewardText?: string }[]
): string => {
    const rowCopy = rows
        .map((row) =>
            [row.chaseLabel, row.actionLabel, row.rewardText ?? row.label, row.distanceLabel]
                .filter(Boolean)
                .join(': ')
        )
        .filter(Boolean)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const getFindableProgressState = (claimed: number, total: number): 'live' | 'complete' => {
    if (total > 0 && claimed >= total) {
        return 'complete';
    }
    return 'live';
};

const getFindableProgressSubline = (claimed: number, total: number): string => {
    if (total > 0 && claimed >= total) {
        return 'All claimed';
    }
    const remaining = Math.max(0, total - claimed);
    return `${remaining} reward${remaining === 1 ? '' : 's'} left`;
};

export interface GameplayHudPickupRewardState {
    findableProgressMeterPercent: number;
    findableProgressState: 'live' | 'complete';
    findableProgressSubline: string;
    pickupChainStackCue: HudPickupChainStackCueModel | null;
    pickupProgressTitle: string;
    pickupRewardPreviewLabel: string;
    pickupRewardPreviewRows: ReturnType<typeof getFindableRows>;
}

export const buildGameplayHudPickupRewardState = ({
    claimedFindables,
    primaryRewardHot,
    primaryRewardLabel,
    stackedPayoffCount,
    totalFindables
}: {
    claimedFindables: number;
    primaryRewardHot: boolean;
    primaryRewardLabel: string | null;
    stackedPayoffCount: number;
    totalFindables: number;
}): GameplayHudPickupRewardState => {
    const findableProgressState = getFindableProgressState(claimedFindables, totalFindables);
    const findableProgressSubline = getFindableProgressSubline(claimedFindables, totalFindables);
    const unclaimedFindableCount = Math.max(0, totalFindables - claimedFindables);
    const pickupChainStackCue = buildHudPickupChainStackCueModel({
        primaryRewardHot,
        primaryRewardLabel,
        stackedPayoffCount,
        unclaimedFindableCount
    });
    const findableProgressMeterPercent =
        totalFindables > 0 ? Math.min(100, (Math.max(0, claimedFindables) / totalFindables) * 100) : 0;
    const pickupRewardPreviewRows = getFindableRows()
        .filter((row) => row.comboShards > 0 || row.score > 0 || row.safeHazardWards > 0)
        .slice(0, 3);
    const pickupRewardPreviewLabel = formatRewardPreviewLabel(
        `Pickup reward preview ${claimedFindables} of ${totalFindables}`,
        pickupRewardPreviewRows
    );
    const pickupProgressTitle = `Pickup progress this floor. ${getFindableRows()
        .map((row) => `${row.label}: ${row.rewardText}`)
        .join('; ')}. Destroy forfeits pickups; shuffle preserves them.`;

    return {
        findableProgressMeterPercent,
        findableProgressState,
        findableProgressSubline,
        pickupChainStackCue,
        pickupProgressTitle,
        pickupRewardPreviewLabel,
        pickupRewardPreviewRows
    };
};
