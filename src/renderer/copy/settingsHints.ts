/**
 * The one-line explanation under each control on the Settings screen.
 *
 * These are the sentences that make a setting decidable rather than a labelled switch, so they are
 * the ones most worth having in front of a translator. Keyed by the setting they sit under, which
 * keeps the mapping checkable against `Settings` in `contracts.ts`.
 */
export const SETTINGS_HINTS = {
    /** Dev: the combo pop's own visuals, off without touching the elements (`useDevOptions`). */
    comboPopEffects: 'Combo sparks, rings and arcs. Applies immediately.',
    boardBloomEnabled: 'A soft glow around the board. Stays off on Low quality.',
    boardPresentation: 'How the board is framed on screen.',
    boardScreenSpaceAA: 'Smooths the edges of the cards. Auto follows Reduce Motion unless you choose.',
    cameraViewportModePreference:
        'Auto fits the board to small screens.',
    displayMode: 'Play in a window or full screen.',
    distractionChannelEnabled: 'Shows the distraction overlay when a daily run includes that mutator.',
    echoFeedbackEnabled: 'Keeps mismatched faces visible a little longer.',
    graphicsQuality:
        'Low favors speed; High favors detail.',
    masterVolume: 'Overall volume for everything.',
    musicVolume: 'Menu and ambient music.',
    reduceMotion: 'Reduces shake, camera motion and animated effects.',
    resolveDelayMultiplier: 'Match, miss and study timing. Applies to new runs.',
    sfxVolume: 'Tile flips, rewards, and hit feedback.',
    shuffleScorePenalty: 'Each full shuffle costs some score. Applies to new runs.',
    tileFocusAssist: 'After your first pick, dims the hidden cards that are not beside it.',
    tileFocusAssistRepeat: 'Dims cards away from your first pick.',
    /* Kept as the reference row's own words: `settings-control-model.ts` documents this placeholder. */
    tutorialHints: 'Practise in the Tutorial Hall.',
    uiScale: 'Menu and HUD size on larger screens.',
    weakerShuffleMode: 'Shuffle the whole board or only its rows.'
} as const;

/** The button row that closes the screen. */
export const SETTINGS_FOOTER_HINT = 'Save your changes, discard them, or keep editing.';
