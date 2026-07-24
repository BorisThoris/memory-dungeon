import { useEffect, useMemo, useRef } from 'react';
import { ACHIEVEMENTS } from '../../shared/achievements';
import { getRewardPerkRows } from '../../shared/bonus-rewards';
import { MUTATOR_CATALOG, RELIC_CATALOG } from '../../shared/game-catalog';
import type { MutatorId, RelicId, RewardPerkId, RunState } from '../../shared/contracts';
import { buildDailyResultsLoopRows } from '../../shared/daily-archive';
import { getGameOverNextRunRows } from '../../shared/game-over-next-run';
import { buildRunJournalEntry } from '../../shared/run-history';
import { runFilteredArray, runFilteredStringArray } from '../../shared/run-array-guards';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { useShallow } from 'zustand/react/shallow';
import { UI_ART } from '../assets/ui';
import { playGameOverOpenSfx, playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { gameOverScreenCopy } from '../copy/gameOverScreen';
import {
    formatRunPayoffLaneMapAttr,
    formatRunPayoffLaneActionMapAttr,
    formatRunPayoffLaneMapLabel,
    formatRunPayoffBurstSignalLabel,
    formatRunPayoffCrescendoSignalLabel,
    formatRunPayoffSequenceSignalLabel,
    formatRunPayoffSignalsLabel,
    getRunPayoffLaneMap,
    getRunPayoffLaneAudioCue,
    getRunPayoffLaneBeatCount,
    getRunPayoffLaneScreenCue,
    getRunPayoffBurstSignal,
    getRunPayoffCrescendoSignal,
    getRunPayoffSequenceSignal,
    getRunPayoffSignalBeatCount,
    getRunPayoffSignals
} from '../copy/runPayoffSignals';
import { useViewportSize } from '../hooks/useViewportSize';
import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import { Eyebrow, Panel, ScreenTitle, StatTile, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import MainMenuBackground from './MainMenuBackground';
import styles from './GameOverScreen.module.css';

interface GameOverScreenProps {
    run: RunState;
}

const mutatorLabel = (id: MutatorId): string => MUTATOR_CATALOG[id].title;

const relicLabel = (id: RelicId): string => RELIC_CATALOG[id].title;

const gameOverMutatorIds = (value: unknown): MutatorId[] =>
    runFilteredArray(value, (id): id is MutatorId => typeof id === 'string' && id in MUTATOR_CATALOG);

const gameOverRelicIds = (value: unknown): RelicId[] =>
    runFilteredArray(value, (id): id is RelicId => typeof id === 'string' && id in RELIC_CATALOG);

const gameOverRewardPerkIds = (value: unknown): RewardPerkId[] =>
    runFilteredArray(value, (id): id is RewardPerkId => typeof id === 'string');

const gameOverFlipHistory = (value: unknown): string[] => runFilteredStringArray(value);

const runModeIdentityLine = (summary: NonNullable<RunState['lastRunSummary']>): string => {
    if (summary.activeContract?.noShuffle) {
        return gameOverScreenCopy.modeIdentity.scholar;
    }
    if (summary.activeContract?.maxPinsTotalRun != null) {
        return gameOverScreenCopy.modeIdentity.pinVow;
    }
    if (summary.wildMenuRun) {
        return gameOverScreenCopy.modeIdentity.wild;
    }
    if (summary.dungeonShowcaseRun) {
        return gameOverScreenCopy.modeIdentity.dungeonShowcase;
    }
    switch (summary.gameMode) {
        case 'gauntlet':
            return gameOverScreenCopy.modeIdentity.gauntlet;
        case 'meditation':
            return gameOverScreenCopy.modeIdentity.meditation;
        case 'puzzle':
            return gameOverScreenCopy.modeIdentity.puzzle;
        case 'daily':
            return gameOverScreenCopy.modeIdentity.daily;
        default:
            if (summary.practiceMode) {
                return gameOverScreenCopy.modeIdentity.practice;
            }
            return gameOverScreenCopy.modeIdentity.classic;
    }
};

const runModeHeading = (summary: NonNullable<RunState['lastRunSummary']>): string => {
    if (summary.gameMode === 'daily' && summary.dailyDateKeyUtc) {
        return gameOverScreenCopy.runModeHeadings.daily(summary.dailyDateKeyUtc);
    }
    if (summary.activeContract?.noShuffle) {
        return gameOverScreenCopy.runModeHeadings.scholar;
    }
    if (summary.activeContract?.maxPinsTotalRun != null) {
        return gameOverScreenCopy.runModeHeadings.pinVow;
    }
    if (summary.wildMenuRun) {
        return gameOverScreenCopy.runModeHeadings.wild;
    }
    if (summary.dungeonShowcaseRun) {
        return gameOverScreenCopy.runModeHeadings.dungeonShowcase;
    }
    switch (summary.gameMode) {
        case 'gauntlet':
            return gameOverScreenCopy.runModeHeadings.gauntlet;
        case 'meditation':
            return gameOverScreenCopy.runModeHeadings.meditation;
        case 'puzzle':
            return gameOverScreenCopy.runModeHeadings.puzzle;
        default:
            return summary.practiceMode
                ? gameOverScreenCopy.runModeHeadings.practice
                : gameOverScreenCopy.runModeHeadings.classic;
    }
};

const runMomentumRecapRows = (
    run: RunState,
    summary: NonNullable<RunState['lastRunSummary']>
): { id: string; label: string; value: string; detail: string; tone: 'chain' | 'reward' | 'build' | 'risk' }[] => {
    const bestStreak = runNonNegativeInteger(summary.bestStreak);
    const pickupClaimed = runNonNegativeInteger(run.findablesClaimedThisFloor);
    const pickupTotal = runNonNegativeInteger(run.findablesTotalThisFloor);
    const traitRouteComplete =
        run.traitRouteObjectiveCompletedThisFloor || Boolean(run.traitRouteObjectiveRewardClaimedThisFloor);
    const summaryActiveMutators = gameOverMutatorIds(summary.activeMutators);
    const summaryRelicIds = gameOverRelicIds(summary.relicIds);
    const rewardPerkIds = gameOverRewardPerkIds(run.rewardPerkIds);
    const perkCount = rewardPerkIds.length;
    const topPerkCue = getRewardPerkRows({ rewardPerkIds })[0]?.nextCue;
    const buildDetail = traitRouteComplete
        ? `Trait route paid: ${run.traitRouteObjectiveRewardTextThisFloor ?? 'trait route cashout'}.`
        : 'Drafted relics and perks define the next build attempt.';
    const buildDetailWithPerk = topPerkCue ? `${buildDetail} Perk next: ${topPerkCue}` : buildDetail;
    const pressureCount =
        summaryActiveMutators.length +
        runNonNegativeInteger(run.stats.mismatches) +
        runNonNegativeInteger(run.stats.volatileTraitShuffles);
    const nextFocus =
        bestStreak < 4
            ? {
                  value: 'Rebuild chain',
                  detail: 'Aim for x4+ before chasing side rewards.',
                  tone: 'chain' as const
              }
            : pickupTotal > 0 && pickupClaimed < pickupTotal
              ? {
                    value: 'Claim pickups',
                    detail: 'Prioritize visible reward pairs before the floor ends.',
                    tone: 'reward' as const
                }
              : summaryRelicIds.length === 0 && perkCount === 0
                ? {
                      value: 'Draft engine',
                      detail: 'Take a relic or perk that changes the next route plan.',
                      tone: 'build' as const
                  }
                : pressureCount >= 4
                  ? {
                        value: 'Reduce pressure',
                        detail: 'Use guard, peek, or control tools before risky flips.',
                        tone: 'risk' as const
                    }
                  : {
                        value: 'Push rewards',
                        detail: 'Chain and build tools are ready for greedier routes.',
                        tone: 'reward' as const
                    };

    return [
        {
            id: 'chain',
            label: 'Chain engine',
            value: bestStreak > 0 ? `x${bestStreak}` : 'not started',
            detail:
                bestStreak >= 10
                    ? 'Combo-tier streak reached.'
                    : bestStreak >= 4
                      ? 'Reward thresholds were in reach.'
                      : 'Short chains left reward momentum on the table.',
            tone: 'chain'
        },
        {
            id: 'pickup',
            label: 'Reward grabs',
            value: pickupTotal > 0 ? `${pickupClaimed}/${pickupTotal}` : `${pickupClaimed}`,
            detail: pickupTotal > 0 ? 'Findable reward pairs claimed this floor.' : 'No active pickup route at the end.',
            tone: 'reward'
        },
        {
            id: 'build',
            label: 'Build engines',
            value: `${summaryRelicIds.length} relics / ${perkCount} perks`,
            detail: buildDetailWithPerk,
            tone: 'build'
        },
        {
            id: 'pressure',
            label: 'Pressure read',
            value: pressureCount > 0 ? `${pressureCount} signals` : 'stable',
            detail:
                pressureCount > 0
                    ? 'Mutators, misses, and volatile shuffles shaped the run.'
                    : 'Low-pressure run state; push route rewards harder next time.',
            tone: 'risk'
        },
        {
            id: 'next-focus',
            label: 'Next focus',
            value: nextFocus.value,
            detail: nextFocus.detail,
            tone: nextFocus.tone
        }
    ];
};

const formatGameOverFeedbackRowsLabel = (
    label: string,
    rows: readonly { actionHint?: string; detail?: string; label?: string; title?: string; value: string }[]
): string => {
    const rowCopy = rows
        .map((row) =>
            [
                row.label ?? row.title,
                row.value,
                row.detail,
                row.actionHint
            ].filter(Boolean).join(': ')
        )
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const GameOverScreen = ({ run }: GameOverScreenProps) => {
    const shellRef = useRef<HTMLElement | null>(null);
    const { height, width } = useViewportSize();
    const { goToMenu, restartRun, runStartSaveData, saveData, settings } = useAppStore(
        useShallow((state) => ({
            goToMenu: state.goToMenu,
            restartRun: state.restartRun,
            runStartSaveData: state.runStartSaveData,
            saveData: state.saveData,
            settings: state.settings
        }))
    );
    const reduceMotion = useEffectiveReducedMotion(settings.reduceMotion);
    const { tiltRef: fieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: shellRef,
        strength: 1
    });
    const summary = run.lastRunSummary;
    const dailyResultsRows = useMemo(() => buildDailyResultsLoopRows(saveData), [saveData]);
    const dailyResultRow =
        summary?.gameMode === 'daily' ? dailyResultsRows.find((row) => row.scope === 'daily') : null;

    const politeRunSummaryText = useMemo(
        () =>
            summary
                ? gameOverScreenCopy.politeRunSummary(
                      runNonNegativeInteger(summary.totalScore),
                      runNonNegativeInteger(summary.highestLevel)
                  )
                : '',
        [summary]
    );
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);

    useEffect(() => {
        resumeUiSfxContext();
        playGameOverOpenSfx(uiGain);
    }, [uiGain]);

    if (!summary) {
        return null;
    }

    const unlockedAchievements = summary.unlockedAchievements
        .map((achievementId) => ACHIEVEMENTS.find((achievement) => achievement.id === achievementId))
        .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => Boolean(achievement));

    const summaryActiveMutators = gameOverMutatorIds(summary.activeMutators);
    const summaryRelicIds = gameOverRelicIds(summary.relicIds);
    const summaryDisplay = {
        bestScore: runNonNegativeInteger(summary.bestScore),
        bestStreak: runNonNegativeInteger(summary.bestStreak),
        highestLevel: runNonNegativeInteger(summary.highestLevel),
        levelsCleared: runNonNegativeInteger(summary.levelsCleared),
        perfectClears: runNonNegativeInteger(summary.perfectClears),
        totalScore: runNonNegativeInteger(summary.totalScore)
    };
    const rewardPerkIds = gameOverRewardPerkIds(run.rewardPerkIds);
    const flipHistory = gameOverFlipHistory(run.flipHistory);
    const flipCount = flipHistory.length;
    const journalEntry = buildRunJournalEntry(run);
    const nextRunRows = getGameOverNextRunRows(run, saveData, runStartSaveData ?? undefined);
    const metaItems = [
        ...summaryActiveMutators.map((id) => ({ kind: 'mutator' as const, label: mutatorLabel(id) })),
        ...summaryRelicIds.map((id) => ({ kind: 'relic' as const, label: relicLabel(id) }))
    ];
    const outcomeSignals = [
        { kind: 'score', label: 'Score', value: summaryDisplay.totalScore.toLocaleString() },
        { kind: 'chain', label: 'Best chain', value: `x${summaryDisplay.bestStreak}` },
        { kind: 'perfect', label: 'Perfect clears', value: `${summaryDisplay.perfectClears}` },
        summaryRelicIds.length > 0
            ? { kind: 'build', label: 'Prime', value: `${summaryRelicIds.length} relic${summaryRelicIds.length === 1 ? '' : 's'}` }
            : null,
        summaryActiveMutators.length > 0
            ? {
                  kind: 'pressure',
                  label: 'Pressure',
                  value: `${summaryActiveMutators.length} mutator${summaryActiveMutators.length === 1 ? '' : 's'}`
              }
            : null
    ].filter((row): row is { kind: string; label: string; value: string } => row != null);
    const payoffBurstRows = getRunPayoffSignals(summary, {
        pickupClaimed: run.findablesClaimedThisFloor,
        pickupTotal: run.findablesTotalThisFloor,
        pressureExtra:
            runNonNegativeInteger(run.stats.mismatches) +
            runNonNegativeInteger(run.stats.volatileTraitShuffles),
        rewardPerkCount: rewardPerkIds.length,
        routePaid: run.traitRouteObjectiveCompletedThisFloor || Boolean(run.traitRouteObjectiveRewardClaimedThisFloor),
        routeRewardText: run.traitRouteObjectiveRewardTextThisFloor
    });
    const payoffLaneMap = getRunPayoffLaneMap(payoffBurstRows);
    const primaryPayoffLane = payoffLaneMap[0] ?? null;
    const payoffLaneMapAttr = formatRunPayoffLaneMapAttr(payoffLaneMap);
    const payoffLaneActionMapAttr = formatRunPayoffLaneActionMapAttr(payoffLaneMap);
    const payoffLaneMapLabel = formatRunPayoffLaneMapLabel('Run payoff lanes', payoffLaneMap);
    const payoffBurstSignal = getRunPayoffBurstSignal(payoffBurstRows);
    const payoffCrescendoSignal = getRunPayoffCrescendoSignal(payoffBurstRows, payoffBurstSignal);
    const payoffStackPlan = getRunPayoffSequenceSignal(payoffBurstRows);
    const momentumRecapRows = runMomentumRecapRows(run, summary);
    const dungeonJournalRows = journalEntry.rows
        .filter((row) => row.id.startsWith('dungeon_'))
        .slice(0, 6);
    const outcomeSignalsLabel = formatGameOverFeedbackRowsLabel('Game over outcome signals', outcomeSignals);
    const payoffBurstRowsLabel = formatRunPayoffSignalsLabel('Run payoff burst', payoffBurstRows);
    const payoffBurstSignalLabel = formatRunPayoffBurstSignalLabel('Run payoff stack', payoffBurstSignal);
    const payoffCrescendoSignalLabel = formatRunPayoffCrescendoSignalLabel('Run payoff crescendo', payoffCrescendoSignal);
    const payoffStackPlanLabel = formatRunPayoffSequenceSignalLabel('Run payoff sequence', payoffStackPlan);
    const momentumRecapRowsLabel = formatGameOverFeedbackRowsLabel('Game over momentum recap', momentumRecapRows);
    const nextRunRowsLabel = formatGameOverFeedbackRowsLabel('Next run loop signals', nextRunRows);
    const dungeonJournalRowsLabel = formatGameOverFeedbackRowsLabel('Dungeon journal signals', dungeonJournalRows);
    const playAgainActionCue =
        nextRunRows.find((row) => row.id === 'chain_target')?.actionHint ??
        nextRunRows.find((row) => row.id === 'run_it_back')?.actionHint;
    const mainMenuActionCue =
        nextRunRows.find((row) => row.id === 'next_goal')?.actionHint ??
        nextRunRows.find((row) => row.id === 'build_recap')?.actionHint;

    return (
        <section className={styles.shell} ref={shellRef}>
            <MainMenuBackground
                fieldTiltRef={fieldTiltRef}
                graphicsQuality={settings.graphicsQuality}
                height={height}
                reduceMotion={reduceMotion}
                width={width}
            />
            <div
                aria-hidden="true"
                className={styles.sceneLayer}
                style={{ backgroundImage: `url(${UI_ART.menuScene})` }}
            />
            <div className={styles.scrim} />

            <div className={styles.foreground}>
                <p
                    aria-atomic="true"
                    aria-label="Run summary announcement"
                    aria-live="polite"
                    className={styles.visuallyHidden}
                    role="status"
                >
                    {politeRunSummaryText}
                </p>
                <section
                    aria-label="Run result and next actions"
                    className={styles.mobileActionDock}
                    data-testid="game-over-above-fold-summary"
                >
                    <div className={styles.mobileOutcomeCopy}>
                        <strong>{summaryDisplay.totalScore.toLocaleString()} score</strong>
                        <span>Floor {summaryDisplay.highestLevel} / {summaryDisplay.levelsCleared} clears / {summaryDisplay.bestStreak} streak</span>
                    </div>
                    <UiButton
                        fullWidth
                        aria-label="Mobile Play Again - start a new run after this expedition"
                        data-next-run-button-cue={playAgainActionCue}
                        size="lg"
                        variant="primary"
                        onClick={restartRun}
                    >
                        <span className={styles.actionButtonContent}>
                            <span>{gameOverScreenCopy.playAgainLabel}</span>
                            {playAgainActionCue ? <small>{playAgainActionCue}</small> : null}
                        </span>
                    </UiButton>
                    <UiButton
                        fullWidth
                        aria-label="Mobile return to the main menu"
                        data-next-run-button-cue={mainMenuActionCue}
                        size="lg"
                        variant="secondary"
                        onClick={() => {
                            resumeUiSfxContext();
                            playUiBackSfx(uiGain);
                            goToMenu();
                        }}
                    >
                        <span className={styles.actionButtonContent}>
                            <span>{gameOverScreenCopy.mainMenuLabel}</span>
                            {mainMenuActionCue ? <small>{mainMenuActionCue}</small> : null}
                        </span>
                    </UiButton>
                </section>

                <div className={styles.layout}>
                    <Panel className={styles.heroPanel} padding="lg" variant="strong">
                        <div className={styles.heroLockup}>
                            <img alt="" className={styles.brandCrest} src={UI_ART.brandCrest} />
                            <Eyebrow>{gameOverScreenCopy.heroEyebrow}</Eyebrow>
                            <ScreenTitle as="h1" role="screenLg">
                                {gameOverScreenCopy.heroTitle}
                            </ScreenTitle>
                        </div>
                        <div
                            aria-label={`Total score ${summaryDisplay.totalScore.toLocaleString()}`}
                            className={styles.scoreHero}
                        >
                            <span className={styles.scoreHeroLabel}>{gameOverScreenCopy.scoreLabel}</span>
                            <span className={styles.scoreHeroValue}>{summaryDisplay.totalScore.toLocaleString()}</span>
                        </div>
                        <div
                            aria-label={outcomeSignalsLabel}
                            className={styles.outcomeSignalStrip}
                            data-testid="game-over-outcome-signals"
                        >
                            {outcomeSignals.map((signal) => (
                                <span data-outcome-signal={signal.kind} key={signal.kind}>
                                    <small>{signal.label}</small>
                                    <strong>{signal.value}</strong>
                                </span>
                            ))}
                        </div>
                        <div
                            aria-label={payoffBurstRowsLabel}
                            className={styles.payoffBurstStrip}
                            data-payoff-lane-actions={payoffLaneActionMapAttr}
                            data-payoff-lane-map={payoffLaneMapAttr}
                            data-testid="game-over-payoff-burst"
                        >
                            {payoffLaneMap.length > 1 ? (
                                <span
                                    aria-label={payoffLaneMapLabel}
                                    data-payoff-lane-actions={payoffLaneActionMapAttr}
                                    data-payoff-lane-map={payoffLaneMapAttr}
                                    data-payoff-primary-lane={primaryPayoffLane?.id ?? 'none'}
                                    data-payoff-primary-lane-action={primaryPayoffLane?.action ?? 'none'}
                                    data-payoff-primary-lane-audio={
                                        primaryPayoffLane ? getRunPayoffLaneAudioCue(primaryPayoffLane) : 'none'
                                    }
                                    data-payoff-primary-lane-beats={
                                        primaryPayoffLane ? getRunPayoffLaneBeatCount(primaryPayoffLane) : 0
                                    }
                                    data-payoff-primary-lane-cue={primaryPayoffLane?.cue ?? 'none'}
                                    data-payoff-primary-lane-screen-cue={
                                        primaryPayoffLane ? getRunPayoffLaneScreenCue(primaryPayoffLane) : 'none'
                                    }
                                    data-testid="game-over-payoff-lane-map"
                                >
                                    {primaryPayoffLane ? (
                                        <i
                                            aria-label={`Primary run payoff lane. ${primaryPayoffLane.label}: ${primaryPayoffLane.action}. ${primaryPayoffLane.cue}. ${getRunPayoffLaneBeatCount(primaryPayoffLane)} beats.`}
                                            className={styles.payoffPrimaryLaneCue}
                                            data-payoff-primary-lane={primaryPayoffLane.id}
                                            data-payoff-primary-lane-action={primaryPayoffLane.action}
                                            data-payoff-primary-lane-audio={getRunPayoffLaneAudioCue(primaryPayoffLane)}
                                            data-payoff-primary-lane-beats={getRunPayoffLaneBeatCount(primaryPayoffLane)}
                                            data-payoff-primary-lane-cue={primaryPayoffLane.cue}
                                            data-payoff-primary-lane-screen-cue={getRunPayoffLaneScreenCue(primaryPayoffLane)}
                                            data-testid="game-over-primary-payoff-lane"
                                        >
                                            <small>Top chase</small>
                                            <strong>{primaryPayoffLane.label}</strong>
                                            <b>{primaryPayoffLane.action}</b>
                                            <em>{primaryPayoffLane.cue}</em>
                                            <span aria-hidden="true" className={styles.payoffPrimaryLaneBeatPips}>
                                                {Array.from({ length: getRunPayoffLaneBeatCount(primaryPayoffLane) }, (_, index) => (
                                                    <s
                                                        data-payoff-primary-lane-beat={index + 1}
                                                        data-payoff-primary-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                ))}
                                            </span>
                                        </i>
                                    ) : null}
                                    {payoffLaneMap.map((lane) => (
                                        <i
                                            data-payoff-lane={lane.id}
                                            data-payoff-lane-action={lane.action}
                                            data-payoff-lane-audio={getRunPayoffLaneAudioCue(lane)}
                                            data-payoff-lane-beats={getRunPayoffLaneBeatCount(lane)}
                                            data-payoff-lane-count={lane.count}
                                            data-payoff-lane-screen-cue={getRunPayoffLaneScreenCue(lane)}
                                            key={lane.id}
                                        >
                                            <small>{lane.label}</small>
                                            <strong>{lane.count}</strong>
                                            <b>{lane.action}</b>
                                            <em>{lane.cue}</em>
                                            <span aria-hidden="true" className={styles.payoffLaneBeatPips}>
                                                {Array.from({ length: getRunPayoffLaneBeatCount(lane) }, (_, index) => (
                                                    <s
                                                        data-payoff-lane-beat={index + 1}
                                                        data-payoff-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                ))}
                                            </span>
                                        </i>
                                    ))}
                                </span>
                            ) : null}
                            {payoffBurstSignal ? (
                                <span
                                    aria-label={payoffBurstSignalLabel}
                                    data-payoff-burst-stack-action={payoffBurstSignal.action}
                                    data-payoff-burst-stack-tone={payoffBurstSignal.tone}
                                    data-testid="game-over-payoff-burst-stack"
                                >
                                    <small>{payoffBurstSignal.label}</small>
                                    <b>{payoffBurstSignal.action}</b>
                                    <strong>{payoffBurstSignal.value}</strong>
                                </span>
                            ) : null}
                            {payoffCrescendoSignal ? (
                                <span
                                    aria-label={payoffCrescendoSignalLabel}
                                    data-payoff-crescendo-audio={payoffCrescendoSignal.audioCue}
                                    data-payoff-crescendo-beats={payoffCrescendoSignal.beatCount}
                                    data-payoff-crescendo-cue={payoffCrescendoSignal.screenCue}
                                    data-payoff-crescendo-screen-cue={payoffCrescendoSignal.screenCue}
                                    data-payoff-crescendo-tier={payoffCrescendoSignal.tier}
                                    data-testid="game-over-payoff-crescendo"
                                >
                                    <small>{payoffCrescendoSignal.label}</small>
                                    <b>{payoffCrescendoSignal.detail}</b>
                                    <strong>
                                        {Array.from({ length: payoffCrescendoSignal.beatCount }, (_, index) => (
                                            <i
                                                aria-hidden="true"
                                                data-payoff-crescendo-beat={index + 1}
                                                data-payoff-crescendo-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        ))}
                                    </strong>
                                </span>
                            ) : null}
                            {payoffStackPlan ? (
                                <span
                                    aria-label={payoffStackPlanLabel}
                                    data-payoff-sequence-first={payoffStackPlan.first}
                                    data-payoff-sequence-keep={payoffStackPlan.keep}
                                    data-payoff-sequence-then={payoffStackPlan.then}
                                    data-payoff-sequence-tone={payoffStackPlan.tone}
                                    data-testid="game-over-payoff-sequence"
                                >
                                    <small>First</small>
                                    <strong>{payoffStackPlan.first}</strong>
                                    <small>Then</small>
                                    <strong>{payoffStackPlan.then}</strong>
                                    <small>Keep</small>
                                    <strong>{payoffStackPlan.keep}</strong>
                                </span>
                            ) : null}
                            {payoffBurstRows.map((row) => (
                                <span
                                    data-payoff-burst-action={row.action}
                                    data-payoff-burst-audio={row.audioCue}
                                    data-payoff-burst-beats={getRunPayoffSignalBeatCount(row)}
                                    data-payoff-burst-screen-cue={row.screenCue}
                                    data-payoff-burst-tone={row.tone}
                                    key={row.id}
                                >
                                    <b>{row.arcadeCue}</b>
                                    <small>{row.label}</small>
                                    <strong>{row.value}</strong>
                                    <i>{row.action}</i>
                                    <span aria-hidden="true" className={styles.payoffBurstBeatPips}>
                                        {Array.from({ length: getRunPayoffSignalBeatCount(row) }, (_, index) => (
                                            <i
                                                data-payoff-burst-beat={index + 1}
                                                data-payoff-burst-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        ))}
                                    </span>
                                    {row.nextCue ? <em>{row.nextCue}</em> : null}
                                </span>
                            ))}
                        </div>
                        <div
                            aria-label={momentumRecapRowsLabel}
                            className={styles.momentumRecapGrid}
                            data-testid="game-over-momentum-recap"
                        >
                            {momentumRecapRows.map((row) => (
                                <span data-momentum-recap-tone={row.tone} key={row.id}>
                                    <small>{row.label}</small>
                                    <strong>{row.value}</strong>
                                    <em>{row.detail}</em>
                                </span>
                            ))}
                        </div>
                        <img alt="" className={styles.divider} src={UI_ART.dividerOrnament} />
                        <p className={styles.copy}>{gameOverScreenCopy.floorCaption(summaryDisplay.highestLevel)}</p>

                        {metaItems.length > 0 ? (
                            <div className={styles.metaStrip} data-testid="game-over-meta-strip">
                                {metaItems.map((item) => (
                                    <span
                                        className={styles.metaChip}
                                        data-testid={item.kind === 'relic' ? 'game-over-relic-chip' : 'game-over-mutator-chip'}
                                        key={`${item.kind}:${item.label}`}
                                    >
                                        {item.label}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        <div className={styles.summaryGrid}>
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.highestFloor}
                                value={summaryDisplay.highestLevel}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.bestStreak}
                                value={summaryDisplay.bestStreak}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.perfectFloors}
                                value={summaryDisplay.perfectClears}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.floorsCleared}
                                value={summaryDisplay.levelsCleared}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.bestScore}
                                value={summaryDisplay.bestScore.toLocaleString()}
                            />
                        </div>

                        <p className={styles.note}>
                            {summary.achievementsEnabled
                                ? gameOverScreenCopy.achievementsNoteOn
                                : gameOverScreenCopy.achievementsNoteOff}
                        </p>
                    </Panel>

                    <aside className={styles.sideRail}>
                        <Panel className={styles.actionPanel} padding="lg" variant="default">
                            <div className={styles.actionHeader}>
                                <img alt="" className={styles.actionSeal} src={UI_ART.menuSeal} />
                                <div>
                                    <span className={styles.panelKicker}>{gameOverScreenCopy.actionKicker}</span>
                                    <h2 className={styles.panelHeading}>{gameOverScreenCopy.actionHeading}</h2>
                                </div>
                            </div>
                            <div className={styles.actionButtons}>
                                <UiButton
                                    fullWidth
                                    aria-label={gameOverScreenCopy.playAgainAriaLabel}
                                    data-next-run-button-cue={playAgainActionCue}
                                    size="lg"
                                    variant="primary"
                                    className={styles.desktopActionButton}
                                    onClick={restartRun}
                                >
                                    <span className={styles.actionButtonContent}>
                                        <span>{gameOverScreenCopy.playAgainLabel}</span>
                                        {playAgainActionCue ? <small>{playAgainActionCue}</small> : null}
                                    </span>
                                </UiButton>
                                <UiButton
                                    fullWidth
                                    aria-label={gameOverScreenCopy.mainMenuAriaLabel}
                                    data-next-run-button-cue={mainMenuActionCue}
                                    size="lg"
                                    variant="secondary"
                                    className={styles.desktopActionButton}
                                    onClick={() => {
                                        resumeUiSfxContext();
                                        playUiBackSfx(uiGain);
                                        goToMenu();
                                    }}
                                >
                                    <span className={styles.actionButtonContent}>
                                        <span>{gameOverScreenCopy.mainMenuLabel}</span>
                                        {mainMenuActionCue ? <small>{mainMenuActionCue}</small> : null}
                                    </span>
                                </UiButton>
                            </div>
                            <div
                                aria-label={nextRunRowsLabel}
                                className={styles.nextRunGrid}
                                data-testid="game-over-next-run-loop"
                            >
                                {nextRunRows.map((row) => (
                                    <div
                                        className={styles.nextRunCard}
                                        data-next-run-action-cue={row.actionHint}
                                        data-next-run-row={row.id}
                                        key={row.id}
                                    >
                                        <strong>{row.title}</strong>
                                        <span>{row.value}</span>
                                        <small className={styles.nextRunActionCue}>{row.actionHint}</small>
                                        <p>{row.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        <Panel className={styles.actionPanel} padding="lg" variant="muted">
                            <span className={styles.panelKicker}>{gameOverScreenCopy.runSnapshotKicker}</span>
                            <strong className={styles.panelHeading} data-testid="game-over-mode-heading">
                                {runModeHeading(summary)}
                            </strong>
                            <p className={styles.panelCopy} data-testid="game-over-mode-identity">
                                {runModeIdentityLine(summary)}
                            </p>
                            {dailyResultRow ? (
                                <p className={styles.panelCopy}>
                                    Share: {dailyResultRow.shareString} / {dailyResultRow.repeatAttemptRule}
                                </p>
                            ) : null}
                            <p className={styles.panelCopy}>{gameOverScreenCopy.flipHistoryCopy(flipCount)}</p>
                            <p className={styles.panelCopy}>
                                Journal {journalEntry.journalId}: {journalEntry.buildSummary} / {journalEntry.shareLabel}
                            </p>
                            <div
                                aria-label={dungeonJournalRowsLabel}
                                className={styles.journalRows}
                                data-testid="game-over-dungeon-journal"
                            >
                                {dungeonJournalRows.map((row) => (
                                        <div className={styles.journalRow} key={row.id}>
                                            <strong>{row.label}</strong>
                                            <span>{row.value}</span>
                                        </div>
                                    ))}
                            </div>
                        </Panel>
                    </aside>
                </div>

                {unlockedAchievements.length > 0 ? (
                    <Panel className={styles.achievementPanel} padding="lg" variant="default">
                        <Eyebrow>{gameOverScreenCopy.achievementEyebrow}</Eyebrow>
                        <ScreenTitle as="h2" className={styles.achievementHeading} role="screen">
                            {gameOverScreenCopy.achievementHeading}
                        </ScreenTitle>
                        <ul className={styles.achievementList}>
                            {unlockedAchievements.map((achievement) => (
                                <li className={styles.achievementItem} key={achievement.id}>
                                    <strong>{achievement.title}</strong>
                                    <span>{achievement.description}</span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                ) : null}

                {flipHistory.length > 0 ? (
                    <Panel className={styles.detailsPanel} padding="md" variant="muted">
                        <details className={styles.timelineDetails} data-testid="game-over-detail-drawer">
                            <summary>{gameOverScreenCopy.flipTimelineSummary}</summary>
                            <ol className={styles.ghostSteps}>
                                {flipHistory.map((id, index) => (
                                    <li key={`${id}-${index}`}>
                                        <span className={styles.ghostStepIndex}>{index + 1}</span>
                                        <code>{id}</code>
                                    </li>
                                ))}
                            </ol>
                        </details>
                    </Panel>
                ) : null}
            </div>
        </section>
    );
};

export default GameOverScreen;
