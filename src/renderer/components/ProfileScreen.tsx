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
import type { RunHistoryRecord } from '../../shared/contracts';
import { normalizeRunHistory } from '../../shared/run-history-log';
import { getModeRecords, type ModeRecord } from '../../shared/mode-records';
import {
    formatRunHistoryDate,
    MODE_RECORDS_COPY,
    PROFILE_LEDGER_COPY,
    PROFILE_LEDGER_VIEWS,
    RUN_HISTORY_COPY,
    type ProfileLedgerView
} from '../copy/runHistory';
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
 * The ledger below the tier rail is one paged region with three tabs — what the player is
 * part-way through, their recent runs, and their record in each mode. Three stacked lists could
 * not fit: with a full run history, thirteen rows sat past the bottom edge with nothing able to
 * scroll them into view. It is also the first screen to show the daily archive and the quest
 * campaign at all — both were tracked in the save with nothing rendering them, so a player's
 * daily streak existed only in a file.
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
    const [ledgerView, setLedgerView] = useState<ProfileLedgerView>('progress');

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

            <section aria-label={PROFILE_LEDGER_COPY.label} className={styles.ledger} data-testid="profile-ledger">
                <div className={styles.ledgerHeader}>
                    <h2 className={styles.ledgerHeading}>{PROFILE_LEDGER_COPY.label}</h2>
                    <div aria-label={PROFILE_LEDGER_COPY.tabAriaLabel} className={styles.ledgerTabs} role="tablist">
                        {PROFILE_LEDGER_VIEWS.map((view) => (
                            <button
                                aria-selected={ledgerView === view}
                                className={styles.ledgerTab}
                                data-selected={ledgerView === view}
                                data-testid={`profile-ledger-${view}`}
                                key={view}
                                onClick={() => {
                                    resumeUiSfxContext();
                                    playUiClickSfx(uiGain);
                                    setLedgerView(view);
                                }}
                                role="tab"
                                type="button"
                            >
                                {PROFILE_LEDGER_COPY.tab[view]}
                            </button>
                        ))}
                    </div>
                </div>
                {ledgerView === 'progress' ? (
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
                        resetKey="progress"
                        rowHeight={104}
                        testId="profile-progress-grid"
                    />
                ) : ledgerView === 'records' ? (
                    <FittedGrid
                        ariaLabel={MODE_RECORDS_COPY.label}
                        emptyState={MODE_RECORDS_COPY.empty}
                        items={modeRecords}
                        itemNoun="records"
                        keyForItem={(record) => record.mode}
                        minColumnWidth={240}
                        renderItem={(record: ModeRecord) => (
                            <article className={styles.ledgerCard}>
                                <strong className={styles.historyMode}>{record.mode}</strong>
                                <span className={styles.historyResult}>
                                    {MODE_RECORDS_COPY.result(record.totalScore, record.highestLevel)}
                                </span>
                                {MODE_RECORDS_COPY.chain(record.bestChain, record.biggestChunk) ? (
                                    <span className={styles.historyResult} data-testid="profile-mode-record-chain">
                                        {MODE_RECORDS_COPY.chain(record.bestChain, record.biggestChunk)}
                                    </span>
                                ) : null}
                                <span className={styles.historyDate}>{MODE_RECORDS_COPY.runs(record.runs)}</span>
                            </article>
                        )}
                        resetKey="records"
                        rowHeight={92}
                        testId="profile-mode-records"
                    />
                ) : (
                    <FittedGrid
                        ariaLabel={RUN_HISTORY_COPY.label}
                        emptyState={RUN_HISTORY_COPY.empty}
                        items={runHistory}
                        itemNoun="runs"
                        keyForItem={(record) => `${record.endedAtIso}:${record.mode}`}
                        minColumnWidth={240}
                        renderItem={(record: RunHistoryRecord) => (
                            <article className={styles.ledgerCard}>
                                {/*
                                 * The badge sits beside the name rather than inside it: the name
                                 * ellipsises a long mode away, and a box that clips its overflow
                                 * was cutting the badge off at the narrowest width.
                                 */}
                                <div className={styles.ledgerCardTop}>
                                    <strong className={styles.historyMode}>{record.mode}</strong>
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
                                </div>
                                <span className={styles.historyResult}>{RUN_HISTORY_COPY.result(record)}</span>
                                <div className={styles.ledgerCardFoot}>
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
                                </div>
                            </article>
                        )}
                        resetKey="runs"
                        rowHeight={92}
                        testId="profile-run-history"
                    />
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
