import type { DungeonBoardPresentation } from '../../shared/dungeon-board-status';
import type { DungeonCombatLogRow } from './gameScreenFeedback';
import styles from './GameScreen.module.css';

interface GameScreenDungeonStatusPanelProps {
    combatLogRows: readonly DungeonCombatLogRow[];
    panel: DungeonBoardPresentation;
}

type DungeonForecastSignalTone = 'action' | 'defense' | 'risk';
type DungeonForecastSignalRow = { label: string; tone: DungeonForecastSignalTone; value: string };
type DungeonForecastActionCue = { label: 'Now'; tone: DungeonForecastSignalTone; value: string };

const dungeonForecastSignalBeatCount = (row: DungeonForecastSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'risk') {
        return row.value === 'No guard' ? 4 : 3;
    }
    if (row.tone === 'defense') {
        return 3;
    }
    return 2;
};

const dungeonForecastActionBeatCount = (cue: DungeonForecastActionCue): 2 | 3 | 4 => {
    if (cue.tone === 'risk') {
        return 4;
    }
    if (cue.tone === 'defense') {
        return 3;
    }
    return 2;
};

const dungeonForecastActionAudioCue = (
    cue: DungeonForecastActionCue
): 'forecast-action-play' | 'forecast-action-defense' | 'forecast-action-risk' => {
    if (cue.tone === 'risk') {
        return 'forecast-action-risk';
    }
    if (cue.tone === 'defense') {
        return 'forecast-action-defense';
    }
    return 'forecast-action-play';
};

const dungeonForecastActionScreenCue = (cue: DungeonForecastActionCue): 'guard' | 'pulse' | 'risk' => {
    if (cue.tone === 'risk') {
        return 'risk';
    }
    if (cue.tone === 'defense') {
        return 'guard';
    }
    return 'pulse';
};

const dungeonForecastSignalAudioCue = (
    row: DungeonForecastSignalRow
): 'forecast-signal-play' | 'forecast-signal-defense' | 'forecast-signal-risk' => {
    if (row.tone === 'risk') {
        return 'forecast-signal-risk';
    }
    if (row.tone === 'defense') {
        return 'forecast-signal-defense';
    }
    return 'forecast-signal-play';
};

const dungeonForecastSignalScreenCue = (row: DungeonForecastSignalRow): 'guard' | 'pulse' | 'risk' => {
    if (row.tone === 'risk') {
        return 'risk';
    }
    if (row.tone === 'defense') {
        return 'guard';
    }
    return 'pulse';
};

const formatDungeonForecastSignalsLabel = (
    forecastText: string,
    rows: readonly DungeonForecastSignalRow[]
): string => {
    const rowCopy = rows.map((row) => `${row.label}: ${row.value}`).join('. ');
    return `Dungeon combat forecast signals. ${forecastText}${rowCopy ? ` ${rowCopy}.` : ''}`;
};

const getDungeonForecastSignalRows = (forecastText: string): DungeonForecastSignalRow[] => {
    const normalized = forecastText.toLowerCase();
    const hasGuard = normalized.includes('guard ready') || normalized.includes('guards ready');
    const hasLifeRisk = normalized.includes('life') || normalized.includes('lives');
    return [
        {
            label: 'Threat',
            tone: hasLifeRisk ? 'risk' : 'action',
            value: normalized.includes('patrol') ? 'Patrol hit' : 'Mismatch hit'
        },
        {
            label: 'Defense',
            tone: hasGuard ? 'defense' : 'risk',
            value: hasGuard ? 'Guard first' : 'No guard'
        },
        {
            label: 'Play',
            tone: 'action',
            value: hasGuard ? 'Use safe match' : 'Avoid contact'
        }
    ];
};

const getDungeonForecastActionCue = (forecastText: string): DungeonForecastActionCue => {
    const normalized = forecastText.toLowerCase();
    if (normalized.includes('guard ready') || normalized.includes('guards ready')) {
        return { label: 'Now', tone: 'defense', value: 'Use guard' };
    }
    if (normalized.includes('life') || normalized.includes('lives')) {
        return { label: 'Now', tone: 'risk', value: 'Avoid hit' };
    }
    if (normalized.includes('patrol')) {
        return { label: 'Now', tone: 'action', value: 'Watch patrol' };
    }
    return { label: 'Now', tone: 'action', value: 'Play safe' };
};

export const GameScreenDungeonStatusPanel = ({
    combatLogRows,
    panel
}: GameScreenDungeonStatusPanelProps) => {
    const forecastSignalRows = panel.combatForecastText ? getDungeonForecastSignalRows(panel.combatForecastText) : [];
    const forecastActionCue = panel.combatForecastText ? getDungeonForecastActionCue(panel.combatForecastText) : null;
    const forecastSignalsLabel = panel.combatForecastText
        ? formatDungeonForecastSignalsLabel(panel.combatForecastText, forecastSignalRows)
        : 'Dungeon combat forecast signals';

    return (
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
            {panel.combatForecastText ? (
                <div className={styles.dungeonStatusForecast} data-testid="dungeon-status-forecast">
                    <span>{panel.combatForecastText}</span>
                    {forecastActionCue ? (
                        <span
                            aria-label={`Dungeon forecast action cue. ${forecastActionCue.label}: ${forecastActionCue.value}.`}
                            className={styles.dungeonStatusForecastActionCue}
                            data-forecast-action-audio={dungeonForecastActionAudioCue(forecastActionCue)}
                            data-forecast-action-beats={dungeonForecastActionBeatCount(forecastActionCue)}
                            data-forecast-action-screen-cue={dungeonForecastActionScreenCue(forecastActionCue)}
                            data-forecast-action-tone={forecastActionCue.tone}
                            data-testid="dungeon-status-forecast-action-cue"
                        >
                            <small>{forecastActionCue.label}</small>
                            <b>{forecastActionCue.value}</b>
                            <span aria-hidden="true" className={styles.dungeonStatusForecastBeatPips}>
                                {Array.from({ length: dungeonForecastActionBeatCount(forecastActionCue) }, (_, index) => (
                                    <i data-forecast-action-beat key={index} />
                                ))}
                            </span>
                        </span>
                    ) : null}
                    <span
                        className={styles.dungeonStatusForecastSignals}
                        data-testid="dungeon-status-forecast-signals"
                        aria-label={forecastSignalsLabel}
                    >
                        {forecastSignalRows.map((row) => (
                            <span
                                data-forecast-signal-audio={dungeonForecastSignalAudioCue(row)}
                                data-forecast-signal-beats={dungeonForecastSignalBeatCount(row)}
                                data-forecast-signal-screen-cue={dungeonForecastSignalScreenCue(row)}
                                data-forecast-signal-tone={row.tone}
                                key={`${row.label}:${row.value}`}
                            >
                                <small>{row.label}</small>
                                <b>{row.value}</b>
                                <span aria-hidden="true" className={styles.dungeonStatusForecastBeatPips}>
                                    {Array.from({ length: dungeonForecastSignalBeatCount(row) }, (_, index) => (
                                        <i data-forecast-signal-beat key={index} />
                                    ))}
                                </span>
                            </span>
                        ))}
                    </span>
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
};
