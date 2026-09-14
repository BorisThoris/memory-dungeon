/**
 * The one-line explanation under each control on the Settings screen.
 *
 * These are the sentences that make a setting decidable rather than a labelled switch, so they are
 * the ones most worth having in front of a translator. Keyed by the setting they sit under, which
 * keeps the mapping checkable against `Settings` in `contracts.ts`.
 */
export const SETTINGS_HINTS = {
    boardBloomEnabled: 'A soft glow around the board. Stays off on Low quality.',
    boardPresentation: 'How the board is framed on screen.',
    boardScreenSpaceAA: 'Smooths the edges of the cards. Auto follows Reduce Motion unless you choose.',
    cameraViewportModePreference:
        'A close-up camera that follows the board on phones and short, narrow screens. Auto turns it on for those; Always and Never decide for you.',
    displayMode: 'Play in a window or full screen.',
    distractionChannelEnabled: 'Shows the distraction overlay when a daily run includes that mutator.',
    echoFeedbackEnabled: 'Keeps mismatched faces visible a little longer.',
    graphicsQuality:
        'Low draws the board and the menu backdrop at a lower resolution; High keeps them sharp. Bloom stays off unless you turn it on below.',
    masterVolume: 'Overall volume for everything.',
    musicVolume: 'Menu and ambient music.',
    reduceMotion: 'Turns off the board shake, board breathing, tilting menus, and background drift.',
    resolveDelayMultiplier: 'How long matches and mismatches linger, and above 1x the memorize window with them. Applies to new runs.',
    sfxVolume: 'Tile flips, rewards, and hit feedback.',
    shuffleScorePenalty: 'Each full shuffle costs some score. Applies to new runs.',
    tileFocusAssist: 'After your first pick, dims the hidden cards that are not beside it.',
    tileFocusAssistRepeat: 'The same Focus Assist switch as under Gameplay, here for quick reach.',
    /* Kept as the reference row's own words: `settings-control-model.ts` documents this placeholder. */
    tutorialHints: 'Tutorial hint visibility is presented here for layout fidelity only.',
    uiScale: 'Makes the menus and HUD larger or smaller on desktop and tablet screens.',
    weakerShuffleMode: 'Full shuffle keeps the original challenge. Rows only is the gentler option.'
} as const;

/** The button row that closes the screen. */
export const SETTINGS_FOOTER_HINT = 'Save your changes, discard them, or keep editing.';
