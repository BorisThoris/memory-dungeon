import type { RelicId } from '../../shared/contracts';
import { getEquippedCosmeticId } from '../../shared/cosmetics';
import { RELIC_CATALOG } from '../../shared/game-catalog';
import { countEligibleHonors, totalHonorUnlocks } from '../../shared/honorUnlocks';
import { getMetaProgressionBoard, getMetaProgressionMilestones } from '../../shared/meta-progression';
import { getDailyStreakEthicsRow } from '../../shared/daily-archive';
import { getObjectiveBoardItems } from '../../shared/objective-board';
import { buildProfileSaveShellSummary, getProfileSummaryRows, getSaveTrustRows } from '../../shared/profile-summary';
import { formatNextUtcReset } from '../../shared/utc-countdown';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { UI_ART } from '../assets/ui';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { Eyebrow, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import metaStyles from './MetaScreen.module.css';
import styles from './ProfileScreen.module.css';

const ProfileScreen = () => {
    const [nowMs, setNowMs] = useState(() => Date.now());
    const { claimMetaProgressionReward, closeSubscreen, openSettings, saveData, settings, steamConnected } = useAppStore(
        useShallow((state) => ({
            claimMetaProgressionReward: state.claimMetaProgressionReward,
            closeSubscreen: state.closeSubscreen,
            openSettings: state.openSettings,
            saveData: state.saveData,
            settings: state.settings,
            steamConnected: state.steamConnected
        }))
    );

    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const lastRunSummary = saveData.lastRunSummary;
    const lastRunLabel = lastRunSummary
        ? `${lastRunSummary.totalScore.toLocaleString()} score / Floor ${lastRunSummary.highestLevel} / ${lastRunSummary.bestStreak} streak`
        : 'No descent recorded yet.';
    const dailyCountdown = formatNextUtcReset(nowMs);
    const dailyStreakEthics = getDailyStreakEthicsRow(saveData, nowMs);
    const objectiveBoard = getObjectiveBoardItems(saveData);
    const profileSummary = getProfileSummaryRows(saveData);
    const trustShell = buildProfileSaveShellSummary(saveData);
    const progressionBoard = getMetaProgressionBoard(saveData);
    const progressionMilestones = getMetaProgressionMilestones(saveData);
    const readyProgressionReward = progressionBoard.nextReward?.status === 'available' ? progressionBoard.nextReward : null;
    const saveTrustRows = getSaveTrustRows(saveData);
    const profileTitle = getEquippedCosmeticId(saveData, 'title') === 'title_ascendant_v' ? 'Ascendant V' : 'Seeker';
    const profileCrest = getEquippedCosmeticId(saveData, 'crest') === 'crest_daily_bronze' ? 'Daily Bronze' : 'Lantern';
    const relicPickEntries = saveData.playerStats
        ? (Object.entries(saveData.playerStats.relicPickCounts) as [RelicId, number][])
              .filter(([, count]) => count > 0)
              .sort((left, right) => right[1] - left[1])
        : [];

    const handleBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
        closeSubscreen();
    };

    const handleOpenSettings = (): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
        openSettings('profile');
    };

    const handleClaimProgressionReward = (): void => {
        if (!readyProgressionReward) {
            return;
        }
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
        claimMetaProgressionReward(readyProgressionReward.id);
    };

    useEffect(() => {
        const id = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <section aria-label="Profile" className={`${metaStyles.shell} ${metaStyles.shellMetaStage}`} role="region">
            <header className={metaStyles.header}>
                <div className={metaStyles.headerText}>
                    <Eyebrow tone="menu">Progress</Eyebrow>
                    <ScreenTitle as="h1" role="display">
                        Profile
                    </ScreenTitle>
                    <p className={metaStyles.subtitle}>Local stats, dailies, mastery goals, and run context from your save.</p>
                </div>
                <div className={styles.headerActions}>
                    <UiButton size="md" variant="secondary" onClick={handleOpenSettings} type="button">
                        Settings
                    </UiButton>
                    <UiButton size="md" variant="secondary" onClick={handleBack} type="button">
                        Back
                    </UiButton>
                </div>
            </header>

            <div className={metaStyles.body} data-testid="profile-screen-body">
                <Panel className={styles.panel} padding="lg" variant="default">
                    <div className={styles.profileIdentity} data-testid="profile-identity">
                        <span className={styles.profileCrestBadge}>{profileCrest.slice(0, 1)}</span>
                        <div>
                            <span className={styles.kicker}>Local profile</span>
                            <strong className={styles.profileName}>{profileTitle}</strong>
                            <span className={styles.profileSub}>Single-device save · no social account required</span>
                        </div>
                    </div>
                    <div className={styles.summaryGrid} data-testid="profile-summary-grid">
                        {profileSummary.map((row) => (
                            <div className={styles.summaryCell} key={row.id}>
                                <span className={styles.summaryLabel}>{row.label}</span>
                                <strong className={styles.summaryValue}>{row.value}</strong>
                            </div>
                        ))}
                    </div>
                    <div className={styles.progressionBrief} data-testid="profile-progression-brief">
                        <span className={styles.kicker}>{trustShell.difficultyTierLabel}</span>
                        <strong>{trustShell.progressionMotivationCopy}</strong>
                        <p>
                            {trustShell.honorMarksToNextLevel} honor mark
                            {trustShell.honorMarksToNextLevel === 1 ? '' : 's'} to next profile level
                            {trustShell.nextRewardProgressCopy ? `; ${trustShell.nextRewardProgressCopy}.` : '.'}
                        </p>
                        <p>{trustShell.nextMilestoneProgressCopy}</p>
                        {readyProgressionReward ? (
                            <UiButton
                                className={styles.progressionClaimButton}
                                size="sm"
                                variant="primary"
                                onClick={handleClaimProgressionReward}
                                type="button"
                            >
                                Claim {readyProgressionReward.title}
                            </UiButton>
                        ) : null}
                    </div>
                    <div className={styles.milestoneRail} data-testid="profile-milestone-rail" aria-label="Profile tier milestones">
                        {progressionMilestones.map((milestone) => (
                            <div className={styles.milestoneChip} data-status={milestone.status} key={milestone.tier}>
                                <span className={styles.milestoneLevel}>Lv {milestone.level}</span>
                                <strong>{milestone.label}</strong>
                                <span>
                                    {milestone.status === 'upcoming'
                                        ? `${milestone.marksRemaining} honor marks`
                                        : milestone.status}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className={styles.inlineMetaRow}>
                        <span className={styles.kicker}>Steam</span>
                        <strong>{steamConnected ? 'Connected' : 'Offline'}</strong>
                        <span className={styles.kicker}>Honors</span>
                        <strong>
                            {countEligibleHonors(saveData)} / {totalHonorUnlocks}
                        </strong>
                        <span className={styles.kicker}>Daily streak</span>
                        <strong>{saveData.playerStats?.dailyStreakCosmetic ?? 0}</strong>
                        <span className={styles.streakNote}>{dailyStreakEthics.missedDayRule}</span>
                    </div>
                </Panel>

                <Panel className={styles.panel} padding="lg" variant="accent">
                    <Eyebrow tone="tight">Objective Board</Eyebrow>
                    <ScreenTitle as="h2" className={styles.sectionTitle} role="screen">
                        Mastery goals
                    </ScreenTitle>
                    <div className={styles.objectiveList} data-testid="profile-objective-board">
                        {objectiveBoard.map((objective) => (
                            <div className={styles.objectiveItem} data-status={objective.status} key={objective.id}>
                                <strong>{objective.title}</strong>
                                <span>
                                    {objective.progress.current}/{objective.progress.target} · {objective.status}
                                </span>
                                <p>{objective.reward}</p>
                            </div>
                        ))}
                    </div>
                </Panel>

                <div className={styles.twoCol}>
                    <Panel className={styles.panel} padding="md" variant="default" data-testid="profile-daily-panel">
                        <div className={styles.panelHeader}>
                            <img alt="" className={styles.panelSeal} src={UI_ART.menuSeal} />
                            <div>
                                <span className={styles.panelKicker}>Daily Challenge</span>
                                <strong className={styles.panelHeading}>New challenge in {dailyCountdown}</strong>
                            </div>
                        </div>
                        <p className={styles.panelBody}>
                            UTC seed rotation. Mutators, relic pacing, and floor pressure shift with each day.
                            {` ${dailyStreakEthics.rewardCopy}`}
                        </p>
                    </Panel>

                    <Panel className={styles.panel} padding="md" variant="default" data-testid="profile-recent-run">
                        <div className={styles.panelHeader}>
                            <img alt="" className={styles.panelSeal} src={UI_ART.menuSeal} />
                            <div>
                                <span className={styles.panelKicker}>Recent Descent</span>
                                <strong className={styles.panelHeading}>
                                    {lastRunSummary ? `Floor ${lastRunSummary.highestLevel}` : 'No active record'}
                                </strong>
                            </div>
                        </div>
                        <p className={styles.panelBody}>{lastRunLabel}</p>
                    </Panel>
                </div>

                <details className={styles.relicDetails} data-testid="profile-relic-details">
                    <summary>Most-picked relics</summary>
                    {relicPickEntries.length > 0 ? (
                        <ul className={styles.relicList}>
                            {relicPickEntries.slice(0, 5).map(([id, count]) => (
                                <li key={id}>
                                    <span>{RELIC_CATALOG[id]?.title ?? id}</span>
                                    <strong>{count}</strong>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.emptyState}>No relic history yet.</p>
                    )}
                </details>

                <Panel className={styles.panel} padding="md" variant="default" data-testid="profile-save-trust-panel">
                    <div className={styles.saveTrustHeader}>
                        <div>
                            <span className={styles.panelKicker}>Save Trust</span>
                            <strong className={styles.panelHeading}>Local profile boundaries</strong>
                        </div>
                        <span className={styles.saveTrustScope}>No account required</span>
                    </div>
                    <div className={styles.saveTrustList}>
                        {saveTrustRows.map((row) => (
                            <div className={styles.saveTrustItem} data-status={row.status} key={row.id}>
                                <div className={styles.saveTrustItemHeader}>
                                    <strong>{row.label}</strong>
                                    <span className={styles.saveTrustStatus}>{row.status.replace('_', ' ')}</span>
                                </div>
                                <p>{row.description}</p>
                            </div>
                        ))}
                    </div>
                </Panel>

                <p className={styles.trustFooter} data-testid="profile-trust-footer">
                    {trustShell.saveLocationCopy} {trustShell.exportCopy}
                </p>
            </div>
        </section>
    );
};

export default ProfileScreen;
