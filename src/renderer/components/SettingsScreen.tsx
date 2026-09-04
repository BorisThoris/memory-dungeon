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
import { getReferenceOnlySettingsRows } from '../../shared/settings-control-model';
import { DEFAULT_SETTINGS, SETTINGS_NUMERIC_RANGES } from '../../shared/save-data';
import {
    isNarrowShortLandscapeForMenuStack,
    isShortLandscapeViewport,
    VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH,
    VIEWPORT_MOBILE_MAX
} from '../breakpoints';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { useViewportSize } from '../hooks/useViewportSize';
import { runPersistenceInBackground } from '../store/backgroundPersistence';
import {
    playUiBackSfx,
    playUiClickSfx,
    playUiConfirmSfx,
    playUiCounterSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import { Eyebrow, OverlayActionDock, Panel, ScreenTitle, UiButton } from '../ui';
import { pairProximityUiStrings } from '../ui/strings/pairProximityUi';
import packageJson from '../../../package.json';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import OverlayModal from './OverlayModal';
import { DIAGNOSTICS_COPY, SAVE_FILE_COPY } from '../copy/diagnosticsSettings';
import { SETTINGS_FOOTER_HINT, SETTINGS_HINTS } from '../copy/settingsHints';
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

const SettingsScreen = ({ presentation = 'page' }: SettingsScreenProps) => {
    const {
        clearPersistenceWriteNotice,
        closeSettings,
        persistenceWriteNotice,
        priorCrashNotice,
        revealSaveFile,
        settings,
        saveData,
        updateSettings
    } = useAppStore(
        useShallow((state) => ({
            clearPersistenceWriteNotice: state.clearPersistenceWriteNotice,
            closeSettings: state.closeSettings,
            persistenceWriteNotice: state.persistenceWriteNotice,
            priorCrashNotice: state.priorCrashNotice,
            revealSaveFile: state.revealSaveFile,
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
        runPersistenceInBackground(() => updateSettings(draft));
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
        runPersistenceInBackground(() => updateSettings(next));
    };

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
            className={`${styles.shell} ${isModal ? styles.shellModal : ''} ${stackedSettingsShell ? styles.stackedShell : ''} ${wideShortDesktopShell ? styles.wideShortShell : ''} ${shortLandscapeStackedShell ? styles.shortLandscapeShell : ''}`.trim()}
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
                            className={`${styles.panel} ${isModal ? styles.panelModal : ''}`.trim()}
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

                                    <nav className={styles.categoryNav}>
                                        {SETTINGS_CATEGORIES.map((category) => (
                                            <button
                                                aria-pressed={activeCategory === category.id}
                                                className={`${styles.categoryButton} ${activeCategory === category.id ? styles.categoryButtonActive : ''}`.trim()}
                                                key={category.id}
                                                onClick={() => {
                                                    playUiClick();
                                                    setActiveCategory(category.id);
                                                }}
                                                type="button"
                                            >
                                                {/* The rail picks; the header describes what was picked. */}
                                                <span className={styles.categoryLabel}>{category.label}</span>
                                            </button>
                                        ))}
                                    </nav>

                                    {/* Phones get the same choice as one menu row instead of six stacked cards. */}
                                    <label className={styles.categoryMenu}>
                                        <span className={styles.srOnly}>Settings category</span>
                                        <select
                                            className={styles.categorySelect}
                                            data-testid="settings-category-menu"
                                            onChange={(event) => {
                                                playUiClick();
                                                setActiveCategory(event.target.value as typeof activeCategory);
                                            }}
                                            value={activeCategory}
                                        >
                                            {SETTINGS_CATEGORIES.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </aside>

                                <div className={styles.contentPane}>
                                    {/*
                                      * The category is named once. This header used to print it
                                      * as an eyebrow and again as the title, directly under the
                                      * rail entry that had just named it a third time.
                                      */}
                                    <header className={styles.contentHeader}>
                                        <ScreenTitle
                                            as={isModal ? 'h3' : 'h2'}
                                            className={styles.contentTitle}
                                            role="screen"
                                        >
                                            {activeCategoryMeta.label}
                                        </ScreenTitle>
                                        <p className={styles.headerCopy}>{activeCategoryMeta.note}</p>
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
                                                    aria-pressed={activeSubsection === option.id}
                                                    className={`${styles.subsectionButton} ${activeSubsection === option.id ? styles.subsectionButtonActive : ''}`.trim()}
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

                                    <div className={styles.contentScroll}>
                                        {activeCategory === 'gameplay' && showSubsection('board') ? (
                                            <SettingsSection title="Board Presentation">
                                                <div className={styles.boardPresentationPair}>
                                                    <SegmentedControl<BoardPresentationMode>
                                                        hint={SETTINGS_HINTS.boardPresentation}
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
                                                        hint={SETTINGS_HINTS.cameraViewportModePreference}
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
                                                    hint={SETTINGS_HINTS.resolveDelayMultiplier}
                                                    label="Resolve Delay"
                                                    max={SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier.max}
                                                    min={SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier.min}
                                                    onChange={(next) => patchSettings('resolveDelayMultiplier', next)}
                                                    step={0.05}
                                                    value={draft.resolveDelayMultiplier}
                                                    valueLabel={`${draft.resolveDelayMultiplier.toFixed(2)}x`}
                                                />
                                                <SegmentedControl<WeakerShuffleMode>
                                                    hint={SETTINGS_HINTS.weakerShuffleMode}
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
                                                        hint={SETTINGS_HINTS.tileFocusAssist}
                                                        label="Focus Assist"
                                                        onChange={(next) => patchSettings('tileFocusAssist', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.echoFeedbackEnabled}
                                                        hint={SETTINGS_HINTS.echoFeedbackEnabled}
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
                                                        hint={SETTINGS_HINTS.distractionChannelEnabled}
                                                        label="Distraction Channel"
                                                        onChange={(next) => patchSettings('distractionChannelEnabled', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.shuffleScoreTaxEnabled}
                                                        hint={SETTINGS_HINTS.shuffleScorePenalty}
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
                                                    use the left rail. Press P to pause or resume; pause freezes timers.
                                                    Settings opened from a run opens the modal shell without ending the
                                                    descent.
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
                                                    hint={SETTINGS_HINTS.masterVolume}
                                                    label="Master Volume"
                                                    max={SETTINGS_NUMERIC_RANGES.masterVolume.max}
                                                    min={SETTINGS_NUMERIC_RANGES.masterVolume.min}
                                                    onChange={(next) => patchSettings('masterVolume', next)}
                                                    step={0.05}
                                                    value={draft.masterVolume}
                                                    valueLabel={`${Math.round(draft.masterVolume * 100)}%`}
                                                />
                                                <SliderRow
                                                    hint={SETTINGS_HINTS.musicVolume}
                                                    label="Music"
                                                    max={SETTINGS_NUMERIC_RANGES.musicVolume.max}
                                                    min={SETTINGS_NUMERIC_RANGES.musicVolume.min}
                                                    onChange={(next) => patchSettings('musicVolume', next)}
                                                    step={0.05}
                                                    value={draft.musicVolume}
                                                    valueLabel={`${Math.round(draft.musicVolume * 100)}%`}
                                                />
                                                <SliderRow
                                                    hint={SETTINGS_HINTS.sfxVolume}
                                                    label="SFX"
                                                    max={SETTINGS_NUMERIC_RANGES.sfxVolume.max}
                                                    min={SETTINGS_NUMERIC_RANGES.sfxVolume.min}
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
                                                    hint={SETTINGS_HINTS.displayMode}
                                                    label="Window Mode"
                                                    onChange={(next) => patchSettings('displayMode', next)}
                                                    options={[
                                                        { label: 'Windowed', value: 'windowed' },
                                                        { label: 'Fullscreen', value: 'fullscreen' }
                                                    ]}
                                                    value={draft.displayMode}
                                                />
                                                <SliderRow
                                                    hint={SETTINGS_HINTS.uiScale}
                                                    label="UI Scale"
                                                    max={SETTINGS_NUMERIC_RANGES.uiScale.max}
                                                    min={SETTINGS_NUMERIC_RANGES.uiScale.min}
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
                                                    hint={SETTINGS_HINTS.graphicsQuality}
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
                                                        hint={SETTINGS_HINTS.boardBloomEnabled}
                                                        label="Board bloom"
                                                        onChange={(next) => patchSettings('boardBloomEnabled', next)}
                                                    />
                                                </div>
                                                <SegmentedControl<BoardScreenSpaceAA>
                                                    hint={SETTINGS_HINTS.boardScreenSpaceAA}
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
                                                        hint={SETTINGS_HINTS.reduceMotion}
                                                        label="Reduce Motion"
                                                        onChange={(next) => patchSettings('reduceMotion', next)}
                                                    />
                                                    <ToggleRow
                                                        checked={draft.tileFocusAssist}
                                                        hint={SETTINGS_HINTS.tileFocusAssistRepeat}
                                                        label="Board Focus Assist"
                                                        onChange={(next) => patchSettings('tileFocusAssist', next)}
                                                    />
                                                </div>
                                                <PlaceholderControl
                                                    hint={SETTINGS_HINTS.tutorialHints}
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
                                                {/*
                                                 * Crash reports never leave the machine, so the only way anyone can send
                                                 * one is by being told where it is. Deliberately here rather than on the
                                                 * menu: a player who crashed once should not be reminded every launch.
                                                 */}
                                                <p className={styles.headerCopy} data-testid="settings-crash-reports">
                                                    <strong>{DIAGNOSTICS_COPY.label}:</strong>{' '}
                                                    {priorCrashNotice ?? DIAGNOSTICS_COPY.none}{' '}
                                                    {DIAGNOSTICS_COPY.hint}
                                                </p>
                                                <div className={styles.profileSummaryGrid} data-testid="settings-profile-summary">
                                                    {profileSummaryRows.map((row) => (
                                                        <div className={styles.profileSummaryRow} key={row.id}>
                                                            <strong>{row.label}</strong>
                                                            <span>{row.value}</span>
                                                            <em>{row.source}</em>
                                                        </div>
                                                    ))}
                                                </div>
                                                <UiButton
                                                    aria-label={SAVE_FILE_COPY.revealAriaLabel}
                                                    data-testid="settings-reveal-save-file"
                                                    onClick={revealSaveFile}
                                                    size="md"
                                                    type="button"
                                                    variant="secondary"
                                                >
                                                    {SAVE_FILE_COPY.reveal}
                                                </UiButton>
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
                                            actions={[
                                                {
                                                    label: 'Back',
                                                    onClick: handleBack,
                                                    variant: 'secondary'
                                                },
                                                {
                                                    disabled: !isDirty,
                                                    label: 'Save',
                                                    onClick: handleSave,
                                                    variant: 'primary'
                                                }
                                            ]}
                                            className={styles.footerActions}
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
                                runPersistenceInBackground(() => updateSettings(draft));
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
                    subtitle={SETTINGS_FOOTER_HINT}
                    testId="settings-unsaved-back-modal"
                    title="Unsaved settings"
                />
            ) : null}
        </>
    );
};

export default SettingsScreen;
