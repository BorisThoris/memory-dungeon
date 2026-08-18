import type { FloorIdentityContract } from '../../shared/boss-encounters';
import type { FloorArchetypeDefinition } from '../../shared/floor-mutator-schedule';
import styles from './GameScreen.module.css';

interface GameScreenEndlessChapterBannerProps {
    archetype: FloorArchetypeDefinition;
    featuredObjectiveLabel: string;
    floorIdentity: FloorIdentityContract | null;
}

type ChapterSignalTone = 'counter' | 'objective' | 'pressure' | 'reward' | 'safe';
type ChapterSignalRow = { label: string; tone: ChapterSignalTone; value: string };
type ChapterActionCue = { label: 'Now'; tone: ChapterSignalTone; value: string };

const chapterSignalBeatCount = (row: ChapterSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'objective' || row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'pressure') {
        return 3;
    }
    return 2;
};

const chapterActionBeatCount = (cue: ChapterActionCue): 2 | 3 | 4 => {
    if (cue.tone === 'objective' || cue.tone === 'reward') {
        return 4;
    }
    if (cue.tone === 'pressure') {
        return 3;
    }
    return 2;
};

const chapterActionAudioCue = (
    cue: ChapterActionCue
): 'chapter-action-counter' | 'chapter-action-pressure' | 'chapter-action-reward' | 'chapter-action-safe' => {
    if (cue.tone === 'reward' || cue.tone === 'objective') {
        return 'chapter-action-reward';
    }
    if (cue.tone === 'pressure') {
        return 'chapter-action-pressure';
    }
    if (cue.tone === 'safe') {
        return 'chapter-action-safe';
    }
    return 'chapter-action-counter';
};

const chapterActionScreenCue = (cue: ChapterActionCue): 'burst' | 'guard' | 'pulse' | 'snap' => {
    if (cue.tone === 'reward' || cue.tone === 'objective') {
        return 'burst';
    }
    if (cue.tone === 'pressure') {
        return 'guard';
    }
    if (cue.tone === 'safe') {
        return 'pulse';
    }
    return 'snap';
};

const chapterSignalAudioCue = (
    row: ChapterSignalRow
): 'chapter-signal-counter' | 'chapter-signal-pressure' | 'chapter-signal-reward' | 'chapter-signal-safe' => {
    if (row.tone === 'reward' || row.tone === 'objective') {
        return 'chapter-signal-reward';
    }
    if (row.tone === 'pressure') {
        return 'chapter-signal-pressure';
    }
    if (row.tone === 'safe') {
        return 'chapter-signal-safe';
    }
    return 'chapter-signal-counter';
};

const chapterSignalScreenCue = (row: ChapterSignalRow): 'burst' | 'guard' | 'pulse' | 'snap' => {
    if (row.tone === 'reward' || row.tone === 'objective') {
        return 'burst';
    }
    if (row.tone === 'pressure') {
        return 'guard';
    }
    if (row.tone === 'safe') {
        return 'pulse';
    }
    return 'snap';
};

const chapterSignalTone = (floorIdentity: FloorIdentityContract | null): ChapterSignalTone => {
    if (!floorIdentity) {
        return 'pressure';
    }
    if (floorIdentity.warningLevel === 'danger' || floorIdentity.warningLevel === 'warning') {
        return 'pressure';
    }
    if (floorIdentity.warningLevel === 'reward') {
        return 'reward';
    }
    if (floorIdentity.warningLevel === 'safe') {
        return 'safe';
    }
    return 'counter';
};

const chapterActionCue = (
    floorIdentity: FloorIdentityContract | null,
    featuredObjectiveLabel: string
): ChapterActionCue => {
    if (!floorIdentity) {
        return { label: 'Now', tone: 'counter', value: `Read board for ${featuredObjectiveLabel}` };
    }
    if (floorIdentity.warningLevel === 'reward') {
        return { label: 'Now', tone: 'reward', value: `Cash ${featuredObjectiveLabel}` };
    }
    if (floorIdentity.warningLevel === 'safe') {
        return { label: 'Now', tone: 'safe', value: `Build ${featuredObjectiveLabel}` };
    }
    if (floorIdentity.warningLevel === 'danger' || floorIdentity.warningLevel === 'warning') {
        return { label: 'Now', tone: 'pressure', value: 'Play counter first' };
    }
    return { label: 'Now', tone: 'counter', value: `Route ${featuredObjectiveLabel}` };
};

export const GameScreenEndlessChapterBanner = ({
    archetype,
    featuredObjectiveLabel,
    floorIdentity
}: GameScreenEndlessChapterBannerProps) => {
    const pressureTone = chapterSignalTone(floorIdentity);
    const actionCue = chapterActionCue(floorIdentity, featuredObjectiveLabel);
    const chapterSignalRows: ChapterSignalRow[] = [
        { label: 'Pressure', tone: pressureTone, value: floorIdentity?.label ?? archetype.theme },
        { label: 'Counter', tone: 'counter', value: floorIdentity ? 'Read plan' : 'Adapt' },
        { label: 'Payoff', tone: 'objective', value: featuredObjectiveLabel }
    ];
    const chapterSignalsLabel = `Chapter gameplay signals. ${chapterSignalRows
        .map((row) => `${row.label}: ${row.value}`)
        .join('. ')}. ${actionCue.label}: ${actionCue.value}.`;

    return (
        <div
            className={styles.endlessChapterBanner}
            data-chapter-theme={archetype.theme}
            data-testid="endless-chapter-banner"
        >
            <strong className={styles.endlessChapterTitle}>{archetype.title}</strong>
            <span className={styles.endlessChapterHint} data-testid="endless-chapter-hint">
                {floorIdentity?.teachingSentence ?? archetype.hint}
            </span>
            <span className={styles.endlessChapterRisk}>
                {archetype.theme}: {floorIdentity?.counterplaySentence ?? archetype.riskProfile}
            </span>
            <span className={styles.endlessChapterObjective} data-testid="endless-chapter-objective">
                Objective: {featuredObjectiveLabel}
            </span>
            <span
                aria-label={`Chapter action cue. ${actionCue.label}: ${actionCue.value}.`}
                className={styles.endlessChapterActionCue}
                data-chapter-action-audio={chapterActionAudioCue(actionCue)}
                data-chapter-action-beats={chapterActionBeatCount(actionCue)}
                data-chapter-action-screen-cue={chapterActionScreenCue(actionCue)}
                data-chapter-action-tone={actionCue.tone}
                data-testid="endless-chapter-action-cue"
            >
                <small>{actionCue.label}</small>
                <b>{actionCue.value}</b>
                <span aria-hidden="true" className={styles.endlessChapterBeatPips}>
                    {Array.from({ length: chapterActionBeatCount(actionCue) }, (_, index) => (
                        <i
                            data-chapter-action-beat={index + 1}
                            data-chapter-action-beat-audio={chapterActionAudioCue(actionCue)}
                            data-chapter-action-beat-focus={index === 0 ? 'primary' : 'support'}
                            data-chapter-action-beat-screen-cue={chapterActionScreenCue(actionCue)}
                            data-chapter-action-beat-tone={actionCue.tone}
                            key={index}
                        />
                    ))}
                </span>
            </span>
            <span
                className={styles.endlessChapterSignals}
                data-testid="endless-chapter-signals"
                aria-label={chapterSignalsLabel}
            >
                {chapterSignalRows.map((row) => (
                    <span
                        data-chapter-signal-audio={chapterSignalAudioCue(row)}
                        data-chapter-signal-beats={chapterSignalBeatCount(row)}
                        data-chapter-signal-screen-cue={chapterSignalScreenCue(row)}
                        data-chapter-signal-tone={row.tone}
                        key={`${row.label}:${row.value}`}
                    >
                        <small>{row.label}</small>
                        <b>{row.value}</b>
                        <span aria-hidden="true" className={styles.endlessChapterBeatPips}>
                            {Array.from({ length: chapterSignalBeatCount(row) }, (_, index) => (
                                <i
                                    data-chapter-signal-beat={index + 1}
                                    data-chapter-signal-beat-audio={chapterSignalAudioCue(row)}
                                    data-chapter-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                    data-chapter-signal-beat-screen-cue={chapterSignalScreenCue(row)}
                                    data-chapter-signal-beat-tone={row.tone}
                                    key={index}
                                />
                            ))}
                        </span>
                    </span>
                ))}
            </span>
        </div>
    );
};
