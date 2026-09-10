import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId
} from './contracts';
import type { FloorScheduleEntry } from './floor-mutator-schedule';
import type { MechanicTokenId } from './mechanic-feedback';

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
            'Keystone Pair board anchor.',
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
        return {
            id: 'boss_trophy_moment',
            label: 'Keystone chamber',
            teachingSentence: `A keystone floor deals its suits scattered, so a match takes only what it touches and chains are short.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: mutators.includes('short_memorize')
                ? 'The study window is short here: learn the board in one look, then let the tools carry the floor rather than the memory.'
                : 'Take the pairs whose suit still has neighbours first; the isolated ones pay the same whenever you take them.',
            floorClearSentence: 'Keystone cleared. On a scattered deal the score comes from many small pops rather than one big one.',
            atmosphericFeedback: 'The Keystone chamber goes quiet, but the last matched pair still hangs in the air.',
            activeReminder: 'Keystone: scattered suits, short chains.',
            warningLevel: 'danger',
            tokens: ['objective', 'risk', 'reward', 'momentum']
        };
    }

    if (floorArchetypeId === 'trap_hall' || floorArchetypeId === 'speed_trial') {
        return {
            id: 'scattered_hall',
            label: floorArchetypeId === 'speed_trial' ? 'Speed trial' : 'Scattered hall',
            teachingSentence: `The suits are scattered on this floor, so most matches pop alone and the chain ladder is hard to climb.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'A swap is worth more here than anywhere else: move one half of a pair against its own suit and the pop finds something to take.',
            floorClearSentence: 'Scattered floor cleared. Every pop that took more than its own pair was one you built.',
            atmosphericFeedback: 'The chalk rings fade one at a time, in the order you found them.',
            activeReminder: 'Scattered suits: build contact before you match.',
            warningLevel: 'warning',
            tokens: ['risk', 'reward', 'resolved', 'momentum']
        };
    }

    if (floorArchetypeId === 'spotlight_hunt') {
        return {
            id: 'two_suit_hunt',
            label: 'Spotlight hunt',
            teachingSentence: `Two suits only, whatever the board's size - so almost everything touches something of its own kind.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'This is the floor to chain on. Hold a known pair back until a match has already popped beside it and the tier will carry.',
            floorClearSentence: 'Spotlight cleared. Two suits is the widest reach the deal ever gives you.',
            atmosphericFeedback: 'The spotlight swings off the last pair and the hall goes even.',
            activeReminder: 'Two suits: the deepest chains of the run live here.',
            warningLevel: 'reward',
            tokens: ['reward', 'momentum', 'objective']
        };
    }

    if (floorArchetypeId === 'treasure_gallery') {
        const dense = mutators.includes('findables_floor');
        return {
            id: dense ? 'pickup_gallery_dense' : 'pickup_gallery',
            label: dense ? 'Dense gallery' : 'Gallery',
            teachingSentence: `Pickup pairs are on the board and the suits are clumped, so a pop can spill a glint you have not found yet.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Matching a carrier pair claims its glint; a break that takes the carrier spills it and pays it anyway. Either way the score arrives.',
            floorClearSentence: 'Gallery cleared. Claimed glints and spilled ones are worth the same, which is why the chain never costs you a pickup.',
            atmosphericFeedback: 'The gallery shutters click shut behind the weight of what you carried out.',
            activeReminder: 'Gallery: glints pay whether you claim them or pop them.',
            warningLevel: 'reward',
            tokens: ['reward', 'resolved', 'momentum']
        };
    }

    if (floorTag === 'breather' || floorArchetypeId === 'breather') {
        return {
            id: 'recovery_study_room',
            label: 'Recovery study',
            teachingSentence: `A breather deals big clumps and asks for less, which makes it the cheapest place to spend a peek or a flash.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Charges do not carry a premium for being saved. Spend them on the floor that is easy to read and bank the score.',
            floorClearSentence: 'Breather cleared. Big clumps mean the pops were wide even when the floor was gentle.',
            atmosphericFeedback: 'The study lamps keep burning after you leave, holding the next route in soft focus.',
            activeReminder: 'Breather: wide clumps, cheap floor to spend on.',
            warningLevel: 'safe',
            tokens: ['safe', 'hidden_known', 'reward', 'momentum']
        };
    }

    if (floorArchetypeId === 'parasite_tithe' || floorArchetypeId === 'anchor_chain') {
        return {
            id: 'anchor_floor',
            label: floorArchetypeId === 'anchor_chain' ? 'Anchor chain' : 'Tithe hall',
            teachingSentence: `Clumped suits and a floor that keeps asking you to remember one particular pair.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Pin the anchor rather than trusting it to memory; the pin costs nothing and survives a shuffle it would not otherwise.',
            floorClearSentence: 'Anchor floor cleared. The pairs the floor kept pointing at were the ones worth holding.',
            atmosphericFeedback: 'The mortar settles, and the pair the room kept asking for goes quiet with it.',
            warningLevel: 'warning',
            activeReminder: 'Anchor floor: pin what the floor keeps asking for.',
            tokens: ['objective', 'cost', 'safe']
        };
    }

    if (floorArchetypeId === 'shadow_read' || floorArchetypeId === 'script_room') {
        return {
            id: 'scout_read_floor',
            label: floorArchetypeId === 'script_room' ? 'Script read' : 'Shadow read',
            teachingSentence: `The cards are harder to read here, but the suits are clumped, so the backs still tell you where the chains are.${objectiveSuffix(featuredObjectiveLabel)}`,
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
        teachingSentence: `Clumped suits and no twist: clear the board, and take the matches that touch their own kind first.${objectiveSuffix(featuredObjectiveLabel)}`,
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
