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
import { useAppStore } from '../store/useAppStore';
import styles from './MainMenu.module.css';

interface MenuActionConfig {
    label: string;
    onClick: () => void;
    tone?: 'default' | 'play' | 'showcase';
    variant: 'ghost' | 'primary' | 'secondary';
}

interface MenuActionButtonProps {
    action: MenuActionConfig;
    onPress: () => void;
    size: 'lg' | 'md' | 'sm';
}

const MenuActionButton = ({ action, onPress, size }: MenuActionButtonProps) => {
    const toneClassName =
        action.tone === 'play'
            ? styles.ctaButtonPlay
            : action.tone === 'showcase'
              ? styles.ctaButtonShowcase
              : '';

    return (
        <UiButton
            aria-label={action.label}
            className={`${styles.ctaButton} ${toneClassName}`.trim()}
            fullWidth
            size={size}
            variant={action.variant}
            onClick={() => {
                onPress();
                action.onClick();
            }}
        >
            <span className={styles.ctaContent}>
                <span className={styles.ctaTitle}>{action.label}</span>
            </span>
        </UiButton>
    );
};

interface MenuNoticeStripProps {
    message: string;
    onDismiss: () => void;
    role: 'alert' | 'status';
}

const MenuNoticeStrip = ({ message, onDismiss, role }: MenuNoticeStripProps) => (
    <div className={styles.steamBridgeNotice} role={role}>
        <span>{message}</span>
        <button type="button" className={styles.steamBridgeNoticeDismiss} onClick={onDismiss}>
            Dismiss
        </button>
    </div>
);

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
    onStartDungeonShowcase: () => void;
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
    onStartDungeonShowcase
}: MainMenuProps) => {
    const { achievementBridgeNotice, clearAchievementBridgeNotice, persistenceWriteNotice, clearPersistenceWriteNotice } =
        useAppStore(
            useShallow((state) => ({
                achievementBridgeNotice: state.achievementBridgeNotice,
                clearAchievementBridgeNotice: state.clearAchievementBridgeNotice,
                persistenceWriteNotice: state.persistenceWriteNotice,
                clearPersistenceWriteNotice: state.clearPersistenceWriteNotice
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
    const denseSecondaryActionGrid = touchCompactLayout;
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
    const visibleHelpCenterRows = touchCompactLayout ? helpCenterRows.slice(0, 3) : helpCenterRows;
    const balanceTouchHeroColumn =
        touchCompactLayout &&
        !showHowToPlay &&
        !achievementBridgeNotice &&
        !persistenceWriteNotice;
    const primaryActions: MenuActionConfig[] = [
        {
            label: 'Play',
            onClick: onPlay,
            tone: 'play',
            variant: 'primary'
        },
        {
            label: 'Dungeon Showcase',
            onClick: onStartDungeonShowcase,
            tone: 'showcase',
            variant: 'secondary'
        }
    ];
    const secondaryActions: MenuActionConfig[] = [
        {
            label: 'Collection',
            onClick: onOpenCollection,
            variant: 'secondary'
        },
        {
            label: 'Profile',
            onClick: onOpenProfile,
            variant: 'secondary'
        },
        {
            label: 'Inventory',
            onClick: onOpenInventory,
            variant: 'ghost'
        },
        {
            label: 'Codex',
            onClick: onOpenCodex,
            variant: 'ghost'
        },
        {
            label: 'Settings',
            onClick: onOpenSettings,
            variant: 'secondary'
        },
        {
            label: 'Exit Game',
            onClick: () => {
                void desktopClient.quitApp();
            },
            variant: 'ghost'
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
        <Panel className={styles.supportPanel} data-testid="main-menu-how-to-panel" padding="md" variant="accent">
            <details className={styles.helpDisclosure}>
                <summary>
                    <span>
                        <Eyebrow tone="tight">How To Play</Eyebrow>
                        <strong className={styles.supportHeading}>Read, match, and protect the streak</strong>
                    </span>
                    <span className={styles.helpSummaryAction}>
                        <span className={styles.helpSummaryOpenLabel}>Open</span>
                        <span className={styles.helpSummaryCloseLabel}>Close</span>
                    </span>
                </summary>
            <p className={styles.emptyState}>
                {touchCompactLayout
                    ? 'Quick prompts continue inside Play.'
                    : 'Skippable help center - guided prompts continue inside the first run.'}
            </p>
            <div className={styles.howToGrid} data-testid="main-menu-help-center">
                {visibleHelpCenterRows.map((row) => (
                    <p key={row.id}>
                        <strong>{row.title.replace(/^\d+\.\s*/, '')}</strong>
                        <span>{touchCompactLayout ? row.action : row.body}</span>
                    </p>
                ))}
            </div>
            <UiButton
                fullWidth
                size="md"
                variant="secondary"
                onClick={() => {
                    playUiClick();
                    void onDismissHowToPlay();
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
                <div
                    ref={menuFitMeasureRef}
                    className={[
                        styles.fitMeasureOuter,
                        balanceTouchHeroColumn && styles.touchCompactMeasureBalanced
                    ]
                        .filter(Boolean)
                        .join(' ')}
                >
                    <div
                        className={[
                            styles.content,
                            balanceTouchHeroColumn && styles.touchCompactContentBalanced
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        style={{ zoom: shellFitZoom }}
                    >
                        {persistenceWriteNotice ? (
                            <MenuNoticeStrip
                                message={persistenceWriteNotice}
                                onDismiss={clearPersistenceWriteNotice}
                                role="alert"
                            />
                        ) : null}

                        {achievementBridgeNotice ? (
                            <MenuNoticeStrip
                                message={achievementBridgeNotice}
                                onDismiss={clearAchievementBridgeNotice}
                                role="status"
                            />
                        ) : null}

                        <div
                            className={[
                                styles.layout,
                                balanceTouchHeroColumn && styles.touchCompactLayoutBalanced
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            <main
                                className={[
                                    styles.heroColumn,
                                    balanceTouchHeroColumn && styles.touchCompactHeroBalanced
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            >
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
                                                {primaryActions.map((action) => (
                                                    <MenuActionButton
                                                        action={action}
                                                        key={action.label}
                                                        onPress={playMenuOpen}
                                                        size={playButtonSize}
                                                    />
                                                ))}
                                                <div
                                                    className={styles.secondaryActionGrid}
                                                    data-layout={denseSecondaryActionGrid ? 'dense-grid' : 'stack'}
                                                    data-testid="main-menu-secondary-actions"
                                                >
                                                    {secondaryActions.map((action) => (
                                                        <MenuActionButton
                                                            action={action}
                                                            key={action.label}
                                                            onPress={action.label === 'Exit Game' ? playUiBack : playMenuOpen}
                                                            size={hubButtonSize}
                                                        />
                                                    ))}
                                                </div>
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
