import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ACHIEVEMENT_BY_ID } from '../../shared/achievements';
import type { RelicId } from '../../shared/contracts';
import {
    COSMETIC_CATALOG,
    cosmeticUnlockTag,
    getOwnedCosmeticIds,
    getEquippedCosmeticId
} from '../../shared/cosmetics';
import {
    eligibleHonorUnlockIds,
    HONOR_UNLOCK_CATALOG,
    HONOR_UNLOCK_ORDER
} from '../../shared/honorUnlocks';
import { RELIC_CATALOG } from '../../shared/game-catalog';
import { getCollectionGalleryRows } from '../../shared/collection-reward-gallery';
import { getDailyArchiveRows } from '../../shared/daily-archive';
import {
    getMetaCosmeticTrackRows,
    getMetaProgressionBoard,
    getMetaProgressionFeedback,
    getPermanentUpgradeRows
} from '../../shared/meta-progression';
import { getCollectionRewardSignals, getMetaProgressionRunImpactRows } from '../../shared/meta-reward-signals';
import { ACHIEVEMENT_IDS } from '../../shared/save-data';
import {
    CALLSIGN_SYMBOLS,
    LETTER_SYMBOLS as LETTER_TILES,
    NUMBER_SYMBOLS,
    SYMBOL_BAND_READABILITY_PROFILES
} from '../../shared/tile-symbol-catalog';
import { playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import {
    formatRunPayoffLaneMapAttr,
    formatRunPayoffLaneActionMapAttr,
    formatRunPayoffLaneMapLabel,
    formatRunPayoffLaneRoleMapAttr,
    formatRunPayoffLaneRoleIdMapAttr,
    formatRunPayoffBurstSignalLabel,
    formatRunPayoffCrescendoSignalLabel,
    formatRunPayoffSequenceSignalLabel,
    formatRunPayoffSignalsLabel,
    getRunPayoffLaneAudioCue,
    getRunPayoffLaneBeatCount,
    getRunPayoffLaneMap,
    getRunPayoffLaneRole,
    getRunPayoffLaneRoleId,
    getRunPayoffLaneScreenCue,
    getRunPayoffBurstSignal,
    getRunPayoffCrescendoSignal,
    getRunPayoffSequenceSignal,
    getRunPayoffSignalBeatCount,
    getRunPayoffSignals
} from '../copy/runPayoffSignals';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import metaStyles from './MetaScreen.module.css';
import { handleMetaBodyTocLinkClick } from './metaScreenTocNav';
import styles from './CollectionScreen.module.css';

const formatProgressionImpactLabel = (
    label: string,
    rows: readonly { boardMoment: string; impact: string; lane: string; nextAction: string; title: string }[]
): string => {
    const rowCopy = rows
        .map((row) => `${row.lane}: ${row.impact}. Moment: ${row.boardMoment}. Next: ${row.nextAction}. ${row.title}`)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const formatRewardSignalLabel = (
    label: string,
    rows: readonly { body?: string; cta?: string; status?: string; title: string; total?: number; owned?: number; nextAction?: string }[]
): string => {
    const rowCopy = rows
        .map((row) => {
            const progress = row.owned != null && row.total != null ? ` ${row.owned}/${row.total}.` : '';
            const status = row.status ? ` ${row.status.replace('_', ' ')}.` : '';
            const body = row.body ? ` ${row.body}` : '';
            const cta = row.cta ? ` Next: ${row.cta}.` : '';
            const nextAction = row.nextAction ? ` Next: ${row.nextAction}.` : '';
            return `${row.title}.${status}${progress}${body}${cta}${nextAction}`;
        })
        .join(' ');
    return rowCopy ? `${label}. ${rowCopy}` : label;
};

const CollectionScreen = () => {
    const bodyScrollRef = useRef<HTMLDivElement | null>(null);
    const { closeSubscreen, saveData, settings } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            saveData: state.saveData,
            settings: state.settings
        }))
    );
    const ps = saveData.playerStats;
    const summary = saveData.lastRunSummary;
    const honorEarned = new Set(eligibleHonorUnlockIds(saveData));
    const metaProgressionBoard = getMetaProgressionBoard(saveData);
    const metaProgressionFeedback = getMetaProgressionFeedback(saveData);
    const rewardSignals = getCollectionRewardSignals(saveData);
    const progressionImpactRows = getMetaProgressionRunImpactRows(saveData);
    const progressionImpactLabel = formatProgressionImpactLabel('Collection progression impact signals', progressionImpactRows);
    const rewardGalleryRows = getCollectionGalleryRows(saveData);
    const rewardSignalsLabel = formatRewardSignalLabel('Collection reward signals', rewardSignals);
    const rewardGalleryLabel = formatRewardSignalLabel('Collection reward gallery', rewardGalleryRows);
    const lastRunPayoffRows = summary ? getRunPayoffSignals(summary, { includeChainTarget: true }).slice(0, 4) : [];
    const lastRunPayoffRowsLabel = formatRunPayoffSignalsLabel('Collection last run payoff signals', lastRunPayoffRows);
    const lastRunPayoffLaneMap = getRunPayoffLaneMap(lastRunPayoffRows);
    const primaryLastRunPayoffLane = lastRunPayoffLaneMap[0] ?? null;
    const lastRunPayoffLaneMapAttr = formatRunPayoffLaneMapAttr(lastRunPayoffLaneMap);
    const lastRunPayoffLaneActionMapAttr = formatRunPayoffLaneActionMapAttr(lastRunPayoffLaneMap);
    const lastRunPayoffLaneRoleMapAttr = formatRunPayoffLaneRoleMapAttr(lastRunPayoffLaneMap);
    const lastRunPayoffLaneRoleIdMapAttr = formatRunPayoffLaneRoleIdMapAttr(lastRunPayoffLaneMap);
    const lastRunPayoffLaneMapLabel = formatRunPayoffLaneMapLabel('Collection last run payoff lanes', lastRunPayoffLaneMap);
    const lastRunPayoffBurst = getRunPayoffBurstSignal(lastRunPayoffRows);
    const lastRunPayoffBurstLabel = formatRunPayoffBurstSignalLabel('Collection last run payoff burst', lastRunPayoffBurst);
    const lastRunPayoffCrescendo = getRunPayoffCrescendoSignal(lastRunPayoffRows, lastRunPayoffBurst);
    const lastRunPayoffCrescendoLabel = formatRunPayoffCrescendoSignalLabel(
        'Collection last run payoff crescendo',
        lastRunPayoffCrescendo
    );
    const lastRunPayoffSequence = getRunPayoffSequenceSignal(lastRunPayoffRows);
    const lastRunPayoffSequenceLabel = formatRunPayoffSequenceSignalLabel(
        'Collection last run payoff sequence',
        lastRunPayoffSequence
    );
    const permanentUpgradeRows = getPermanentUpgradeRows(saveData);
    const cosmeticTrackRows = getMetaCosmeticTrackRows(saveData);
    const dailyArchiveRows = getDailyArchiveRows(saveData);
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const handleBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
        closeSubscreen();
    };

    return (
        <section aria-label="Collection" className={`${metaStyles.shell} ${metaStyles.shellMetaStage}`} role="region">
            <header className={metaStyles.header}>
                <div className={metaStyles.headerText}>
                    <Eyebrow tone="menu">Archive</Eyebrow>
                    <ScreenTitle as="h1" role="display">
                        Collection
                    </ScreenTitle>
                    <p className={metaStyles.subtitle}>
                        Read-only progress from your save: achievements, relic picks, bests, dailies, and the symbol sets
                        used on the board.
                    </p>
                </div>
                <UiButton size="md" variant="secondary" onClick={handleBack} type="button">
                    Back
                </UiButton>
            </header>

            <div ref={bodyScrollRef} className={metaStyles.body} data-testid="meta-screen-body">
                <nav aria-label="Collection sections" className={metaStyles.inPageToc}>
                    <a href="#collection-achievements" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Achievements
                    </a>
                    <a href="#collection-honors" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Honors
                    </a>
                    <a href="#collection-cosmetics" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Cosmetics
                    </a>
                    <a href="#collection-gallery" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Gallery
                    </a>
                    <a href="#collection-meta-upgrades" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Meta upgrades
                    </a>
                    <a href="#collection-relics" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Relics
                    </a>
                    <a href="#collection-bests" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Bests
                    </a>
                    <a href="#collection-daily" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Daily
                    </a>
                    <a href="#collection-symbols" onClick={(e) => handleMetaBodyTocLinkClick(bodyScrollRef, e)}>
                        Symbols
                    </a>
                </nav>
                <MetaFrame data-testid="collection-meta-frame-achievements">
                    <Panel padding="lg" variant="strong">
                        <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-achievements">
                            <h2 className={styles.sectionTitle}>Achievements</h2>
                            <div className={`${styles.grid} ${metaStyles.metaLongList}`}>
                                {ACHIEVEMENT_IDS.map((id) => {
                                    const def = ACHIEVEMENT_BY_ID[id];
                                    const unlocked = saveData.achievements[id];
                                    return (
                                        <div
                                            className={`${styles.achievementCard} ${unlocked ? styles.achievementUnlocked : styles.achievementLocked}`}
                                            key={id}
                                        >
                                            <strong>{def.title}</strong>
                                            <p className={metaStyles.subtitle}>{def.description}</p>
                                            <span className={styles.symbolMeta}>{unlocked ? 'Unlocked' : 'Locked'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="collection-meta-frame-honors">
                    <Panel padding="lg" variant="default">
                        <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-honors">
                            <h2 className={styles.sectionTitle}>Honors</h2>
                            <p className={metaStyles.subtitle}>
                                Local archive titles — no Steam slot required. Earned from dailies, no-powers floors,
                                score, relic picks, and gauntlet clears.
                            </p>
                            <div className={`${styles.grid} ${metaStyles.metaLongList}`}>
                                {HONOR_UNLOCK_ORDER.map((id) => {
                                    const def = HONOR_UNLOCK_CATALOG[id];
                                    const unlocked = honorEarned.has(id);
                                    return (
                                        <div
                                            className={`${styles.achievementCard} ${unlocked ? styles.achievementUnlocked : styles.achievementLocked}`}
                                            key={id}
                                        >
                                            <strong>{def.title}</strong>
                                            <p className={metaStyles.subtitle}>{def.description}</p>
                                            <span className={styles.symbolMeta}>{unlocked ? 'Earned' : 'Locked'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="collection-meta-frame-reward-signals">
                    <Panel padding="lg" variant="default">
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Reward signals</h2>
                            <p className={metaStyles.subtitle}>
                                Runs feed durable local progress: next goal, recent reward, and missing discovery are shown here.
                            </p>
                            <div
                                aria-label={rewardSignalsLabel}
                                className={metaStyles.archiveCatalogGrid}
                                data-testid="collection-reward-signals"
                            >
                                {rewardSignals.map((signal) => (
                                    <div
                                        aria-label={`${signal.title}. ${signal.body} Next: ${signal.cta}.`}
                                        className={metaStyles.archiveCatalogRow}
                                        key={signal.id}
                                    >
                                        <p className={metaStyles.archiveCatalogRowTitle}>{signal.title}</p>
                                        <p className={metaStyles.subtitle}>{signal.body}</p>
                                        <span className={styles.symbolMeta}>{signal.cta}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="collection-meta-frame-reward-gallery">
                    <Panel padding="lg" variant="default">
                        <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-reward-gallery">
                            <h2 className={styles.sectionTitle}>Reward gallery</h2>
                            <p className={metaStyles.subtitle}>
                                Final hub gallery rows show owned, in-progress, and missing rewards from the local save.
                            </p>
                            <div
                                aria-label={rewardGalleryLabel}
                                className={`${styles.galleryGrid} ${metaStyles.metaLongList}`}
                                data-testid="collection-reward-gallery"
                            >
                                {rewardGalleryRows.map((row) => {
                                    return (
                                    <div
                                        aria-label={`${row.title}. ${row.status.replace('_', ' ')}. ${row.owned}/${row.total}. Impact: ${row.gameplayImpact}. Next: ${row.nextAction}.`}
                                        className={styles.galleryCard}
                                        data-status={row.status}
                                        data-gallery-impact={row.id}
                                        key={row.id}
                                    >
                                        <span className={styles.galleryBadge}>{row.status.replace('_', ' ')}</span>
                                        <strong>{row.title}</strong>
                                        <p className={metaStyles.subtitle}>{row.description}</p>
                                        <span className={styles.galleryImpactCue}>
                                            <small>Impact</small>
                                            <b>{row.gameplayImpact}</b>
                                        </span>
                                        <span className={styles.symbolMeta}>{row.owned}/{row.total}</span>
                                        <span className={styles.symbolMeta}>{row.nextAction}</span>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="collection-meta-frame-cosmetics">
                    <Panel padding="lg" variant="default">
                        <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-cosmetics">
                            <h2 className={styles.sectionTitle}>Cosmetics</h2>
                            <p className={metaStyles.subtitle}>
                                Cosmetic slots are visual-only. Owned/equipped state uses local unlock tags; no gameplay power is attached.
                            </p>
                            <div className={`${styles.grid} ${metaStyles.metaLongList}`}>
                                {(Object.values(COSMETIC_CATALOG)).map((cosmetic) => {
                                    const owned = getOwnedCosmeticIds(saveData).includes(cosmetic.id);
                                    const equipped = getEquippedCosmeticId(saveData, cosmetic.slot) === cosmetic.id;
                                    return (
                                        <div
                                            className={`${styles.achievementCard} ${owned ? styles.achievementUnlocked : styles.achievementLocked}`}
                                            key={cosmetic.id}
                                        >
                                            <strong>{cosmetic.title ?? cosmetic.label}</strong>
                                            <p className={metaStyles.subtitle}>{cosmetic.description}</p>
                                            <span className={styles.symbolMeta}>
                                                {equipped ? 'Equipped' : owned ? 'Owned' : `Locked · ${cosmetic.unlockHint ?? cosmetic.unlockSource}`}
                                            </span>
                                            <span className={styles.symbolMeta}>{cosmeticUnlockTag(cosmetic.id)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="collection-meta-frame-meta-upgrades">
                    <Panel padding="lg" variant="default">
                        <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-meta-upgrades">
                            <h2 className={styles.sectionTitle}>Permanent upgrades and cosmetic track</h2>
                            <p className={metaStyles.subtitle}>
                                Permanent rows are local save milestones only. Gameplay-affecting upgrades are capped and earned from play; cosmetic track rows stay visual-only.
                            </p>
                            <div className={metaStyles.archiveCatalogGrid} data-testid="collection-meta-progression-board">
                                <div className={metaStyles.archiveCatalogRow}>
                                    <p className={metaStyles.archiveCatalogRowTitle}>Profile level {metaProgressionBoard.level}</p>
                                    <span>
                                        {metaProgressionFeedback.difficultyTierLabel} - {metaProgressionFeedback.honorMarksToNextLevel} honor mark
                                        {metaProgressionFeedback.honorMarksToNextLevel === 1 ? '' : 's'} to next profile level
                                    </span>
                                </div>
                                <div className={metaStyles.archiveCatalogRow}>
                                    <p className={metaStyles.archiveCatalogRowTitle}>Next reward</p>
                                    <span>{metaProgressionBoard.nextReward ? `${metaProgressionBoard.nextReward.title} · ${metaProgressionBoard.nextReward.source}` : 'All visible rewards owned'}</span>
                                </div>
                                <div className={metaStyles.archiveCatalogRow}>
                                    <p className={metaStyles.archiveCatalogRowTitle}>Progression focus</p>
                                    <span>{metaProgressionFeedback.motivationCopy}</span>
                                </div>
                                <div className={metaStyles.archiveCatalogRow}>
                                    <p className={metaStyles.archiveCatalogRowTitle}>Next tier milestone</p>
                                    <span>{metaProgressionFeedback.nextMilestoneCopy}</span>
                                </div>
                                <div className={metaStyles.archiveCatalogRow}>
                                    <p className={metaStyles.archiveCatalogRowTitle}>Long-term goal</p>
                                    <span>{metaProgressionBoard.longTermGoal ? `${metaProgressionBoard.longTermGoal.title} · ${metaProgressionBoard.longTermGoal.gate}` : 'No open local goals'}</span>
                                </div>
                            </div>
                            <div
                                aria-label={progressionImpactLabel}
                                className={styles.progressionImpactGrid}
                                data-testid="collection-progression-impact-grid"
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
                            <div className={`${styles.grid} ${metaStyles.metaLongList}`}>
                                {permanentUpgradeRows.map((row) => (
                                    <div
                                        className={`${styles.achievementCard} ${row.status === 'owned' ? styles.achievementUnlocked : styles.achievementLocked}`}
                                        key={row.id}
                                    >
                                        <strong>{row.title}</strong>
                                        <p className={metaStyles.subtitle}>{row.description}</p>
                                        <span className={styles.symbolMeta}>{row.status} · {row.progress.current}/{row.progress.target}</span>
                                        <span className={styles.symbolMeta}>Source: {row.source}</span>
                                        <span className={styles.symbolMeta}>Mode rule: {row.modeRule}</span>
                                        <span className={styles.symbolMeta}>{row.gate}</span>
                                    </div>
                                ))}
                                {cosmeticTrackRows.map((row) => (
                                    <div
                                        className={`${styles.achievementCard} ${row.status === 'owned' ? styles.cosmeticOwned : styles.cosmeticLocked}`}
                                        key={row.id}
                                    >
                                        <strong>{row.title}</strong>
                                        <p className={metaStyles.subtitle}>{row.description}</p>
                                        <span className={styles.symbolMeta}>
                                            {row.reward} · {row.progress.current}/{row.progress.target}
                                        </span>
                                        <span className={styles.symbolMeta}>Source: {row.source}</span>
                                        <span className={styles.symbolMeta}>Visual only: {row.gameplayAffecting ? 'No' : 'Yes'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <MetaFrame data-testid="collection-meta-frame-relics">
                    <Panel padding="lg" variant="default">
                        <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-relics">
                            <h2 className={styles.sectionTitle}>Relic catalog</h2>
                            <p className={metaStyles.subtitle}>
                                Tier tint reflects how often each relic has been picked across runs (cosmetic only).
                            </p>
                            <div className={`${styles.grid} ${metaStyles.metaLongList}`}>
                                {(Object.keys(RELIC_CATALOG) as RelicId[]).map((id) => {
                                    const def = RELIC_CATALOG[id];
                                    const picks = ps?.relicPickCounts[id] ?? 0;
                                    const tierClass =
                                        picks >= 3 ? styles.relicTierForged : picks >= 1 ? styles.relicTierKnown : styles.relicTierLatent;
                                    return (
                                        <div className={`${styles.achievementCard} ${tierClass}`} key={id}>
                                            <strong>{def.title}</strong>
                                            <p className={metaStyles.subtitle}>{def.description}</p>
                                            <span className={styles.symbolMeta}>Times picked: {picks}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Panel>
                </MetaFrame>

                <Panel padding="lg" variant="default">
                    <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-bests">
                        <h2 className={styles.sectionTitle}>Bests and last run</h2>
                        <div className={styles.statRow}>
                            <span>
                                Best score<strong>{saveData.bestScore > 0 ? saveData.bestScore.toLocaleString() : '—'}</strong>
                            </span>
                            <span>
                                Best no-powers floor<strong>{ps?.bestFloorNoPowers ?? 0}</strong>
                            </span>
                        </div>
                        {summary ? (
                            <>
                            <p className={metaStyles.subtitle}>
                                Last run: {summary.totalScore.toLocaleString()} pts · Floor {summary.highestLevel} ·{' '}
                                {summary.levelsCleared} clears · Streak {summary.bestStreak}
                            </p>
                            <div
                                aria-label={lastRunPayoffRowsLabel}
                                className={styles.runPayoffStrip}
                                data-run-payoff-lane-actions={lastRunPayoffLaneActionMapAttr}
                                data-run-payoff-lane-map={lastRunPayoffLaneMapAttr}
                                data-run-payoff-lane-role-ids={lastRunPayoffLaneRoleIdMapAttr}
                                data-run-payoff-lane-roles={lastRunPayoffLaneRoleMapAttr}
                                data-testid="collection-last-run-payoff-signals"
                            >
                                {lastRunPayoffLaneMap.length > 1 ? (
                                    <span
                                        aria-label={lastRunPayoffLaneMapLabel}
                                        data-run-payoff-lane-actions={lastRunPayoffLaneActionMapAttr}
                                        data-run-payoff-lane-map={lastRunPayoffLaneMapAttr}
                                        data-run-payoff-lane-role-ids={lastRunPayoffLaneRoleIdMapAttr}
                                        data-run-payoff-lane-roles={lastRunPayoffLaneRoleMapAttr}
                                        data-run-payoff-primary-lane={primaryLastRunPayoffLane?.id ?? 'none'}
                                        data-run-payoff-primary-lane-action={primaryLastRunPayoffLane?.action ?? 'none'}
                                        data-run-payoff-primary-lane-audio={
                                            primaryLastRunPayoffLane ? getRunPayoffLaneAudioCue(primaryLastRunPayoffLane) : 'none'
                                        }
                                        data-run-payoff-primary-lane-beats={
                                            primaryLastRunPayoffLane ? getRunPayoffLaneBeatCount(primaryLastRunPayoffLane) : 0
                                        }
                                        data-run-payoff-primary-lane-cue={primaryLastRunPayoffLane?.cue ?? 'none'}
                                        data-run-payoff-primary-lane-role={
                                            primaryLastRunPayoffLane ? getRunPayoffLaneRole(primaryLastRunPayoffLane) : 'none'
                                        }
                                        data-run-payoff-primary-lane-role-id={
                                            primaryLastRunPayoffLane ? getRunPayoffLaneRoleId(primaryLastRunPayoffLane) : 'none'
                                        }
                                        data-run-payoff-primary-lane-screen-cue={
                                            primaryLastRunPayoffLane ? getRunPayoffLaneScreenCue(primaryLastRunPayoffLane) : 'none'
                                        }
                                        data-testid="collection-last-run-payoff-lane-map"
                                    >
                                        <i
                                            className={styles.runPayoffLaneMapSummary}
                                            data-run-payoff-lane-count={lastRunPayoffLaneMap.length}
                                            data-testid="collection-last-run-payoff-lane-map-summary"
                                        >
                                            <small>Archive lanes</small>
                                            <strong>
                                                {lastRunPayoffLaneMap.length}{' '}
                                                {lastRunPayoffLaneMap.length === 1 ? 'lane' : 'lanes'}
                                            </strong>
                                            <b>
                                                {primaryLastRunPayoffLane
                                                    ? `${getRunPayoffLaneRole(primaryLastRunPayoffLane)} ${primaryLastRunPayoffLane.label}`
                                                    : 'No lead lane'}
                                            </b>
                                            <span aria-hidden="true" className={styles.runPayoffLaneMapSummaryBeatPips}>
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, lastRunPayoffLaneMap.length + 1)) },
                                                    (_, index) => (
                                                        <s
                                                            data-run-payoff-lane-map-summary-beat={index + 1}
                                                            data-run-payoff-lane-map-summary-beat-focus={
                                                                index === 0 ? primaryLastRunPayoffLane?.id ?? 'none' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </i>
                                        {primaryLastRunPayoffLane ? (
                                            <i
                                                aria-label={`Primary archived payoff lane. ${getRunPayoffLaneRole(primaryLastRunPayoffLane)} ${primaryLastRunPayoffLane.label}: ${primaryLastRunPayoffLane.action}. ${primaryLastRunPayoffLane.cue}. ${getRunPayoffLaneBeatCount(primaryLastRunPayoffLane)} beats.`}
                                                className={styles.runPayoffPrimaryLaneCue}
                                                data-run-payoff-primary-lane={primaryLastRunPayoffLane.id}
                                                data-run-payoff-primary-lane-action={primaryLastRunPayoffLane.action}
                                                data-run-payoff-primary-lane-audio={getRunPayoffLaneAudioCue(primaryLastRunPayoffLane)}
                                                data-run-payoff-primary-lane-beats={getRunPayoffLaneBeatCount(primaryLastRunPayoffLane)}
                                                data-run-payoff-primary-lane-cue={primaryLastRunPayoffLane.cue}
                                                data-run-payoff-primary-lane-role={getRunPayoffLaneRole(primaryLastRunPayoffLane)}
                                                data-run-payoff-primary-lane-role-id={getRunPayoffLaneRoleId(primaryLastRunPayoffLane)}
                                                data-run-payoff-primary-lane-screen-cue={getRunPayoffLaneScreenCue(primaryLastRunPayoffLane)}
                                                data-testid="collection-last-run-primary-payoff-lane"
                                            >
                                                <small>Archive chase</small>
                                                <strong>{getRunPayoffLaneRole(primaryLastRunPayoffLane)}</strong>
                                                <b>{primaryLastRunPayoffLane.action}</b>
                                                <em>{primaryLastRunPayoffLane.cue}</em>
                                                <span aria-hidden="true" className={styles.runPayoffPrimaryLaneBeatPips}>
                                                    {Array.from(
                                                        { length: getRunPayoffLaneBeatCount(primaryLastRunPayoffLane) },
                                                        (_, index) => (
                                                            <s
                                                                data-run-payoff-primary-lane-beat={index + 1}
                                                                data-run-payoff-primary-lane-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={index}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </i>
                                        ) : null}
                                        {lastRunPayoffLaneMap.map((lane) => (
                                            <i
                                                data-run-payoff-lane={lane.id}
                                                data-run-payoff-lane-action={lane.action}
                                                data-run-payoff-lane-audio={getRunPayoffLaneAudioCue(lane)}
                                                data-run-payoff-lane-beats={getRunPayoffLaneBeatCount(lane)}
                                                data-run-payoff-lane-count={lane.count}
                                                data-run-payoff-lane-role={getRunPayoffLaneRole(lane)}
                                                data-run-payoff-lane-role-id={getRunPayoffLaneRoleId(lane)}
                                                data-run-payoff-lane-screen-cue={getRunPayoffLaneScreenCue(lane)}
                                                key={lane.id}
                                            >
                                                <small>{lane.label}</small>
                                                <strong>{getRunPayoffLaneRole(lane)}</strong>
                                                <b>{lane.action}</b>
                                                <em>
                                                    x{lane.count} / {lane.cue}
                                                </em>
                                                <span aria-hidden="true" className={styles.runPayoffLaneBeatPips}>
                                                    {Array.from({ length: getRunPayoffLaneBeatCount(lane) }, (_, index) => (
                                                        <s
                                                            data-run-payoff-lane-beat={index + 1}
                                                            data-run-payoff-lane-beat-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                            </i>
                                        ))}
                                    </span>
                                ) : null}
                                {lastRunPayoffBurst ? (
                                    <span
                                        aria-label={lastRunPayoffBurstLabel}
                                        data-run-payoff-burst-action={lastRunPayoffBurst.action}
                                        data-run-payoff-burst-tone={lastRunPayoffBurst.tone}
                                        data-testid="collection-last-run-payoff-burst"
                                    >
                                        <small>{lastRunPayoffBurst.label}</small>
                                        <b>{lastRunPayoffBurst.action}</b>
                                        <strong>{lastRunPayoffBurst.value}</strong>
                                    </span>
                                ) : null}
                                {lastRunPayoffCrescendo ? (
                                    <span
                                        aria-label={lastRunPayoffCrescendoLabel}
                                        data-run-payoff-crescendo-audio={lastRunPayoffCrescendo.audioCue}
                                        data-run-payoff-crescendo-beats={lastRunPayoffCrescendo.beatCount}
                                        data-run-payoff-crescendo-cue={lastRunPayoffCrescendo.screenCue}
                                        data-run-payoff-crescendo-screen-cue={lastRunPayoffCrescendo.screenCue}
                                        data-run-payoff-crescendo-tier={lastRunPayoffCrescendo.tier}
                                        data-testid="collection-last-run-payoff-crescendo"
                                    >
                                        <small>{lastRunPayoffCrescendo.label}</small>
                                        <b>{lastRunPayoffCrescendo.detail}</b>
                                        <strong>
                                            {Array.from({ length: lastRunPayoffCrescendo.beatCount }, (_, index) => (
                                                <i
                                                    aria-hidden="true"
                                                    data-run-payoff-crescendo-beat={index + 1}
                                                    data-run-payoff-crescendo-beat-focus={
                                                        index === 0 ? 'primary' : 'support'
                                                    }
                                                    key={index}
                                                />
                                            ))}
                                        </strong>
                                    </span>
                                ) : null}
                                {lastRunPayoffSequence ? (
                                    <span
                                        aria-label={lastRunPayoffSequenceLabel}
                                        data-run-payoff-sequence-first={lastRunPayoffSequence.first}
                                        data-run-payoff-sequence-keep={lastRunPayoffSequence.keep}
                                        data-run-payoff-sequence-then={lastRunPayoffSequence.then}
                                        data-run-payoff-sequence-tone={lastRunPayoffSequence.tone}
                                        data-testid="collection-last-run-payoff-sequence"
                                    >
                                        <small>First</small>
                                        <strong>{lastRunPayoffSequence.first}</strong>
                                        <small>Then</small>
                                        <strong>{lastRunPayoffSequence.then}</strong>
                                        <small>Keep</small>
                                        <strong>{lastRunPayoffSequence.keep}</strong>
                                    </span>
                                ) : null}
                                {lastRunPayoffRows.map((row) => (
                                    <span
                                        data-run-payoff-action={row.action}
                                        data-run-payoff-audio={row.audioCue}
                                        data-run-payoff-beats={getRunPayoffSignalBeatCount(row)}
                                        data-run-payoff-screen-cue={row.screenCue}
                                        data-run-payoff-tone={row.tone}
                                        key={row.id}
                                    >
                                        <b>{row.arcadeCue}</b>
                                        <small>{row.label}</small>
                                        <strong>{row.value}</strong>
                                        <i>{row.action}</i>
                                        <span aria-hidden="true" className={styles.runPayoffBeatPips}>
                                            {Array.from({ length: getRunPayoffSignalBeatCount(row) }, (_, index) => (
                                                <i
                                                    data-run-payoff-beat={index + 1}
                                                    data-run-payoff-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                        {row.nextCue ? <em>{row.nextCue}</em> : null}
                                    </span>
                                ))}
                            </div>
                            </>
                        ) : (
                            <p className={metaStyles.subtitle}>No completed run summary stored yet.</p>
                        )}
                    </div>
                </Panel>

                <Panel padding="lg" variant="default">
                    <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-daily">
                        <h2 className={styles.sectionTitle}>Daily stats</h2>
                        <div className={styles.statRow}>
                            <span>
                                Dailies cleared<strong>{ps?.dailiesCompleted ?? 0}</strong>
                            </span>
                            <span>
                                Streak (cosmetic)<strong>{ps?.dailyStreakCosmetic ?? 0}</strong>
                            </span>
                            <span>
                                Weekly archive<strong>{dailyArchiveRows.find((row) => row.scope === 'weekly')?.key}</strong>
                            </span>
                            <span>
                                Season archive<strong>{dailyArchiveRows.find((row) => row.scope === 'season')?.key}</strong>
                            </span>
                        </div>
                        <div className={`${styles.grid} ${metaStyles.metaLongList}`}>
                            {dailyArchiveRows.map((row) => (
                                <div className={styles.achievementCard} key={row.key}>
                                    <strong>{row.title}</strong>
                                    <p className={metaStyles.subtitle}>{row.comparisonString}</p>
                                    <span className={styles.symbolMeta}>{row.scope} · {row.key}</span>
                                    <span className={styles.symbolMeta}>Local only · online boards deferred</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>

                <Panel padding="lg" variant="default">
                    <div className={`${styles.section} ${metaStyles.sectionAnchor}`} id="collection-symbols">
                        <h2 className={styles.sectionTitle}>Symbol gallery</h2>
                        <p className={metaStyles.subtitle}>
                            Tiles rotate through these sets by floor band. Letter-only mutator uses the hybrid letter band.
                        </p>
                        <div className={styles.symbolProfileGrid}>
                            {SYMBOL_BAND_READABILITY_PROFILES.map((profile) => (
                                <div className={styles.symbolProfileCard} key={profile.id}>
                                    <strong>{profile.title}</strong>
                                    <span>{profile.levelRange}</span>
                                    <p>{profile.purpose}</p>
                                </div>
                            ))}
                        </div>
                        <p className={styles.setLabel}>Band A — letters + digits</p>
                        <div className={styles.symbolGrid}>
                            {LETTER_TILES.map((entry) => (
                                <div className={styles.symbolChip} key={entry.symbol}>
                                    {entry.symbol}
                                    <span className={styles.symbolMeta}>{entry.label}</span>
                                </div>
                            ))}
                        </div>
                        <p className={styles.setLabel}>Band B — two-digit numbers</p>
                        <div className={styles.symbolGrid}>
                            {NUMBER_SYMBOLS.slice(0, 18).map((entry) => (
                                <div className={styles.symbolChip} key={entry.symbol}>
                                    {entry.symbol}
                                </div>
                            ))}
                            <span className={styles.symbolMeta}>…and {NUMBER_SYMBOLS.length - 18} more</span>
                        </div>
                        <p className={styles.setLabel}>Band C — callsigns</p>
                        <div className={styles.symbolGrid}>
                            {CALLSIGN_SYMBOLS.slice(0, 16).map((entry) => (
                                <div className={styles.symbolChip} key={entry.symbol}>
                                    {entry.symbol}
                                    <span className={styles.symbolMeta}>{entry.label}</span>
                                </div>
                            ))}
                            <span className={styles.symbolMeta}>…and {CALLSIGN_SYMBOLS.length - 16} more</span>
                        </div>
                    </div>
                </Panel>
            </div>
        </section>
    );
};

export default CollectionScreen;
