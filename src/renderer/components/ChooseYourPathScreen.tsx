import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MutatorId } from '../../shared/contracts';
import { getChallengeModeGateRows } from '../../shared/challenge-progression';
import {
    choosePathHeroModes,
    choosePathLibraryModes,
    RUN_MODE_GROUP_LABEL,
    RUN_MODE_GROUP_ORDER,
    type RunModeDefinition,
    type RunModeGroup
} from '../../shared/run-mode-catalog';
import { buildSocialScopeNote } from '../../shared/social-play-scope';
import { PASS_AND_PLAY_MIN_SEATS, passAndPlaySeatCounts } from '../../shared/pass-and-play-rules';
import { PASS_AND_PLAY_COPY } from '../copy/passAndPlay';
import { parseRunShareKey } from '../../shared/run-share-key';
import { formatNextUtcReset } from '../../shared/utc-countdown';
import { isModePosterFallback, resolveModePosterUrl } from '../assets/ui/modeArt';
import { UI_ART } from '../assets/ui';
import {
    playMenuOpenSfx,
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { FittedGrid, Eyebrow, ScreenTitle, UiButton } from '../ui';
import { useAppStore } from '../store/useAppStore';
import { buildMeditationPickMutatorRows } from './chooseYourPathScreenModel';
import OverlayModal from './OverlayModal';
import styles from './ChooseYourPathScreen.module.css';
import { CHOOSE_YOUR_PATH_COPY } from '../copy/screenCopy';

/**
 * Mode select. One recommended run a new player can start in one click, and a library of
 * the rest. Each mode states what it is once: a group label, a title, one sentence. The
 * detail modal carries everything else on demand.
 */

const BackChevron = (): ReactElement => (
    <svg aria-hidden="true" className={styles.chevron} fill="none" viewBox="0 0 24 24">
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
);

const launchSummary = (def: RunModeDefinition, freshClassic: boolean): string =>
    freshClassic
        ? CHOOSE_YOUR_PATH_COPY.guidedBlurb
        : def.id === 'classic'
          ? CHOOSE_YOUR_PATH_COPY.dungeonBlurb
          : def.shortDescription;

/**
 * The daily is the one mode with an expiry, and the screen never said when it turns over.
 *
 * Its own component so the clock starts at mount — which is the moment the daily's panel opens —
 * and the interval only runs while that panel is on screen. Nothing else on Choose Your Path
 * re-renders once a second for a clock nobody is reading.
 */
const DailyResetCountdown = (): ReactElement => {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(tick);
    }, []);

    return (
        <p className={styles.detailLine} data-testid="choose-path-daily-reset">
            <strong>{CHOOSE_YOUR_PATH_COPY.dailyResetPrefix}</strong> <time>{formatNextUtcReset(nowMs)}</time>
        </p>
    );
};

const socialScopeNote = buildSocialScopeNote();

const ChooseYourPathScreen = (): ReactElement => {
    const {
        closeSubscreen,
        openSettings,
        startDailyRun,
        startDungeonShowcaseRun,
        startGauntletRun,
        startMeditationRun,
        startMeditationRunWithMutators,
        startPassAndPlayRun,
        startPinVowRun,
        startPracticeRun,
        startPuzzleRun,
        startRun,
        startScholarContractRun,
        startSharedRun,
        startWildRun,
        saveData,
        settings
    } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            openSettings: state.openSettings,
            startDailyRun: state.startDailyRun,
            startDungeonShowcaseRun: state.startDungeonShowcaseRun,
            startGauntletRun: state.startGauntletRun,
            startMeditationRun: state.startMeditationRun,
            startMeditationRunWithMutators: state.startMeditationRunWithMutators,
            startPassAndPlayRun: state.startPassAndPlayRun,
            startPinVowRun: state.startPinVowRun,
            startPracticeRun: state.startPracticeRun,
            startPuzzleRun: state.startPuzzleRun,
            startRun: state.startRun,
            startScholarContractRun: state.startScholarContractRun,
            startSharedRun: state.startSharedRun,
            startWildRun: state.startWildRun,
            saveData: state.saveData,
            settings: state.settings
        }))
    );

    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const playClick = useCallback((): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    }, [uiGain]);
    const playBack = useCallback((): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    }, [uiGain]);
    const playOpen = useCallback((): void => {
        resumeUiSfxContext();
        playMenuOpenSfx(uiGain);
    }, [uiGain]);

    const [browseOpen, setBrowseOpen] = useState(true);
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState<RunModeGroup | null>(null);
    const [sharedKeyText, setSharedKeyText] = useState('');
    const [sharedKeyRejected, setSharedKeyRejected] = useState(false);
    const [detailMode, setDetailMode] = useState<RunModeDefinition | null>(null);
    const [meditationOpen, setMeditationOpen] = useState(false);
    const [meditationSelection, setMeditationSelection] = useState<Set<MutatorId>>(() => new Set());

    const heroModes = useMemo(() => choosePathHeroModes(), []);
    const launchMode = useMemo((): RunModeDefinition | null => {
        const preferred = saveData.onboardingDismissed ? 'dungeon_showcase' : 'classic';
        return (
            heroModes.find((mode) => mode.id === preferred && mode.availability === 'available') ??
            heroModes.find((mode) => mode.availability === 'available') ??
            null
        );
    }, [heroModes, saveData.onboardingDismissed]);
    const browseModes = useMemo(
        (): readonly RunModeDefinition[] => [
            ...heroModes.filter((mode) => mode.id !== launchMode?.id),
            ...choosePathLibraryModes()
        ],
        [heroModes, launchMode?.id]
    );
    /*
     * The grid pages, and a 1440x900 screen fits four cards, so eleven of the twelve modes were
     * behind Next presses a player had no reason to make. The catalog already sorts every mode into
     * a group; these chips make that taxonomy the way you narrow the library, so the kind of run
     * you want is one click away instead of three pages deep.
     */
    const groupCounts = useMemo(() => {
        const counts = new Map<RunModeGroup, number>();
        for (const mode of browseModes) {
            counts.set(mode.group, (counts.get(mode.group) ?? 0) + 1);
        }
        return counts;
    }, [browseModes]);
    const visibleModes = useMemo(() => {
        const q = query.trim().toLowerCase();
        return browseModes.filter(
            (mode) =>
                (group === null || mode.group === group) &&
                (q === '' ||
                    mode.title.toLowerCase().includes(q) ||
                    mode.shortDescription.toLowerCase().includes(q))
        );
    }, [browseModes, group, query]);
    const gateRows = useMemo(() => getChallengeModeGateRows(saveData), [saveData]);

    const runModeAction = useCallback(
        (def: RunModeDefinition): void => {
            const { action } = def;
            switch (action.type) {
                case 'startRun':
                    startRun();
                    return;
                case 'startDungeonShowcaseRun':
                    startDungeonShowcaseRun();
                    return;
                case 'startDailyRun':
                    startDailyRun();
                    return;
                case 'startPassAndPlayRun':
                    startPassAndPlayRun(action.seats);
                    return;
                case 'puzzle':
                    startPuzzleRun(action.puzzleId);
                    return;
                case 'startWildRun':
                    startWildRun();
                    return;
                case 'startPracticeRun':
                    startPracticeRun();
                    return;
                case 'startScholarContractRun':
                    startScholarContractRun();
                    return;
                case 'startPinVowRun':
                    startPinVowRun();
                    return;
                case 'meditationSetup':
                    playOpen();
                    setMeditationOpen(true);
                    return;
                case 'locked':
                case 'gauntlet':
                    return;
            }
        },
        [
            playOpen,
            startDailyRun,
            startPassAndPlayRun,
            startDungeonShowcaseRun,
            startPinVowRun,
            startPracticeRun,
            startPuzzleRun,
            startRun,
            startScholarContractRun,
            startWildRun
        ]
    );

    const closeDetail = useCallback((): void => {
        playBack();
        setDetailMode(null);
    }, [playBack]);

    const detailActions = (def: RunModeDefinition) => {
        const close = { label: 'Close', onClick: closeDetail, variant: 'secondary' as const };
        if (def.availability !== 'available' || def.action.type === 'gauntlet') {
            return [close];
        }
        /*
         * One press per seat count, rather than a Play button and a setup screen behind it. The
         * rules always allowed up to four seats and only two were reachable, which is the same
         * "declared but unreachable" shape this project keeps finding; a table deciding how many
         * are playing should not have to walk through a second screen to say so.
         */
        if (def.action.type === 'startPassAndPlayRun') {
            return [
                close,
                ...passAndPlaySeatCounts().map((seats) => ({
                    label: PASS_AND_PLAY_COPY.seatCountLabel(seats),
                    onClick: (): void => {
                        setDetailMode(null);
                        startPassAndPlayRun(seats);
                    },
                    variant: seats === PASS_AND_PLAY_MIN_SEATS ? ('primary' as const) : ('secondary' as const)
                }))
            ];
        }
        if (def.action.type === 'meditationSetup') {
            return [
                close,
                {
                    label: 'Set up run…',
                    onClick: (): void => {
                        setDetailMode(null);
                        runModeAction(def);
                    },
                    variant: 'primary' as const
                }
            ];
        }
        return [
            close,
            {
                label: 'Play',
                onClick: (): void => {
                    setDetailMode(null);
                    runModeAction(def);
                },
                variant: 'primary' as const
            }
        ];
    };

    const renderLaunch = (def: RunModeDefinition): ReactElement => {
        const freshClassic = def.id === 'classic' && !saveData.onboardingDismissed;
        const canStart = def.availability === 'available' && def.action.type !== 'gauntlet';
        return (
            <section aria-label="Recommended run" className={styles.launch} data-testid="choose-path-launcher">
                <img alt="" className={styles.launchPoster} src={resolveModePosterUrl(def.posterKey)} />
                <div className={styles.launchBody}>
                    <Eyebrow tone="menu">Recommended</Eyebrow>
                    <ScreenTitle as="h2" className={styles.launchTitle} role="screenMd">
                        {def.title}
                    </ScreenTitle>
                    <p className={styles.launchSummary}>{launchSummary(def, freshClassic)}</p>
                    {freshClassic ? (
                        <ol className={styles.beats} data-testid="choose-path-first-run-beats">
                            <li>Match the marked pair.</li>
                            <li>Clear the room for score and streak.</li>
                            <li>Pick Safe, Greed, or Mystery for room two.</li>
                        </ol>
                    ) : null}
                    <div className={styles.launchActions}>
                        <UiButton
                            className={styles.launchPrimary}
                            disabled={!canStart}
                            onClick={() => runModeAction(def)}
                            size="lg"
                            type="button"
                            variant="primary"
                        >
                            Start run
                        </UiButton>
                        <UiButton
                            aria-controls="choose-path-more-modes"
                            aria-expanded={browseOpen}
                            onClick={() => {
                                playClick();
                                setBrowseOpen((open) => !open);
                            }}
                            size="lg"
                            type="button"
                            variant="secondary"
                        >
                            {browseOpen ? 'Hide modes' : 'Browse modes'}
                        </UiButton>
                    </div>
                </div>
            </section>
        );
    };

    const renderCard = (def: RunModeDefinition): ReactElement => {
        const locked = def.availability !== 'available';
        return (
            <button
                aria-label={`${def.title}. Open details.`}
                className={`${styles.card} ${locked ? styles.cardLocked : ''}`.trim()}
                data-testid={def.testId}
                key={def.id}
                onClick={() => {
                    playOpen();
                    setDetailMode(def);
                }}
                type="button"
            >
                <img
                    alt=""
                    className={styles.cardPoster}
                    data-mode-art-fallback={isModePosterFallback(def.posterKey) ? 'true' : 'false'}
                    src={resolveModePosterUrl(def.posterKey)}
                />
                <span className={styles.cardBody}>
                    <span className={styles.cardKicker}>{RUN_MODE_GROUP_LABEL[def.group]}</span>
                    <span className={styles.cardTitle}>{def.title}</span>
                    <span className={styles.cardDescription}>{def.shortDescription}</span>
                </span>
                {locked ? <span className={styles.lockedTag}>In the full game</span> : null}
            </button>
        );
    };

    const detailGate = detailMode ? gateRows.find((row) => row.modeId === detailMode.id) : null;
    const showsDailyReset = detailMode?.action.type === 'startDailyRun';

    return (
        <section aria-label="Choose your path" className={styles.screen} role="region">
            <div aria-hidden="true" className={styles.scene} data-testid="choose-path-scene-layer" style={{ backgroundImage: `url(${UI_ART.choosePathScene})` }} />
            <div aria-hidden="true" className={styles.scrim} />
            <div className={styles.column}>
                <header className={styles.header}>
                    <div className={styles.headerRow}>
                        <button
                            className={styles.ghost}
                            data-testid="choose-path-inline-back"
                            onClick={() => {
                                playBack();
                                closeSubscreen();
                            }}
                            type="button"
                        >
                            <BackChevron />
                            <span>Back</span>
                        </button>
                        <button
                            className={styles.ghost}
                            data-testid="choose-path-settings"
                            onClick={() => {
                                playOpen();
                                openSettings('modeSelect');
                            }}
                            type="button"
                        >
                            Settings
                        </button>
                    </div>
                    <Eyebrow tone="menu">Start a run</Eyebrow>
                    <ScreenTitle as="h1" className={styles.title} role="display">
                        Choose Your Path
                    </ScreenTitle>
                </header>

                {launchMode ? renderLaunch(launchMode) : null}

                {browseOpen ? (
                    <section
                        aria-label="Browse modes"
                        className={styles.browse}
                        data-testid="choose-path-more-modes"
                        id="choose-path-more-modes"
                    >
                        <div className={styles.browseHead}>
                            <Eyebrow tone="menu">Browse modes</Eyebrow>
                            <label className={styles.search}>
                                <span className={styles.srOnly}>Filter modes</span>
                                <input
                                    autoComplete="off"
                                    id="choose-path-mode-filter"
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search modes"
                                    type="search"
                                    value={query}
                                />
                            </label>
                        </div>
                        <div
                            aria-label={CHOOSE_YOUR_PATH_COPY.groupFilterLabel}
                            className={styles.groupChips}
                            data-testid="choose-path-group-filter"
                            role="group"
                        >
                            <button
                                aria-pressed={group === null}
                                className={`${styles.chip} ${group === null ? styles.chipOn : ''}`.trim()}
                                onClick={() => {
                                    playClick();
                                    setGroup(null);
                                }}
                                type="button"
                            >
                                {CHOOSE_YOUR_PATH_COPY.groupFilterAll}
                                <span className={styles.chipCount}>{browseModes.length}</span>
                            </button>
                            {RUN_MODE_GROUP_ORDER.filter((name) => (groupCounts.get(name) ?? 0) > 0).map((name) => (
                                <button
                                    aria-pressed={group === name}
                                    className={`${styles.chip} ${group === name ? styles.chipOn : ''}`.trim()}
                                    key={name}
                                    onClick={() => {
                                        playClick();
                                        setGroup(group === name ? null : name);
                                    }}
                                    type="button"
                                >
                                    {RUN_MODE_GROUP_LABEL[name]}
                                    <span className={styles.chipCount}>{groupCounts.get(name)}</span>
                                </button>
                            ))}
                        </div>
                        <form
                            className={styles.sharedRun}
                            data-testid="choose-path-shared-run"
                            onSubmit={(event) => {
                                event.preventDefault();
                                playClick();
                                if (!parseRunShareKey(sharedKeyText)) {
                                    setSharedKeyRejected(true);
                                    return;
                                }
                                setSharedKeyRejected(false);
                                startSharedRun(sharedKeyText);
                            }}
                        >
                            <label className={styles.sharedRunField}>
                                <span className={styles.srOnly}>{CHOOSE_YOUR_PATH_COPY.sharedRunLabel}</span>
                                <input
                                    autoComplete="off"
                                    onChange={(event) => {
                                        setSharedKeyText(event.target.value);
                                        setSharedKeyRejected(false);
                                    }}
                                    placeholder={CHOOSE_YOUR_PATH_COPY.sharedRunPlaceholder}
                                    type="text"
                                    value={sharedKeyText}
                                />
                            </label>
                            <UiButton disabled={sharedKeyText.trim() === ''} size="md" type="submit" variant="secondary">
                                {CHOOSE_YOUR_PATH_COPY.sharedRunPlay}
                            </UiButton>
                            {sharedKeyRejected ? (
                                <p className={styles.sharedRunError} data-testid="choose-path-shared-run-error" role="alert">
                                    {CHOOSE_YOUR_PATH_COPY.sharedRunUnreadable}
                                </p>
                            ) : null}
                        </form>
                        <p
                            aria-live="polite"
                            className={styles.browseCount}
                            data-testid="choose-path-mode-count"
                        >
                            {CHOOSE_YOUR_PATH_COPY.modeCount(visibleModes.length, browseModes.length)}
                        </p>
                        <FittedGrid
                            ariaLabel="Modes"
                            emptyState={CHOOSE_YOUR_PATH_COPY.noSearchResults}
                            items={visibleModes}
                            itemNoun="modes"
                            keyForItem={(def) => def.id}
                            minColumnWidth={260}
                            renderItem={(def) => renderCard(def)}
                            resetKey={`${group ?? 'all'}:${query}`}
                            rowHeight={152}
                            testId="choose-path-mode-grid"
                        />
                    </section>
                ) : null}

                {/* Built from the scope decision table, not restated here: this line was still
                    promising "share strings only" after same-device play shipped. */}
                <p className={styles.footnote} data-testid="choose-path-offline-note">
                    {socialScopeNote}
                </p>
            </div>

            {detailMode ? (
                <OverlayModal
                    actions={detailActions(detailMode)}
                    onEscape={closeDetail}
                    subtitle={RUN_MODE_GROUP_LABEL[detailMode.group]}
                    testId="library-mode-detail-modal"
                    title={detailMode.title}
                >
                    <p className={styles.detailLead}>{detailMode.shortDescription}</p>
                    {showsDailyReset ? <DailyResetCountdown /> : null}
                    {detailMode.startContract ? (
                        <p
                            className={styles.detailLine}
                            data-start-contract-testid={detailMode.startContract.testId}
                            data-testid="choose-path-start-contract"
                        >
                            <strong>{detailMode.startContract.label}:</strong> {detailMode.startContract.signal}
                        </p>
                    ) : null}
                    {detailMode.promise ? <p className={styles.detailLine}>{detailMode.promise}</p> : null}
                    {detailMode.eligibilityNote ? <p className={styles.detailMuted}>{detailMode.eligibilityNote}</p> : null}
                    {detailMode.availabilityDetail ? <p className={styles.detailLine}>{detailMode.availabilityDetail}</p> : null}
                    {detailGate ? (
                        <p className={styles.detailMuted}>
                            Gate: {detailGate.entryCondition} · {detailGate.progress.current}/{detailGate.progress.target} ·{' '}
                            {detailGate.status === 'available' ? 'Unlocked locally' : 'Locked locally'}
                        </p>
                    ) : null}
                    {detailMode.availability !== 'available' ? (
                        <p className={styles.detailMuted}>This mode is intentionally locked in the demo. It ships in the full game.</p>
                    ) : null}
                    {detailMode.action.type === 'gauntlet' && detailMode.availability === 'available' ? (
                        <div aria-label="Gauntlet duration" className={styles.presets} role="group">
                            {detailMode.action.presets.map((preset) => (
                                <UiButton
                                    key={preset.label}
                                    onClick={() => {
                                        setDetailMode(null);
                                        startGauntletRun(preset.durationMs);
                                    }}
                                    size="md"
                                    type="button"
                                    variant="secondary"
                                >
                                    {preset.label}
                                </UiButton>
                            ))}
                        </div>
                    ) : null}
                </OverlayModal>
            ) : null}

            {meditationOpen ? (
                <OverlayModal
                    actions={[
                        {
                            label: 'Cancel',
                            onClick: () => {
                                playBack();
                                setMeditationOpen(false);
                            },
                            variant: 'secondary'
                        },
                        {
                            label: 'Calm (no mutators)',
                            onClick: () => {
                                startMeditationRun();
                                setMeditationOpen(false);
                            },
                            variant: 'secondary'
                        },
                        {
                            label: 'Start with selection',
                            onClick: () => {
                                startMeditationRunWithMutators([...meditationSelection]);
                                setMeditationOpen(false);
                            },
                            variant: 'primary'
                        }
                    ]}
                    onEscape={() => {
                        playBack();
                        setMeditationOpen(false);
                    }}
                    subtitle={CHOOSE_YOUR_PATH_COPY.mutatorsSubtitle}
                    title="Meditation setup"
                >
                    <ul className={styles.mutatorList}>
                        {buildMeditationPickMutatorRows().map((def) => {
                            const inputId = `choose-path-meditation-mutator-${def.id}`;
                            return (
                                <li className={styles.mutatorRow} key={def.id}>
                                    <input
                                        checked={meditationSelection.has(def.id)}
                                        id={inputId}
                                        onChange={() =>
                                            setMeditationSelection((current) => {
                                                const next = new Set(current);
                                                if (next.has(def.id)) {
                                                    next.delete(def.id);
                                                } else {
                                                    next.add(def.id);
                                                }
                                                return next;
                                            })
                                        }
                                        type="checkbox"
                                    />
                                    <label className={styles.mutatorLabel} htmlFor={inputId}>
                                        <strong>{def.title}</strong>
                                        <span>{def.description}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </OverlayModal>
            ) : null}
        </section>
    );
};

export default ChooseYourPathScreen;
