import { useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    type BoardPresentationMode,
    type BoardScreenSpaceAA,
    type CameraViewportModePreference,
    type DisplayMode,
    type GraphicsQualityPreset,
    type Settings,
    type WeakerShuffleMode
} from '../../shared/contracts';
import { FEATURE_CLOUD_SAVE } from '../../shared/feature-flags';
import { getProfileSummaryRows, getSaveTrustRows } from '../../shared/profile-summary';
import { getPremiumEconomyPolicyRows } from '../../shared/premium-economy-policy';
import { getSettingsControlCenterRows } from '../../shared/settings-control-center';
import { getReferenceOnlySettingsRows } from '../../shared/settings-control-model';
import { DEFAULT_SETTINGS } from '../../shared/save-data';
import {
    isNarrowShortLandscapeForMenuStack,
    isShortLandscapeViewport,
    VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH,
    VIEWPORT_MOBILE_MAX
} from '../breakpoints';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { useViewportSize } from '../hooks/useViewportSize';
import {
    playUiBackSfx,
    playUiClickSfx,
    playUiConfirmSfx,
    playUiCounterSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import { cx, Eyebrow, OverlayActionDock, Panel, ScreenTitle, UiButton, type OverlayAction } from '../ui';
import { pairProximityUiStrings } from '../ui/strings/pairProximityUi';
import packageJson from '../../../package.json';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import OverlayModal from './OverlayModal';
import { PlaceholderControl, SegmentedControl, SettingsSection, SliderRow, ToggleRow } from './SettingsControls';
import {
    DEFAULT_SUBSECTION_BY_CATEGORY,
    SETTINGS_CATEGORIES,
    SETTINGS_SUBSECTIONS,
    type SettingsCategory,
    type SettingsSubsection
} from './settingsNavigationModel';
import styles from './SettingsScreen.module.css';

interface SettingsScreenProps {
    presentation?: 'page' | 'modal';
}

const SETTINGS_CATEGORY_COMPACT_LABEL: Record<SettingsCategory, string> = {
    accessibility: 'Access',
    about: 'About',
    audio: 'Audio',
    controls: 'Input',
    gameplay: 'Game',
    video: 'Video'
};

const SETTINGS_SUBSECTION_COMPACT_LABEL: Record<SettingsSubsection, string> = {
    accessibility: 'Access',
    assist: 'Assist',
    board: 'Board',
    build: 'Build',
    display: 'Display',
    graphics: 'Graphics',
    input: 'Input',
    reference: 'Guide',
    reset: 'Reset',
    timing: 'Timing',
    tuning: 'Tuning',
    volume: 'Volume'
};

const SettingsScreen = ({ presentation = 'page' }: SettingsScreenProps) => {
    const {
        clearPersistenceWriteNotice,
        closeSettings,
        persistenceWriteNotice,
        settings,
        saveData,
        updateSettings
    } = useAppStore(
        useShallow((state) => ({
            clearPersistenceWriteNotice: state.clearPersistenceWriteNotice,
            closeSettings: state.closeSettings,
            persistenceWriteNotice: state.persistenceWriteNotice,
            settings: state.settings,
            saveData: state.saveData,
            updateSettings: state.updateSettings
        }))
    );
    const [draft, setDraft] = useState<Settings>(settings);
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('gameplay');
    const [activeSubsection, setActiveSubsection] = useState<SettingsSubsection>(
        DEFAULT_SUBSECTION_BY_CATEGORY.gameplay
    );
    const isModal = presentation === 'modal';
    const modalShellRef = useRef<HTMLElement | null>(null);
    const { height: viewportHeight, width: viewportWidth } = useViewportSize();
    const titleId = useId();
    const title = isModal ? 'Run Settings' : 'Settings';
    const eyebrow = isModal ? 'Paused' : 'Preferences';
    const profileSummaryRows = getProfileSummaryRows(saveData);
    const saveTrustRows = getSaveTrustRows(saveData);
    const premiumEconomyRows = getPremiumEconomyPolicyRows();
    const controlCenterRows = getSettingsControlCenterRows();
    const referenceControlRows = getReferenceOnlySettingsRows();
    const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);
    const [unsavedBackOpen, setUnsavedBackOpen] = useState(false);
    const lastCounterTickAtRef = useRef(0);
    const isPhoneViewport = viewportWidth <= VIEWPORT_MOBILE_MAX;
    const isShortLandscapeShell = isShortLandscapeViewport(viewportWidth, viewportHeight);
    const stackedSettingsShell = isPhoneViewport || isNarrowShortLandscapeForMenuStack(viewportWidth, viewportHeight);
    const shortLandscapeStackedShell = stackedSettingsShell && isShortLandscapeShell;
    /** Stacked phone / narrow short-landscape: one subsection at a time. */
    const compactDisclosure = shortLandscapeStackedShell;
    /** Non-stacked short-landscape wider than narrow-stack cap (961–1023px, etc.): same shell as 1280×720, not bare desktop. */
    const wideShortDesktopShell =
        !stackedSettingsShell &&
        isShortLandscapeViewport(viewportWidth, viewportHeight) &&
        viewportWidth > VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH;
    const footerButtonSize = stackedSettingsShell ? 'sm' : 'md';
    const activeCategoryMeta = SETTINGS_CATEGORIES.find((item) => item.id === activeCategory) ?? SETTINGS_CATEGORIES[0];
    const subsectionOptions = SETTINGS_SUBSECTIONS[activeCategory];
    const desktopSettingsDensity = stackedSettingsShell ? 'stacked' : activeCategory === 'gameplay' ? 'expanded' : 'compact';
    /** Wide-short (e.g. 1280×720): one subsection at a time so the right column scroll region stays usable with full Gameplay subsections. */
    const subsectionOneAtATime = subsectionOptions.length > 1;
    const showSubsectionNav = subsectionOneAtATime && subsectionOptions.length > 1;
    const showSubsection = (id: SettingsSubsection): boolean =>
        !subsectionOneAtATime || activeSubsection === id;
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const playUiClick = (): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    };
    const playUiConfirm = (): void => {
        resumeUiSfxContext();
        playUiConfirmSfx(uiGain);
    };
    const playUiCounter = (): void => {
        const now = Date.now();
        if (now - lastCounterTickAtRef.current < 70) {
            return;
        }
        lastCounterTickAtRef.current = now;
        resumeUiSfxContext();
        playUiCounterSfx(uiGain);
    };
    const playUiBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    };

    useEffect(() => {
        setDraft(settings);
    }, [settings]);

    useEffect(() => {
        setActiveSubsection(DEFAULT_SUBSECTION_BY_CATEGORY[activeCategory]);
    }, [activeCategory, compactDisclosure, wideShortDesktopShell]);

    useModalFocusTrap({ active: isModal, containerRef: modalShellRef });

    const patchSettings = <Key extends keyof Settings>(key: Key, value: Settings[Key]): void => {
        if (draft[key] === value) {
            return;
        }
        if (typeof value === 'string') {
            playUiClick();
        } else {
            playUiCounter();
        }
        setDraft((current) => ({
            ...current,
            [key]: value
        }));
    };

    const handleSave = (): void => {
        playUiConfirm();
        void updateSettings(draft);
    };

    const handleBack = (): void => {
        playUiBack();
        if (isDirty) {
            setUnsavedBackOpen(true);
            return;
        }
        closeSettings();
    };

    const handleResetToDefaults = (): void => {
        playUiConfirm();
        const next: Settings = {
            ...DEFAULT_SETTINGS,
            debugFlags: { ...DEFAULT_SETTINGS.debugFlags }
        };
        setDraft(next);
        void updateSettings(next);
    };
    const footerActions: OverlayAction[] = [
        {
            label: 'Back',
            onClick: handleBack,
            variant: 'secondary'
        },
        ...(isDirty
            ? [
                  {
                      label: 'Save',
                      onClick: handleSave,
                      variant: 'primary' as const
                  }
              ]
            : [])
    ];

    return (
        <>
            {persistenceWriteNotice ? (
                <div className={styles.persistWriteBanner} role="alert">
                    <span>{persistenceWriteNotice}</span>
                    <button
                        type="button"
                        className={styles.persistWriteBannerDismiss}
                        onClick={clearPersistenceWriteNotice}
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}
        <section
            aria-labelledby={isModal ? titleId : undefined}
            aria-modal={isModal ? 'true' : undefined}
            className={cx(
                styles.shell,
                isModal && styles.shellModal,
                stackedSettingsShell && styles.stackedShell,
                wideShortDesktopShell && styles.wideShortShell,
                shortLandscapeStackedShell && styles.shortLandscapeShell
            )}
            data-settings-category={activeCategory}
            data-settings-density={desktopSettingsDensity}
            data-settings-layout={
                shortLandscapeStackedShell ? 'short-stacked' : wideShortDesktopShell ? 'wide-short' : stackedSettingsShell ? 'stacked' : 'desktop'
            }
            data-testid={isModal ? 'settings-modal-shell' : undefined}
            ref={modalShellRef}
            role={isModal ? 'dialog' : undefined}
            style={isModal ? GAMEPLAY_VISUAL_CSS_VARS : undefined}
            tabIndex={isModal ? -1 : undefined}
        >
            <div className={styles.fitViewport}>
                <div className={styles.fitMeasureOuter}>
                    <div
                        className={styles.fitZoomInner}
                        data-testid="settings-shell-fit-zoom"
                        style={{ zoom: 1 }}
                    >
                        <Panel
                            className={cx(styles.panel, isModal && styles.panelModal)}
                            data-testid="settings-shell-panel"
                            padding="none"
                            variant="strong"
                        >
                            <div className={styles.frame}>
                                <aside className={styles.sidebar}>
                                    <div className={styles.sidebarHeader}>
                                        <Eyebrow>{eyebrow}</Eyebrow>
                                        <ScreenTitle
                                            as={isModal ? 'h2' : 'h1'}
                                            className={styles.shellTitle}
                                            id={titleId}
                                            role="screenMd"
                                        >
                                            {title}
                                        </ScreenTitle>
                                    </div>

                                    <nav className={styles.categoryNav} data-testid="settings-category-nav">
                                        {SETTINGS_CATEGORIES.map((category) => (
                                            <button
                                                aria-label={category.label}
                                                aria-pressed={activeCategory === category.id}
                                                className={cx(
                                                    styles.categoryButton,
                                                    activeCategory === category.id && styles.categoryButtonActive
                                                )}
                                                key={category.id}
                                                onClick={() => {
                                                    playUiClick();
                                                    setActiveCategory(category.id);
                                                }}
                                                type="button"
                                            >
                                                <span
                                                    className={styles.categoryLabel}
                                                    data-compact-label={SETTINGS_CATEGORY_COMPACT_LABEL[category.id]}
                                                >
                                                    {category.label}
                                                </span>
                                                <span className={styles.categoryNote}>{category.note}</span>
                                            </button>
                                        ))}
                                    </nav>
                                </aside>

                                <div className={styles.contentPane}>
                                    <header className={styles.contentHeader}>
                                        <Eyebrow tone="tight">{activeCategoryMeta.label}</Eyebrow>
                                        <ScreenTitle
                                            as={isModal ? 'h3' : 'h2'}
                                            className={styles.contentTitle}
                                            role="screen"
                                        >
                                            {activeCategoryMeta.label}
                                        </ScreenTitle>
                                        <p className={styles.headerCopy}>{activeCategoryMeta.note}</p>
                                        <div className={styles.controlCenterStrip} data-testid="settings-control-center-strip">
                                            {controlCenterRows.map((row) => (
                                                <span
                                                    className={styles.controlCenterRow}
                                                    data-settings-control-row={row.id}
                                                    key={row.id}
                                                >
                                                    <span>{row.label}</span>
                                                    <strong>{row.value}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    </header>

                                    {showSubsectionNav ? (
                                        <div
                                            aria-label={`${activeCategoryMeta.label} sections`}
                                            className={styles.subsectionNav}
                                            data-testid="settings-subsection-nav"
                                            role="group"
                                        >
                                            {subsectionOptions.map((option) => (
                                                <button
                                                    aria-label={option.label}
                                                    aria-pressed={activeSubsection === option.id}
                                                    className={cx(
                                                        styles.subsectionButton,
                                                        activeSubsection === option.id && styles.subsectionButtonActive
                                                    )}
                                                    data-compact-label={SETTINGS_SUBSECTION_COMPACT_LABEL[option.id]}
                                                    key={option.id}
                                                    onClick={() => {
                                                        playUiClick();
                                                        setActiveSubsection(option.id);
                                                    }}
                                                    type="button"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    <div className={styles.contentScroll} data-testid="settings-content-scroll">
                                        {activeCategory === 'gameplay' && showSubsection('board') ? (
                                            <SettingsSection title="Board Presentation">
                                                <div className={styles.boardPresentationPair}>
                                                    <SegmentedControl<BoardPresentationMode>
                                                        hint="Choose the current live board framing mode."
                                                        label="Layout Style"
                                                        onChange={(next) => patchSettings('boardPresentation', next)}
                                                        options={[
                                                            { label: 'Standard', value: 'standard' },
                                                            { label: 'Spaghetti', value: 'spaghetti' },
                                                            { label: 'Breathing', value: 'breathing' }
                                                        ]}
                                                        value={draft.boardPresentation}
                                                    />
                                                    <SegmentedControl<CameraViewportModePreference>
                                                        hint="Auto follows phone / narrow-short-landscape breakpoints. Always or Never override."
                                                        label="Mobile Camera Shell"
                                                        onChange={(next) => patchSettings('cameraViewportModePreference', next)}
                                                        options={[
                                                            { label: 'Auto', value: 'auto' },
                                                            { label: 'Always', value: 'always' },
                                                            { label: 'Never', value: 'never' }
                                                        ]}
                                                        value={draft.cameraViewportModePreference}
                                                    />
                                                </div>
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'gameplay' && showSubsection('timing') ? (
                                            <SettingsSection title="Run Timing">
                                                <SliderRow
                                                    hint="Controls mismatch and resolve pacing for new runs."
                                                    label="Resolve Delay"
                                                    max={2.5}
                                                    min={0.5}
                                                    onChange={(next) => patchSettings('resolveDelayMultiplier', next)}
                                                    step={0.05}
                                                    value={draft.resolveDelayMultiplier}
                                                    valueLabel={`${draft.resolveDelayMultiplier.toFixed(2)}x`}
                                                />
                                                <SegmentedControl<WeakerShuffleMode>
                                                    hint="Full shuffle preserves the original challenge. Rows only is the softer live option."
                                                    label="Shuffle Strength"
                                                    onChange={(next) => patchSettings('weakerShuffleMode', next)}
                                                    options={[
                                                        { label: 'Full Shuffle', value: 'full' },
                                                        { label: 'Rows Only', value: 'rows_only' }
                                                    ]}
                                                    value={draft.weakerShuffleMode}
                                                />
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'gameplay' && showSubsection('assist') ? (
                                            <SettingsSection title="Assist Layers">
                                                <div className={styles.toggleStack}>
                                                    <ToggleRow
                                                        checked={draft.tileFocusAssist}
                                                        hint="Dims non-adjacent hidden tiles after the first pick on the fallback board."
                                                        label="Focus Assist"
                                                        onChange={(next) => patchSettings('tileFocusAssist', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.echoFeedbackEnabled}
                                                        hint="Keeps mismatched faces visible a little longer."
                                                        label="Echo Feedback"
                                                        onChange={(next) => patchSettings('echoFeedbackEnabled', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.pairProximityHintsEnabled}
                                                        hint={pairProximityUiStrings.settingsHint}
                                                        label={pairProximityUiStrings.settingsLabel}
                                                        onChange={(next) => patchSettings('pairProximityHintsEnabled', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.distractionChannelEnabled}
                                                        hint="Enables the distraction mutator overlay when the daily includes it."
                                                        label="Distraction Channel"
                                                        onChange={(next) => patchSettings('distractionChannelEnabled', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.shuffleScoreTaxEnabled}
                                                        hint="Applies the current live score penalty after each shuffle."
                                                        label="Shuffle Score Tax"
                                                        onChange={(next) => patchSettings('shuffleScoreTaxEnabled', next)}
                                                    />
                                                </div>
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'gameplay' && showSubsection('reference') ? (
                                            <SettingsSection title="Gameplay reference">
                                                <p className={styles.headerCopy}>
                                                    Reference comparison controls with no live save keys in this build.
                                                    Segments are disabled; the shipped Steam demo ignores these fields.
                                                </p>
                                                <div className={styles.toggleStack} data-testid="settings-gameplay-reference">
                                                    {referenceControlRows.map((row) => (
                                                        <PlaceholderControl
                                                            honestFuturePlaceholder={row.persistedSettingKey === null}
                                                            hint={`${row.hint} ${row.ruleImpact}`}
                                                            key={row.id}
                                                            label={row.label}
                                                            options={[...row.options]}
                                                        />
                                                    ))}
                                                </div>
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'controls' && showSubsection('input') ? (
                                            <SettingsSection title="Input">
                                                <p className={styles.headerCopy}>
                                                    Primary control is pointer or touch: tap a hidden tile to flip it. When
                                                    only one tile is face-up, the next tap attempts a match. Board powers
                                                    use the left rail. Run settings open as a modal shell without ending the
                                                    descent or advancing floor timers.
                                                </p>
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'controls' && showSubsection('tuning') ? (
                                            <SettingsSection title="Future Tuning">
                                                <p className={styles.headerCopy}>
                                                    Reference-only balance and presentation selectors are grouped under
                                                    Gameplay → Gameplay reference as honest "Coming soon" placeholders
                                                    (not persisted).
                                                </p>
                                                <div className={styles.saveTrustGrid} data-testid="settings-reference-control-policy">
                                                    {referenceControlRows.map((row) => (
                                                        <div className={styles.saveTrustRow} key={row.id}>
                                                            <strong>{row.label}</strong>
                                                            <span>{row.copy}</span>
                                                            <em>{row.migrationRequiredWhenEnabled ? 'Migration required before enabling' : 'No migration while placeholder'}</em>
                                                        </div>
                                                    ))}
                                                </div>
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'audio' && showSubsection('volume') ? (
                                            <SettingsSection title="Volume">
                                                <SliderRow
                                                    hint="Overall mix applied across the whole run."
                                                    label="Master Volume"
                                                    max={1}
                                                    min={0}
                                                    onChange={(next) => patchSettings('masterVolume', next)}
                                                    step={0.05}
                                                    value={draft.masterVolume}
                                                    valueLabel={`${Math.round(draft.masterVolume * 100)}%`}
                                                />
                                                <SliderRow
                                                    hint="Menu and ambient music level."
                                                    label="Music"
                                                    max={1}
                                                    min={0}
                                                    onChange={(next) => patchSettings('musicVolume', next)}
                                                    step={0.05}
                                                    value={draft.musicVolume}
                                                    valueLabel={`${Math.round(draft.musicVolume * 100)}%`}
                                                />
                                                <SliderRow
                                                    hint="Tile flips, rewards, and hit feedback."
                                                    label="SFX"
                                                    max={1}
                                                    min={0}
                                                    onChange={(next) => patchSettings('sfxVolume', next)}
                                                    step={0.05}
                                                    value={draft.sfxVolume}
                                                    valueLabel={`${Math.round(draft.sfxVolume * 100)}%`}
                                                />
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'video' && showSubsection('display') ? (
                                            <SettingsSection title="Display">
                                                <SegmentedControl<DisplayMode>
                                                    hint="Switch between current supported desktop display modes."
                                                    label="Window Mode"
                                                    onChange={(next) => patchSettings('displayMode', next)}
                                                    options={[
                                                        { label: 'Windowed', value: 'windowed' },
                                                        { label: 'Fullscreen', value: 'fullscreen' }
                                                    ]}
                                                    value={draft.displayMode}
                                                />
                                                <SliderRow
                                                    hint="Scales the renderer UI on desktop and tablet viewports."
                                                    label="UI Scale"
                                                    max={1.4}
                                                    min={0.8}
                                                    onChange={(next) => patchSettings('uiScale', next)}
                                                    step={0.05}
                                                    value={draft.uiScale}
                                                    valueLabel={`${draft.uiScale.toFixed(2)}x`}
                                                />
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'video' && showSubsection('graphics') ? (
                                            <SettingsSection title="Graphics">
                                                <SegmentedControl<GraphicsQualityPreset>
                                                    hint="Low caps board pixel ratio and menu atmosphere resolution; high allows sharper WebGL. Bloom stays off unless you enable it below."
                                                    label="Graphics quality"
                                                    onChange={(next) => patchSettings('graphicsQuality', next)}
                                                    options={[
                                                        { label: 'Low', value: 'low' },
                                                        { label: 'Medium', value: 'medium' },
                                                        { label: 'High', value: 'high' }
                                                    ]}
                                                    value={draft.graphicsQuality}
                                                />
                                                <div className={styles.toggleStack}>
                                                    <ToggleRow
                                                        checked={draft.boardBloomEnabled}
                                                        disabled={draft.graphicsQuality === 'low'}
                                                        hint="Soft board-stage glow. Disabled on Low quality for performance."
                                                        label="Board bloom"
                                                        onChange={(next) => patchSettings('boardBloomEnabled', next)}
                                                    />
                                                </div>
                                                <SegmentedControl<BoardScreenSpaceAA>
                                                    hint="Board WebGL edge smoothing. Auto follows the motion setting unless you override it."
                                                    label="Board anti-aliasing"
                                                    onChange={(next) => patchSettings('boardScreenSpaceAA', next)}
                                                    options={[
                                                        { label: 'Auto', value: 'auto' },
                                                        { label: 'Native', value: 'smaa' },
                                                        { label: 'MSAA', value: 'msaa' },
                                                        { label: 'Off', value: 'off' }
                                                    ]}
                                                    value={draft.boardScreenSpaceAA}
                                                />
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'accessibility' && showSubsection('accessibility') ? (
                                            <SettingsSection title="Accessibility">
                                                <div className={styles.toggleStack}>
                                                    <ToggleRow
                                                        checked={draft.reduceMotion}
                                                        hint="Disables board breathing, tilt-heavy UI motion, and visual drift where possible."
                                                        label="Reduce Motion"
                                                        onChange={(next) => patchSettings('reduceMotion', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.tileFocusAssist}
                                                        hint="Repeats the live focus assist toggle here for faster access."
                                                        label="Board Focus Assist"
                                                        onChange={(next) => patchSettings('tileFocusAssist', next)}
                                                    />
                                                </div>
                                                <PlaceholderControl
                                                    hint="Tutorial hint visibility is presented here for layout fidelity only."
                                                    label="Tutorial Hints"
                                                    options={['Off', 'On']}
                                                />
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'about' && showSubsection('build') ? (
                                            <SettingsSection title="Memory Dungeon">
                                                <p className={styles.headerCopy}>
                                                    Version {packageJson.version}. Windows-first Steam desktop build. For
                                                    support and updates, use your storefront or developer channels.
                                                </p>
                                                <p className={styles.headerCopy}>
                                                    Built with React, Pixi/Three render paths, and Electron for the desktop
                                                    shell.
                                                </p>
                                                <p className={styles.headerCopy}>
                                                    Analytics-style events are privacy-first: the default build does not send
                                                    them, and the dev console hook scrubs paths and long strings before any
                                                    optional sink runs.
                                                </p>
                                                {!FEATURE_CLOUD_SAVE ? (
                                                    <p className={styles.headerCopy}>
                                                        Saves stay on this device; there is no cloud sync in this build.
                                                    </p>
                                                ) : null}
                                                <div className={styles.profileSummaryGrid} data-testid="settings-profile-summary">
                                                    {profileSummaryRows.map((row) => (
                                                        <div className={styles.profileSummaryRow} key={row.id}>
                                                            <strong>{row.label}</strong>
                                                            <span>{row.value}</span>
                                                            <em>{row.source}</em>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className={styles.profileSummaryGrid} data-testid="settings-save-trust">
                                                    {saveTrustRows.map((row) => (
                                                        <div className={styles.profileSummaryRow} key={row.id}>
                                                            <strong>{row.label}</strong>
                                                            <span>{row.status}</span>
                                                            <em>{row.description}</em>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className={styles.profileSummaryGrid} data-testid="settings-premium-economy-policy">
                                                    {premiumEconomyRows.map((row) => (
                                                        <div className={styles.profileSummaryRow} key={row.id}>
                                                            <strong>{row.title}</strong>
                                                            <span>{row.status}</span>
                                                            <em>{row.copy}</em>
                                                        </div>
                                                    ))}
                                                </div>
                                            </SettingsSection>
                                        ) : null}

                                        {activeCategory === 'about' && showSubsection('reset') ? (
                                            <SettingsSection title="Reset">
                                                <p className={styles.headerCopy}>
                                                    Restore all settings to application defaults. Save data, profile level,
                                                    history, honors, and cosmetics are not deleted; full profile reset/export
                                                    is intentionally not enabled in this offline release shell.
                                                </p>
                                                <UiButton size={footerButtonSize} variant="secondary" onClick={handleResetToDefaults}>
                                                    Reset to defaults
                                                </UiButton>
                                            </SettingsSection>
                                        ) : null}
                                    </div>

                                    <footer className={styles.footer} data-testid="settings-shell-footer">
                                        <OverlayActionDock
                                            actions={footerActions}
                                            className={styles.footerActions}
                                            leading={
                                                <div
                                                    className={styles.saveState}
                                                    data-dirty={isDirty ? 'true' : 'false'}
                                                    data-testid="settings-save-state"
                                                >
                                                    <strong>{isDirty ? 'Unsaved' : 'Saved'}</strong>
                                                    <span>{isDirty ? 'Save to apply changes.' : 'No pending changes.'}</span>
                                                </div>
                                            }
                                            placement="dock"
                                            size={footerButtonSize}
                                            testId="settings-action-dock"
                                        />
                                    </footer>
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        </section>
            {unsavedBackOpen ? (
                <OverlayModal
                    actions={[
                        {
                            label: 'Save',
                            onClick: () => {
                                playUiConfirm();
                                void updateSettings(draft);
                                setUnsavedBackOpen(false);
                                closeSettings();
                            },
                            variant: 'primary'
                        },
                        {
                            label: 'Discard',
                            onClick: () => {
                                playUiBack();
                                setUnsavedBackOpen(false);
                                closeSettings();
                            },
                            variant: 'danger'
                        },
                        {
                            label: 'Cancel',
                            onClick: () => {
                                playUiBack();
                                setUnsavedBackOpen(false);
                            },
                            variant: 'secondary'
                        }
                    ]}
                    onEscape={() => {
                        playUiBack();
                        setUnsavedBackOpen(false);
                    }}
                    subtitle="Save your changes, discard them, or keep editing."
                    testId="settings-unsaved-back-modal"
                    title="Unsaved settings"
                />
            ) : null}
        </>
    );
};

export default SettingsScreen;
