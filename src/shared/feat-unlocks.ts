import { tr } from './i18n';
import type { RunState, SaveData } from './contracts';
import type { CosmeticId } from './cosmetic-ids';
import { isCartographerFloor } from './cartographer-rules';
import { isKeeperFloor } from './keeper-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { runDepth } from './depth-rules';

/**
 * Feats (DGE-024): unlocks as a guided tour of the deep game.
 *
 * Each feat is something done in a mechanic players under-use, said aloud in the Collection and the
 * Codex before it is done (no hidden progress bars), and each unlocks something sideways - a title,
 * or an option built from what the game already has - never a number the deep game asks for. The
 * owner chose ten feats on existing options (2026-10-22) and twenty more the same way (2026-10-23). A feat is read off the run as it plays (\`earnedFeats\`) and kept on the profile as an
 * unlock tag (\`feat:<id>\`), its title as \`cosmetic:<id>\` and its option, if any, as \`option:<id>\`.
 */
export type FeatId =
    | 'held_twelve'
    | 'warden_felled'
    | 'first_evolution'
    | 'three_carves'
    | 'five_reprises'
    | 'spiral_survived'
    | 'sleepers_kept'
    | 'keeper_raging'
    | 'cartographer_raging'
    | 'three_unmasked'
    | 'keeper_felled'
    | 'cartographer_felled'
    | 'keeper_deep'
    | 'cartographer_deep'
    | 'warden_deepest'
    | 'keeper_pinned'
    | 'warden_dealt_again'
    | 'learned'
    | 'sleeper_woken'
    | 'spiral_two_rings'
    | 'carve_through_hold'
    | 'vault_saved'
    | 'raging_blueprint'
    | 'first_reprise'
    | 'wanderer_steps'
    | 'colossus_felled'
    | 'hourglass_three'
    | 'realm_peak'
    | 'confluence'
    | 'endless_floor';

export type FeatOptionId = 'camp_evolve';

export interface FeatDefinition {
    readonly id: FeatId;
    readonly name: string;
    /** The condition, as the Collection and the Codex say it. */
    readonly condition: string;
    readonly title: CosmeticId;
    /** A title always, and an option at most: never a number (`feat-unlocks.test.ts`). */
    readonly option: FeatOptionId | null;
    /** What the unlock gives, in a sentence. */
    readonly unlocks: string;
    readonly earned: (run: RunState) => boolean;
}

const won = (run: RunState): boolean => run.status === 'levelComplete';
const raging = (run: RunState): boolean => run.realmSeverity === 'raging';

export const FEATS: readonly FeatDefinition[] = [
    { id: 'held_twelve', name: tr.s('Twelve Held'), condition: tr.s('Release a Hold of twelve pairs.'), title: 'title_twelve_held', option: null, unlocks: tr.s('The title Twelve Held.'), earned: (run) => runNonNegativeInteger(run.largestHeldReleaseThisRun) >= 12 },
    { id: 'warden_felled', name: tr.s('Warden-Feller'), condition: tr.s('Fell the complete Warden, behind the wild or raging door.'), title: 'title_warden_feller', option: null, unlocks: tr.s('The title Warden-Feller.'), earned: (run) => won(run) && run.wardenFelled === true },
    { id: 'first_evolution', name: tr.s('Alchemist'), condition: tr.s('Evolve two relics at camp.'), title: 'title_alchemist', option: 'camp_evolve', unlocks: tr.s('The title Alchemist, and the Evolve camp preference.'), earned: (run) => (run.evolutions ?? []).length > 0 },
    { id: 'three_carves', name: tr.s('Mason'), condition: tr.s('Spend three carves on one floor.'), title: 'title_mason', option: null, unlocks: tr.s('The title Mason.'), earned: (run) => runNonNegativeInteger(run.carvesSpentThisFloor) >= 3 },
    { id: 'five_reprises', name: tr.s('Encore'), condition: tr.s('Reprise on five floors of one run.'), title: 'title_encore', option: null, unlocks: tr.s('The title Encore.'), earned: (run) => runNonNegativeInteger(run.reprisesThisRun) >= 5 },
    { id: 'spiral_survived', name: tr.s('Ring-Walker'), condition: tr.s('Survive a Spiral to par.'), title: 'title_ring_walker', option: null, unlocks: tr.s('The title Ring-Walker.'), earned: (run) => won(run) && run.spiralSurvived === true },
    { id: 'sleepers_kept', name: tr.s('Night Watch'), condition: tr.s('Keep three Sleepers down on one floor.'), title: 'title_night_watch', option: null, unlocks: tr.s('The title Night Watch.'), earned: (run) => runNonNegativeInteger(run.sleepersKeptDownThisFloor) >= 3 },
    { id: 'keeper_raging', name: tr.s('Hallbreaker'), condition: tr.s('Beat the Keeper of Halls behind the raging door.'), title: 'title_hallbreaker', option: null, unlocks: tr.s('The title Hallbreaker.'), earned: (run) => won(run) && raging(run) && isKeeperFloor(run.board) },
    { id: 'cartographer_raging', name: tr.s('Map-Burner'), condition: tr.s('Beat the Cartographer behind the raging door.'), title: 'title_map_burner', option: null, unlocks: tr.s('The title Map-Burner.'), earned: (run) => won(run) && raging(run) && isCartographerFloor(run.board) },
    { id: 'three_unmasked', name: tr.s('Unmasker'), condition: tr.s('Drop three masks on one floor.'), title: 'title_unmasker', option: null, unlocks: tr.s('The title Unmasker.'), earned: (run) => runNonNegativeInteger(run.masksDroppedThisFloor) >= 3 },
    // The second twenty (2026-10-23): titles for deeds in the bosses, the Depths, the families, the Hold, the realms and Endless.
    { id: 'keeper_felled', name: tr.s('Doorwarden'), condition: tr.s('Beat the Keeper of Halls.'), title: 'title_doorwarden', option: null, unlocks: tr.s('The title Doorwarden.'), earned: (run) => won(run) && isKeeperFloor(run.board) },
    { id: 'cartographer_felled', name: tr.s('Chartwright'), condition: tr.s('Beat the Cartographer.'), title: 'title_chartwright', option: null, unlocks: tr.s('The title Chartwright.'), earned: (run) => won(run) && isCartographerFloor(run.board) },
    { id: 'keeper_deep', name: tr.s('Deep Doorwarden'), condition: tr.s('Beat the Keeper of Halls at Depth 10 or deeper.'), title: 'title_deep_doorwarden', option: null, unlocks: tr.s('The title Deep Doorwarden.'), earned: (run) => won(run) && isKeeperFloor(run.board) && runDepth(run) >= 10 },
    { id: 'cartographer_deep', name: tr.s('Deep Chartwright'), condition: tr.s('Beat the Cartographer at Depth 15 or deeper.'), title: 'title_deep_chartwright', option: null, unlocks: tr.s('The title Deep Chartwright.'), earned: (run) => won(run) && isCartographerFloor(run.board) && runDepth(run) >= 15 },
    { id: 'warden_deepest', name: tr.s('Abyssal'), condition: tr.s('Fell the Warden at Depth 20.'), title: 'title_abyssal', option: null, unlocks: tr.s('The title Abyssal.'), earned: (run) => won(run) && run.wardenOutcome === 'cleared' && runDepth(run) >= 20 },
    { id: 'keeper_pinned', name: tr.s('Lockkeeper'), condition: tr.s('Hold a pin through the Keeper of Halls’ swap.'), title: 'title_lockkeeper', option: null, unlocks: tr.s('The title Lockkeeper.'), earned: (run) => isKeeperFloor(run.board) && runNonNegativeInteger(run.keeperSwapsThisFloor) >= 1 && (run.pinnedTileIds ?? []).length > 0 },
    { id: 'warden_dealt_again', name: tr.s('Second Board'), condition: tr.s('Clear the board before the complete Warden, and be dealt it again.'), title: 'title_second_board', option: null, unlocks: tr.s('The title Second Board.'), earned: (run) => runNonNegativeInteger(run.wardenDealsAgainThisFloor) >= 1 },
    { id: 'learned', name: tr.s('Known'), condition: tr.s('Be told what the dungeon learned about you.'), title: 'title_known', option: null, unlocks: tr.s('The title Known.'), earned: (run) => run.learnedRule != null },
    { id: 'sleeper_woken', name: tr.s('Early Riser'), condition: tr.s('Watch a Sleeper wake.'), title: 'title_early_riser', option: null, unlocks: tr.s('The title Early Riser.'), earned: (run) => runNonNegativeInteger(run.sleepersWokenThisFloor) >= 1 },
    { id: 'spiral_two_rings', name: tr.s('Spiral-Breaker'), condition: tr.s('Seal two rings of a Spiral on one floor.'), title: 'title_spiral_breaker', option: null, unlocks: tr.s('The title Spiral-Breaker.'), earned: (run) => runNonNegativeInteger(run.spiralRingsSealedThisFloor) >= 2 },
    { id: 'carve_through_hold', name: tr.s('Hollow Stone'), condition: tr.s('Spend a carve on the pop of a released Hold.'), title: 'title_hollow_stone', option: null, unlocks: tr.s('The title Hollow Stone.'), earned: (run) => runNonNegativeInteger(run.carvesSpentThisFloor) >= 1 && runNonNegativeInteger(run.holdsReleasedThisFloor) >= 1 },
    { id: 'vault_saved', name: tr.s('Vault-Keeper'), condition: tr.s('Be saved by the Miser\u2019s Vault.'), title: 'title_vault_keeper', option: null, unlocks: tr.s('The title Vault-Keeper.'), earned: (run) => run.misersVaultUsedThisFloor === true },
    { id: 'raging_blueprint', name: tr.s('Draughtsman'), condition: tr.s('Win a blueprint from a boss behind the raging door.'), title: 'title_draughtsman', option: null, unlocks: tr.s('The title Draughtsman.'), earned: (run) => (run.blueprints ?? []).length > 0 },
    { id: 'first_reprise', name: tr.s('Second Take'), condition: tr.s('Reprise for the first time.'), title: 'title_second_take', option: null, unlocks: tr.s('The title Second Take.'), earned: (run) => runNonNegativeInteger(run.reprisesThisRun) >= 1 },
    { id: 'wanderer_steps', name: tr.s('Tracker'), condition: tr.s('Watch the Wanderers step three times on one floor.'), title: 'title_tracker', option: null, unlocks: tr.s('The title Tracker.'), earned: (run) => runNonNegativeInteger(run.wandererStepsThisFloor) >= 3 },
    { id: 'colossus_felled', name: tr.s('Giantsbane'), condition: tr.s('Fell a Colossus.'), title: 'title_giantsbane', option: null, unlocks: tr.s('The title Giantsbane.'), earned: (run) => runNonNegativeInteger(run.colossiFelledThisRun) >= 1 },
    { id: 'hourglass_three', name: tr.s('Sandcatcher'), condition: tr.s('Catch three Hourglasses in one run.'), title: 'title_sandcatcher', option: null, unlocks: tr.s('The title Sandcatcher.'), earned: (run) => runNonNegativeInteger(run.hourglassesCaughtThisRun) >= 3 },
    { id: 'realm_peak', name: tr.s('Weathered'), condition: tr.s('Weather a realm at its peak.'), title: 'title_weathered', option: null, unlocks: tr.s('The title Weathered.'), earned: (run) => runNonNegativeInteger(run.realmPeaksThisFloor) >= 1 },
    { id: 'confluence', name: tr.s('Confluent'), condition: tr.s('Walk into a confluence of two realms.'), title: 'title_confluent', option: null, unlocks: tr.s('The title Confluent.'), earned: (run) => run.realmSecondaryId != null },
    { id: 'endless_floor', name: tr.s('Past the Gate'), condition: tr.s('Clear a floor of Endless.'), title: 'title_past_the_gate', option: null, unlocks: tr.s('The title Past the Gate.'), earned: (run) => won(run) && run.endless === true }
];

export const FEAT_IDS: readonly FeatId[] = FEATS.map((feat) => feat.id);
export const FEAT_OPTION_IDS: readonly FeatOptionId[] = ['camp_evolve'];

export const featTag = (id: FeatId): string => `feat:${id}`;
export const featOptionTag = (id: FeatOptionId): string => `option:${id}`;

/** The feats this run has done so far. */
export const earnedFeats = (run: RunState): FeatId[] => FEATS.filter((feat) => feat.earned(run)).map((feat) => feat.id);

/** Whether the profile holds a feat, or a feat's option. */
export const hasFeat = (save: Pick<SaveData, 'unlocks'>, id: FeatId): boolean => (save.unlocks ?? []).includes(featTag(id));
export const hasFeatOption = (save: Pick<SaveData, 'unlocks'>, id: FeatOptionId): boolean => (save.unlocks ?? []).includes(featOptionTag(id));

/** The run's feats folded into the profile: the feat, its title, and its option. */
export const recordFeats = (save: SaveData, run: RunState): SaveData => {
    const earned = earnedFeats(run);
    if (earned.length === 0) return save;
    const tags = earned.flatMap((id) => {
        const feat = FEATS.find((entry) => entry.id === id)!;
        return [featTag(id), `cosmetic:${feat.title}`, ...(feat.option ? [featOptionTag(feat.option)] : [])];
    });
    const unlocks = [...new Set([...(save.unlocks ?? []), ...tags])];
    return unlocks.length === (save.unlocks ?? []).length ? save : { ...save, unlocks };
};
