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
import { getCollectionRewardSignals } from '../../shared/meta-reward-signals';
import { ACHIEVEMENT_IDS } from '../../shared/save-data';
import {
    CALLSIGN_SYMBOLS,
    LETTER_SYMBOLS as LETTER_TILES,
    NUMBER_SYMBOLS,
    SYMBOL_BAND_READABILITY_PROFILES
} from '../../shared/tile-symbol-catalog';
import { playUiBackSfx, resumeUiSfxContext, uiSfxGainFromSettings } from '../audio/uiSfx';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import metaStyles from './MetaScreen.module.css';
import { handleMetaBodyTocLinkClick } from './metaScreenTocNav';
import styles from './CollectionScreen.module.css';

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
    const rewardGalleryRows = getCollectionGalleryRows(saveData);
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
                            <div className={metaStyles.archiveCatalogGrid}>
                                {rewardSignals.map((signal) => (
                                    <div className={metaStyles.archiveCatalogRow} key={signal.id}>
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
                            <div className={`${styles.galleryGrid} ${metaStyles.metaLongList}`} data-testid="collection-reward-gallery">
                                {rewardGalleryRows.map((row) => {
                                    return (
                                    <div className={styles.galleryCard} data-status={row.status} key={row.id}>
                                        <span className={styles.galleryBadge}>{row.status.replace('_', ' ')}</span>
                                        <strong>{row.title}</strong>
                                        <p className={metaStyles.subtitle}>{row.description}</p>
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
                                            <strong>{cosmetic.title}</strong>
                                            <p className={metaStyles.subtitle}>{cosmetic.description}</p>
                                            <span className={styles.symbolMeta}>
                                                {equipped ? 'Equipped' : owned ? 'Owned' : `Locked · ${cosmetic.unlockHint}`}
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
                            <p className={metaStyles.subtitle}>
                                Last run: {summary.totalScore.toLocaleString()} pts · Floor {summary.highestLevel} ·{' '}
                                {summary.levelsCleared} clears · Streak {summary.bestStreak}
                            </p>
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
