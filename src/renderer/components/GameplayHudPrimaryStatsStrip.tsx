import { type CSSProperties } from 'react';
import { MAX_LIVES, type RunState } from '../../shared/contracts';
import scoreParasiteCrystalUrl from '../assets/ui/icons/icon-score-parasite-crystal.svg?url';
import { MUTATOR_HUD_LABELS } from './gameplayHudMutatorLabels';
import styles from './GameScreen.module.css';
import { type GameplayHudContextState } from './gameplayHudContextState';
import { type GameplayHudRewardFlowState } from './gameplayHudRewardFlowState';

const hudMeterStyle = (percent: number): CSSProperties =>
    ({
        '--hud-meter-fill': `${Math.max(0, Math.min(100, percent))}%`
    }) as CSSProperties;

const LifeHeartIcon = () => (
    <svg aria-hidden="true" className={styles.lifeHeartGlyph} viewBox="0 0 16 16">
        <path d="M8 14.2 2.54 9.1A3.64 3.64 0 0 1 7.7 3.95L8 4.26l.3-.31A3.64 3.64 0 0 1 13.46 9.1Z" fill="currentColor" />
    </svg>
);

export interface GameplayHudPrimaryStatsStripProps {
    board: NonNullable<RunState['board']>;
    bossCounterplayTitle: string;
    dailyDateStripKey: string | null;
    encounterIdentity: GameplayHudContextState['encounterIdentity'];
    floorHexFillGradId: string;
    floorHexStrokeGradId: string;
    floorIdentity: GameplayHudContextState['floorIdentity'];
    healthTone: 'critical' | 'safe' | 'wounded';
    lifeSegmentTitle: string;
    lifeTrackLabel: string;
    parasiteFloorProgress: number;
    resourceSegmentTitle: string;
    rewardFlowState: GameplayHudRewardFlowState;
    run: RunState;
    scoreParasiteActive: boolean;
}

const GameplayHudPrimaryStatsStrip = ({
    board,
    bossCounterplayTitle,
    dailyDateStripKey,
    encounterIdentity,
    floorHexFillGradId,
    floorHexStrokeGradId,
    floorIdentity,
    healthTone,
    lifeSegmentTitle,
    lifeTrackLabel,
    parasiteFloorProgress,
    resourceSegmentTitle,
    rewardFlowState,
    run,
    scoreParasiteActive
}: GameplayHudPrimaryStatsStripProps) => (
    <div className={styles.hudPrimaryStatsRow}>
        <div className={styles.hudStripLeftModule} data-testid="hud-wing-left">
            <div className={styles.floorBadgeHexFrame} data-testid="hud-floor-hex-frame">
                <svg
                    aria-hidden="true"
                    className={styles.floorBadgeHexSvg}
                    preserveAspectRatio="xMidYMid meet"
                    viewBox="0 0 72 88"
                >
                    <defs>
                        <linearGradient
                            id={floorHexStrokeGradId}
                            gradientUnits="userSpaceOnUse"
                            x1="8"
                            x2="64"
                            y1="10"
                            y2="78"
                        >
                            <stop offset="0%" stopColor="#F2D39D" stopOpacity="0.95" />
                            <stop offset="42%" stopColor="#C3954F" />
                            <stop offset="100%" stopColor="#6B441B" stopOpacity="0.9" />
                        </linearGradient>
                        <linearGradient id={floorHexFillGradId} x1="36" x2="36" y1="12" y2="76" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#F2D39D" stopOpacity="0.14" />
                            <stop offset="55%" stopColor="#8A6228" stopOpacity="0.06" />
                            <stop offset="100%" stopColor="#0a0c12" stopOpacity="0.22" />
                        </linearGradient>
                    </defs>
                    <polygon
                        fill={`url(#${floorHexFillGradId})`}
                        points="36,3 68,25 68,63 36,85 4,63 4,25"
                        stroke={`url(#${floorHexStrokeGradId})`}
                        strokeLinejoin="round"
                        strokeWidth="2.35"
                    />
                    <polygon
                        fill="none"
                        points="36,9.5 62.5,28.5 62.5,59.5 36,78.5 9.5,59.5 9.5,28.5"
                        stroke="#F2D39D"
                        strokeLinejoin="round"
                        strokeOpacity="0.38"
                        strokeWidth="0.85"
                    />
                </svg>
                <div className={`${styles.hudSegment} ${styles.floorBadge}`} title={`${floorIdentity.teachingSentence} ${floorIdentity.counterplaySentence}`}>
                    <span className={styles.floorLabel}>Floor</span>
                    <span className={styles.floorValue}>{board.level}</span>
                    {board.floorTag === 'boss' ? (
                        <span className={styles.floorTagPill} data-testid="hud-encounter-identity" title={bossCounterplayTitle}>
                            {encounterIdentity?.label ? `Boss: ${encounterIdentity.label}` : 'Boss'}
                        </span>
                    ) : board.floorTag === 'breather' ? (
                        <span className={styles.floorTagPill} data-testid="hud-floor-identity" title={floorIdentity.activeReminder}>
                            {floorIdentity.label}
                        </span>
                    ) : floorIdentity.warningLevel !== 'baseline' ? (
                        <span className={styles.floorTagPill} data-testid="hud-floor-identity" title={floorIdentity.activeReminder}>
                            {floorIdentity.label}
                        </span>
                    ) : null}
                </div>
            </div>
            <div className={styles.hudStripDivider} aria-hidden="true" />
            <div
                className={`${styles.hudSegment} ${styles.hudLivesSegment}`}
                data-health={healthTone}
                data-testid="hud-lives"
                title={lifeSegmentTitle}
            >
                <span className={styles.statKey}>Lives</span>
                <div className={styles.lifeTrack} role="group" aria-label={lifeTrackLabel}>
                    {Array.from({ length: MAX_LIVES }).map((_, index) => (
                        <span
                            aria-hidden="true"
                            className={index < run.lives ? styles.lifeHeartActive : styles.lifeHeartInactive}
                            key={`life-${index}`}
                        >
                            <LifeHeartIcon />
                        </span>
                    ))}
                </div>
                <span className={`${styles.statSubline} ${styles.lifeCapReadout}`}>
                    {run.lives <= 1 ? 'Critical ' : ''}
                    {run.lives} / {MAX_LIVES}
                </span>
            </div>
            <div className={styles.hudStripDivider} aria-hidden="true" />
            <div
                className={`${styles.hudSegment} ${styles.statPill} ${styles.hudShardsSegment}`}
                data-hud-combo-surge={rewardFlowState.chainComboSurgeBand ? 'true' : 'false'}
                data-primary-reward-hot={rewardFlowState.primaryRewardHot ? 'true' : 'false'}
                data-testid="hud-combo-shards"
                title={resourceSegmentTitle}
            >
                <span className={styles.statKey}>Shards</span>
                <span className={`${styles.statVal} ${styles.hudShardsValue}`}>{run.stats.comboShards}</span>
                <span className={styles.statSubline}>Guards {run.stats.guardTokens}</span>
                <span className={styles.statSubline}>3 shards = +1 life</span>
                {rewardFlowState.primaryResourceRewardCue ? (
                    <span
                        aria-label={rewardFlowState.primaryResourceRewardCueLabel}
                        className={styles.hudPrimaryRewardCue}
                        data-primary-reward-action={rewardFlowState.primaryResourceRewardAction}
                        data-primary-reward-audio={rewardFlowState.primaryResourceRewardAudioCue}
                        data-primary-reward-beats={rewardFlowState.primaryResourceRewardBeatCount}
                        data-primary-reward-distance={rewardFlowState.primaryResourceRewardCue.distance}
                        data-primary-reward-progress={rewardFlowState.primaryChainRewardProgress?.label ?? 'none'}
                        data-primary-reward-screen-cue={rewardFlowState.primaryResourceRewardScreenCue}
                        data-primary-reward-tone={rewardFlowState.primaryResourceRewardCue.tone}
                        data-primary-reward-urgency={rewardFlowState.primaryResourceRewardCue.urgency}
                        data-testid="hud-primary-reward-cue"
                    >
                        <span className={styles.hudPrimaryRewardAction}>
                            {rewardFlowState.primaryResourceRewardAction}
                        </span>
                        <span className={styles.hudPrimaryRewardLabel}>
                            {rewardFlowState.primaryResourceRewardCue.label}
                        </span>
                        {rewardFlowState.primaryChainRewardProgress ? (
                            <span
                                aria-label={`Primary reward progress ${rewardFlowState.primaryChainRewardProgress.label} toward ${rewardFlowState.primaryChainRewardProgress.targetLabel}. ${rewardFlowState.primaryChainRewardProgress.remainingLabel}.`}
                                aria-valuemax={rewardFlowState.primaryChainRewardProgress.total}
                                aria-valuemin={0}
                                aria-valuenow={rewardFlowState.primaryChainRewardProgress.filled}
                                aria-valuetext={rewardFlowState.primaryChainRewardProgress.remainingLabel}
                                className={styles.hudPrimaryRewardProgress}
                                data-primary-reward-progress-filled={rewardFlowState.primaryChainRewardProgress.filled}
                                data-primary-reward-progress-total={rewardFlowState.primaryChainRewardProgress.total}
                                role="progressbar"
                            >
                                <span
                                    className={styles.hudPrimaryRewardProgressFill}
                                    style={hudMeterStyle(
                                        (rewardFlowState.primaryChainRewardProgress.filled /
                                            Math.max(1, rewardFlowState.primaryChainRewardProgress.total)) *
                                            100
                                    )}
                                />
                                <b>{rewardFlowState.primaryChainRewardProgress.remainingLabel}</b>
                            </span>
                        ) : null}
                        <span aria-hidden="true" className={styles.hudPrimaryRewardBeatPips}>
                            {Array.from({ length: rewardFlowState.primaryResourceRewardBeatCount }, (_, beatIndex) => (
                                <i
                                    data-primary-reward-beat={beatIndex + 1}
                                    data-primary-reward-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={`${rewardFlowState.primaryResourceRewardCue.id}-primary-beat-${beatIndex + 1}`}
                                />
                            ))}
                        </span>
                    </span>
                ) : null}
            </div>
        </div>
        <div className={`${styles.hudStripDivider} ${styles.hudStripDividerBetweenZones}`} aria-hidden="true" />
        <div className={styles.hudStripScoreModule} data-testid="hud-wing-center">
            <div className={`${styles.hudSegment} ${styles.hudScoreSegment}`}>
                <span className={styles.statKey}>Score</span>
                <span className={`${styles.statVal} ${styles.statValScore}`}>{run.stats.totalScore.toLocaleString()}</span>
            </div>
        </div>
        <div className={`${styles.hudStripDivider} ${styles.hudStripDividerBetweenZones}`} aria-hidden="true" />
        <div className={styles.hudStripRightModule}>
            {dailyDateStripKey ? (
                <div
                    className={`${styles.hudSegment} ${styles.hudDailySegment} ${styles.hudContextAux}`}
                    title="UTC daily challenge id"
                >
                    <span className={styles.statKey}>Daily</span>
                    <span className={styles.hudDailyDate}>{dailyDateStripKey}</span>
                </div>
            ) : null}
            {dailyDateStripKey && scoreParasiteActive ? (
                <div className={styles.hudStripDivider} aria-hidden="true" />
            ) : null}
            {scoreParasiteActive ? (
                <div
                    aria-label={`Score parasite: ${run.parasiteFloors} of 4 floors toward life drain.${
                        run.parasiteWardRemaining > 0
                            ? ` ${run.parasiteWardRemaining} parasite ward charge${
                                  run.parasiteWardRemaining === 1 ? '' : 's'
                              }.`
                            : ''
                    }`}
                    className={styles.hudParasiteSegment}
                    title="Every four floor advances with this mutator can drain a life. A Parasite ward charge absorbs one drain instead (relic: Parasite ward)."
                >
                    <div className={styles.hudParasiteRow}>
                        <div className={styles.hudParasiteCrystalWrap} aria-hidden="true">
                            <img
                                alt=""
                                className={styles.hudParasiteCrystal}
                                height={30}
                                src={scoreParasiteCrystalUrl}
                                width={24}
                            />
                        </div>
                        <div className={styles.hudParasiteBody}>
                            <span className={styles.hudParasiteLabel}>{MUTATOR_HUD_LABELS.score_parasite}</span>
                            <div className={styles.hudParasiteTrack}>
                                <div className={styles.hudParasiteFill} style={{ width: `${parasiteFloorProgress * 100}%` }} />
                            </div>
                            <span className={styles.hudParasiteCaption}>{run.parasiteFloors} / 4 floors</span>
                            {run.parasiteWardRemaining > 0 ? (
                                <span className={styles.hudParasiteWard} data-testid="hud-parasite-ward">
                                    Ward x{run.parasiteWardRemaining}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    </div>
);

export default GameplayHudPrimaryStatsStrip;
