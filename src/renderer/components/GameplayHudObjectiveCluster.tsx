import { type SecondaryObjectiveProgress } from '../../shared/secondary-objectives';
import { RELIC_FAVOR_PER_BONUS_PICK } from '../../shared/relic-favor-rules';
import FeedbackBeatPips from './FeedbackBeatPips';
import { type HudObjectiveSignalRowModel } from './gameplayHudObjectiveSignalFeedbackModel';
import styles from './GameScreen.module.css';

export interface HudRiskWagerModel {
    ariaLabel: string;
    beatCount: number;
    bonusFavor: number;
    screenCue: 'guard' | 'risk';
    streakAtRisk: number;
    title: string;
}

export interface GameplayHudObjectiveClusterProps {
    endlessChapterActive: boolean;
    favorProgressTitle: string | undefined;
    featuredObjectiveLabel: string | null;
    featuredObjectiveTitle: string;
    objectiveSignalRows: readonly HudObjectiveSignalRowModel[];
    objectiveSignalsLabel: string;
    relicFavorProgress: number;
    riskWager: HudRiskWagerModel | null;
    secondaryObjectiveRows: readonly SecondaryObjectiveProgress[];
}

const GameplayHudObjectiveCluster = ({
    endlessChapterActive,
    favorProgressTitle,
    featuredObjectiveLabel,
    featuredObjectiveTitle,
    objectiveSignalRows,
    objectiveSignalsLabel,
    relicFavorProgress,
    riskWager,
    secondaryObjectiveRows
}: GameplayHudObjectiveClusterProps) => (
    <>
        {endlessChapterActive && featuredObjectiveLabel ? (
            <div
                className={styles.statPillCompact}
                data-testid="hud-featured-objective"
                title={featuredObjectiveTitle}
            >
                <span className={styles.statKey}>Objective</span>
                <span className={styles.statVal}>{featuredObjectiveLabel}</span>
                <span
                    aria-label={objectiveSignalsLabel}
                    className={styles.hudObjectiveSignals}
                    data-testid="hud-objective-signals"
                >
                    {objectiveSignalRows.map((row) => (
                        <span
                            data-objective-signal-action={row.action}
                            data-objective-signal-audio={row.audioCue}
                            data-objective-signal-beats={row.beatCount}
                            data-objective-signal-screen-cue={row.screenCue}
                            data-objective-signal-tone={row.tone}
                            key={row.id}
                        >
                            <small>{row.label}</small>
                            <b>{row.value}</b>
                            <FeedbackBeatPips
                                className={styles.hudObjectiveSignalBeatPips}
                                count={row.beatCount}
                                itemProps={(index) => ({
                                    'data-objective-signal-beat': '',
                                    'data-objective-signal-beat-focus': index === 0 ? 'primary' : 'support'
                                })}
                                keyPrefix={`objective-signal-${row.id}`}
                            />
                        </span>
                    ))}
                </span>
            </div>
        ) : null}
        {secondaryObjectiveRows.map((row) => (
            <div
                className={styles.statPillCompact}
                data-testid={`hud-secondary-objective-${row.id}`}
                key={row.id}
                title={row.detail}
            >
                <span className={styles.statKey}>{row.label}</span>
                <span className={styles.statVal}>{row.status}</span>
            </div>
        ))}
        {endlessChapterActive ? (
            <div
                className={styles.statPillCompact}
                data-testid="hud-favor-progress"
                title={favorProgressTitle}
            >
                <span className={styles.statKey}>Favor</span>
                <span className={styles.statVal}>{relicFavorProgress}/{RELIC_FAVOR_PER_BONUS_PICK}</span>
                <span className={styles.statSubline}>
                    {RELIC_FAVOR_PER_BONUS_PICK - relicFavorProgress} more for a relic pick
                </span>
            </div>
        ) : null}
        {riskWager ? (
            <div
                aria-label={riskWager.ariaLabel}
                className={`${styles.statPillCompact} ${styles.hudEndlessRiskWagerPill}`}
                data-hud-risk-wager-action="Protect streak"
                data-hud-risk-wager-audio="risk-wager-armed"
                data-hud-risk-wager-beats={riskWager.beatCount}
                data-hud-risk-wager-favor={riskWager.bonusFavor}
                data-hud-risk-wager-risk={`x${riskWager.streakAtRisk}`}
                data-hud-risk-wager-screen-cue={riskWager.screenCue}
                data-testid="hud-endless-risk-wager"
                title={riskWager.title}
            >
                <span className={styles.statKey}>Wager</span>
                <span className={styles.statVal}>+{riskWager.bonusFavor} Favor</span>
                <span className={styles.statSubline}>Protect streak</span>
                <FeedbackBeatPips
                    className={styles.hudEndlessRiskWagerBeatPips}
                    count={riskWager.beatCount}
                    itemProps={(beatIndex) => ({
                        'data-hud-risk-wager-beat': beatIndex + 1,
                        'data-hud-risk-wager-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix="hud-risk-wager"
                />
            </div>
        ) : null}
    </>
);

export default GameplayHudObjectiveCluster;
