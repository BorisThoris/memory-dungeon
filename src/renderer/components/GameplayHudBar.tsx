import { useId, type ReactNode } from 'react';
import { getBossEncounterIdentityForFloor, getFloorIdentityContract } from '../../shared/boss-encounters';
import { MAX_LIVES, type MutatorId, type RunState } from '../../shared/contracts';
import { getActiveDungeonBossPressureRule } from '../../shared/dungeon-boss-rules';
import {
    getFeaturedObjectiveHudTooltip,
    getFeaturedObjectiveLabel,
    getFloorArchetypeDefinition,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { getSecondaryObjectiveStatusRows } from '../../shared/secondary-objectives';
import { getDefaultDifficultyProfile } from '../../shared/difficulty-profile';
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import { getFindableRows } from '../../shared/findables';
import { getHazardTileBoardSummary } from '../../shared/hazard-tiles';
import { getTraitOpportunityHudModel, getTraitOpportunitySummary } from '../../shared/trait-opportunities';
import { getTraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import {
    getInRunCauseRows,
    getPerfectMemoryAttribution,
    getTouchHudDetailRows
} from '../../shared/long-run-feedback';
import { getRunEconomyEntry } from '../../shared/run-economy';
import { getRunBuildProfile } from '../../shared/relics';
import { SHOP_ITEM_CATALOG } from '../../shared/shop-rules';
import codexBookUrl from '../assets/ui/icons/icon-codex-book-v1.svg?url';
import scoreParasiteCrystalUrl from '../assets/ui/icons/icon-score-parasite-crystal.svg?url';
import shuffleIconUrl from '../assets/ui/icons/icon-shuffle-v1.svg?url';
import { PERFECT_MEMORY_BASE_RULES, perfectMemoryHudKind } from '../copy/perfectMemory';
import { REG106_HUD_IA } from '../gameplay/regPhase4PlayContract';
import { formatHudActionFeedbackText } from '../hooks/useHudPoliteLiveAnnouncement';
import styles from './GameScreen.module.css';

const MUTATOR_HUD_LABELS: Record<MutatorId, string> = {
    glass_floor: 'Glass floor',
    sticky_fingers: 'Sticky fingers',
    score_parasite: 'Score parasite',
    category_letters: 'Letters',
    short_memorize: 'Short memorize',
    wide_recall: 'Wide recall',
    silhouette_twist: 'Silhouette',
    n_back_anchor: 'N-back',
    distraction_channel: 'Distraction',
    findables_floor: 'Dense pickups',
    shifting_spotlight: 'Shifting spotlight',
    generous_shrine: 'Generous shrine'
};

const getMutatorChipTitle = (id: MutatorId): string => {
    if (id === 'sticky_fingers') {
        return 'Sticky fingers — your next opening flip must use a different slot than the tile you matched last.';
    }
    if (id === 'glass_floor') {
        return 'Glass floor — adds one decoy trap tile that never pairs. Avoid dragging it into a mismatch for the glass-witness bonus.';
    }
    if (id === 'findables_floor') {
        return 'Dense pickups — this floor guarantees two pickup pairs instead of the normal baseline spawn.';
    }
    return MUTATOR_HUD_LABELS[id] ?? id;
};

const temporaryCurrencyPurpose = (run: RunState, currencyId: string): string | undefined =>
    getRunEconomyEntry(run, currencyId)?.purpose;

const mutatorChipStyle = (id: MutatorId): string | undefined => {
    switch (id) {
        case 'short_memorize':
            return styles.mutatorChipShortMemorize;
        case 'n_back_anchor':
            return styles.mutatorChipNBack;
        case 'shifting_spotlight':
            return styles.mutatorChipShiftingSpotlight;
        default:
            return undefined;
    }
};

const MutatorChipGlyph = ({ mutator }: { mutator: MutatorId }) => {
    switch (mutator) {
        case 'short_memorize':
            return (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <circle cx="8" cy="8" fill="none" r="6.25" stroke="currentColor" strokeWidth="1.35" />
                        <path d="M8 4.35V8l2.6 1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
                    </svg>
                </span>
            );
        case 'n_back_anchor':
            return (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <path
                            d="M3.4 10.2c0-2.1 1.7-3.8 3.8-3.8h1.6c2.1 0 3.8 1.7 3.8 3.8v1.1H3.4z"
                            fill="none"
                            stroke="currentColor"
                            strokeLinejoin="round"
                            strokeWidth="1.25"
                        />
                        <path d="M8 2.7v3.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.25" />
                        <circle cx="8" cy="2.2" fill="currentColor" r="1.05" />
                    </svg>
                </span>
            );
        case 'shifting_spotlight':
            return (
                <span aria-hidden="true" className={styles.mutatorChipSpotlightPair}>
                    <span className={styles.mutatorChipSpotWard} />
                    <span className={styles.mutatorChipSpotBounty} />
                </span>
            );
        default:
            return null;
    }
};

export interface GameplayHudBarProps {
    run: RunState;
    cameraViewportMode: boolean;
    /** Precomputed from host clock (`gauntletDeadlineMs - now`), or null when gauntlet is off. */
    gauntletRemainingMs: number | null;
    /** HUD-015: low-frequency status line for screen readers (`aria-live="polite"`). */
    politeHudAnnouncement?: string;
    /** Mirrors the visible board feedback tone in compact HUD context. */
    politeHudAnnouncementPriority?: 'info' | 'error';
    /** Gates brief chain-pill emphasis animation */
    reduceMotion?: boolean;
}

const GameplayHudBar = ({
    run,
    cameraViewportMode,
    gauntletRemainingMs,
    politeHudAnnouncement = '',
    politeHudAnnouncementPriority = 'info',
    reduceMotion = false
}: GameplayHudBarProps) => {
    const floorHexUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const floorHexStrokeGradId = `hud-floor-hex-stroke-${floorHexUid}`;
    const floorHexFillGradId = `hud-floor-hex-fill-${floorHexUid}`;

    const board = run.board;
    if (!board) {
        return null;
    }

    const healthTone = run.lives <= 1 ? 'critical' : run.lives < MAX_LIVES ? 'wounded' : 'safe';
    const lifeTrackLabel =
        run.lives <= 1
            ? `${run.lives} of ${MAX_LIVES} lives remaining. Critical health; protect the last life.`
            : `${run.lives} of ${MAX_LIVES} lives remaining`;
    const lifeSegmentTitle =
        run.lives <= 1
            ? 'Critical health: one more unguarded hit can end the run.'
            : 'Lives carry across floors; clean clears, routes, shops, rests, and shrines can restore them.';
    const resourceSegmentTitle = [
        temporaryCurrencyPurpose(run, 'combo_shards'),
        'Guard tokens absorb mismatch damage before lives are lost.'
    ]
        .filter(Boolean)
        .join(' ');
    const matchedPairCount = Math.min(board.pairCount, board.matchedPairs);
    const remainingPairCount = Math.max(0, board.pairCount - matchedPairCount);
    const pairProgressTitle =
        remainingPairCount === 0
            ? 'All required pairs are clear. The exit or floor clear prompt is ready.'
            : `${remainingPairCount} ${remainingPairCount === 1 ? 'pair remains' : 'pairs remain'} before the floor is clear.`;
    const compactHudAnnouncement = politeHudAnnouncement
        ? formatHudActionFeedbackText(politeHudAnnouncement, { maxChars: 76, maxSentences: 1 })
        : '';
    const dailyDateStripKey = run.gameMode === 'daily' && run.dailyDateKeyUtc ? run.dailyDateKeyUtc : null;
    const dungeonShowcaseActive =
        run.practiceMode &&
        run.gameMode === 'endless' &&
        board.level >= 5 &&
        run.activeMutators.includes('wide_recall') &&
        !run.wildMenuRun &&
        run.activeContract == null;
    const puzzleModeTitle = run.puzzleId ? (BUILTIN_PUZZLES[run.puzzleId]?.title ?? run.puzzleId) : null;
    const hudModeLabel =
        dailyDateStripKey != null
            ? 'Daily challenge'
            : gauntletRemainingMs !== null
              ? 'Gauntlet'
              : dungeonShowcaseActive
                ? 'Dungeon Showcase'
                : run.gameMode === 'puzzle'
                  ? puzzleModeTitle
                      ? `Puzzle: ${puzzleModeTitle}`
                      : 'Puzzle'
              : run.activeContract?.noShuffle
                ? 'Scholar Contract'
                : run.activeContract?.maxPinsTotalRun != null
                  ? 'Pin vow'
                : run.gameMode === 'meditation'
                  ? 'Meditation Run'
                  : run.wildMenuRun
                    ? 'Wild Run'
                    : run.practiceMode
                      ? 'Practice'
                    : run.gameMode === 'endless'
                      ? 'Classic Dungeon'
                      : 'Arcade Run';
    const nBackMutatorActive = run.activeMutators.includes('n_back_anchor');
    const nBackLabel =
        run.nBackAnchorPairKey && nBackMutatorActive ? `Anchor ${run.nBackAnchorPairKey.slice(0, 6)}` : null;
    const scoreParasiteActive = run.activeMutators.includes('score_parasite');
    const parasiteFloorProgress = Math.min(1, run.parasiteFloors / 4);
    const mutatorsForChips = run.activeMutators.filter((id) => !(scoreParasiteActive && id === 'score_parasite'));
    const endlessChapterActive =
        run.gameMode === 'endless' &&
        usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
        board.floorArchetypeId != null;
    const perfectMemoryHud = perfectMemoryHudKind(run.achievementsEnabled, run.powersUsedThisRun);
    const perfectMemoryAttribution = getPerfectMemoryAttribution(run);
    const activeRiskWagerFavor =
        run.endlessRiskWager != null
            ? run.endlessRiskWager.bonusFavorOnSuccess + (run.relicIds.includes('wager_surety') ? 1 : 0)
            : 0;
    const archetype = getFloorArchetypeDefinition(board.floorArchetypeId);
    const featuredObjectiveLabel = getFeaturedObjectiveLabel(board.featuredObjectiveId);
    const floorIdentity = getFloorIdentityContract({
        floorTag: board.floorTag ?? 'normal',
        floorArchetypeId: board.floorArchetypeId,
        mutators: run.activeMutators,
        featuredObjectiveLabel
    });
    const difficultyProfile = getDefaultDifficultyProfile();
    const secondaryObjectiveRows = getSecondaryObjectiveStatusRows(run);
    const buildProfile = getRunBuildProfile(run);
    const hazardTileSummary = getHazardTileBoardSummary(board);
    const traitOpportunitySummary = getTraitOpportunitySummary(board);
    const traitOpportunityHud = getTraitOpportunityHudModel(board, run);
    const traitOpportunityCardLine = traitOpportunitySummary.tiles.length > 0
        ? traitOpportunitySummary.tiles
              .slice(0, 5)
              .map((tile) => `${tile.label} (${tile.traitKind})`)
              .join(', ')
        : null;
    const traitRouteObjectiveStatus = getTraitRouteObjectiveStatus(run);
    const traitRouteProgressLabel = traitRouteObjectiveStatus
        ? `${traitRouteObjectiveStatus.progress}/${traitRouteObjectiveStatus.required}`
        : traitOpportunityHud.routeCountLabel;
    const inRunCauseRows = getInRunCauseRows(run).slice(0, 3);
    const touchHudDetailRows = getTouchHudDetailRows(run);
    const encounterIdentity = getBossEncounterIdentityForFloor(board.floorTag ?? 'normal', {
        floorArchetypeId: board.floorArchetypeId,
        mutators: run.activeMutators,
        riskProfile: archetype?.riskProfile ?? null
    });
    const bossPressureRule = board.floorTag === 'boss' ? getActiveDungeonBossPressureRule(board) : null;
    const bossCounterplayItem = bossPressureRule ? SHOP_ITEM_CATALOG[bossPressureRule.shopPriorityItemId] : null;
    const bossCounterplayLabel = bossCounterplayItem ? `Counter: ${bossCounterplayItem.label}` : null;
    const bossCounterplayTitle = [
        encounterIdentity?.payoffCopy ?? 'Keystone Warden scoring',
        bossPressureRule?.pressureCopy,
        bossCounterplayLabel
    ]
        .filter(Boolean)
        .join(' ');
    const bossReminderTitle = [
        'Study the first reveal, then finish the boss objective before leaving.',
        bossPressureRule?.pressureCopy,
        bossCounterplayLabel
    ]
        .filter(Boolean)
        .join(' ');
    const bossReminderText = bossCounterplayLabel ? `Boss trophy - ${bossCounterplayLabel}` : 'Boss trophy';
    const contextChips: { className: string; key: string; label: string; testId: string; title: string; glyph: ReactNode }[] = [];
    if (run.gameMode === 'gauntlet') {
        contextChips.push({
            className: styles.mutatorChipGauntlet,
            glyph: (
                <span aria-hidden="true" className={styles.mutatorChipGlyphSvg}>
                    <svg className={styles.mutatorChipSvg} viewBox="0 0 16 16">
                        <rect fill="none" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" width="9" x="3.5" y="3.5" />
                        <path d="M8 2.4V4.2M8 11.8v1.8M2.4 8H4.2M11.8 8H13.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
                    </svg>
                </span>
            ),
            key: 'ctx-gauntlet',
            label: 'Gauntlet',
            testId: 'hud-chip-gauntlet',
            title: 'Timed gauntlet run — clear floors before the clock hits zero'
        });
    }
    if (run.activeContract?.noShuffle) {
        contextChips.push({
            className: styles.mutatorChipScholar,
            glyph: (
                <span aria-hidden="true" className={styles.mutatorChipGlyphImg}>
                    <img alt="" className={styles.mutatorChipBookImg} height={14} src={codexBookUrl} width={14} />
                </span>
            ),
            key: 'ctx-scholar',
            label: 'Scholar',
            testId: 'hud-chip-scholar',
            title: 'Scholar contract: board shuffle is disabled'
        });
    }
    if (run.shuffleScoreTaxActive) {
        contextChips.push({
            className: styles.mutatorChipShuffleTax,
            glyph: (
                <span aria-hidden="true" className={styles.mutatorChipGlyphImg}>
                    <img alt="" className={styles.mutatorChipShuffleImg} height={14} src={shuffleIconUrl} width={14} />
                </span>
            ),
            key: 'ctx-shuffle-tax',
            label: 'Shuffle tax',
            testId: 'hud-chip-shuffle-tax',
            title: 'Match score multiplier is reduced after shuffles this run'
        });
    }
    const showMutatorChipRow = contextChips.length > 0 || mutatorsForChips.length > 0;
    const showNoMutatorsCopy = run.activeMutators.length === 0 && contextChips.length === 0;

    /*
     * PLAY-003 (HUD IA): Primary row keeps the reference “slim strip” read — floor, lives, shards, hero score,
     * plus identity widgets (daily id, score-parasite) in the top-right grid cell. Mode label, mutator/context
     * chips, and the compact stat rail move to a second slim strip below on wide layouts so they do not set
     * the primary row’s height or compete optically with score. Narrow / mobile camera stacks the primary
     * grid first, then this context strip (toolbar flyout was considered and rejected here to avoid hiding
     * live mutator state behind an extra tap).
     */
    return (
        <header
            className={`${styles.hudRow} ${cameraViewportMode ? styles.mobileCameraHud : ''}`}
            data-reg-hud-ia="v1"
            data-reg-hud-primary-lanes={REG106_HUD_IA.primary.join(',')}
            data-testid="game-hud"
        >
            <div className={`${styles.floatingDeck} ${styles.statsDeck} ${styles.hudDeck}`} role="group" aria-label="Run stats">
                <div className={styles.hudDeckDualRow}>
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
                        {/*
                         * PLAY-004: Reference mock shows three hearts; live rules cap at MAX_LIVES (5).
                         * Product: honest contract — always render MAX_LIVES heart slots plus an explicit
                         * current/max readout so five empty/filled slots stay legible on narrow HUD widths.
                         */}
                        <div
                            className={`${styles.hudSegment} ${styles.hudLivesSegment}`}
                            data-health={healthTone}
                            data-testid="hud-lives"
                            title={lifeSegmentTitle}
                        >
                            <span className={styles.statKey}>Lives</span>
                            <div
                                className={styles.lifeTrack}
                                role="group"
                                aria-label={lifeTrackLabel}
                            >
                                {Array.from({ length: MAX_LIVES }).map((_, index) => (
                                    <span
                                        aria-hidden="true"
                                        className={index < run.lives ? styles.lifeHeartActive : styles.lifeHeartInactive}
                                        key={`life-${index}`}
                                    >
                                        ♥
                                    </span>
                                ))}
                            </div>
                            <span className={`${styles.statSubline} ${styles.lifeCapReadout}`}>
                                {run.lives <= 1 ? 'Critical ' : ''}{run.lives} / {MAX_LIVES}
                            </span>
                        </div>
                        <div className={styles.hudStripDivider} aria-hidden="true" />
                        <div
                            className={`${styles.hudSegment} ${styles.statPill} ${styles.hudShardsSegment}`}
                            data-testid="hud-combo-shards"
                            title={resourceSegmentTitle}
                        >
                            <span className={styles.statKey}>Shards</span>
                            <span className={`${styles.statVal} ${styles.hudShardsValue}`}>{run.stats.comboShards}</span>
                            <span className={styles.statSubline}>Guards {run.stats.guardTokens}</span>
                        </div>
                    </div>
                    <div
                        className={`${styles.hudStripDivider} ${styles.hudStripDividerBetweenZones}`}
                        aria-hidden="true"
                    />
                    <div className={styles.hudStripScoreModule} data-testid="hud-wing-center">
                        <div className={`${styles.hudSegment} ${styles.hudScoreSegment}`}>
                            <span className={styles.statKey}>Score</span>
                            <span className={`${styles.statVal} ${styles.statValScore}`}>
                                {run.stats.totalScore.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div
                        className={`${styles.hudStripDivider} ${styles.hudStripDividerBetweenZones}`}
                        aria-hidden="true"
                    />
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
                                        <span className={styles.hudParasiteLabel}>
                                            {MUTATOR_HUD_LABELS.score_parasite}
                                        </span>
                                        <div className={styles.hudParasiteTrack}>
                                            <div
                                                className={styles.hudParasiteFill}
                                                style={{ width: `${parasiteFloorProgress * 100}%` }}
                                            />
                                        </div>
                                        <span className={styles.hudParasiteCaption}>
                                            {run.parasiteFloors} / 4 floors
                                        </span>
                                        {run.parasiteWardRemaining > 0 ? (
                                            <span
                                                className={styles.hudParasiteWard}
                                                data-testid="hud-parasite-ward"
                                            >
                                                Ward ×{run.parasiteWardRemaining}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    </div>
                    <details
                        className={`${styles.hudContextSecondaryStrip} ${styles.hudContextRegion}`}
                        data-testid="hud-wing-right"
                        aria-label="Run context"
                    >
                        <summary className={styles.hudContextSummary} title="Run context">
                            Info
                        </summary>
                        <div className={styles.hudStripRightInnerColumn}>
                            <div className={`${styles.hudSegment} ${styles.hudMetaSegment}`} data-testid="hud-mode-identity">
                                <span className={styles.statKey}>Mode</span>
                                <span className={styles.statVal}>{hudModeLabel}</span>
                                {endlessChapterActive && board.actTitle ? (
                                    <span
                                        className={styles.statSubline}
                                        data-testid="hud-chapter-act"
                                        title={board.biomeTone ?? 'Endless act and biome'}
                                    >
                                        {board.actTitle} · {board.biomeTitle} · {board.actFloorNumber}/
                                        {board.actFloorCount}
                                    </span>
                                ) : null}
                                {endlessChapterActive && archetype ? (
                                    <span
                                        className={styles.statSubline}
                                        data-testid="hud-endless-archetype"
                                        title={[
                                            board.actTitle,
                                            board.biomeTitle,
                                            board.actFloorNumber != null && board.actFloorCount != null
                                                ? `Act floor ${board.actFloorNumber}/${board.actFloorCount}`
                                                : null,
                                            archetype.hint
                                        ]
                                            .filter(Boolean)
                                            .join(' — ')}
                                    >
                                        {archetype.title}
                                        {board.actTitle ? ` · ${board.actTitle}` : ''}
                                    </span>
                                ) : null}
                                {floorIdentity.warningLevel !== 'baseline' ? (
                                    <span
                                        className={styles.statSubline}
                                        data-testid="hud-floor-identity-reminder"
                                        title={
                                            board.floorTag === 'boss'
                                                ? bossReminderTitle
                                                : floorIdentity.counterplaySentence
                                        }
                                    >
                                        {board.floorTag === 'boss' ? bossReminderText : floorIdentity.activeReminder}
                                    </span>
                                ) : null}
                                {nBackLabel ? <span className={styles.statSubline}>{nBackLabel}</span> : null}
                                {showMutatorChipRow ? (
                                    <div className={styles.mutatorRow}>
                                        {contextChips.map((chip) => (
                                            <div
                                                className={`${styles.mutatorChip} ${chip.className}`}
                                                data-testid={chip.testId}
                                                key={chip.key}
                                                title={chip.title}
                                            >
                                                {chip.glyph}
                                                <span className={styles.mutatorChipLabel}>{chip.label}</span>
                                            </div>
                                        ))}
                                        {mutatorsForChips.map((mutator) => (
                                            <div
                                                className={[styles.mutatorChip, mutatorChipStyle(mutator)]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                data-testid={`hud-mutator-chip-${mutator}`}
                                                key={mutator}
                                                title={getMutatorChipTitle(mutator)}
                                            >
                                                <MutatorChipGlyph mutator={mutator} />
                                                <span className={styles.mutatorChipLabel}>
                                                    {MUTATOR_HUD_LABELS[mutator] ?? mutator}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : showNoMutatorsCopy ? (
                                    <span className={styles.statSubline}>No active mutators</span>
                                ) : null}
                            </div>

                            <div className={styles.statRail} data-hud-priority="secondary">
                                <div
                                    className={styles.statPillCompact}
                                    data-testid="hud-pair-progress"
                                    title={pairProgressTitle}
                                >
                                    <span className={styles.statKey}>Pairs</span>
                                    <span className={styles.statVal}>{matchedPairCount}/{board.pairCount}</span>
                                </div>
                                {gauntletRemainingMs !== null ? (
                                    <div className={styles.statPillCompact} title="Gauntlet time left">
                                        <span className={styles.statKey}>Time</span>
                                        <span className={styles.statVal}>{Math.ceil(gauntletRemainingMs / 1000)}s</span>
                                    </div>
                                ) : null}
                                {endlessChapterActive && featuredObjectiveLabel ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-featured-objective"
                                        title={
                                            getFeaturedObjectiveHudTooltip(board.featuredObjectiveId ?? null) ??
                                            'Featured objective for this endless floor'
                                        }
                                    >
                                        <span className={styles.statKey}>Objective</span>
                                        <span className={styles.statVal}>{featuredObjectiveLabel}</span>
                                    </div>
                                ) : null}
                                {secondaryObjectiveRows.map((row) => (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid={`hud-secondary-objective-${row.id}`}
                                        key={row.id}
                                        title={row.detail}
                                    >
                                        <span className={styles.statKey}>{row.label}</span>
                                        <span className={styles.statVal}>{row.status}</span>
                                    </div>
                                ))}
                                {endlessChapterActive ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-favor-progress"
                                        title={temporaryCurrencyPurpose(run, 'relic_favor')}
                                    >
                                        <span className={styles.statKey}>Favor</span>
                                        <span className={styles.statVal}>{run.relicFavorProgress}/3</span>
                                    </div>
                                ) : null}
                                {endlessChapterActive && run.endlessRiskWager?.targetLevel === board.level ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-endless-risk-wager"
                                        title={
                                            run.relicIds.includes('wager_surety')
                                                ? "Complete this floor's featured objective to win bonus Favor; miss it and the streak falls to x1"
                                                : "Complete this floor's featured objective to win bonus Favor; miss it and the streak resets"
                                        }
                                    >
                                        <span className={styles.statKey}>Wager</span>
                                        <span className={styles.statVal}>+{activeRiskWagerFavor} Favor</span>
                                    </div>
                                ) : null}
                                {buildProfile.primary ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-build-profile"
                                        title={buildProfile.tooltip}
                                    >
                                        <span className={styles.statKey}>Build</span>
                                        <span className={styles.statVal}>
                                            {buildProfile.primary.label} · {buildProfile.primary.score}
                                        </span>
                                    </div>
                                ) : null}
                                {run.findablesTotalThisFloor > 0 ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-findables-claimed"
                                        title={`Pickup progress this floor. ${getFindableRows()
                                            .map((row) => `${row.label}: ${row.rewardText}`)
                                            .join('; ')}. Destroy forfeits pickups; shuffle preserves them.`}
                                    >
                                        <span className={styles.statKey}>Pickups</span>
                                        <span className={styles.statVal}>
                                            {run.findablesClaimedThisFloor}/{run.findablesTotalThisFloor}
                                        </span>
                                    </div>
                                ) : null}
                                {hazardTileSummary.hasHazards ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-hazard-tiles"
                                        title={hazardTileSummary.hudDetail ?? 'Active hazard tiles on this floor'}
                                    >
                                        <span className={styles.statKey}>Hazards</span>
                                        <span className={styles.statVal}>{hazardTileSummary.totalHazardTiles}</span>
                                    </div>
                                ) : null}
                                {traitOpportunityHud.active ? (
                                    <div
                                        className={`${styles.statPillCompact} ${styles.hudTraitRoutePill}`}
                                        data-testid="hud-trait-route-panel"
                                        title={traitOpportunityHud.title}
                                    >
                                        <span className={styles.statKey}>Trait routes</span>
                                        <span className={styles.statVal}>{traitRouteProgressLabel}</span>
                                        <span className={styles.statSubline}>{traitOpportunityHud.buildLabel}</span>
                                        <small className={styles.hudTraitRoutePrimary}>{traitOpportunityHud.primaryLine}</small>
                                    </div>
                                ) : null}
                                {run.status === 'playing' && run.stats.currentStreak > 0 ? (
                                    <div
                                        key={`hud-chain-${board.level}-${run.stats.currentStreak}`}
                                        className={`${styles.statPillCompact} ${reduceMotion ? '' : styles.hudChainPill}`}
                                        data-testid="hud-match-chain"
                                        title="Consecutive matches without a miss — each match adds bonus score on top of the base."
                                    >
                                        <span className={styles.statKey}>Chain</span>
                                        <span className={styles.statVal}>×{run.stats.currentStreak}</span>
                                    </div>
                                ) : null}
                                {compactHudAnnouncement ? (
                                    <div
                                        className={`${styles.statPillCompact} ${styles.hudRecentActionPill}`}
                                        data-testid="hud-recent-action"
                                        data-tone={politeHudAnnouncementPriority}
                                        title={politeHudAnnouncement}
                                    >
                                        <span className={styles.statKey}>
                                            {politeHudAnnouncementPriority === 'error' ? 'Critical' : 'Last action'}
                                        </span>
                                        <span className={styles.statVal}>{compactHudAnnouncement}</span>
                                    </div>
                                ) : null}
                                {inRunCauseRows.length > 0 ? (
                                    <div
                                        aria-label="Recent run feedback"
                                        className={styles.hudFeedbackStrip}
                                        data-testid="hud-in-run-cause-strip"
                                    >
                                        {inRunCauseRows.map((row) => (
                                            <span
                                                className={styles.hudFeedbackChip}
                                                data-feedback-kind={row.kind}
                                                data-testid={`hud-cause-row-${row.id}`}
                                                key={row.id}
                                                title={row.detail}
                                            >
                                                <span className={styles.statKey}>{row.label}</span>
                                                <span className={styles.statVal}>{row.summary}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                {endlessChapterActive && run.featuredObjectiveStreak > 0 ? (
                                    <div
                                        className={styles.statPillCompact}
                                        data-hud-density="tertiary"
                                        data-testid="hud-featured-streak"
                                        title="Consecutive endless featured objectives completed"
                                    >
                                        <span className={styles.statKey}>Streak</span>
                                        <span className={styles.statVal}>x{run.featuredObjectiveStreak}</span>
                                    </div>
                                ) : null}
                            </div>
                            <details className={styles.hudTertiaryDetails} data-testid="hud-secondary-stat-drawer">
                                <summary aria-label="More run context" title="More run context">More</summary>
                                <div className={styles.statRailTertiary} data-hud-priority="tertiary">
                                    {run.status === 'memorize' || run.status === 'playing' ? (
                                        <>
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid="hud-shuffle-charges"
                                                title={
                                                    run.activeContract?.noShuffle
                                                        ? 'Scholar contract: full-board shuffle is locked.'
                                                        : `Search — Shuffle charges: ${run.shuffleCharges}. Uses a run charge; breaks Scholar-style and some perfect-memory rules when used.`
                                                }
                                            >
                                                <span className={styles.statKey}>Shuffle</span>
                                                <span className={styles.statVal}>
                                                    {run.activeContract?.noShuffle ? 'Off' : run.shuffleCharges}
                                                </span>
                                            </div>
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid="hud-destroy-charges"
                                                title={
                                                    run.activeContract?.noDestroy
                                                        ? 'Scholar contract: destroy pair is locked.'
                                                        : `Damage control — Destroy charges: ${run.destroyPairCharges}. Spend to remove a fully hidden pair with no match score — forfeits pickups on that pair. Run rewards can add to the uncapped bank.`
                                                }
                                            >
                                                <span className={styles.statKey}>Destroy</span>
                                                <span className={styles.statVal}>
                                                    {run.activeContract?.noDestroy ? 'Off' : run.destroyPairCharges}
                                                </span>
                                            </div>
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid="hud-peek-charges"
                                                title={`Recall — Peek charges: ${run.peekCharges}. Arm peek in the toolbar, then tap a tile for a brief reveal.`}
                                            >
                                                <span className={styles.statKey}>Peek</span>
                                                <span className={styles.statVal}>{run.peekCharges}</span>
                                            </div>
                                        </>
                                    ) : null}
                                    {run.activeContract?.noShuffle ? (
                                        <div className={styles.statPillCompact}>
                                            <span className={styles.statKey}>Contract</span>
                                            <span className={styles.statVal}>Scholar</span>
                                        </div>
                                    ) : null}
                                    {traitOpportunityHud.active ? (
                                        <div
                                            className={styles.hudTraitRouteDetails}
                                            data-testid="hud-trait-route-details"
                                        >
                                            <span className={styles.statKey}>Trait Route Panel</span>
                                            <strong>
                                                {traitOpportunitySummary.buildLabels.length > 0
                                                    ? traitOpportunitySummary.buildLabels.join(' / ')
                                                    : traitOpportunityHud.buildLabel}
                                            </strong>
                                            {traitOpportunityCardLine ? (
                                                <span>Cards: {traitOpportunityCardLine}</span>
                                            ) : null}
                                            {traitOpportunitySummary.interactionLines.slice(0, 3).map((line) => (
                                                <span key={line}>{line}</span>
                                            ))}
                                            {traitOpportunityHud.swapHint ? (
                                                <span>{traitOpportunityHud.swapHint.text}</span>
                                            ) : null}
                                            <small>
                                                {traitOpportunityHud.toolLine}
                                            </small>
                                        </div>
                                    ) : null}
                                    {run.activeContract?.maxPinsTotalRun != null ? (
                                        <div className={styles.statPillCompact} title="Pin vow contract">
                                            <span className={styles.statKey}>Pins</span>
                                            <span className={styles.statVal}>
                                                {run.pinsPlacedCountThisRun}/{run.activeContract.maxPinsTotalRun}
                                            </span>
                                        </div>
                                    ) : null}
                                    {run.gameMode === 'meditation' ? (
                                        <div className={styles.statPillCompact} title="Meditation run">
                                            <span className={styles.statKey}>Mode</span>
                                            <span className={styles.statVal}>Meditation</span>
                                        </div>
                                    ) : null}
                                    <div
                                        className={styles.statPillCompact}
                                        data-testid="hud-difficulty-profile"
                                        title={`${difficultyProfile.label}: ${difficultyProfile.playerCopy}`}
                                    >
                                        <span className={styles.statKey}>Difficulty</span>
                                        <span className={styles.statVal}>{difficultyProfile.label}</span>
                                    </div>
                                    {run.wildMenuRun ? (
                                        <div className={styles.statPillCompact} title="Wild joker run">
                                            <span className={styles.statKey}>Wild</span>
                                            <span className={styles.statVal}>On</span>
                                        </div>
                                    ) : null}
                                    {perfectMemoryHud !== 'hidden' ? (
                                        <div
                                            className={`${styles.statPillCompact} ${
                                                perfectMemoryHud === 'locked' ? styles.statPillCompactPerfectMemoryLocked : ''
                                            }`}
                                            data-testid="hud-perfect-memory"
                                            title={`${perfectMemoryAttribution.summary} ${PERFECT_MEMORY_BASE_RULES}`}
                                        >
                                            <span className={styles.statKey}>Perfect Memory</span>
                                            <span className={styles.statVal}>
                                                {perfectMemoryHud === 'locked'
                                                    ? `Locked${perfectMemoryAttribution.firstAction ? `: ${perfectMemoryAttribution.firstAction}` : ''}`
                                                    : 'Eligible'}
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className={styles.hudTouchDetailRows} data-testid="hud-touch-detail-rows">
                                        {touchHudDetailRows.map((row) => (
                                            <div
                                                className={styles.statPillCompact}
                                                data-testid={`hud-touch-detail-${row.id}`}
                                                key={row.id}
                                                title={row.detail}
                                            >
                                                <span className={styles.statKey}>{row.label}</span>
                                                <span className={styles.statVal}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </div>
                    </details>
                </div>
            </div>
            <div
                aria-atomic="true"
                aria-live="polite"
                className={styles.srOnly}
                data-testid="hud-polite-live-region"
                role="status"
            >
                {politeHudAnnouncement}
            </div>
        </header>
    );
};

export default GameplayHudBar;
