import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId
} from './contracts';
import type { FloorScheduleEntry } from './floor-mutator-schedule';
import type { MechanicTokenId } from './mechanic-feedback';
import { SCATTERED_SUIT_CEILING, getSuitDealProfile, suitCountForDeal } from './tile-suit-rules';

/**
 * How many suits this archetype's deal actually puts on a board, and what that does to a pop.
 *
 * Gen 261 added this because three separate strings on a boss floor asserted a palette and each was
 * wrong for at least one of the archetypes that can carry the boss tag. The keystone floor told every
 * player "two suits, long chains" - true of `trap_hall`, `rush_recall` and `spotlight_hunt`, and false
 * of `treasure_gallery`, which the position-nine rotation also tags boss and which deals four. So one
 * boss floor in three named the wrong palette, in three sentences at once.
 *
 * The second half was backwards as well. Both the clear line and the boss mechanics list said a
 * scattered deal means "many small pops rather than one big one" - but scattered means
 * `SCATTERED_SUIT_CEILING`, which is two suits, and two suits is the WIDEST reach a pop gets
 * (measured, Gen 259: a two-suit board costs 0.74 of a four-suit board's turns per pair). This file's
 * own narrow-palette branch had it right - "the pops here are the widest of the run" - while the boss
 * branch beside it said the opposite about the same board.
 *
 * Read from `SUIT_DEAL_PROFILE_BY_ARCHETYPE` rather than restated, so a floor cannot describe a deal
 * it is not given.
 */
export const paletteMechanicLine = (floorArchetypeId: FloorArchetypeId | null | undefined): string => {
    const { suits, narrow } = floorPaletteRead(floorArchetypeId);
    // 2026-09-23: the break is capped by rung, so the palette no longer changes what a pop takes.
    // A narrow palette is three suits and a chain that is easier to keep; a wide one is more map.
    return narrow
        ? `Three-suit deal: a card of your kind is never far, so a chain is easier to keep.`
        : `${suits}-suit deal: more map to read; a pop takes what it touches, whatever the palette.`;
};

export const floorPaletteRead = (
    floorArchetypeId: FloorArchetypeId | null | undefined
): { suits: number; narrow: boolean } => {
    const suits = suitCountForDeal(getSuitDealProfile(floorArchetypeId));
    return { suits, narrow: suits <= SCATTERED_SUIT_CEILING };
};

export type BossEliteEncounterKind = 'boss';

export interface BossElitePresentationSlot {
    slot: 'icon' | 'key_art' | 'audio_stinger' | 'fx_burst';
    placeholderNeeded: boolean;
    fallback: string;
}

export interface BossEliteEncounterIdentity {
    kind: BossEliteEncounterKind;
    id: string;
    label: string;
    readRule: string;
    readabilityChecklist?: string;
    mechanics: string[];
    rewardHook: string;
    payoffCopy?: string;
    scoreRule: string;
    presentationSlots: BossElitePresentationSlot[];
    offlineOnly: true;
}

const PRESENTATION_SLOTS: readonly BossElitePresentationSlot[] = [
    {
        slot: 'icon',
        placeholderNeeded: false,
        fallback: 'Reuse existing floor tag pill / route node glyph.'
    },
    {
        slot: 'key_art',
        placeholderNeeded: true,
        fallback: 'Use current chapter panel gradient and procedural frame.'
    },
    {
        slot: 'audio_stinger',
        placeholderNeeded: true,
        fallback: 'Silence; do not block local/offline play.'
    },
    {
        slot: 'fx_burst',
        placeholderNeeded: true,
        fallback: 'Existing HUD pulse / reduced-motion safe CSS transition.'
    }
] as const;

const mechanicCopy = (mutators: readonly MutatorId[], floorArchetypeId: FloorArchetypeId | null): string[] => {
    const rows = mutators.map((mutator) => `Mutator: ${mutator.replace(/_/g, ' ')}.`);
    if (floorArchetypeId) {
        rows.unshift(`Chapter identity: ${floorArchetypeId.replace(/_/g, ' ')}.`);
    }
    return rows.length > 0 ? rows : ['No extra mutator; identity comes from route risk and reward pacing.'];
};

/*
 * Gen 201: two of the four "mechanics" this promised do not exist. Favor was the Endless wager's
 * currency and went in Gen 175 with the relic draft it paid into; the "Keystone Pair board anchor"
 * appears nowhere in the game at all - no field, no rule, no generator. Both were named in the HUD
 * title a player reads on a boss floor. What a boss floor really is: a score multiplier, a
 * scattered deal, and whatever the schedule hangs on it.
 */
export const BOSS_ENCOUNTER_IDENTITY: BossEliteEncounterIdentity = {
    kind: 'boss',
    id: 'boss_floor_identity',
    label: 'Keystone Warden',
    readRule: 'Boss floors must display the Keystone Warden tag, a chapter/risk note, and at least one named pressure mechanic before or during play.',
    mechanics: [
        'Keystone Warden boss tag.',
        'Chapter schedule pressure mutators.',
        'Featured objective bonus.',
        'Scattered suit deal: short chains, many small pops.'
    ],
    rewardHook: `Every point on the floor is worth ${BOSS_FLOOR_SCORE_MULTIPLIER}x, the chain bonus included.`,
    scoreRule: `${BOSS_FLOOR_SCORE_MULTIPLIER}x score multiplier after floor subtotal bonuses.`,
    presentationSlots: [...PRESENTATION_SLOTS],
    offlineOnly: true
};

export const getBossEncounterIdentityForFloor = (
    floorTag: FloorTag,
    entry: Pick<FloorScheduleEntry, 'floorArchetypeId' | 'mutators' | 'riskProfile'>
): BossEliteEncounterIdentity | null => {
    if (floorTag !== 'boss') {
        return null;
    }
    return {
        ...BOSS_ENCOUNTER_IDENTITY,
        presentationSlots: BOSS_ENCOUNTER_IDENTITY.presentationSlots.map((slot) => ({ ...slot })),
        readabilityChecklist: `${BOSS_ENCOUNTER_IDENTITY.readRule} Pending presentation slots: ${BOSS_ENCOUNTER_IDENTITY.presentationSlots
            .filter((slot) => slot.placeholderNeeded)
            .map((slot) => slot.slot.replace(/_/g, ' '))
            .join(', ')}.`,
        payoffCopy: `Boss pressure: ${BOSS_ENCOUNTER_IDENTITY.scoreRule} ${BOSS_ENCOUNTER_IDENTITY.rewardHook} Offline-safe fallback art and audio keep the encounter readable.`,
        mechanics: [
            `${BOSS_ENCOUNTER_IDENTITY.label} boss tag.`,
            ...mechanicCopy(entry.mutators, entry.floorArchetypeId),
            /*
             * Gen 213: this line was 'Keystone Pair board anchor.' - the same phantom the comment
             * above BOSS_ENCOUNTER_IDENTITY says appears nowhere in the game. Gen 201 took it out
             * of the constant and left it in the builder that a real floor goes through, so the
             * mechanics list every boss floor actually produced still named it.
             *
             * Gen 261: what replaced it was wrong twice. It said every boss floor deals its suits
             * scattered - false for the boss-tagged `treasure_gallery` the position-nine rotation
             * deals, which is clumped - and it said a scattered deal means short chains and many
             * small pops, which is backwards: scattered is two suits, and two suits is the widest
             * reach a pop gets. Read off the archetype now (`floorPaletteRead`).
             */
            paletteMechanicLine(entry.floorArchetypeId),
            entry.riskProfile ? `Risk read: ${entry.riskProfile}` : 'Risk read: boss pressure.'
        ]
    };
};

export const getBossFloorHudTitle = (
    entry: Pick<FloorScheduleEntry, 'floorArchetypeId' | 'mutators' | 'riskProfile'>
): string => {
    const identity = getBossEncounterIdentityForFloor('boss', entry);
    return identity
        ? `${identity.label}: ${identity.scoreRule} ${identity.rewardHook}`
        : 'Keystone Warden scoring';
};

export interface EncounterIdentityRow {
    encounterRank: BossEliteEncounterKind;
    label: string;
    scoreRule: string;
    mechanics: string[];
    placeholderNeeded: boolean;
    placeholderSlots: string[];
}

export type FloorIdentityWarningLevel = 'baseline' | 'safe' | 'reward' | 'warning' | 'danger';

export interface FloorIdentityContract {
    id: string;
    label: string;
    teachingSentence: string;
    counterplaySentence: string;
    floorClearSentence: string;
    atmosphericFeedback: string;
    activeReminder: string;
    warningLevel: FloorIdentityWarningLevel;
    tokens: MechanicTokenId[];
}

const objectiveSuffix = (featuredObjectiveLabel?: string | null): string =>
    featuredObjectiveLabel ? ` Objective: ${featuredObjectiveLabel}.` : '';

/*
 * Gen 201 rewrote every sentence below.
 *
 * This is the coaching a player reads *during a run*, on the floor they are standing on, and until
 * now it taught a game that has not existed since Gen 176. It named trap bounties and clean
 * disarms, the Trap Workshop and the Rune Seal, keys and locks and cache extraction, guard and
 * scout value, the parasite clock, boss blockers, and finding the exit. Every one of those left
 * with the dungeon layer, the hazards, the lives and the exits. A player following this advice was
 * being told to manage a resource they do not have, on a floor that does not work that way.
 *
 * What a floor archetype actually decides now is one thing: how the deal lays the suits out -
 * `clumped`, `scattered` or `two_suit` (`SUIT_DEAL_PROFILE_BY_ARCHETYPE`) - plus which mutators the
 * schedule hangs on it. That shape is what decides how far a pop reaches, so that is what the
 * coaching says. It is the same four sentences per floor, aimed at the game being played.
 */
export const getFloorIdentityContract = ({
    floorTag,
    floorArchetypeId,
    mutators,
    featuredObjectiveLabel
}: {
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    mutators: readonly MutatorId[];
    featuredObjectiveLabel?: string | null;
}): FloorIdentityContract => {
    if (floorTag === 'boss' || floorArchetypeId === 'rush_recall') {
        // Gen 261: read the palette rather than asserting it. A boss-tagged `treasure_gallery` deals
        // four suits, and this branch told it it dealt two.
        const keystone = floorPaletteRead(floorArchetypeId);
        return {
            id: 'boss_trophy_moment',
            label: 'Keystone chamber',
            teachingSentence: keystone.narrow
                ? `A keystone floor deals three suits, so the card you need is never far to look for and the chain is easier to keep.${objectiveSuffix(featuredObjectiveLabel)}`
                : `This keystone deals the full ${keystone.suits} suits: more map to read, and the pressure is the board's size rather than the chain.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: mutators.includes('short_memorize')
                ? 'The study window is short here: learn the board in one look, then let the tools carry the floor rather than the memory.'
                : 'Take the pairs whose suit still has neighbours first; the isolated ones pay the same whenever you take them.',
            floorClearSentence: keystone.narrow
                ? 'Keystone cleared. On three suits the chain was easy to keep; what you chose was the order.'
                : `Keystone cleared. On ${keystone.suits} suits the score came from the chain you kept rather than from any one pop.`,
            atmosphericFeedback: 'The Keystone chamber goes quiet, but the last matched pair still hangs in the air.',
            activeReminder: keystone.narrow
                ? 'Keystone: three suits, a chain that is easy to keep.'
                : `Keystone: ${keystone.suits} suits, read the map.`,
            warningLevel: 'danger',
            tokens: ['objective', 'risk', 'reward', 'momentum']
        };
    }

    if (floorArchetypeId === 'trap_hall' || floorArchetypeId === 'speed_trial') {
        return {
            id: 'narrow_palette_hall',
            label: floorArchetypeId === 'speed_trial' ? 'Speed trial' : 'Narrow hall',
            teachingSentence: `Three suits on this floor, so a card of your own kind is never far to look for.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'A narrow palette is a chaining floor. Hold a known pair until the chain is at Clean and the pop will take what it touches.',
            floorClearSentence: 'Cleared. On a three-suit floor the chain is easy to keep; what you choose is the order.',
            atmosphericFeedback: 'The chalk rings fade one at a time, in the order you found them.',
            activeReminder: 'Three suits: the chain is easy to keep here.',
            warningLevel: 'warning',
            tokens: ['risk', 'reward', 'resolved', 'momentum']
        };
    }

    if (floorArchetypeId === 'spotlight_hunt') {
        return {
            id: 'two_suit_hunt',
            label: 'Spotlight hunt',
            teachingSentence: `Three suits, whatever the board's size - the narrowest palette the deal gives you past the first floor.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'This is the floor to chain on. Hold a known pair back until the chain is at Clean and the pop will take what it touches.',
            floorClearSentence: 'Spotlight cleared. Three suits is the narrowest palette a floor gets, and the easiest chain to keep.',
            atmosphericFeedback: 'The spotlight swings off the last pair and the hall goes even.',
            activeReminder: 'Three suits: the easiest chains of the run live here.',
            warningLevel: 'reward',
            tokens: ['reward', 'momentum', 'objective']
        };
    }

    if (floorArchetypeId === 'treasure_gallery') {
        const dense = mutators.includes('findables_floor');
        return {
            id: dense ? 'pickup_gallery_dense' : 'pickup_gallery',
            label: dense ? 'Dense gallery' : 'Gallery',
            teachingSentence: `Pickup pairs are shuffled in with everything else, so a pop can spill a glint you have not found yet.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Matching a carrier pair claims its glint; a break that takes the carrier spills it and pays it anyway. Either way the score arrives.',
            floorClearSentence: 'Gallery cleared. Claimed glints and spilled ones are worth the same, which is why the chain never costs you a pickup.',
            atmosphericFeedback: 'The gallery shutters click shut behind the weight of what you carried out.',
            activeReminder: 'Gallery: glints pay whether you claim them or pop them.',
            warningLevel: 'reward',
            tokens: ['reward', 'resolved', 'momentum']
        };
    }

    if (floorTag === 'breather' || floorArchetypeId === 'breather') {
        /*
         * Gen 261: read the palette here too. The `breather` TAG is not the `breather` ARCHETYPE -
         * the cycle tags floors 3 and 10 breather and gives both of them `treasure_gallery`, which is
         * clumped and deals four suits. Gen 260 rewrote this block for the archetype's new two-suit
         * deal and so told those two floors they dealt two, and left the clear line below still
         * saying four, contradicting the two sentences above it. All three read the board now.
         */
        const rest = floorPaletteRead(floorArchetypeId);
        return {
            id: 'recovery_study_room',
            label: 'Recovery study',
            teachingSentence: rest.narrow
                ? `A breather asks for less and deals three suits, and every break here takes a pair more than it would elsewhere, so a broken chain is cheap to rebuild.${objectiveSuffix(featuredObjectiveLabel)}`
                : `A breather asks for less, and this one deals the full ${rest.suits} suits, so the floor is a place to bank rather than to chain.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Charges do not carry a premium for being saved. Spend them on the floor that is easy to read and bank the score.',
            floorClearSentence: rest.narrow
                ? 'Breather cleared. The breaks ran a pair deeper here, and the floor never pushed back.'
                : `Breather cleared. ${rest.suits} suits, and the floor never pushed back.`,
            atmosphericFeedback: 'The study lamps keep burning after you leave, holding the next route in soft focus.',
            activeReminder: rest.narrow
                ? 'Breather: three suits, breaks a pair deeper, cheap floor to rebuild a chain on.'
                : `Breather: ${rest.suits} suits, cheap floor to bank on.`,
            warningLevel: 'safe',
            tokens: ['safe', 'hidden_known', 'reward', 'momentum']
        };
    }

    if (floorArchetypeId === 'lantern_hall') {
        return {
            id: 'lantern_light',
            label: 'Lantern hall',
            teachingSentence: `Every match lights up to three of the face-down cards touching it, until you turn the next card.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Match in the middle of what you have not read: a pair at the edge lights little, one in the dark lights the most.',
            floorClearSentence: 'Lantern hall cleared. You went where the light would help.',
            atmosphericFeedback: 'The lanterns gutter out one by one behind you.',
            activeReminder: 'Lantern hall: a match lights its neighbours. Read them before the next flip.',
            warningLevel: 'reward',
            tokens: ['reward', 'hidden_known', 'momentum']
        };
    }

    if (floorArchetypeId === 'skittish_hall') {
        return {
            id: 'skittish_cards',
            label: 'Skittish hall',
            teachingSentence: `Miss, and the two cards you just saw each flinch one step - up, down, left or right.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'A card you missed is next to where it was: check its neighbours before the rest of the board, and pin what you cannot afford to lose - a pinned card never moves.',
            floorClearSentence: 'Skittish hall cleared. You kept track of cards that would not keep still.',
            atmosphericFeedback: 'The cards settle into their cells and stop twitching.',
            activeReminder: 'Skittish hall: a missed card moves one step. Look beside it.',
            warningLevel: 'warning',
            tokens: ['hidden_known', 'risk', 'objective']
        };
    }

    if (floorArchetypeId === 'anchor_chain') {
        return {
            id: 'anchor_floor',
            label: 'Anchor chain',
            teachingSentence: `After a match the floor marks one face-down card: match it with its partner for an extra chain link.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'The marked card is half the answer. Remember where its partner was, and take the anchor before two other matches move it on.',
            floorClearSentence: 'Anchor floor cleared. The pairs the floor pointed at were the ones worth taking.',
            atmosphericFeedback: 'The mortar settles, and the pair the room kept asking for goes quiet with it.',
            warningLevel: 'warning',
            activeReminder: 'Anchor floor: find the marked card’s partner for an extra link.',
            tokens: ['objective', 'cost', 'safe']
        };
    }

    if (floorArchetypeId === 'restless_hall') {
        return {
            id: 'restless_floor',
            label: 'Restless hall',
            teachingSentence: `Every third turn the floor shifts: hidden cards trade places, one pair at first and up to three once you linger.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Clear the pairs you know before the clock ticks, and pin the card you cannot afford to lose - a pinned card never moves.',
            floorClearSentence: 'Restless hall cleared. The floor moved and you moved faster.',
            atmosphericFeedback: 'The flagstones settle. Whatever was still shifting under the cards has gone quiet.',
            activeReminder: 'Restless hall: the board drifts every third turn. Pin what matters.',
            warningLevel: 'warning',
            tokens: ['hidden_known', 'risk', 'objective']
        };
    }

    if (floorArchetypeId === 'shadow_read') {
        return {
            id: 'scout_read_floor',
            label: 'Shadow read',
            teachingSentence: `The cards are harder to read here, but the suit on every back still tells you what a match would take.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Read the suit on the back rather than trying to hold the face. Contact is what the pop cares about, not identity.',
            floorClearSentence: 'Read floor cleared. Suit on the back was enough; the faces were never the whole puzzle.',
            atmosphericFeedback: 'The remaining shadows keep their names, but the route you proved stays legible.',
            activeReminder: 'Read floor: play the suits on the backs.',
            warningLevel: 'warning',
            tokens: ['hidden_known', 'risk', 'objective']
        };
    }

    return {
        id: 'baseline_floor',
        label: 'Baseline descent',
        teachingSentence: `No twist on this floor: clear the board, and take the matches that touch their own kind first.${objectiveSuffix(featuredObjectiveLabel)}`,
        counterplaySentence: 'A tool spent here is a tool not spent on a harder floor, but an unspent charge scores nothing either.',
        floorClearSentence: 'Floor cleared. The board is empty, which is the only condition the floor ever had.',
        atmosphericFeedback: 'The corridor remembers the clean pairs first and lets the rest fade into the stone.',
        activeReminder: 'Baseline: clear the board, chain where you can.',
        warningLevel: 'baseline',
        tokens: ['objective', 'safe', 'reward']
    };
};

const rowFromIdentity = (identity: BossEliteEncounterIdentity): EncounterIdentityRow => ({
    encounterRank: identity.kind,
    label: 'Boss encounter',
    scoreRule: 'Applies the boss floor score multiplier after bonuses.',
    mechanics: identity.mechanics,
    placeholderNeeded: identity.presentationSlots.some((slot) => slot.placeholderNeeded),
    placeholderSlots: ['boss intro stinger', 'boss key art panel', 'boss FX burst']
});

export const getEncounterIdentityForFloor = (
    entry: FloorScheduleEntry
): EncounterIdentityRow | null => {
    const identity = getBossEncounterIdentityForFloor(entry.floorTag, entry);
    return identity ? rowFromIdentity(identity) : null;
};
