import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { passAndPlaySeatCounts } from '../../shared/pass-and-play-rules';
import { PASS_AND_PLAY_COPY } from '../copy/passAndPlay';
import { parseRunShareKey } from '../../shared/run-share-key';
import { isModePosterFallback, resolveModePosterUrl } from '../assets/ui/modeArt';
import { UI_ART } from '../assets/ui';
import {
    playMenuOpenSfx,
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useEscapeLeaves } from '../hooks/useEscapeLeaves';
import { useAppStore } from '../store/useAppStore';
import OverlayModal from './OverlayModal';
import { PortalScene } from './PortalScene';
import styles from './ChooseYourPathScreen.module.css';
import { CHOOSE_YOUR_PATH_COPY, CLASSIC_SETUP_COPY } from '../copy/screenCopy';
import { DEFAULT_CLASSIC_RUN_SETUP, type ClassicRunSetup } from '../../shared/classic-run-setup';

/**
 * Mode select as the first chapter page of the book the run is set in ("The Margin"): the
 * chapter title on one side, the roads down on the other as a numbered ladder with leader
 * rules — the recommended run first and in gold, opened out with its summary, its first-run
 * beats and its two actions; the rest of the library as one line each; and a shared run as
 * the last entry, a field to paste a key into. Each mode states what it is once; the detail
 * dialog carries everything else on demand.
 */

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'] as const;

const numeral = (index: number): string => NUMERALS[index] ?? String(index + 1);

const BackChevron = (): ReactElement => (
    <svg aria-hidden="true" className={styles.chevron} fill="none" viewBox="0 0 24 24">
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
);

const launchSummary = (def: RunModeDefinition, freshClassic: boolean): string =>
    freshClassic
        ? CHOOSE_YOUR_PATH_COPY.guidedBlurb
        : def.id === 'classic'
          ? CHOOSE_YOUR_PATH_COPY.dungeonBlurb
          : def.shortDescription;

const socialScopeNote = buildSocialScopeNote();

const ChooseYourPathScreen = (): ReactElement => {
    const {
        closeSubscreen,
        openSettings,
        startPassAndPlayRun,
        startRun,
        startSharedRun,
        saveData,
        settings
    } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            openSettings: state.openSettings,
            startPassAndPlayRun: state.startPassAndPlayRun,
            startRun: state.startRun,
            startSharedRun: state.startSharedRun,
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

    /*
     * B leaves Choose Your Path for the menu, the same thing the running head's Back word does.
     * The detail sheet and the setup sheet are `OverlayModal`s that take Escape first, so an open
     * sheet closes itself rather than dropping the player out of the screen behind it.
     */
    const leaveToMenu = useCallback((): void => {
        playBack();
        closeSubscreen();
    }, [closeSubscreen, playBack]);
    useEscapeLeaves(leaveToMenu);

    const [browseOpen, setBrowseOpen] = useState(true);
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState<RunModeGroup | null>(null);
    const [sharedKeyText, setSharedKeyText] = useState('');
    const [sharedKeyRejected, setSharedKeyRejected] = useState(false);
    const [detailMode, setDetailMode] = useState<RunModeDefinition | null>(null);
    const [setupOpen, setSetupOpen] = useState(false);
    const [setup, setSetup] = useState<ClassicRunSetup>(DEFAULT_CLASSIC_RUN_SETUP);

    const heroModes = useMemo(() => choosePathHeroModes(), []);
    // Classic leads. The showcase this used to prefer after onboarding was retired into the
    // setup sheet's unrecorded option, so the preference fell through to Classic anyway.
    const launchMode = useMemo(
        (): RunModeDefinition | null =>
            heroModes.find((mode) => mode.id === 'classic' && mode.availability === 'available') ??
            heroModes.find((mode) => mode.availability === 'available') ??
            null,
        [heroModes]
    );
    const browseModes = useMemo(
        (): readonly RunModeDefinition[] => [
            ...heroModes.filter((mode) => mode.id !== launchMode?.id),
            ...choosePathLibraryModes()
        ],
        [heroModes, launchMode?.id]
    );
    /*
     * The catalog sorts every mode into a group; when the library is long these chips make that
     * taxonomy the way you narrow it, so the kind of run you want is one click away. A library
     * of one line needs neither the chips nor the search and prints without them.
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
    const hasLibrary = browseModes.length > 1;

    const runModeAction = useCallback(
        (def: RunModeDefinition): void => {
            const { action } = def;
            switch (action.type) {
                case 'startRun':
                    /*
                     * Straight into the run. The setup sheet is a door beside Start, not in front
                     * of it: a player who just wants to play should not pay a dialog every time,
                     * and the whole point of retiring the preset cards was to stop asking people
                     * to make a decision before they know anything about the run.
                     */
                    startRun();
                    return;
                case 'startPassAndPlayRun':
                    startPassAndPlayRun(action.seats);
                    return;
                case 'locked':
                    return;
            }
        },
        [startPassAndPlayRun, startRun]
    );

    const closeDetail = useCallback((): void => {
        playBack();
        setDetailMode(null);
    }, [playBack]);

    const detailActions = (def: RunModeDefinition) => {
        const close = { label: 'Close', onClick: closeDetail, variant: 'secondary' as const };
        if (def.availability !== 'available') {
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
                /*
                 * All one variant, deliberately. The dock renders every secondary and then every
                 * primary, so marking two players as the primary tore it out of its own ordered
                 * set and the table read "3 players, 4 players, 2 players". These are equal
                 * choices along one dimension; the count is the only thing that differs, so they
                 * belong together in the order a person counts.
                 */
                ...passAndPlaySeatCounts().map((seats) => ({
                    label: PASS_AND_PLAY_COPY.seatCountLabel(seats),
                    onClick: (): void => {
                        setDetailMode(null);
                        startPassAndPlayRun(seats);
                    },
                    variant: 'primary' as const
                }))
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

    /* Entry I: the recommended run, opened out — summary, first-run beats, Start and its door. */
    const renderLaunch = (def: RunModeDefinition): ReactElement => {
        const freshClassic = def.id === 'classic' && !saveData.onboardingDismissed;
        const canStart = def.availability === 'available';
        return (
            <section aria-label="Recommended run" className={styles.launch} data-testid="choose-path-launcher">
                <div className={styles.launchLine}>
                    <span className={styles.numeral}>{numeral(0)}</span>
                    <h2 className={styles.launchTitle}>{def.title}</h2>
                    <span aria-hidden="true" className={styles.leader} />
                    <span className={styles.launchNote}>Recommended</span>
                </div>
                <div className={styles.launchBody}>
                    <p className={styles.launchSummary}>{launchSummary(def, freshClassic)}</p>
                    {freshClassic ? (
                        <ol className={styles.beats} data-testid="choose-path-first-run-beats">
                            <li>Remember the symbols, then find a pair.</li>
                            <li>Match beside a clump to set off a cascade.</li>
                            <li>Build momentum: Clean → Sharp → Fever.</li>
                        </ol>
                    ) : null}
                    <div className={styles.launchActions}>
                        <button
                            className={`${styles.word} ${styles.wordGold}`}
                            disabled={!canStart}
                            onClick={() => runModeAction(def)}
                            type="button"
                        >
                            Start run
                        </button>
                        {/* The door beside Start, not in front of it: the eight retired preset
                            cards live behind this, and a player who just wants to play never has
                            to open it. */}
                        {def.action.type === 'startRun' ? (
                            <button
                                className={styles.word}
                                onClick={() => {
                                    playOpen();
                                    setSetupOpen(true);
                                }}
                                type="button"
                            >
                                {CLASSIC_SETUP_COPY.title}
                            </button>
                        ) : null}
                        {hasLibrary ? (
                            <button
                                aria-controls="choose-path-more-modes"
                                aria-expanded={browseOpen}
                                className={`${styles.word} ${styles.wordQuiet}`}
                                onClick={() => {
                                    playClick();
                                    setBrowseOpen((open) => !open);
                                }}
                                type="button"
                            >
                                {browseOpen ? 'Hide modes' : 'Browse modes'}
                            </button>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    };

    /* A library entry: one line of the contents, the whole line the button. */
    const renderEntry = (def: RunModeDefinition, index: number): ReactElement => {
        const locked = def.availability !== 'available';
        return (
            <button
                aria-label={`${def.title}. Open details.`}
                className={`${styles.entry} ${locked ? styles.entryLocked : ''}`.trim()}
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
                    className={styles.entryPoster}
                    data-mode-art-fallback={isModePosterFallback(def.posterKey) ? 'true' : 'false'}
                    src={resolveModePosterUrl(def.posterKey)}
                />
                <span className={styles.numeral}>{numeral(index)}</span>
                <span className={styles.entryTitle}>{def.title}</span>
                <span aria-hidden="true" className={styles.leader} />
                <span className={styles.entryNote}>{locked ? 'In the full game' : RUN_MODE_GROUP_LABEL[def.group]}</span>
                <span className={styles.entryDescription}>{def.shortDescription}</span>
            </button>
        );
    };

    const detailGate = detailMode ? gateRows.find((row) => row.modeId === detailMode.id) : null;
    const sharedEntryIndex = (launchMode ? 1 : 0) + browseModes.length;

    return (
        <section aria-label="Choose your path" className={styles.screen} role="region">
            {/* The recommended run's poster is the scene behind the page, sunk into the ink as the
                cathedral is behind the title page; the stage art stands in when there is none. The
                Classic poster is a living scene (`PortalScene`); the other posters are stills. */}
            {launchMode?.posterKey === 'classic' ? (
                <div aria-hidden="true" className={styles.scene} data-testid="choose-path-scene-layer" data-scene="portal">
                    <PortalScene quality={settings.graphicsQuality} reduceMotion={settings.reduceMotion} />
                </div>
            ) : (
                <div
                    aria-hidden="true"
                    className={styles.scene}
                    data-testid="choose-path-scene-layer"
                    style={{ backgroundImage: `url(${launchMode ? resolveModePosterUrl(launchMode.posterKey) : UI_ART.choosePathScene})` }}
                />
            )}
            <div aria-hidden="true" className={styles.scrim} />

            <div className={styles.page}>
                {/* The running head: the way back on the left, the settings on the right, one rule. */}
                <header className={styles.runningHead}>
                    <button
                        className={styles.headWord}
                        data-testid="choose-path-inline-back"
                        onClick={leaveToMenu}
                        type="button"
                    >
                        <BackChevron />
                        <span>Back</span>
                    </button>
                    <span className={styles.headKicker}>Chapter One</span>
                    <button
                        className={styles.headWord}
                        data-testid="choose-path-settings"
                        onClick={() => {
                            playOpen();
                            openSettings('modeSelect');
                        }}
                        type="button"
                    >
                        Settings
                    </button>
                </header>

                <div className={styles.spread}>
                    <div className={styles.titleBlock}>
                        <p className={styles.eyebrow}>Start a run</p>
                        <h1 className={styles.title}>
                            <span>Choose</span>
                            <span>Your Path</span>
                        </h1>
                        <span aria-hidden="true" className={styles.rule} />
                        <p className={styles.tagline}>Every descent begins with a road taken.</p>
                    </div>

                    <main className={styles.contents}>
                        <p className={styles.contentsHead}>The runs</p>

                        {launchMode ? renderLaunch(launchMode) : null}

                        {browseOpen ? (
                            <section
                                aria-label="Browse modes"
                                className={styles.browse}
                                data-testid="choose-path-more-modes"
                                id="choose-path-more-modes"
                            >
                                {hasLibrary ? (
                                    <>
                                        <div className={styles.browseHead}>
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
                                            <p
                                                aria-live="polite"
                                                className={styles.browseCount}
                                                data-testid="choose-path-mode-count"
                                            >
                                                {CHOOSE_YOUR_PATH_COPY.modeCount(visibleModes.length, browseModes.length)}
                                            </p>
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
                                    </>
                                ) : null}

                                {visibleModes.length > 0 ? (
                                    <div aria-label="Modes" className={styles.entries} data-testid="choose-path-mode-grid" role="list">
                                        {visibleModes.map((def, index) => (
                                            <div key={def.id} role="listitem">
                                                {renderEntry(def, (launchMode ? 1 : 0) + index)}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={styles.empty} data-testid="choose-path-mode-grid">
                                        {CHOOSE_YOUR_PATH_COPY.noSearchResults}
                                    </p>
                                )}

                                {/* The last entry: a run someone else played, pasted in. */}
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
                                    <span className={styles.numeral}>{numeral(sharedEntryIndex)}</span>
                                    <span className={styles.entryTitle}>{CHOOSE_YOUR_PATH_COPY.sharedRunLabel}</span>
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
                                    <button
                                        className={`${styles.word} ${styles.wordSmall}`}
                                        disabled={sharedKeyText.trim() === ''}
                                        type="submit"
                                    >
                                        {CHOOSE_YOUR_PATH_COPY.sharedRunPlay}
                                    </button>
                                    {sharedKeyRejected ? (
                                        <p className={styles.sharedRunError} data-testid="choose-path-shared-run-error" role="alert">
                                            {CHOOSE_YOUR_PATH_COPY.sharedRunUnreadable}
                                        </p>
                                    ) : null}
                                </form>
                            </section>
                        ) : null}
                    </main>
                </div>

                {/* Built from the scope decision table, not restated here: this line was still
                    promising "share strings only" after same-device play shipped. */}
                <footer className={styles.colophon} data-testid="choose-path-offline-note">
                    {socialScopeNote}
                </footer>
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
                    {/*
                      * The gate line appears only while the mode is actually gated. On an unlocked
                      * mode it read "Gate: <condition> · 1/1 · Unlocked locally" - a requirement
                      * stated to the one player who has already met it, beside a paragraph that
                      * had just said the same thing in words ("Offline and local. It needs no
                      * account."). That is the duplication §105 exists to remove, and it was also
                      * the line the sheet ran out of room for: at 812x375 the body clipped at
                      * y=307 with this line laid out at 310-330 and the action row painted over it
                      * at 321-357, so it was cut AND covered. The cost, stated rather than left to
                      * be noticed: a player who wants reassurance that a mode is unlocked no
                      * longer gets it in those words - the mode simply opens and plays.
                      */}
                    {detailGate && detailGate.status !== 'available' ? (
                        <p className={styles.detailMuted}>
                            Gate: {detailGate.entryCondition} · {detailGate.progress.current}/{detailGate.progress.target} ·
                            Locked locally
                        </p>
                    ) : null}
                    {detailMode.availability !== 'available' ? (
                        <p className={styles.detailMuted}>This mode is intentionally locked in the demo. It ships in the full game.</p>
                    ) : null}
                </OverlayModal>
            ) : null}

            {setupOpen ? (
                <OverlayModal
                    actions={[
                        {
                            label: CLASSIC_SETUP_COPY.cancelLabel,
                            onClick: () => {
                                playBack();
                                setSetupOpen(false);
                            },
                            variant: 'secondary'
                        },
                        {
                            label: CLASSIC_SETUP_COPY.startLabel,
                            onClick: () => {
                                startRun(setup);
                                setSetupOpen(false);
                            },
                            variant: 'primary'
                        }
                    ]}
                    onEscape={() => {
                        playBack();
                        setSetupOpen(false);
                    }}
                    subtitle={CLASSIC_SETUP_COPY.subtitle}
                    testId="classic-setup-sheet"
                    title={CLASSIC_SETUP_COPY.title}
                    wide
                >
                    <div className={styles.setupGroups}>
                        <fieldset className={styles.setupGroup}>
                            <legend className={styles.setupLegend}>{CLASSIC_SETUP_COPY.vowsLabel}</legend>
                            <p className={styles.setupHint}>{CLASSIC_SETUP_COPY.vowsHint}</p>
                            {([
                                ['scholar', CLASSIC_SETUP_COPY.scholarLabel],
                                ['pin_vow', CLASSIC_SETUP_COPY.pinVowLabel]
                            ] as const).map(([vow, label]) => (
                                <label className={styles.setupRow} key={vow}>
                                    <input
                                        checked={setup.vows.includes(vow)}
                                        onChange={(event) =>
                                            setSetup((current) => ({
                                                ...current,
                                                vows: event.target.checked
                                                    ? [...current.vows, vow]
                                                    : current.vows.filter((held) => held !== vow)
                                            }))
                                        }
                                        type="checkbox"
                                    />
                                    <span className={styles.setupMark} aria-hidden="true" />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>

                        <fieldset className={styles.setupGroup}>
                            <legend className={styles.setupLegend}>{CLASSIC_SETUP_COPY.pacingLabel}</legend>
                            <label className={styles.setupRow}>
                                <input
                                    checked={setup.pacing === 'calm'}
                                    onChange={(event) =>
                                        setSetup((current) => ({
                                            ...current,
                                            pacing: event.target.checked ? 'calm' : 'standard'
                                        }))
                                    }
                                    type="checkbox"
                                />
                                <span className={styles.setupMark} aria-hidden="true" />
                                <span>{CLASSIC_SETUP_COPY.calmLabel}</span>
                            </label>
                            <label className={styles.setupRow}>
                                <input
                                    checked={setup.chaos}
                                    onChange={(event) =>
                                        setSetup((current) => ({ ...current, chaos: event.target.checked }))
                                    }
                                    type="checkbox"
                                />
                                <span className={styles.setupMark} aria-hidden="true" />
                                <span>{CLASSIC_SETUP_COPY.chaosLabel}</span>
                            </label>
                            <label className={styles.setupRow}>
                                <input
                                    checked={setup.unrecorded}
                                    onChange={(event) =>
                                        setSetup((current) => ({ ...current, unrecorded: event.target.checked }))
                                    }
                                    type="checkbox"
                                />
                                <span className={styles.setupMark} aria-hidden="true" />
                                <span>{CLASSIC_SETUP_COPY.unrecordedLabel}</span>
                            </label>
                        </fieldset>
                    </div>
                </OverlayModal>
            ) : null}
        </section>
    );
};

export default ChooseYourPathScreen;
