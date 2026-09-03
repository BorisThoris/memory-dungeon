/**
 * The one-line explanation under each control on the Settings screen.
 *
 * These are the sentences that make a setting decidable rather than a labelled switch, so they are
 * the ones most worth having in front of a translator. Keyed by the setting they sit under, which
 * keeps the mapping checkable against `Settings` in `contracts.ts`.
 */
export const SETTINGS_HINTS = {
    boardBloomEnabled: 'Soft board-stage glow. Disabled on Low quality for performance.',
    boardPresentation: 'Choose the current live board framing mode.',
    boardScreenSpaceAA: 'Board WebGL edge smoothing. Auto follows the motion setting unless you override it.',
    cameraViewportModePreference:
        'Auto follows phone / narrow-short-landscape breakpoints. Always or Never override.',
    displayMode: 'Switch between current supported desktop display modes.',
    distractionChannelEnabled: 'Enables the distraction mutator overlay when the daily includes it.',
    echoFeedbackEnabled: 'Keeps mismatched faces visible a little longer.',
    graphicsQuality:
        'Low caps board pixel ratio and menu atmosphere resolution; high allows sharper WebGL. Bloom stays off unless you enable it below.',
    masterVolume: 'Overall mix applied across the whole run.',
    musicVolume: 'Menu and ambient music level.',
    reduceMotion: 'Disables board breathing, tilt-heavy UI motion, and visual drift where possible.',
    resolveDelayMultiplier: 'Controls mismatch and resolve pacing for new runs.',
    sfxVolume: 'Tile flips, rewards, and hit feedback.',
    shuffleScorePenalty: 'Applies the current live score penalty after each shuffle.',
    tileFocusAssist: 'Dims non-adjacent hidden tiles after the first pick on the fallback board.',
    tileFocusAssistRepeat: 'Repeats the live focus assist toggle here for faster access.',
    tutorialHints: 'Tutorial hint visibility is presented here for layout fidelity only.',
    uiScale: 'Scales the renderer UI on desktop and tablet viewports.',
    weakerShuffleMode: 'Full shuffle preserves the original challenge. Rows only is the softer live option.'
} as const;

/** The button row that closes the screen. */
export const SETTINGS_FOOTER_HINT = 'Save your changes, discard them, or keep editing.';
