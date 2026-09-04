import { useShallow } from 'zustand/react/shallow';
import { countEligibleHonors, totalHonorUnlocks } from '../../shared/honorUnlocks';
import { getMetaProgressionBoard, getMetaProgressionMilestones } from '../../shared/meta-progression';
import { getDailyArchiveSummary } from '../../shared/daily-archive';
import {
    getLocalProgressRegistryRows,
    type LocalProgressRegistryRow
} from '../../shared/local-progress-registry';
import { getObjectiveBoardItems } from '../../shared/objective-board';
import { getProfileSummaryRows } from '../../shared/profile-summary';
import { playUiBackSfx, playUiClickSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import {
    PROFILE_PROGRESS_COPY,
    PROFILE_PROGRESS_SOURCE_LABEL,
    PROFILE_PROGRESS_STATUS_LABEL
} from '../copy/profileProgress';
import { FittedGrid, MetaShell, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import styles from './ProfileScreen.module.css';

/**
 * Profile. Six numbers, the tier rail, everything the player is part-way through, the next goal,
 * and the claim when one is ready. It fits one screen at every size: the recent-run payoff burst,
 * lane map, impact grid and save-trust ledger restated the archive and the settings page, and are
 * gone.
 *
 * The progress grid is paged rather than long, and it is the first screen to show the daily
 * archive and the quest campaign at all — both were tracked in the save with nothing rendering
 * them, so a player's daily streak existed only in a file.
 */

const ProfileScreen = () => {
    const { claimMetaProgressionReward, closeSubscreen, saveData, settings } = useAppStore(
        useShallow((state) => ({
            claimMetaProgressionReward: state.claimMetaProgressionReward,
            closeSubscreen: state.closeSubscreen,
            saveData: state.saveData,
            settings: state.settings
        }))
    );
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const summaryRows = getProfileSummaryRows(saveData);
    const board = getMetaProgressionBoard(saveData);
    const milestones = getMetaProgressionMilestones(saveData);
    const objectives = getObjectiveBoardItems(saveData);
    const nextObjective = objectives.find((item) => item.status === 'active') ?? objectives[0] ?? null;
    const readyReward = board.rows.find((row) => row.status === 'available') ?? null;
    const honorsEarned = countEligibleHonors(saveData);
    const dailyArchive = getDailyArchiveSummary(saveData);
    const progressRows = getLocalProgressRegistryRows(saveData);

    return (
        <MetaShell
            eyebrow="Local profile"
            label="Profile"
            onBack={() => {
                resumeUiSfxContext();
                playUiBackSfx(uiGain);
                closeSubscreen();
            }}
            subtitle={`Level ${board.level} · ${honorsEarned} of ${totalHonorUnlocks} honors · ${PROFILE_PROGRESS_COPY.streak(dailyArchive.streak)} · stored on this device only.`}
            testId="profile-screen"
            title="Profile"
        >
            <dl aria-label="Profile summary" className={styles.summary} data-testid="profile-summary-grid">
                {summaryRows.map((row) => (
                    <div className={styles.summaryCell} key={row.id}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>

            <div aria-label="Profile tiers" className={styles.tiers} data-testid="profile-milestone-rail" role="group">
                {milestones.map((milestone) => (
                    <div className={styles.tier} data-status={milestone.status} key={milestone.tier}>
                        <span className={styles.tierLevel}>Lv {milestone.level}</span>
                        <strong className={styles.tierTitle}>{milestone.label}</strong>
                        <span className={styles.tierNote}>
                            {milestone.status === 'current'
                                ? 'Current'
                                : milestone.status === 'reached'
                                  ? 'Reached'
                                  : `${milestone.marksRequired} honor marks`}
                        </span>
                    </div>
                ))}
            </div>

            <section aria-label={PROFILE_PROGRESS_COPY.label} className={styles.progress}>
                <FittedGrid
                    ariaLabel={PROFILE_PROGRESS_COPY.label}
                    emptyState={PROFILE_PROGRESS_COPY.noRows}
                    items={progressRows}
                    itemNoun="entries"
                    keyForItem={(row) => `${row.source}:${row.id}`}
                    minColumnWidth={220}
                    renderItem={(row: LocalProgressRegistryRow) => (
                        <article className={styles.progressCard} data-status={row.status}>
                            <span className={styles.progressKicker}>{PROFILE_PROGRESS_SOURCE_LABEL[row.source]}</span>
                            <strong className={styles.progressTitle}>{row.title}</strong>
                            <span className={styles.progressMeta}>
                                {PROFILE_PROGRESS_STATUS_LABEL[row.status]} · {row.progressLabel}
                            </span>
                        </article>
                    )}
                    rowHeight={104}
                    testId="profile-progress-grid"
                />
            </section>

            <div className={styles.footer}>
                {nextObjective ? (
                    <p className={styles.nextGoal} data-testid="profile-objective-board">
                        <span className={styles.nextGoalLabel}>Next goal</span>
                        <strong>{nextObjective.title}</strong> {nextObjective.description}
                    </p>
                ) : null}
                {readyReward ? (
                    <UiButton
                        data-testid="profile-claim-reward"
                        onClick={() => {
                            resumeUiSfxContext();
                            playUiClickSfx(uiGain);
                            claimMetaProgressionReward(readyReward.id);
                        }}
                        size="lg"
                        type="button"
                        variant="primary"
                    >
                        Claim {readyReward.title}
                    </UiButton>
                ) : null}
            </div>
        </MetaShell>
    );
};

export default ProfileScreen;
