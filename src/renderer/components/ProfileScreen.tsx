import type { RelicId } from '../../shared/contracts';
import { getEquippedCosmeticId } from '../../shared/cosmetics';
import { RELIC_CATALOG } from '../../shared/game-catalog';
import { countEligibleHonors, totalHonorUnlocks } from '../../shared/honorUnlocks';
import { getMetaProgressionBoard, getMetaProgressionMilestones } from '../../shared/meta-progression';
import { getDailyStreakEthicsRow } from '../../shared/daily-archive';
import { getObjectiveBoardItems } from '../../shared/objective-board';
import { buildProfileSaveShellSummary, getProfileSummaryRows, getSaveTrustRows } from '../../shared/profile-summary';
import { getMetaProgressionRunImpactRows } from '../../shared/meta-reward-signals';
import { formatNextUtcReset } from '../../shared/utc-countdown';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { UI_ART } from '../assets/ui';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import {
    formatRunPayoffLaneMapAttr,
    formatRunPayoffLaneActionMapAttr,
    formatRunPayoffLaneMapLabel,
    formatRunPayoffLaneRoleMapAttr,
    formatRunPayoffLaneRoleIdMapAttr,
    formatRunPayoffBurstSignalLabel,
    formatRunPayoffSignalsLabel,
    getRunPayoffLaneAudioCue,
    getRunPayoffLaneBeatCount,
    getRunPayoffLaneMap,
    getRunPayoffLaneRole,
    getRunPayoffLaneRoleId,
    getRunPayoffLaneScreenCue,
    getRunPayoffBurstSignal,
    getRunPayoffSignalBeatCount,
    getRunPayoffSignals
} from '../copy/runPayoffSignals';
import { Eyebrow, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import metaStyles from './MetaScreen.module.css';
import styles from './ProfileScreen.module.css';

const formatProgressionImpactLabel = (
    label: string,
    rows: readonly { boardMoment: string; impact: string; lane: string; nextAction: string; title: string }[]
): string => {
    const rowCopy = rows
        .map((row) => `${row.lane}: ${row.impact}. Moment: ${row.boardMoment}. Next: ${row.nextAction}. ${row.title}`)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

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
    const recentRunSignalRows = lastRunSummary ? getRunPayoffSignals(lastRunSummary, { includeChainTarget: true }).slice(0, 4) : [];
    const recentRunPayoffLaneMap = getRunPayoffLaneMap(recentRunSignalRows);
    const primaryRecentRunPayoffLane = recentRunPayoffLaneMap[0] ?? null;
    const recentRunPayoffLaneMapAttr = formatRunPayoffLaneMapAttr(recentRunPayoffLaneMap);
    const recentRunPayoffLaneActionMapAttr = formatRunPayoffLaneActionMapAttr(recentRunPayoffLaneMap);
    const recentRunPayoffLaneRoleMapAttr = formatRunPayoffLaneRoleMapAttr(recentRunPayoffLaneMap);
    const recentRunPayoffLaneRoleIdMapAttr = formatRunPayoffLaneRoleIdMapAttr(recentRunPayoffLaneMap);
    const recentRunPayoffLaneMapLabel = formatRunPayoffLaneMapLabel('Profile recent run payoff lanes', recentRunPayoffLaneMap);
    const recentRunPayoffBurst = getRunPayoffBurstSignal(recentRunSignalRows);
    const recentRunPayoffBurstLabel = formatRunPayoffBurstSignalLabel('Profile recent run payoff burst', recentRunPayoffBurst);
    const recentRunSignalLabel =
        recentRunSignalRows.length > 0
            ? formatRunPayoffSignalsLabel('Recent run payoff signals', recentRunSignalRows)
            : lastRunLabel;
    const dailyCountdown = formatNextUtcReset(nowMs);
    const dailyStreakEthics = getDailyStreakEthicsRow(saveData, nowMs);
    const objectiveBoard = getObjectiveBoardItems(saveData);
    const profileSummary = getProfileSummaryRows(saveData);
    const trustShell = buildProfileSaveShellSummary(saveData);
    const progressionBoard = getMetaProgressionBoard(saveData);
    const progressionMilestones = getMetaProgressionMilestones(saveData);
    const progressionImpactRows = getMetaProgressionRunImpactRows(saveData);
    const progressionImpactLabel = formatProgressionImpactLabel('Profile progression impact signals', progressionImpactRows);
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
                                aria-label={`Claim ${readyProgressionReward.title}. Reward: ${readyProgressionReward.reward}. ${readyProgressionReward.description}`}
                                className={styles.progressionClaimButton}
                                size="sm"
                                variant="primary"
                                onClick={handleClaimProgressionReward}
                                type="button"
                                data-profile-claim-payoff={readyProgressionReward.reward}
                            >
                                <span className={styles.progressionClaimContent}>
                                    <span>Claim {readyProgressionReward.title}</span>
                                    <small>{readyProgressionReward.reward}</small>
                                    <em>{readyProgressionReward.description}</em>
                                </span>
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
                    <div
                        aria-label={progressionImpactLabel}
                        className={styles.progressionImpactGrid}
                        data-testid="profile-progression-impact-grid"
                    >
                        {progressionImpactRows.map((row) => (
                            <div
                                aria-label={`${row.title}. ${row.lane}: ${row.impact}. Moment: ${row.boardMoment}. Next: ${row.nextAction}.`}
                                className={styles.progressionImpactCard}
                                data-impact-tone={row.tone}
                                key={row.id}
                            >
                                <span>{row.lane}</span>
                                <strong>{row.impact}</strong>
                                <em>{row.boardMoment}</em>
                                <small>{row.nextAction}</small>
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
                        {recentRunSignalRows.length > 0 ? (
                            <div
                                aria-label={recentRunSignalLabel}
                                className={styles.recentRunSignals}
                                data-recent-run-lane-actions={recentRunPayoffLaneActionMapAttr}
                                data-recent-run-lane-map={recentRunPayoffLaneMapAttr}
                                data-recent-run-lane-role-ids={recentRunPayoffLaneRoleIdMapAttr}
                                data-recent-run-lane-roles={recentRunPayoffLaneRoleMapAttr}
                                data-testid="profile-recent-run-signals"
                            >
                                {recentRunPayoffLaneMap.length > 1 ? (
                                    <span
                                        aria-label={recentRunPayoffLaneMapLabel}
                                        data-recent-run-lane-actions={recentRunPayoffLaneActionMapAttr}
                                        data-recent-run-lane-map={recentRunPayoffLaneMapAttr}
                                        data-recent-run-lane-role-ids={recentRunPayoffLaneRoleIdMapAttr}
                                        data-recent-run-lane-roles={recentRunPayoffLaneRoleMapAttr}
                                        data-recent-run-primary-lane={primaryRecentRunPayoffLane?.id ?? 'none'}
                                        data-recent-run-primary-lane-action={primaryRecentRunPayoffLane?.action ?? 'none'}
                                        data-recent-run-primary-lane-audio={
                                            primaryRecentRunPayoffLane ? getRunPayoffLaneAudioCue(primaryRecentRunPayoffLane) : 'none'
                                        }
                                        data-recent-run-primary-lane-beats={
                                            primaryRecentRunPayoffLane ? getRunPayoffLaneBeatCount(primaryRecentRunPayoffLane) : 0
                                        }
                                        data-recent-run-primary-lane-cue={primaryRecentRunPayoffLane?.cue ?? 'none'}
                                        data-recent-run-primary-lane-role={
                                            primaryRecentRunPayoffLane ? getRunPayoffLaneRole(primaryRecentRunPayoffLane) : 'none'
                                        }
                                        data-recent-run-primary-lane-role-id={
                                            primaryRecentRunPayoffLane ? getRunPayoffLaneRoleId(primaryRecentRunPayoffLane) : 'none'
                                        }
                                        data-recent-run-primary-lane-screen-cue={
                                            primaryRecentRunPayoffLane ? getRunPayoffLaneScreenCue(primaryRecentRunPayoffLane) : 'none'
                                        }
                                        data-testid="profile-recent-run-lane-map"
                                    >
                                        {primaryRecentRunPayoffLane ? (
                                            <i
                                                aria-label={`Primary recent run payoff lane. ${getRunPayoffLaneRole(primaryRecentRunPayoffLane)} ${primaryRecentRunPayoffLane.label}: ${primaryRecentRunPayoffLane.action}. ${primaryRecentRunPayoffLane.cue}. ${getRunPayoffLaneBeatCount(primaryRecentRunPayoffLane)} beats.`}
                                                className={styles.recentRunPrimaryLaneCue}
                                                data-recent-run-primary-lane={primaryRecentRunPayoffLane.id}
                                                data-recent-run-primary-lane-action={primaryRecentRunPayoffLane.action}
                                                data-recent-run-primary-lane-audio={getRunPayoffLaneAudioCue(primaryRecentRunPayoffLane)}
                                                data-recent-run-primary-lane-beats={getRunPayoffLaneBeatCount(primaryRecentRunPayoffLane)}
                                                data-recent-run-primary-lane-cue={primaryRecentRunPayoffLane.cue}
                                                data-recent-run-primary-lane-role={getRunPayoffLaneRole(primaryRecentRunPayoffLane)}
                                                data-recent-run-primary-lane-role-id={getRunPayoffLaneRoleId(primaryRecentRunPayoffLane)}
                                                data-recent-run-primary-lane-screen-cue={getRunPayoffLaneScreenCue(primaryRecentRunPayoffLane)}
                                                data-testid="profile-recent-run-primary-payoff-lane"
                                            >
                                                <small>Replay chase</small>
                                                <strong>{getRunPayoffLaneRole(primaryRecentRunPayoffLane)}</strong>
                                                <b>{primaryRecentRunPayoffLane.action}</b>
                                                <em>{primaryRecentRunPayoffLane.cue}</em>
                                                <span aria-hidden="true" className={styles.recentRunPrimaryLaneBeatPips}>
                                                    {Array.from(
                                                        { length: getRunPayoffLaneBeatCount(primaryRecentRunPayoffLane) },
                                                        (_, index) => (
                                                            <s
                                                                data-recent-run-primary-lane-beat
                                                                data-recent-run-primary-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={index}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </i>
                                        ) : null}
                                        {recentRunPayoffLaneMap.map((lane) => (
                                            <i
                                                data-recent-run-lane={lane.id}
                                                data-recent-run-lane-action={lane.action}
                                                data-recent-run-lane-audio={getRunPayoffLaneAudioCue(lane)}
                                                data-recent-run-lane-beats={getRunPayoffLaneBeatCount(lane)}
                                                data-recent-run-lane-count={lane.count}
                                                data-recent-run-lane-role={getRunPayoffLaneRole(lane)}
                                                data-recent-run-lane-role-id={getRunPayoffLaneRoleId(lane)}
                                                data-recent-run-lane-screen-cue={getRunPayoffLaneScreenCue(lane)}
                                                key={lane.id}
                                            >
                                                <small>{lane.label}</small>
                                                <strong>{getRunPayoffLaneRole(lane)}</strong>
                                                <b>{lane.action}</b>
                                                <em>
                                                    x{lane.count} / {lane.cue}
                                                </em>
                                                <span aria-hidden="true" className={styles.recentRunLaneBeatPips}>
                                                    {Array.from({ length: getRunPayoffLaneBeatCount(lane) }, (_, index) => (
                                                        <s
                                                            data-recent-run-lane-beat
                                                            data-recent-run-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                            </i>
                                        ))}
                                    </span>
                                ) : null}
                                {recentRunPayoffBurst ? (
                                    <span
                                        aria-label={recentRunPayoffBurstLabel}
                                        data-recent-run-burst-action={recentRunPayoffBurst.action}
                                        data-recent-run-burst-tone={recentRunPayoffBurst.tone}
                                        data-testid="profile-recent-run-payoff-burst"
                                    >
                                        <small>{recentRunPayoffBurst.label}</small>
                                        <b>{recentRunPayoffBurst.action}</b>
                                        <strong>{recentRunPayoffBurst.value}</strong>
                                    </span>
                                ) : null}
                                {recentRunSignalRows.map((row) => (
                                    <span
                                        data-recent-run-signal-action={row.action}
                                        data-recent-run-signal-audio={row.audioCue}
                                        data-recent-run-signal-beats={getRunPayoffSignalBeatCount(row)}
                                        data-recent-run-signal-screen-cue={row.screenCue}
                                        data-recent-run-signal-tone={row.tone}
                                        key={row.id}
                                    >
                                        <b>{row.arcadeCue}</b>
                                        <small>{row.label}</small>
                                        <strong>{row.value}</strong>
                                        <i>{row.action}</i>
                                        <span aria-hidden="true" className={styles.recentRunBeatPips}>
                                            {Array.from({ length: getRunPayoffSignalBeatCount(row) }, (_, index) => (
                                                <i
                                                    data-recent-run-signal-beat
                                                    data-recent-run-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                        {row.nextCue ? <em>{row.nextCue}</em> : null}
                                    </span>
                                ))}
                            </div>
                        ) : null}
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
