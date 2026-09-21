import type { SaveData } from '../../shared/contracts';
import { getFirstRunHelpCenterRows } from '../../shared/first-run-help-center';
import { getProfileSummaryRows } from '../../shared/profile-summary';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { UI_ART } from '../assets/ui';
import { desktopClient, hasDesktopBridge } from '../desktop-client';
import { useViewportSize } from '../hooks/useViewportSize';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import {
    playMenuOpenSfx,
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import MainMenuBackground from './MainMenuBackground';
import { SAVE_RECOVERY_COPY } from '../copy/saveRecoveryNotice';
import { runPersistenceInBackground } from '../store/backgroundPersistence';
import { useAppStore } from '../store/useAppStore';
import styles from './MainMenu.module.css';

interface MainMenuProps {
    saveData: SaveData;
    reduceMotion: boolean;
    showHowToPlay: boolean;
    suppressMenuBackgroundFallback?: boolean;
    onDismissHowToPlay: () => Promise<void>;
    onPlay: () => void;
    onOpenCollection: () => void;
    onOpenProfile: () => void;
    onOpenCodex: () => void;
    onOpenInventory: () => void;
    onOpenSettings: () => void;
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/**
 * The start menu as the title page of the book the run is set in ("The Margin"): the title on
 * one side, the contents on the other — Play as the first entry, the rest as a numbered ladder
 * with leader rules — and a colophon at the foot that says where this profile stands.
 *
 * Layout is fluid, not fitted: type and spacing scale with the viewport through `clamp()` and
 * `dvh`, the spread goes to one column when the page is narrow or short, and nothing is zoomed.
 * The old shell scaled a fixed layout with CSS `zoom` behind six viewport regimes, which is why
 * phones got a left-aligned half-page and short landscapes an off-centre stack.
 */
const MainMenu = ({
    saveData,
    reduceMotion,
    showHowToPlay,
    suppressMenuBackgroundFallback = false,
    onDismissHowToPlay,
    onPlay,
    onOpenCollection,
    onOpenProfile,
    onOpenCodex,
    onOpenInventory,
    onOpenSettings
}: MainMenuProps) => {
    const {
        achievementBridgeNotice,
        clearAchievementBridgeNotice,
        persistenceWriteNotice,
        clearPersistenceWriteNotice,
        recoverUnreadableSave,
        saveReadFailureNotice,
        saveWritesBlockedByReadFailure
    } = useAppStore(
        useShallow((state) => ({
            achievementBridgeNotice: state.achievementBridgeNotice,
            clearAchievementBridgeNotice: state.clearAchievementBridgeNotice,
            persistenceWriteNotice: state.persistenceWriteNotice,
            clearPersistenceWriteNotice: state.clearPersistenceWriteNotice,
            recoverUnreadableSave: state.recoverUnreadableSave,
            saveReadFailureNotice: state.saveReadFailureNotice,
            saveWritesBlockedByReadFailure: state.saveWritesBlockedByReadFailure
        }))
    );
    const shellRef = useRef<HTMLElement | null>(null);
    const { tiltRef: menuFieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: shellRef,
        strength: 1
    });
    const { height, width } = useViewportSize();
    const helpCenterRows = getFirstRunHelpCenterRows(saveData);
    const profileRows = getProfileSummaryRows(saveData);
    const profileLevel = profileRows.find((row) => row.id === 'profile_level')?.value ?? '1';
    const bestScore = profileRows.find((row) => row.id === 'best_score')?.value ?? '0';
    const lastRun = saveData.lastRunSummary;
    const entries = [
        { label: 'Collection', note: 'Cards and relics', onClick: onOpenCollection },
        { label: 'Profile', note: 'Marks and records', onClick: onOpenProfile },
        { label: 'Inventory', note: 'What you carry', onClick: onOpenInventory },
        { label: 'Codex', note: 'How the dungeon works', onClick: onOpenCodex },
        { label: 'Settings', note: 'Sound, motion, display', onClick: onOpenSettings }
    ];
    const uiGain = uiSfxGainFromSettings(saveData.settings.masterVolume, saveData.settings.sfxVolume);
    const playUiClick = (): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    };
    const playMenuOpen = (): void => {
        resumeUiSfxContext();
        playMenuOpenSfx(uiGain);
    };
    const playUiBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    };

    return (
        <section className={styles.shell} ref={shellRef}>
            <MainMenuBackground
                fieldTiltRef={menuFieldTiltRef}
                graphicsQuality={saveData.settings.graphicsQuality}
                height={height}
                reduceMotion={reduceMotion}
                suppressLoadingFallback={suppressMenuBackgroundFallback}
                width={width}
            />
            <div aria-hidden="true" className={styles.sceneLayer} style={{ backgroundImage: `url(${UI_ART.menuScene})` }} />
            <div aria-hidden="true" className={styles.scrim} />

            <div className={styles.page} data-testid="main-menu-page">
                {persistenceWriteNotice ? (
                    <div className={styles.note} role="alert">
                        <span>{persistenceWriteNotice}</span>
                        <button className={styles.noteAction} type="button" onClick={clearPersistenceWriteNotice}>
                            Dismiss
                        </button>
                    </div>
                ) : null}

                {saveReadFailureNotice ? (
                    <div className={styles.note} role="alert">
                        <span className={styles.noteTitle}>{SAVE_RECOVERY_COPY.title}</span>
                        <span>{saveReadFailureNotice}</span>
                        {saveWritesBlockedByReadFailure ? (
                            <>
                                <span className={styles.noteDetail}>{SAVE_RECOVERY_COPY.detail}</span>
                                <button
                                    className={styles.noteAction}
                                    type="button"
                                    onClick={() => {
                                        void recoverUnreadableSave();
                                    }}
                                >
                                    {SAVE_RECOVERY_COPY.action}
                                </button>
                            </>
                        ) : null}
                    </div>
                ) : null}

                {achievementBridgeNotice ? (
                    <div className={styles.note} role="status">
                        <span>{achievementBridgeNotice}</span>
                        <button className={styles.noteAction} type="button" onClick={clearAchievementBridgeNotice}>
                            Dismiss
                        </button>
                    </div>
                ) : null}

                <div className={styles.spread}>
                    <header className={styles.titleBlock}>
                        <img alt="" className={styles.crest} src={UI_ART.brandCrest} />
                        <p className={styles.eyebrow}>Seeker of Shards</p>
                        {/*
                          * The space between the words is real text, not a gap the layout draws.
                          * The two spans stack because `.title` is a column flex container, which
                          * also means a whitespace-only node between them renders nothing - but it
                          * is in the accessible name, and without it the `h1` read "MemoryDungeon"
                          * to a screen reader. Found in Gen 253 by a demo-readiness assertion that
                          * had been red on main long enough for nobody to notice.
                          */}
                        <h1 className={styles.title}>
                            <span>Memory</span>{' '}
                            <span>Dungeon</span>
                        </h1>
                        <span aria-hidden="true" className={styles.rule} />
                        <p className={styles.tagline}>Test your mind. Conquer the depths.</p>
                    </header>

                    <main className={styles.contents} data-testid="main-menu-primary-meta-frame">
                        <p className={styles.contentsHead}>Contents</p>
                        <div aria-label="Primary actions" className={styles.ladder} role="group">
                            <button
                                aria-label="Play"
                                className={`${styles.entry} ${styles.entryPlay}`}
                                type="button"
                                onClick={() => {
                                    playMenuOpen();
                                    onPlay();
                                }}
                            >
                                <span className={styles.numeral}>{NUMERALS[0]}</span>
                                <span className={styles.entryTitle}>Play</span>
                                <span aria-hidden="true" className={styles.leader} />
                                <span className={styles.entryNote}>{lastRun ? `Floor ${lastRun.highestLevel} last time` : 'Begin the descent'}</span>
                            </button>
                            <div className={styles.entries} data-testid="main-menu-secondary-actions">
                                {entries.map((entry, index) => (
                                    <button
                                        aria-label={entry.label}
                                        className={styles.entry}
                                        key={entry.label}
                                        type="button"
                                        onClick={() => {
                                            playMenuOpen();
                                            entry.onClick();
                                        }}
                                    >
                                        <span className={styles.numeral}>{NUMERALS[index + 1]}</span>
                                        <span className={styles.entryTitle}>{entry.label}</span>
                                        <span aria-hidden="true" className={styles.leader} />
                                        <span className={styles.entryNote}>{entry.note}</span>
                                    </button>
                                ))}
                                {hasDesktopBridge() ? (
                                    <button
                                        aria-label="Exit Game"
                                        className={`${styles.entry} ${styles.entryQuiet}`}
                                        type="button"
                                        onClick={() => {
                                            playUiBack();
                                            void desktopClient.quitApp();
                                        }}
                                    >
                                        <span className={styles.numeral}>{NUMERALS[entries.length + 1]}</span>
                                        <span className={styles.entryTitle}>Exit Game</span>
                                        <span aria-hidden="true" className={styles.leader} />
                                        <span className={styles.entryNote}>Close the book</span>
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </main>
                </div>

                {showHowToPlay ? (
                    <details className={styles.help} data-testid="main-menu-howto-details">
                        <summary className={styles.helpSummary}>
                            <span className={styles.helpKicker}>How to play</span>
                            <span className={styles.helpTitle}>Read, match, and protect the streak</span>
                            <span aria-hidden="true" className={styles.leader} />
                            <span className={styles.helpOpen}>Open</span>
                        </summary>
                        <p className={styles.helpLead}>Skippable help center - guided prompts continue inside the first run.</p>
                        <div className={styles.helpRows} data-testid="main-menu-help-center">
                            {helpCenterRows.map((row) => (
                                <p key={row.id}>
                                    <strong>{row.title}:</strong> {row.body}
                                </p>
                            ))}
                        </div>
                        <button
                            className={styles.helpDismiss}
                            type="button"
                            onClick={() => {
                                playUiClick();
                                runPersistenceInBackground(onDismissHowToPlay);
                            }}
                        >
                            Dismiss
                        </button>
                    </details>
                ) : null}

                <footer className={styles.colophon} data-testid="main-menu-colophon">
                    <span>Level {profileLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span>Best {bestScore}</span>
                    {lastRun ? (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>Last descent to floor {lastRun.highestLevel}</span>
                        </>
                    ) : null}
                </footer>
            </div>
        </section>
    );
};

export default MainMenu;
