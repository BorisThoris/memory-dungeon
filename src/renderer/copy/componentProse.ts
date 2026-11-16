import { tr } from '../../shared/i18n';

/**
 * Sentences that used to sit as JSX text inside components. Wrapping them for translation made the
 * copy-locality scan see them, so they live here, one per screen line (`scripts/copy-locality.ts`).
 */
export const COMPONENT_PROSE = {
    chooseYourPathScreenEveryDescentBeginsWith: tr.s("Every descent begins with a road taken."),
    chooseYourPathScreenThisModeIsIntentionally: tr.s("This mode is intentionally locked in the demo. It ships in the full game."),
    elementCastGuideSameElementTwiceSwitch: tr.s("Same element twice → switch element. A miss breaks the streak."),
    floorJourneyRandomlySelectedForThis: tr.s("Randomly selected for this run."),
    inventoryScreenGoldBuysAutomaticUpgrades: tr.s("Gold buys automatic upgrades every 3 floors."),
    inventoryScreenCollectShardsThenChoose: tr.s("Collect shards, then choose a target."),
    languageRowChangeTheLanguageFrom: tr.s("Change the language from the main menu."),
    languageRowTheGameRestartsIn: tr.s("The game restarts in the new language. Translations are machine-made and may read oddly."),
    mainMenuTestYourMindConquer: tr.s("Test your mind. Conquer the depths."),
    realmTravelYourMatchesChangeThe: tr.s("Your matches change the arena"),
    settingsScreenTapTwoCardsTo: tr.s("Tap two cards to match. Arrow keys move focus; Enter flips."),
    settingsScreenNothingAboutHowYou: tr.s("Nothing about how you play is sent anywhere. If you claim the world record, the name and score you enter go to the record board."),
    settingsScreenSavesStayOnThis: tr.s("Saves stay on this device; there is no cloud sync in this build."),
    settingsScreenPutsEverySettingBack: tr.s("Puts every setting back to its default. Your saves, profile level, history, honors and cosmetics are kept."),
    storeVaultMakeTheNextFloors: tr.s("Make the next floors yours"),
    storeVaultBuildYourRunOr: tr.s("Build your run or stock up for the next floor. The stop comes back every 3 floors, with a new shelf."),
    storeVaultTwoRelicsThatGrow: tr.s("Two relics that grow, made one power · Both kept · No slot taken"),
    storeVaultTwoRelicsAtRank: tr.s("Two relics at rank 3 and a boss's blueprint · Kept to the end of the run"),
    storeVaultThreeOnThisShelf: tr.s("Three on this shelf, drawn for this run · Four slots · Kept to the end of the run"),
    storeVaultOneChargePerPurchase: tr.s("One charge per purchase · Repeat purchases cost more"),
    storeVaultYouHoldAllThe: tr.s("You hold all the lives you can"),
    storeVaultFullyUpgradedForThis: tr.s("Fully upgraded for this run"),
    storeVaultThisModeHasNo: tr.s("This mode has no miss bank"),
    storeVaultSavingForAnUpgrade: tr.s("Saving for an upgrade? Keep your gold and continue. Gold and upgrades reset when the run ends."),
    tileBoardBoardGraphicsEncounteredAn: tr.s("Board graphics encountered an error. Try reloading the page."),
    tileBoardThisGameRequiresWebgl: tr.s("This game requires WebGL. Enable hardware acceleration or update your browser, then reload."),
    tileBoardWebglContextWasLost: tr.s("WebGL context was lost. The board will rebuild when the GPU restores it. If this stays visible, reload the page or update GPU drivers."),
} as const;
