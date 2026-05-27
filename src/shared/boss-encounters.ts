import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId
} from './contracts';
import type { FloorScheduleEntry } from './floor-mutator-schedule';
import type { MechanicTokenId } from './mechanic-feedback';
import type { RunMapNodeKind } from './run-map';

export type BossEliteEncounterKind = 'boss' | 'elite';

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

export const BOSS_ENCOUNTER_IDENTITY: BossEliteEncounterIdentity = {
    kind: 'boss',
    id: 'boss_floor_identity',
    label: 'Keystone Warden',
    readRule: 'Boss floors must display the Keystone Warden tag, a chapter/risk note, and at least one named pressure mechanic before or during play.',
    mechanics: [
        'Keystone Warden boss tag.',
        'Chapter schedule pressure mutators.',
        'Featured objective favor bonus.',
        'Keystone Pair board anchor.'
    ],
    rewardHook: 'Keystone Pair route anchor plus +2 Favor on featured-objective success.',
    scoreRule: `${BOSS_FLOOR_SCORE_MULTIPLIER}x score multiplier after floor subtotal bonuses.`,
    presentationSlots: [...PRESENTATION_SLOTS],
    offlineOnly: true
};

export const ELITE_ENCOUNTER_IDENTITY: BossEliteEncounterIdentity = {
    kind: 'elite',
    id: 'elite_route_identity',
    label: 'Mnemonic Sentinel',
    readRule: 'Elite nodes must be greed-route pressure hooks: clearly harder than combat, not a vendor/rest/treasure node.',
    mechanics: [
        'Greed route node.',
        'Higher pressure floor hook.',
        'Elite Cache, Final Ward, or Omen Seal hard-route board anchor.'
    ],
    rewardHook: 'Route-specific elite anchors pay gold, guard/combo, or Favor/combo without boss score rules.',
    scoreRule: 'Uses normal floor scoring until a future elite multiplier is explicitly versioned.',
    presentationSlots: [...PRESENTATION_SLOTS],
    offlineOnly: true
};

export const getBossEliteEncounterIdentityForNode = (
    kind: RunMapNodeKind
): BossEliteEncounterIdentity | null =>
    kind === 'elite'
        ? {
              ...ELITE_ENCOUNTER_IDENTITY,
              mechanics: [...ELITE_ENCOUNTER_IDENTITY.mechanics],
              presentationSlots: ELITE_ENCOUNTER_IDENTITY.presentationSlots.map((slot) => ({ ...slot }))
          }
        : kind === 'combat'
          ? null
          : null;

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
            teachingSentence: `Boss pressure is active; complete the boss objective to claim the trophy cache.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: mutators.includes('short_memorize')
                ? 'Study the first reveal hard, then spend assists only when the boss route would otherwise collapse.'
                : 'Prioritize boss blockers before exits and preserve enough safety to finish the objective.',
            floorClearSentence: 'Boss trophy pressure resolved; read objective payout, forfeited cache value, and route momentum together.',
            atmosphericFeedback: 'The Keystone chamber goes quiet, but the last matched pair still hangs in the air.',
            activeReminder: 'Keystone Warden: finish the boss objective before leaving.',
            warningLevel: 'danger',
            tokens: ['objective', 'risk', 'reward', 'momentum']
        };
    }

    if (floorArchetypeId === 'trap_hall') {
        return {
            id: 'trap_bounty_hall',
            label: 'Trap bounty hall',
            teachingSentence: `Trap bounties are live; clean disarms pay, while destroy removes danger but forfeits bounty value.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Use Trap Workshop or Rune Seal to control armed traps before risky matches.',
            floorClearSentence: 'Trap bounty pressure resolved; clean disarms, workshop safety, and forfeited bounty value should be read together.',
            atmosphericFeedback: 'The pressure plates sink back under dust, leaving only chalk rings where danger paid out.',
            activeReminder: 'Trap bounty: disarm cleanly or forfeit value for safety.',
            warningLevel: 'danger',
            tokens: ['armed', 'risk', 'reward', 'forfeit', 'resolved', 'safe']
        };
    }

    if (floorArchetypeId === 'treasure_gallery') {
        const late = mutators.includes('findables_floor') && floorTag === 'breather';
        return {
            id: late ? 'locked_gallery_late' : 'locked_gallery',
            label: late ? 'Late locked gallery' : 'Locked gallery',
            teachingSentence: `Cache value is concentrated here; keys, locks, and pickups are the main extraction puzzle.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Check key count before locks, and avoid destroy on treasure carriers unless safety matters more.',
            floorClearSentence: 'Gallery extraction resolved; key spends, preserved caches, and forfeited treasure value define the floor result.',
            atmosphericFeedback: 'The gallery shutters click shut behind the weight of what you carried out.',
            activeReminder: 'Locked gallery: preserve cache value and spend keys intentionally.',
            warningLevel: 'reward',
            tokens: ['reward', 'cost', 'forfeit', 'locked', 'momentum']
        };
    }

    if (floorTag === 'breather' || floorArchetypeId === 'breather') {
        return {
            id: 'recovery_study_room',
            label: 'Recovery study',
            teachingSentence: `Lower pressure gives room to rebuild guard, scout information, and prepare for the next spike.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Claim guard and scout value before leaving; safe routes trade peak payout for steadier recovery.',
            floorClearSentence: 'Recovery study resolved; guard, scout information, and route preparation are the floor value.',
            atmosphericFeedback: 'The study lamps keep burning after you leave, holding the next route in soft focus.',
            activeReminder: 'Recovery study: scout, guard, and prep for the next floor.',
            warningLevel: 'safe',
            tokens: ['safe', 'hidden_known', 'reward', 'momentum']
        };
    }

    if (floorArchetypeId === 'parasite_tithe') {
        return {
            id: 'parasite_tithe',
            label: 'Parasite tithe',
            teachingSentence: `Parasite pressure taxes slow play; clean objective progress keeps the run from bleeding value.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Preserve guard, avoid low-value stalls, and use recovery tools before the parasite clock compounds.',
            floorClearSentence: 'Parasite tithe resolved; tempo, guard, and objective progress explain the sustain result.',
            atmosphericFeedback: 'The score parasite withdraws into the mortar, fed or starved by the pace you kept.',
            activeReminder: 'Parasite tithe: keep tempo and protect sustain.',
            warningLevel: 'warning',
            tokens: ['risk', 'cost', 'objective', 'safe']
        };
    }

    if (floorArchetypeId === 'shadow_read' || floorArchetypeId === 'script_room') {
        return {
            id: 'scout_read_floor',
            label: floorArchetypeId === 'script_room' ? 'Script read' : 'Shadow read',
            teachingSentence: `Information is partial; solve the fair clue boundary instead of expecting full card identity.${objectiveSuffix(featuredObjectiveLabel)}`,
            counterplaySentence: 'Use scout, peek, and pins to separate known family information from exact pair memory.',
            floorClearSentence: 'Read floor resolved; partial information, scout value, and exact-pair restraint define the result.',
            atmosphericFeedback: 'The remaining shadows keep their names, but the route you proved stays legible.',
            activeReminder: 'Read floor: partial information is the core pressure.',
            warningLevel: 'warning',
            tokens: ['hidden_known', 'risk', 'objective']
        };
    }

    return {
        id: 'baseline_floor',
        label: 'Baseline descent',
        teachingSentence: `Read the board, find the exit, and preserve optional objective value.${objectiveSuffix(featuredObjectiveLabel)}`,
        counterplaySentence: 'Use assists only when they save more value than they forfeit.',
        floorClearSentence: 'Baseline descent resolved; score, objective value, and assist discipline remain the main read.',
        atmosphericFeedback: 'The corridor remembers the clean pairs first and lets the rest fade into the stone.',
        activeReminder: 'Baseline: match cleanly and keep the objective visible.',
        warningLevel: 'baseline',
        tokens: ['objective', 'safe', 'reward']
    };
};

const rowFromIdentity = (identity: BossEliteEncounterIdentity): EncounterIdentityRow => ({
    encounterRank: identity.kind,
    label: identity.kind === 'boss' ? 'Boss encounter' : identity.label,
    scoreRule:
        identity.kind === 'boss'
            ? 'Applies the boss floor score multiplier after bonuses.'
            : 'No boss score multiplier; elite identity is route-pressure and reward pacing only.',
    mechanics: identity.mechanics,
    placeholderNeeded: identity.presentationSlots.some((slot) => slot.placeholderNeeded),
    placeholderSlots:
        identity.kind === 'boss'
            ? ['boss intro stinger', 'boss key art panel', 'boss FX burst']
            : ['elite route badge', 'elite key art panel', 'elite audio stinger']
});

export const getEncounterIdentityForFloor = (
    entry: FloorScheduleEntry
): EncounterIdentityRow | null => {
    const identity = getBossEncounterIdentityForFloor(entry.floorTag, entry);
    return identity ? rowFromIdentity(identity) : null;
};

export const getEncounterIdentityForRouteKind = (kind: RunMapNodeKind): EncounterIdentityRow | null => {
    const identity = getBossEliteEncounterIdentityForNode(kind);
    return identity ? rowFromIdentity(identity) : null;
};
