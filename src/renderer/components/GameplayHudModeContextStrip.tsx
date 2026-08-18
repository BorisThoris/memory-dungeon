import { type RunState } from '../../shared/contracts';
import styles from './GameScreen.module.css';
import GameplayHudMutatorChipGlyph from './GameplayHudMutatorChipGlyph';
import { MUTATOR_HUD_LABELS } from './gameplayHudMutatorLabels';
import {
    getMutatorChipStyle,
    getMutatorChipTitle
} from './gameplayHudMutatorChipMeta';
import { type GameplayHudContextState } from './gameplayHudContextState';

export interface GameplayHudModeContextStripProps {
    board: NonNullable<RunState['board']>;
    contextState: GameplayHudContextState;
}

const GameplayHudModeContextStrip = ({ board, contextState }: GameplayHudModeContextStripProps) => (
    <div className={`${styles.hudSegment} ${styles.hudMetaSegment}`} data-testid="hud-mode-identity">
        <span className={styles.statKey}>Mode</span>
        <span className={styles.statVal}>{contextState.hudModeLabel}</span>
        {contextState.endlessChapterActive && board.actTitle ? (
            <span
                className={styles.statSubline}
                data-testid="hud-chapter-act"
                title={board.biomeTone ?? 'Endless act and biome'}
            >
                {board.actTitle} · {board.biomeTitle} · {board.actFloorNumber}/{board.actFloorCount}
            </span>
        ) : null}
        {contextState.endlessChapterActive && contextState.archetype ? (
            <span
                className={styles.statSubline}
                data-testid="hud-endless-archetype"
                title={[
                    board.actTitle,
                    board.biomeTitle,
                    board.actFloorNumber != null && board.actFloorCount != null
                        ? `Act floor ${board.actFloorNumber}/${board.actFloorCount}`
                        : null,
                    contextState.archetype.hint
                ]
                    .filter(Boolean)
                    .join(' - ')}
            >
                {contextState.archetype.title}
                {board.actTitle ? ` · ${board.actTitle}` : ''}
            </span>
        ) : null}
        {contextState.floorIdentity.warningLevel !== 'baseline' ? (
            <span
                className={styles.statSubline}
                data-testid="hud-floor-identity-reminder"
                title={
                    board.floorTag === 'boss'
                        ? contextState.bossReminderTitle
                        : contextState.floorIdentity.counterplaySentence
                }
            >
                {board.floorTag === 'boss'
                    ? contextState.bossReminderText
                    : contextState.floorIdentity.activeReminder}
            </span>
        ) : null}
        {contextState.nBackLabel ? <span className={styles.statSubline}>{contextState.nBackLabel}</span> : null}
        {contextState.showMutatorChipRow ? (
            <div className={styles.mutatorRow}>
                {contextState.contextChips.map((chip) => (
                    <div
                        className={`${styles.mutatorChip} ${chip.className}`}
                        data-testid={chip.testId}
                        key={chip.key}
                        title={chip.title}
                    >
                        <GameplayHudMutatorChipGlyph chipKind={chip.kind} />
                        <span className={styles.mutatorChipLabel}>{chip.label}</span>
                    </div>
                ))}
                {contextState.mutatorsForChips.map((mutator) => (
                    <div
                        className={[styles.mutatorChip, getMutatorChipStyle(mutator)]
                            .filter(Boolean)
                            .join(' ')}
                        data-testid={`hud-mutator-chip-${mutator}`}
                        key={mutator}
                        title={getMutatorChipTitle(mutator)}
                    >
                        <GameplayHudMutatorChipGlyph mutator={mutator} />
                        <span className={styles.mutatorChipLabel}>
                            {MUTATOR_HUD_LABELS[mutator] ?? mutator}
                        </span>
                    </div>
                ))}
            </div>
        ) : contextState.showNoMutatorsCopy ? (
            <span className={styles.statSubline}>No active mutators</span>
        ) : null}
    </div>
);

export default GameplayHudModeContextStrip;
