import type { RunState, SaveData } from './contracts';
import type { CosmeticId } from './cosmetic-ids';
import { isCartographerFloor } from './cartographer-rules';
import { isKeeperFloor } from './keeper-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Feats (DGE-024): unlocks as a guided tour of the deep game.
 *
 * Each feat is something done in a mechanic players under-use, said aloud in the Collection and the
 * Codex before it is done (no hidden progress bars), and each unlocks something sideways - a title,
 * or an option built from what the game already has - never a number the deep game asks for. The
 * owner chose ten feats on existing options for this batch (2026-10-22); the rest come with their
 * mechanics. A feat is read off the run as it plays (\`earnedFeats\`) and kept on the profile as an
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
    | 'three_unmasked';

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
    { id: 'held_twelve', name: 'Twelve Held', condition: 'Release a Hold of twelve pairs.', title: 'title_twelve_held', option: null, unlocks: 'The title Twelve Held.', earned: (run) => runNonNegativeInteger(run.largestHeldReleaseThisRun) >= 12 },
    { id: 'warden_felled', name: 'Warden-Feller', condition: 'Fell the complete Warden, behind the wild or raging door.', title: 'title_warden_feller', option: null, unlocks: 'The title Warden-Feller.', earned: (run) => won(run) && run.wardenFelled === true },
    { id: 'first_evolution', name: 'Alchemist', condition: 'Evolve two relics at camp.', title: 'title_alchemist', option: 'camp_evolve', unlocks: 'The title Alchemist, and the Evolve camp preference.', earned: (run) => (run.evolutions ?? []).length > 0 },
    { id: 'three_carves', name: 'Mason', condition: 'Spend three carves on one floor.', title: 'title_mason', option: null, unlocks: 'The title Mason.', earned: (run) => runNonNegativeInteger(run.carvesSpentThisFloor) >= 3 },
    { id: 'five_reprises', name: 'Encore', condition: 'Reprise on five floors of one run.', title: 'title_encore', option: null, unlocks: 'The title Encore.', earned: (run) => runNonNegativeInteger(run.reprisesThisRun) >= 5 },
    { id: 'spiral_survived', name: 'Ring-Walker', condition: 'Survive a Spiral to par.', title: 'title_ring_walker', option: null, unlocks: 'The title Ring-Walker.', earned: (run) => won(run) && run.spiralSurvived === true },
    { id: 'sleepers_kept', name: 'Night Watch', condition: 'Keep three Sleepers down on one floor.', title: 'title_night_watch', option: null, unlocks: 'The title Night Watch.', earned: (run) => runNonNegativeInteger(run.sleepersKeptDownThisFloor) >= 3 },
    { id: 'keeper_raging', name: 'Hallbreaker', condition: 'Beat the Keeper of Halls behind the raging door.', title: 'title_hallbreaker', option: null, unlocks: 'The title Hallbreaker.', earned: (run) => won(run) && raging(run) && isKeeperFloor(run.board) },
    { id: 'cartographer_raging', name: 'Map-Burner', condition: 'Beat the Cartographer behind the raging door.', title: 'title_map_burner', option: null, unlocks: 'The title Map-Burner.', earned: (run) => won(run) && raging(run) && isCartographerFloor(run.board) },
    { id: 'three_unmasked', name: 'Unmasker', condition: 'Drop three masks on one floor.', title: 'title_unmasker', option: null, unlocks: 'The title Unmasker.', earned: (run) => runNonNegativeInteger(run.masksDroppedThisFloor) >= 3 }
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
