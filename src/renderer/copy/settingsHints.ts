import { tr } from '../../shared/i18n';
/**
 * The one-line explanation under each control on the Settings screen.
 *
 * These are the sentences that make a setting decidable rather than a labelled switch, so they are
 * the ones most worth having in front of a translator. Keyed by the setting they sit under, which
 * keeps the mapping checkable against `Settings` in `contracts.ts`.
 */
export const SETTINGS_HINTS = {
    /** Dev: the combo pop's own visuals, off without touching the elements (`useDevOptions`). */
    comboPopEffects: tr.s('Combo sparks, rings and arcs. Applies immediately.'),
    boardBloomEnabled: tr.s('A soft glow around the board. Stays off on Low quality.'),
    boardPresentation: tr.s('How the board is framed on screen.'),
    boardScreenSpaceAA: tr.s('Smooths the edges of the cards. Auto follows Reduce Motion unless you choose.'),
    cameraViewportModePreference:
        tr.s('Auto fits the board to small screens.'),
    displayMode: tr.s('Play in a window or full screen.'),
    distractionChannelEnabled: tr.s('Shows the distraction overlay when a daily run includes that mutator.'),
    echoFeedbackEnabled: tr.s('Keeps mismatched faces visible a little longer.'),
    graphicsQuality:
        tr.s('Low favors speed; High favors detail.'),
    masterVolume: tr.s('Overall volume for everything.'),
    musicVolume: tr.s('Menu and ambient music.'),
    dailyMusicEnabled: tr.s('Each realm plays a piece written for you today. Off plays the recorded loops.'),
    colourVision:
        tr.s('Colour vision: every element carries its own symbol on the back of its cards, and the card trait colours are tested to stay distinct with protanopia, deuteranopia and tritanopia.'),
    highContrast: tr.s('Sets the menus’ and the run’s secondary text at full strength and draws the rules and panel edges heavier. The card art is unchanged.'),
    reduceMotion: tr.s('Reduces shake, camera motion and animated effects, and stops the room flashing (lightning, a break, Fever).'),
    screenShakeIntensity: tr.s('How hard bombs, meteors and big breaks shake the board.'),
    resolveDelayMultiplier: tr.s('Match, miss and study timing. Applies to new runs.'),
    sfxVolume: tr.s('Tile flips, rewards, and hit feedback.'),
    shuffleScorePenalty: tr.s('Each full shuffle costs some score. Applies to new runs.'),
    tileFocusAssist: tr.s('After your first pick, dims the hidden cards that are not beside it.'),
    tileFocusAssistRepeat: tr.s('Dims cards away from your first pick.'),
    /* Kept as the reference row's own words: `settings-control-model.ts` documents this placeholder. */
    tutorialHints: tr.s('Practise in the Tutorial Hall.'),
    uiScale: tr.s('Menu and HUD size on larger screens.'),
    weakerShuffleMode: tr.s('Shuffle the whole board or only its rows.')
} as const;

/** The button row that closes the screen. */
export const SETTINGS_FOOTER_HINT = tr.s('Save your changes, discard them, or keep editing.');
