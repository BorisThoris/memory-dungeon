import { type MutatorId, type RunState } from '../../shared/contracts';
import styles from './GameScreen.module.css';
import { MUTATOR_HUD_LABELS } from './gameplayHudMutatorLabels';

export type GameplayHudContextChipKind = 'gauntlet' | 'scholar' | 'shuffle_tax';

export interface GameplayHudContextChipMeta {
    className: string;
    key: string;
    kind: GameplayHudContextChipKind;
    label: string;
    testId: string;
    title: string;
}

export const getMutatorChipTitle = (id: MutatorId): string => {
    if (id === 'sticky_fingers') {
        return 'Sticky fingers - your next opening flip must use a different slot than the tile you matched last.';
    }
    if (id === 'glass_floor') {
        return 'Glass floor - adds one decoy trap tile that never pairs. Avoid dragging it into a mismatch for the glass-witness bonus.';
    }
    if (id === 'findables_floor') {
        return 'Dense pickups - this floor guarantees two pickup pairs instead of the normal baseline spawn.';
    }
    return MUTATOR_HUD_LABELS[id] ?? id;
};

export const getMutatorChipStyle = (id: MutatorId): string | undefined => {
    switch (id) {
        case 'short_memorize':
            return styles.mutatorChipShortMemorize;
        case 'n_back_anchor':
            return styles.mutatorChipNBack;
        case 'shifting_spotlight':
            return styles.mutatorChipShiftingSpotlight;
        default:
            return undefined;
    }
};

export const buildGameplayHudContextChips = (run: RunState): GameplayHudContextChipMeta[] => {
    const chips: GameplayHudContextChipMeta[] = [];

    if (run.gameMode === 'gauntlet') {
        chips.push({
            className: styles.mutatorChipGauntlet,
            key: 'ctx-gauntlet',
            kind: 'gauntlet',
            label: 'Gauntlet',
            testId: 'hud-chip-gauntlet',
            title: 'Timed gauntlet run - clear floors before the clock hits zero'
        });
    }
    if (run.activeContract?.noShuffle) {
        chips.push({
            className: styles.mutatorChipScholar,
            key: 'ctx-scholar',
            kind: 'scholar',
            label: 'Scholar',
            testId: 'hud-chip-scholar',
            title: 'Scholar contract: board shuffle is disabled'
        });
    }
    if (run.shuffleScoreTaxActive) {
        chips.push({
            className: styles.mutatorChipShuffleTax,
            key: 'ctx-shuffle-tax',
            kind: 'shuffle_tax',
            label: 'Shuffle tax',
            testId: 'hud-chip-shuffle-tax',
            title: 'Match score multiplier is reduced after shuffles this run'
        });
    }

    return chips;
};
