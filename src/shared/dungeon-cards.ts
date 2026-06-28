import {
    type DungeonCardEffectId,
    type DungeonCardKind,
    type DungeonObjectiveId,
    type DungeonCardState,
    type Tile
} from './contracts';
import {
    CORE_SAFE_MEMORY_TAX,
    type MechanicTokenId,
    type MemoryTaxScore
} from './mechanic-feedback';

export type DungeonCardRevealTiming = 'on_flip' | 'on_pair_match' | 'manual_reveal';
export type DungeonCardMatchRewardRole =
    | 'combat'
    | 'disarm'
    | 'loot'
    | 'guard'
    | 'route'
    | 'key'
    | 'unlock'
    | 'exit'
    | 'service'
    | 'room';
export type DungeonCardMismatchConsequence =
    | 'none'
    | 'enemy_attack'
    | 'trap_trigger'
    | 'missed_route_information'
    | 'delayed_access';

export interface DungeonCardKindDefinition {
    kind: DungeonCardKind;
    familyLabel: string;
    rulesRole: string;
    revealTiming: DungeonCardRevealTiming;
    matchReward: DungeonCardMatchRewardRole;
    mismatchConsequence: DungeonCardMismatchConsequence;
    objectiveContributions: DungeonObjectiveId[];
    tokens: MechanicTokenId[];
    memoryTax: MemoryTaxScore;
    copyLabel: string;
    helpText: string;
    usesCardPair: boolean;
    usesMovingEnemyHazard: boolean;
}

export interface DungeonCardEffectDefinition {
    effectId: DungeonCardEffectId;
    kind: DungeonCardKind;
    label: string;
    rulesRole: string;
    helpText: string;
}

export interface DungeonCardKnowledge {
    hasDungeonCard: boolean;
    state: DungeonCardState | 'none';
    familyKnown: boolean;
    effectKnown: boolean;
    claimable: boolean;
    familyLabel: string | null;
    effectLabel: string | null;
    stateLabel: string;
}

export const DUNGEON_CARD_KIND_DEFINITIONS: Record<DungeonCardKind, DungeonCardKindDefinition> = {
    enemy: {
        kind: 'enemy',
        familyLabel: 'Enemy',
        rulesRole: 'HP-bearing card pair that can be defeated by matching.',
        revealTiming: 'on_flip',
        matchReward: 'combat',
        mismatchConsequence: 'enemy_attack',
        objectiveContributions: ['defeat_boss', 'pacify_floor'],
        tokens: ['risk', 'objective', 'reward', 'resolved'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, hiddenPunishment: 1, boardCompletionRisk: 1, uiComprehensionLoad: 1 },
        copyLabel: 'Dungeon enemy',
        helpText: 'Match both enemy cards to defeat the encounter and earn combat rewards.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    trap: {
        kind: 'trap',
        familyLabel: 'Trap',
        rulesRole: 'Armed hazard pair that punishes mismatches until disarmed.',
        revealTiming: 'on_flip',
        matchReward: 'disarm',
        mismatchConsequence: 'trap_trigger',
        objectiveContributions: ['disarm_traps', 'reveal_unknowns'],
        tokens: ['risk', 'armed', 'resolved', 'forfeit'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, hiddenPunishment: 1, boardCompletionRisk: 1, uiComprehensionLoad: 2 },
        copyLabel: 'Dungeon trap',
        helpText: 'Revealed traps stay armed until their matching card is found.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    treasure: {
        kind: 'treasure',
        familyLabel: 'Treasure',
        rulesRole: 'Reward pair that pays score and shop gold.',
        revealTiming: 'on_pair_match',
        matchReward: 'loot',
        mismatchConsequence: 'none',
        objectiveContributions: ['loot_cache'],
        tokens: ['reward', 'forfeit'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, uiComprehensionLoad: 1 },
        copyLabel: 'Dungeon treasure',
        helpText: 'Treasure cards are optional rewards that improve the run economy.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    shrine: {
        kind: 'shrine',
        familyLabel: 'Shrine',
        rulesRole: 'Support pair that grants guard and relic favor.',
        revealTiming: 'on_pair_match',
        matchReward: 'guard',
        mismatchConsequence: 'none',
        objectiveContributions: [],
        tokens: ['safe', 'reward', 'momentum'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        copyLabel: 'Dungeon shrine',
        helpText: 'Shrines provide defensive and progression rewards when matched.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    gateway: {
        kind: 'gateway',
        familyLabel: 'Gateway',
        rulesRole: 'Route-selection pair for shaping the next floor.',
        revealTiming: 'on_pair_match',
        matchReward: 'route',
        mismatchConsequence: 'missed_route_information',
        objectiveContributions: ['claim_route'],
        tokens: ['objective', 'hidden_known', 'reward'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 1, uiComprehensionLoad: 2 },
        copyLabel: 'Dungeon gateway',
        helpText: 'Gateways select or reinforce the route profile for the next floor.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    key: {
        kind: 'key',
        familyLabel: 'Key',
        rulesRole: 'Inventory pair that banks a dungeon key.',
        revealTiming: 'on_pair_match',
        matchReward: 'key',
        mismatchConsequence: 'none',
        objectiveContributions: ['loot_cache'],
        tokens: ['reward', 'cost'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, uiComprehensionLoad: 1 },
        copyLabel: 'Dungeon key',
        helpText: 'Keys open locked exits, caches, and rooms depending on the current floor.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    lock: {
        kind: 'lock',
        familyLabel: 'Lock',
        rulesRole: 'Gated reward pair that spends a key for full loot.',
        revealTiming: 'on_pair_match',
        matchReward: 'unlock',
        mismatchConsequence: 'delayed_access',
        objectiveContributions: ['loot_cache'],
        tokens: ['locked', 'cost', 'reward', 'forfeit'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, boardCompletionRisk: 2, uiComprehensionLoad: 2 },
        copyLabel: 'Dungeon lock',
        helpText: 'Locks can become loot if the run has a matching key available.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    exit: {
        kind: 'exit',
        familyLabel: 'Exit',
        rulesRole: 'Singleton floor objective that must be activated to complete dungeon floors.',
        revealTiming: 'manual_reveal',
        matchReward: 'exit',
        mismatchConsequence: 'delayed_access',
        objectiveContributions: ['find_exit', 'open_bonus_exit', 'claim_route'],
        tokens: ['objective', 'locked', 'resolved'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, boardCompletionRisk: 2, uiComprehensionLoad: 2 },
        copyLabel: 'Dungeon exit',
        helpText: 'Exits are singleton utility cards gated by reveal state, levers, or keys.',
        usesCardPair: false,
        usesMovingEnemyHazard: false
    },
    lever: {
        kind: 'lever',
        familyLabel: 'Lever',
        rulesRole: 'Floor-local switch pair for exits and trap-control effects.',
        revealTiming: 'on_pair_match',
        matchReward: 'unlock',
        mismatchConsequence: 'none',
        objectiveContributions: ['find_exit', 'disarm_traps'],
        tokens: ['objective', 'resolved', 'safe'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, boardCompletionRisk: 1, uiComprehensionLoad: 1 },
        copyLabel: 'Dungeon lever',
        helpText: 'Levers satisfy floor-local locks or seal revealed traps.',
        usesCardPair: true,
        usesMovingEnemyHazard: false
    },
    shop: {
        kind: 'shop',
        familyLabel: 'Shop',
        rulesRole: 'Singleton vendor access point.',
        revealTiming: 'manual_reveal',
        matchReward: 'service',
        mismatchConsequence: 'none',
        objectiveContributions: [],
        tokens: ['cost', 'reward'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, uiComprehensionLoad: 1 },
        copyLabel: 'Dungeon shop',
        helpText: 'Shops open floor-local offers and can be revisited while the floor is active.',
        usesCardPair: false,
        usesMovingEnemyHazard: false
    },
    room: {
        kind: 'room',
        familyLabel: 'Room',
        rulesRole: 'Singleton interactable room with a deterministic service.',
        revealTiming: 'manual_reveal',
        matchReward: 'room',
        mismatchConsequence: 'delayed_access',
        objectiveContributions: ['loot_cache', 'reveal_unknowns'],
        tokens: ['cost', 'reward', 'hidden_known'],
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 1, boardCompletionRisk: 1, uiComprehensionLoad: 2 },
        copyLabel: 'Dungeon room',
        helpText: 'Rooms provide one-shot services such as healing, scouting, keys, or trap work.',
        usesCardPair: false,
        usesMovingEnemyHazard: false
    }
};

export const DUNGEON_CARD_EFFECT_DEFINITIONS: Record<DungeonCardEffectId, DungeonCardEffectDefinition> = {
    enemy_sentry: {
        effectId: 'enemy_sentry',
        kind: 'enemy',
        label: 'Archivist Sentry',
        rulesRole: 'Baseline enemy card pair.',
        helpText: 'A low-HP enemy defeated by matching its pair.'
    },
    enemy_elite: {
        effectId: 'enemy_elite',
        kind: 'enemy',
        label: 'Mnemonic Sentinel',
        rulesRole: 'Higher-HP enemy or boss card pair.',
        helpText: 'A stronger enemy that may represent the floor boss.'
    },
    enemy_stalker: {
        effectId: 'enemy_stalker',
        kind: 'enemy',
        label: 'Afterimage Stalker',
        rulesRole: 'Enemy card pair that wakes when traps spring.',
        helpText: 'A hidden enemy that becomes dangerous when trap pressure escalates.'
    },
    trap_spikes: {
        effectId: 'trap_spikes',
        kind: 'trap',
        label: 'Spike Plate',
        rulesRole: 'Baseline armed trap.',
        helpText: 'A revealed trap that should be matched quickly to disarm.'
    },
    trap_curse: {
        effectId: 'trap_curse',
        kind: 'trap',
        label: 'Curse Sigil',
        rulesRole: 'Trap pressure for shadow floors.',
        helpText: 'A trap tuned for information-denial floors.'
    },
    trap_mimic: {
        effectId: 'trap_mimic',
        kind: 'trap',
        label: 'Mimic Bounty',
        rulesRole: 'Trap that pays loot when disarmed.',
        helpText: 'A visible risk-reward trap: destroy removes danger but forfeits the bounty; matching pays once.'
    },
    trap_alarm: {
        effectId: 'trap_alarm',
        kind: 'trap',
        label: 'Bell Trap',
        rulesRole: 'Trap that wakes hidden enemies.',
        helpText: 'Mismatches while it is armed wake hidden enemy cards.'
    },
    trap_snare: {
        effectId: 'trap_snare',
        kind: 'trap',
        label: 'Latch Snare',
        rulesRole: 'Trap that consumes defensive tempo.',
        helpText: 'Mismatches can spend guard or disable free shuffle help.'
    },
    trap_hex: {
        effectId: 'trap_hex',
        kind: 'trap',
        label: 'Forgetful Hex',
        rulesRole: 'Trap that cuts score and reveals hazards.',
        helpText: 'Mismatches punish score and expose more dungeon pressure.'
    },
    treasure_gold: {
        effectId: 'treasure_gold',
        kind: 'treasure',
        label: 'Coin Memory',
        rulesRole: 'Baseline treasure reward.',
        helpText: 'Pays score and shop gold when matched.'
    },
    treasure_cache: {
        effectId: 'treasure_cache',
        kind: 'treasure',
        label: 'Gallery Cache',
        rulesRole: 'Larger treasure reward.',
        helpText: 'Pays a larger cache reward and objective credit.'
    },
    treasure_shard: {
        effectId: 'treasure_shard',
        kind: 'treasure',
        label: 'Supply Niche',
        rulesRole: 'Small supply reward.',
        helpText: 'Pays a modest score and gold reward.'
    },
    shrine_guard: {
        effectId: 'shrine_guard',
        kind: 'shrine',
        label: 'Guard Shrine',
        rulesRole: 'Defensive shrine reward.',
        helpText: 'Adds guard up to the cap and relic Favor, then resolves once.'
    },
    gateway_safe: {
        effectId: 'gateway_safe',
        kind: 'gateway',
        label: 'Safe Gateway',
        rulesRole: 'Safe route selector.',
        helpText: 'Points the run toward recovery and lower pressure.'
    },
    gateway_greed: {
        effectId: 'gateway_greed',
        kind: 'gateway',
        label: 'Greed Gateway',
        rulesRole: 'Greed route selector.',
        helpText: 'Points the run toward higher reward and higher pressure.'
    },
    gateway_mystery: {
        effectId: 'gateway_mystery',
        kind: 'gateway',
        label: 'Mystery Gateway',
        rulesRole: 'Mystery route selector.',
        helpText: 'Points the run toward events and information variance.'
    },
    gateway_depth: {
        effectId: 'gateway_depth',
        kind: 'gateway',
        label: 'Depth Gateway',
        rulesRole: 'Default dungeon route selector.',
        helpText: 'Pushes the run deeper through the selected dungeon route.'
    },
    key_iron: {
        effectId: 'key_iron',
        kind: 'key',
        label: 'Iron Memory Key',
        rulesRole: 'Standard key reward.',
        helpText: 'Banks an iron key for a future lock.'
    },
    key_master: {
        effectId: 'key_master',
        kind: 'key',
        label: 'Master Key',
        rulesRole: 'Universal key reward.',
        helpText: 'Represents a key that can open any one keyed lock.'
    },
    lock_cache: {
        effectId: 'lock_cache',
        kind: 'lock',
        label: 'Sealed Cache',
        rulesRole: 'Key-gated loot cache.',
        helpText: 'Spends a key for full cache rewards, or pays only a small fallback when no key is available.'
    },
    exit_safe: {
        effectId: 'exit_safe',
        kind: 'exit',
        label: 'Safe Exit',
        rulesRole: 'Safe route exit.',
        helpText: 'Completes the floor and favors a safer next node.'
    },
    exit_greed: {
        effectId: 'exit_greed',
        kind: 'exit',
        label: 'Greed Exit',
        rulesRole: 'Greed route exit.',
        helpText: 'Completes the floor and favors a riskier reward route.'
    },
    exit_mystery: {
        effectId: 'exit_mystery',
        kind: 'exit',
        label: 'Mystery Exit',
        rulesRole: 'Mystery route exit.',
        helpText: 'Completes the floor and favors an event-heavy route.'
    },
    exit_boss: {
        effectId: 'exit_boss',
        kind: 'exit',
        label: 'Boss Exit',
        rulesRole: 'Boss floor exit.',
        helpText: 'Completes a boss floor after its blockers are handled.'
    },
    lever_floor: {
        effectId: 'lever_floor',
        kind: 'lever',
        label: 'Exit Lever',
        rulesRole: 'Lever-lock progress.',
        helpText: 'Counts toward a lever-locked exit.'
    },
    rune_seal: {
        effectId: 'rune_seal',
        kind: 'lever',
        label: 'Rune Seal',
        rulesRole: 'Trap-control lever.',
        helpText: 'Seals revealed traps when matched.'
    },
    shop_vendor: {
        effectId: 'shop_vendor',
        kind: 'shop',
        label: 'Vendor',
        rulesRole: 'Shop access.',
        helpText: 'Opens the floor vendor.'
    },
    room_campfire: {
        effectId: 'room_campfire',
        kind: 'room',
        label: 'Mnemonic Hearth',
        rulesRole: 'Room healing service.',
        helpText: 'Restores life or grants recovery value.'
    },
    room_fountain: {
        effectId: 'room_fountain',
        kind: 'room',
        label: 'Stillwater Font',
        rulesRole: 'Room guard service.',
        helpText: 'Adds guard-oriented safety.'
    },
    room_map: {
        effectId: 'room_map',
        kind: 'room',
        label: 'Cartographer Cell',
        rulesRole: 'Room scouting service.',
        helpText: 'Reveals scoped utility-family information without identifying exact pair solutions.'
    },
    room_forge: {
        effectId: 'room_forge',
        kind: 'room',
        label: 'Breaker Forge',
        rulesRole: 'Room upgrade service.',
        helpText: 'Improves run tools or rewards.'
    },
    room_shrine: {
        effectId: 'room_shrine',
        kind: 'room',
        label: 'Whisper Shrine',
        rulesRole: 'Room favor service.',
        helpText: 'Grants relic favor or shrine-style progression.'
    },
    room_scrying_lens: {
        effectId: 'room_scrying_lens',
        kind: 'room',
        label: 'Scrying Lens',
        rulesRole: 'Room reveal service.',
        helpText: 'Reveals a scoped dungeon family clue without paying match rewards.'
    },
    room_armory: {
        effectId: 'room_armory',
        kind: 'room',
        label: 'Recall Armory',
        rulesRole: 'Room combat service.',
        helpText: 'Adds combat safety or damage pressure relief.'
    },
    room_locked_cache: {
        effectId: 'room_locked_cache',
        kind: 'room',
        label: 'Sealed Cache Cell',
        rulesRole: 'Room key-gated loot service.',
        helpText: 'Stays revealed until its matching key or a master key is spent for the full cache reward.'
    },
    room_key_cache: {
        effectId: 'room_key_cache',
        kind: 'room',
        label: 'Key Niche',
        rulesRole: 'Room key service.',
        helpText: 'Grants an iron key and score.'
    },
    room_trap_workshop: {
        effectId: 'room_trap_workshop',
        kind: 'room',
        label: 'Trapwright Bench',
        rulesRole: 'Room trap-control service.',
        helpText: 'One-shot room that resolves an armed trap pair, otherwise reveals a hidden trap family clue.'
    },
    room_omen_archive: {
        effectId: 'room_omen_archive',
        kind: 'room',
        label: 'Omen Archive',
        rulesRole: 'Room information and favor service.',
        helpText: 'Grants favor and reveals a hidden dungeon pair.'
    }
};

export const getDungeonCardKindDefinition = (kind: DungeonCardKind): DungeonCardKindDefinition =>
    DUNGEON_CARD_KIND_DEFINITIONS[kind];

export const getDungeonCardEffectDefinition = (
    effectId: DungeonCardEffectId
): DungeonCardEffectDefinition => DUNGEON_CARD_EFFECT_DEFINITIONS[effectId];

export const getDungeonCardHelpRows = (): DungeonCardKindDefinition[] =>
    Object.values(DUNGEON_CARD_KIND_DEFINITIONS);

export const getDungeonCardKnowledge = (tile: Tile, faceUp: boolean = false): DungeonCardKnowledge => {
    if (!tile.dungeonCardKind) {
        return {
            hasDungeonCard: false,
            state: 'none',
            familyKnown: false,
            effectKnown: false,
            claimable: false,
            familyLabel: null,
            effectLabel: null,
            stateLabel: 'none'
        };
    }

    const state = tile.dungeonCardState ?? 'hidden';
    const familyKnown = faceUp || state === 'revealed' || state === 'resolved';
    const effectKnown = familyKnown && tile.dungeonCardEffectId != null;
    const kindDefinition = getDungeonCardKindDefinition(tile.dungeonCardKind);
    const effectDefinition = tile.dungeonCardEffectId
        ? getDungeonCardEffectDefinition(tile.dungeonCardEffectId)
        : null;

    return {
        hasDungeonCard: true,
        state,
        familyKnown,
        effectKnown,
        claimable: state !== 'resolved' && tile.state !== 'matched' && tile.state !== 'removed',
        familyLabel: familyKnown ? kindDefinition.copyLabel : null,
        effectLabel: effectKnown ? effectDefinition?.label ?? null : null,
        stateLabel: state
    };
};
