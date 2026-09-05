import type { SaveData } from '../../shared/contracts';
import { getFirstRunHelpCenterRows } from '../../shared/first-run-help-center';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getHubShellFitPadding } from '../hooks/hubShellFit';
import { useFitShellZoom } from '../hooks/useFitShellZoom';
import { UI_ART } from '../assets/ui';
import { desktopClient } from '../desktop-client';
import {
    isNarrowShortLandscapeForMenuStack,
    isShortLandscapeViewport,
    VIEWPORT_MOBILE_MAX
} from '../breakpoints';
import { useViewportSize } from '../hooks/useViewportSize';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import { Eyebrow, MetaFrame, Panel, ScreenTitle, UiButton } from '../ui';
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
    onOpenSettings,
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
    const menuFitMeasureRef = useRef<HTMLDivElement | null>(null);
    const { tiltRef: menuFieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: shellRef,
        strength: 1
    });
    const { height, width } = useViewportSize();
    const isCompact = width <= 960 || height <= 760;
    const isPhoneViewport = width <= VIEWPORT_MOBILE_MAX;
    const isShortLandscapeShell = isShortLandscapeViewport(width, height);
    const ultraCompactPhone = width <= 430 && height <= 700;
    const touchCompactLayout = isPhoneViewport || isNarrowShortLandscapeForMenuStack(width, height);
    const shortDesktopShell = !touchCompactLayout && width >= 1024 && height <= 760;
    const ultraShortDesktopShell = shortDesktopShell && height <= 700;
    const fitShellPadding = getHubShellFitPadding(width, height, 'menu');
    const { fitZoom: rawFitZoom } = useFitShellZoom({
        enabled: true,
        measureRef: menuFitMeasureRef,
        viewportWidth: width,
        viewportHeight: height,
        padding: fitShellPadding
    });
    const shellFitZoom = rawFitZoom;
    const hubButtonSize = touchCompactLayout || isShortLandscapeShell || ultraCompactPhone ? 'md' : 'sm';
    const playButtonSize = touchCompactLayout || isShortLandscapeShell || ultraCompactPhone ? 'lg' : 'md';
    const helpCenterRows = getFirstRunHelpCenterRows(saveData);
    const secondaryActions = [
        {
            label: 'Collection',
            onClick: onOpenCollection,
            variant: 'secondary' as const
        },
        {
            label: 'Profile',
            onClick: onOpenProfile,
            variant: 'secondary' as const
        },
        {
            label: 'Inventory',
            onClick: onOpenInventory,
            variant: 'ghost' as const
        },
        {
            label: 'Codex',
            onClick: onOpenCodex,
            variant: 'ghost' as const
        },
        {
            label: 'Settings',
            onClick: onOpenSettings,
            variant: 'secondary' as const
        }
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

    const howToPanel = showHowToPlay ? (
        <Panel className={styles.supportPanel} padding="md" variant="accent">
            <details className={styles.helpDisclosure}>
                <summary>
                    <span>
                        <Eyebrow tone="tight">How To Play</Eyebrow>
                        <strong className={styles.supportHeading}>Read, match, and protect the streak</strong>
                    </span>
                    <span className={styles.helpSummaryAction}>Open</span>
                </summary>
            <p className={styles.emptyState}>Skippable help center - guided prompts continue inside the first run.</p>
            <div className={styles.howToGrid} data-testid="main-menu-help-center">
                {helpCenterRows.map((row) => (
                    <p key={row.id}>
                        <strong>{row.title}:</strong> {row.body}
                    </p>
                ))}
            </div>
            <UiButton
                fullWidth
                size="md"
                variant="secondary"
                onClick={() => {
                    playUiClick();
                    runPersistenceInBackground(onDismissHowToPlay);
                }}
            >
                Dismiss
            </UiButton>
            </details>
        </Panel>
    ) : null;

    return (
        <section
            className={`${styles.shell} ${isCompact ? styles.compactShell : ''} ${touchCompactLayout ? styles.touchCompactShell : ''} ${isShortLandscapeShell ? styles.shortTouchLandscapeShell : ''} ${shortDesktopShell ? styles.shortDesktopShell : ''} ${ultraShortDesktopShell ? styles.ultraShortDesktopShell : ''} ${ultraCompactPhone ? styles.ultraCompactPhoneShell : ''}`.trim()}
            ref={shellRef}
        >
            <MainMenuBackground
                fieldTiltRef={menuFieldTiltRef}
                graphicsQuality={saveData.settings.graphicsQuality}
                height={height}
                reduceMotion={reduceMotion}
                suppressLoadingFallback={suppressMenuBackgroundFallback}
                width={width}
            />
            <div
                aria-hidden="true"
                className={styles.sceneLayer}
                style={{ backgroundImage: `url(${UI_ART.menuScene})` }}
            />
            <div className={styles.scrim} />

            <div className={styles.fitViewport}>
                <div ref={menuFitMeasureRef} className={styles.fitMeasureOuter}>
                    <div className={styles.content} style={{ zoom: shellFitZoom }}>
                        {persistenceWriteNotice ? (
                            <div className={styles.steamBridgeNotice} role="alert">
                                <span>{persistenceWriteNotice}</span>
                                <button
                                    type="button"
                                    className={styles.steamBridgeNoticeDismiss}
                                    onClick={clearPersistenceWriteNotice}
                                >
                                    Dismiss
                                </button>
                            </div>
                        ) : null}

                        {saveReadFailureNotice ? (
                            <div className={styles.saveFailureNotice} role="alert">
                                <span className={styles.saveFailureNoticeTitle}>{SAVE_RECOVERY_COPY.title}</span>
                                <span>{saveReadFailureNotice}</span>
                                {saveWritesBlockedByReadFailure ? (
                                    <>
                                        <span className={styles.saveFailureNoticeDetail}>
                                            {SAVE_RECOVERY_COPY.detail}
                                        </span>
                                        <button
                                            type="button"
                                            className={styles.saveFailureNoticeAction}
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
                            <div className={styles.steamBridgeNotice} role="status">
                                <span>{achievementBridgeNotice}</span>
                                <button type="button" className={styles.steamBridgeNoticeDismiss} onClick={clearAchievementBridgeNotice}>
                                    Dismiss
                                </button>
                            </div>
                        ) : null}

                        <div className={styles.layout}>
                            <main className={styles.heroColumn}>
                                <div className={styles.brandLockup}>
                                    <img alt="" className={styles.brandCrest} src={UI_ART.brandCrest} />
                                    <Eyebrow className={styles.heroEyebrow} tone="menu">
                                        Seeker of Shards
                                    </Eyebrow>
                                    <ScreenTitle className={styles.heroTitle} role="display">
                                        Memory Dungeon
                                    </ScreenTitle>
                                    <img alt="" className={styles.divider} src={UI_ART.dividerOrnament} />
                                    <p className={styles.tagline}>Test your mind. Conquer the depths.</p>
                                </div>

                                <div className={styles.ctaMetaFrameWrap} data-testid="main-menu-primary-meta-frame">
                                    <MetaFrame>
                                        <Panel className={styles.ctaPanel} padding="md" variant="strong">
                                            <div aria-hidden className={styles.ctaIllustratedBand}>
                                                <img alt="" className={styles.ctaBandSeal} src={UI_ART.menuSeal} />
                                                <img alt="" className={styles.ctaBandFlourish} src={UI_ART.dividerOrnament} />
                                            </div>
                                            <div className={styles.actionStack} role="group" aria-label="Primary actions">
                                                <UiButton
                                                    aria-label="Play"
                                                    className={`${styles.ctaButton} ${styles.ctaButtonPlay}`}
                                                    fullWidth
                                                    size={playButtonSize}
                                                    variant="primary"
                                                    onClick={() => {
                                                        playMenuOpen();
                                                        onPlay();
                                                    }}
                                                >
                                                    <span className={styles.ctaContent}>
                                                        <span className={styles.ctaTitle}>Play</span>
                                                    </span>
                                                </UiButton>
                                                <div className={styles.secondaryActionGrid} data-testid="main-menu-secondary-actions">
                                                    {secondaryActions.map((action) => (
                                                        <UiButton
                                                            aria-label={action.label}
                                                            className={styles.ctaButton}
                                                            fullWidth
                                                            key={action.label}
                                                            size={hubButtonSize}
                                                            variant={action.variant}
                                                            onClick={() => {
                                                                playMenuOpen();
                                                                action.onClick();
                                                            }}
                                                        >
                                                            <span className={styles.ctaContent}>
                                                                <span className={styles.ctaTitle}>{action.label}</span>
                                                            </span>
                                                        </UiButton>
                                                    ))}
                                                </div>
                                                <UiButton
                                                    aria-label="Exit Game"
                                                    className={styles.ctaButton}
                                                    fullWidth
                                                    size={hubButtonSize}
                                                    variant="ghost"
                                                    onClick={() => {
                                                        playUiBack();
                                                        void desktopClient.quitApp();
                                                    }}
                                                >
                                                    <span className={styles.ctaContent}>
                                                        <span className={styles.ctaTitle}>Exit Game</span>
                                                    </span>
                                                </UiButton>
                                            </div>
                                        </Panel>
                                    </MetaFrame>
                                </div>

                                {howToPanel}
                            </main>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MainMenu;
