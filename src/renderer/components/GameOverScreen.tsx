import { useEffect, useMemo, useRef } from 'react';
import { ACHIEVEMENTS } from '../../shared/achievements';
import { getActiveContentLock } from '../../shared/content-lock-state';
import { MUTATOR_CATALOG, RELIC_CATALOG } from '../../shared/game-catalog';
import { getSteamStorePageUrl } from '../steamStorePage';
import type { MutatorId, RelicId, RunState } from '../../shared/contracts';
import { buildDailyResultsLoopRows } from '../../shared/daily-archive';
import { getGameOverNextRunRows } from '../../shared/game-over-next-run';
import { buildRunJournalEntry } from '../../shared/run-history';
import { useShallow } from 'zustand/react/shallow';
import { UI_ART } from '../assets/ui';
import { playGameOverOpenSfx, playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { gameOverScreenCopy } from '../copy/gameOverScreen';
import { useViewportSize } from '../hooks/useViewportSize';
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
    const { tiltRef: fieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion: settings.reduceMotion,
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
                ? gameOverScreenCopy.politeRunSummary(summary.totalScore, summary.highestLevel)
                : '',
        [summary]
    );
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const contentLock = getActiveContentLock();
    const steamStoreUrl = getSteamStorePageUrl();

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

    const flipCount = run.flipHistory?.length ?? 0;
    const journalEntry = buildRunJournalEntry(run);
    const nextRunRows = getGameOverNextRunRows(run, saveData, runStartSaveData ?? undefined);
    const metaItems = [
        ...(summary.activeMutators?.map((id) => ({ kind: 'mutator' as const, label: mutatorLabel(id) })) ?? []),
        ...(summary.relicIds?.map((id) => ({ kind: 'relic' as const, label: relicLabel(id) })) ?? [])
    ];

    return (
        <section className={styles.shell} ref={shellRef}>
            <MainMenuBackground
                fieldTiltRef={fieldTiltRef}
                graphicsQuality={settings.graphicsQuality}
                height={height}
                reduceMotion={settings.reduceMotion}
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
                        <strong>{summary.totalScore.toLocaleString()} score</strong>
                        <span>Floor {summary.highestLevel} / {summary.levelsCleared} clears / {summary.bestStreak} streak</span>
                    </div>
                    <UiButton
                        fullWidth
                        aria-label="Mobile Play Again - start a new run after this expedition"
                        size="lg"
                        variant="primary"
                        onClick={restartRun}
                    >
                        {gameOverScreenCopy.playAgainLabel}
                    </UiButton>
                    <UiButton
                        fullWidth
                        aria-label="Mobile return to the main menu"
                        size="lg"
                        variant="secondary"
                        onClick={() => {
                            resumeUiSfxContext();
                            playUiBackSfx(uiGain);
                            goToMenu();
                        }}
                    >
                        {gameOverScreenCopy.mainMenuLabel}
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
                            aria-label={`Total score ${summary.totalScore.toLocaleString()}`}
                            className={styles.scoreHero}
                        >
                            <span className={styles.scoreHeroLabel}>{gameOverScreenCopy.scoreLabel}</span>
                            <span className={styles.scoreHeroValue}>{summary.totalScore.toLocaleString()}</span>
                        </div>
                        <img alt="" className={styles.divider} src={UI_ART.dividerOrnament} />
                        <p className={styles.copy}>{gameOverScreenCopy.floorCaption(summary.highestLevel)}</p>

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
                                value={summary.highestLevel}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.bestStreak}
                                value={summary.bestStreak}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.perfectFloors}
                                value={summary.perfectClears}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.floorsCleared}
                                value={summary.levelsCleared}
                            />
                            <StatTile
                                density="minimal"
                                label={gameOverScreenCopy.statLabels.bestScore}
                                value={summary.bestScore.toLocaleString()}
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
                                    size="lg"
                                    variant="primary"
                                    className={styles.desktopActionButton}
                                    onClick={restartRun}
                                >
                                    {gameOverScreenCopy.playAgainLabel}
                                </UiButton>
                                <UiButton
                                    fullWidth
                                    aria-label={gameOverScreenCopy.mainMenuAriaLabel}
                                    size="lg"
                                    variant="secondary"
                                    className={styles.desktopActionButton}
                                    onClick={() => {
                                        resumeUiSfxContext();
                                        playUiBackSfx(uiGain);
                                        goToMenu();
                                    }}
                                >
                                    {gameOverScreenCopy.mainMenuLabel}
                                </UiButton>
                            </div>
                            <div className={styles.nextRunGrid} data-testid="game-over-next-run-loop">
                                {nextRunRows.map((row) => (
                                    <div className={styles.nextRunCard} data-next-run-row={row.id} key={row.id}>
                                        <strong>{row.title}</strong>
                                        <span>{row.value}</span>
                                        <p>{row.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        {contentLock.flavour === 'demo' ? (
                            <Panel className={styles.actionPanel} padding="lg" variant="default" data-testid="game-over-demo-ledger">
                                <span className={styles.panelKicker}>The full game adds</span>
                                <ul className={styles.demoLedger}>
                                    {contentLock.fullGameLedger.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                                {steamStoreUrl ? (
                                    <a
                                        className={styles.wishlistLink}
                                        data-testid="game-over-wishlist"
                                        href={steamStoreUrl}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >
                                        Wishlist on Steam
                                    </a>
                                ) : null}
                            </Panel>
                        ) : null}
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
                            <div className={styles.journalRows} data-testid="game-over-dungeon-journal">
                                {journalEntry.rows
                                    .filter((row) => row.id.startsWith('dungeon_'))
                                    .slice(0, 6)
                                    .map((row) => (
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

                {(run.flipHistory?.length ?? 0) > 0 ? (
                    <Panel className={styles.detailsPanel} padding="md" variant="muted">
                        <details className={styles.timelineDetails} data-testid="game-over-detail-drawer">
                            <summary>{gameOverScreenCopy.flipTimelineSummary}</summary>
                            <ol className={styles.ghostSteps}>
                                {run.flipHistory!.map((id, index) => (
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
