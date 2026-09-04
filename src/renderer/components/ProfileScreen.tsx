import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { countEligibleHonors, totalHonorUnlocks } from '../../shared/honorUnlocks';
import { getMetaProgressionBoard, getMetaProgressionMilestones } from '../../shared/meta-progression';
import { buildDailyArchiveShareString, getDailyArchiveSummary } from '../../shared/daily-archive';
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
import { normalizeRunHistory } from '../../shared/run-history-log';
import { getModeRecords } from '../../shared/mode-records';
import { formatRunHistoryDate, MODE_RECORDS_COPY, RUN_HISTORY_COPY } from '../copy/runHistory';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
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
    const { copy: copyToClipboard, state: copyState } = useCopyToClipboard();
    /*
     * Only offered once there is a daily record to post. On a profile that has never run one, the
     * line would read "streak 0" and the button would be an invitation to share nothing.
     */
    const canShareDaily = dailyArchive.dailiesCompleted > 0 || dailyArchive.streak > 0;
    const copyDailyLabel =
        copyState === 'copied'
            ? PROFILE_PROGRESS_COPY.copyDailyDone
            : copyState === 'failed'
              ? PROFILE_PROGRESS_COPY.copyDailyFailed
              : PROFILE_PROGRESS_COPY.copyDaily;
    const progressRows = getLocalProgressRegistryRows(saveData);
    const runHistory = normalizeRunHistory(saveData.runHistory);
    /*
     * Which recorded run is the best one, by score. Read off the history rather than compared to
     * `saveData.bestScore`: a record set before the history existed, or one older than the twenty
     * kept, would mark nothing here and leave the player looking for a row that is not there.
     */
    const bestRecordedScore = runHistory.reduce((best, entry) => Math.max(best, entry.totalScore), 0);
    const modeRecords = getModeRecords(runHistory);
    // One copy state per screen would make every row read "Copied" at once, so each row owns which
    // one of them was pressed.
    const [copiedRunKey, setCopiedRunKey] = useState<string | null>(null);

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

            <section aria-label={MODE_RECORDS_COPY.label} className={styles.history} data-testid="profile-mode-records">
                <h2 className={styles.historyHeading}>{MODE_RECORDS_COPY.label}</h2>
                {modeRecords.length === 0 ? (
                    <p className={styles.historyEmpty}>{MODE_RECORDS_COPY.empty}</p>
                ) : (
                    <ul className={styles.historyList}>
                        {modeRecords.map((record) => (
                            <li className={styles.recordRow} key={record.mode}>
                                <strong className={styles.historyMode}>{record.mode}</strong>
                                <span className={styles.historyResult}>
                                    {MODE_RECORDS_COPY.result(record.totalScore, record.highestLevel)}
                                </span>
                                <span className={styles.historyDate}>{MODE_RECORDS_COPY.runs(record.runs)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-label={RUN_HISTORY_COPY.label} className={styles.history} data-testid="profile-run-history">
                <h2 className={styles.historyHeading}>{RUN_HISTORY_COPY.label}</h2>
                {runHistory.length === 0 ? (
                    <p className={styles.historyEmpty}>{RUN_HISTORY_COPY.empty}</p>
                ) : (
                    <ol className={styles.historyList}>
                        {runHistory.map((record) => (
                            <li className={styles.historyRow} key={`${record.endedAtIso}:${record.mode}`}>
                                <strong className={styles.historyMode}>
                                    {record.mode}
                                    {bestRecordedScore > 0 && record.totalScore === bestRecordedScore ? (
                                        <span
                                            aria-label={RUN_HISTORY_COPY.bestAriaLabel}
                                            className={styles.historyBest}
                                            data-testid="profile-run-history-best"
                                            role="img"
                                        >
                                            {RUN_HISTORY_COPY.best}
                                        </span>
                                    ) : null}
                                </strong>
                                <span className={styles.historyResult}>{RUN_HISTORY_COPY.result(record)}</span>
                                <span className={styles.historyDate}>{formatRunHistoryDate(record.endedAtIso)}</span>
                                {record.shareKey === null ? null : (
                                    <UiButton
                                        aria-label={RUN_HISTORY_COPY.copyAriaLabel(record)}
                                        data-testid="profile-run-history-copy"
                                        onClick={() => {
                                            resumeUiSfxContext();
                                            playUiClickSfx(uiGain);
                                            setCopiedRunKey(record.shareKey);
                                            copyToClipboard(record.shareKey ?? '');
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="secondary"
                                    >
                                        {copiedRunKey === record.shareKey && copyState === 'copied'
                                            ? RUN_HISTORY_COPY.copyDone
                                            : copiedRunKey === record.shareKey && copyState === 'failed'
                                              ? RUN_HISTORY_COPY.copyFailed
                                              : RUN_HISTORY_COPY.copy}
                                    </UiButton>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            <div className={styles.footer}>
                {canShareDaily ? (
                    <UiButton
                        aria-label={PROFILE_PROGRESS_COPY.copyDailyAriaLabel}
                        data-copy-state={copyState}
                        data-testid="profile-copy-daily"
                        onClick={() => {
                            resumeUiSfxContext();
                            playUiClickSfx(uiGain);
                            copyToClipboard(buildDailyArchiveShareString(saveData));
                        }}
                        size="md"
                        type="button"
                        variant="secondary"
                    >
                        {copyDailyLabel}
                    </UiButton>
                ) : null}
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
