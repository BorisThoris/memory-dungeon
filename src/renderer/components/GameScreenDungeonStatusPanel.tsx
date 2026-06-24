import type { DungeonBoardPresentation } from '../../shared/dungeon-board-status';
import type { DungeonCombatLogRow } from './gameScreenFeedback';
import styles from './GameScreen.module.css';

interface GameScreenDungeonStatusPanelProps {
    combatLogRows: readonly DungeonCombatLogRow[];
    panel: DungeonBoardPresentation;
}

export const GameScreenDungeonStatusPanel = ({
    combatLogRows,
    panel
}: GameScreenDungeonStatusPanelProps) => (
    <div
        aria-label="Dungeon combat status"
        aria-live="polite"
        className={styles.dungeonStatusPanel}
        data-testid="dungeon-status-panel"
        role="status"
    >
        <div className={styles.dungeonStatusHeader}>
            <strong>{panel.title}</strong>
            {panel.bossText ? <span>{panel.bossText}</span> : null}
        </div>
        {panel.objectiveText ? (
            <div className={styles.dungeonStatusObjective}>
                <span>{panel.objectiveText}</span>
                {panel.objectiveDetail ? <small>{panel.objectiveDetail}</small> : null}
            </div>
        ) : null}
        {panel.chips.length > 0 ? (
            <div className={styles.dungeonStatusChips} aria-label="Dungeon status">
                {panel.chips.map((chip) => (
                    <span
                        className={styles.dungeonStatusChip}
                        data-priority={chip.priority}
                        data-tone={chip.tone}
                        key={chip.id}
                    >
                        <span>{chip.label}</span>
                        <strong>{chip.value}</strong>
                    </span>
                ))}
            </div>
        ) : null}
        {panel.alertText ? <div className={styles.dungeonStatusAlert}>{panel.alertText}</div> : null}
        {combatLogRows.length > 0 ? (
            <div
                aria-label="This floor combat log"
                className={styles.dungeonCombatLog}
                data-testid="dungeon-combat-log"
            >
                {combatLogRows.map((row) => (
                    <span
                        className={styles.dungeonCombatLogRow}
                        data-tone={row.tone}
                        key={row.id}
                    >
                        <strong>{row.label}</strong>
                        <small>{row.detail}</small>
                    </span>
                ))}
            </div>
        ) : null}
    </div>
);

