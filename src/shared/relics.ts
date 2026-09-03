/**
 * Relic **pool and milestone selection** (`RELIC_POOL`, `rollRelicOptions`, `needsRelicPick`).
 * Draft uses **rarity + weights** (`RELIC_DRAFT`) and in-repo {@link pickWeightedWithoutReplacement}.
 * Per-relic immediate gameplay lives in `relic-immediate-rules`; phase and economy effects live with their owning systems.
 *
 * Balance cross-check: `docs/BALANCE_NOTES.md` (Relic roster) — update when adding IDs or changing memorize /
 * charge numbers; `relicBalanceDoc.test.ts` guards key doc strings.
 */
import { filterRelicPoolByContentLock } from './content-lock-state';
import type {
    ContractFlags,
    MutatorId,
    RelicId,
    RelicOfferServiceId,
    RelicOfferServiceState,
    RouteNodeType,
    RunState,
    StartingLoadoutId,
    TileTraitKind
} from './contracts';
import { pickFloorScheduleEntry, usesEndlessFloorSchedule } from './floor-mutator-schedule';
import { hashStringToSeed } from './rng';
import { runArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { getTraitBuildRewardRowsForLoadout, getTraitBuildRewardRowsForRelic } from './trait-build-rewards';
import { pickWeightedWithoutReplacement } from './weightedPick';

/** First floor (after clear) that can trigger a relic offer. */
export const RELIC_FIRST_MILESTONE_FLOOR = 3;
/** Offer again every N floors: 3, 6, 9, 12, … */
export const RELIC_MILESTONE_STEP = 3;
/** Cap total relic picks per run (Endless scaling safety). */
export const MAX_RELIC_PICKS_PER_RUN = 12;

export const RELIC_OFFER_SERVICE_IDS = [
    'reroll_offer',
    'ban_option',
    'upgrade_offer'
] as const satisfies readonly RelicOfferServiceId[];

/** Draft rarity — affects base weight and how fast odds rise with {@link relicMilestoneIndexForFloor}. */
export type RelicDraftRarity = 'common' | 'uncommon' | 'rare';
export type RelicDraftTag =
    | 'memorize'
    | 'parasite'
    | 'shuffle'
    | 'search'
    | 'destroy'
    | 'combo'
    | 'peek'
    | 'pin'
    | 'guard'
    | 'wager'
    | 'favor'
    | 'draft';

export type RelicBuildArchetype =
    | 'guard_tank'
    | 'trap_control'
    | 'treasure_greed'
    | 'boss_hunter'
    | 'route_gambler'
    | 'conduit_cartographer'
    | 'emergency_toolkit'
    | 'combo_shard_engine';

export const RELIC_BUILD_ARCHETYPE_ORDER = [
    'guard_tank',
    'trap_control',
    'treasure_greed',
    'boss_hunter',
    'route_gambler',
    'conduit_cartographer',
    'emergency_toolkit',
    'combo_shard_engine'
] as const satisfies readonly RelicBuildArchetype[];

type RelicContractForbid = keyof Pick<ContractFlags, 'noShuffle' | 'noDestroy'>;

export interface RelicDraftContext {
    isScheduledEndless: boolean;
    clearedFloor: number;
    currentMutators: MutatorId[];
    nextMutators: MutatorId[];
    pendingRouteType: RouteNodeType | null;
    activeRouteType: RouteNodeType | null;
    routeType: RouteNodeType | null;
    routePressure: 'none' | RouteNodeType;
    routeReasonSource: 'pending_route' | 'active_board' | null;
    startingLoadoutId: StartingLoadoutId | null;
    activeTraitKinds: TileTraitKind[];
    activeOrAcceptedRiskWager: boolean;
    favorNearRelicPick: boolean;
    hasChapterCompass: boolean;
}

export interface RelicDraftRow {
    rarity: RelicDraftRarity;
    /** Base weight before tier scaling (tune relative odds at tier 0). */
    weight: number;
    tags: RelicDraftTag[];
    /** REG-019: player-facing build identity buckets surfaced in drafts/Codex. */
    archetypes: RelicBuildArchetype[];
    forbiddenWithContract?: RelicContractForbid[];
}

export interface RelicBuildArchetypeDefinition {
    id: RelicBuildArchetype;
    label: string;
    fantasy: string;
    decisionVerbs: string[];
    summary: string;
    dungeonInteractions: string[];
    supportHooks: string[];
    deferredHooks?: string[];
}

export const RELIC_BUILD_ARCHETYPE_DEFINITIONS: Record<RelicBuildArchetype, RelicBuildArchetypeDefinition> = {
    guard_tank: {
        id: 'guard_tank',
        label: 'The Warden',
        fantasy: 'Hold the line while the archive turns hostile.',
        decisionVerbs: ['guard', 'absorb', 'stabilize'],
        summary: 'Bank guard and study time so patrol pressure, trap springs, and safe-route exits remain recoverable after a bad recall.',
        dungeonInteractions: ['guard tokens', 'safe routes', 'enemy contact', 'trap pressure'],
        supportHooks: ['guard_token_plus_one immediate capped guard', 'safe route contextual draft weighting']
    },
    trap_control: {
        id: 'trap_control',
        label: 'The Saboteur',
        fantasy: 'Turn the dungeon machinery against itself.',
        decisionVerbs: ['disarm', 'delete', 'reroute'],
        summary: 'Use shuffle, swap, destroy, and search tools to convert trap halls from hidden punishment into planned disarms.',
        dungeonInteractions: ['trap halls', 'dungeon trap cards', 'row shuffle / tile swap', 'destroy-pair charges'],
        supportHooks: ['shuffle relic contract filters', 'destroy_bank_plus_one uncapped charge grant', 'trap route contextual weighting']
    },
    treasure_greed: {
        id: 'treasure_greed',
        label: 'The Vaultbreaker',
        fantasy: 'Remember which locked doors are worth the noise.',
        decisionVerbs: ['unlock', 'extract', 'bank'],
        summary: 'Lean into Greed routes, keys, caches, and bonus shrine picks while keeping treasure extraction bounded.',
        dungeonInteractions: ['treasure rooms', 'Greed routes', 'Relic Favor', 'shop gold pressure'],
        supportHooks: [
            'Greed route contextual draft weighting',
            'shrine_echo one-shot extra relic selection',
            'shrine_echo first treasure chest Favor echo'
        ]
    },
    boss_hunter: {
        id: 'boss_hunter',
        label: 'The Slayer',
        fantasy: 'Study the boss before the boss studies you.',
        decisionVerbs: ['prepare', 'focus', 'finish'],
        summary: 'Prepare for boss floors with chapter-aware draft pressure, route wagers, and bounded Favor conversion.',
        dungeonInteractions: ['boss floors', 'boss prep', 'Relic Favor', 'chapter schedule'],
        supportHooks: [
            'chapter_compass immediate peek plus future chapter answer weighting',
            'chapter_compass claimed boss trophy cache score bonus',
            'wager_surety immediate guard plus bounded Favor bonus'
        ],
        deferredHooks: ['Direct boss-damage or boss-ward relics remain deferred to boss presentation/tuning tickets.']
    },
    route_gambler: {
        id: 'route_gambler',
        label: 'The Gambit',
        fantasy: 'Choose the dangerous stair when the memory is sharp.',
        decisionVerbs: ['wager', 'push', 'cash out'],
        summary: 'Turn risky route choices and Endless wagers into more Favor without erasing the cost of a failed read.',
        dungeonInteractions: ['risk wagers', 'Greed routes', 'Mystery routes', 'Relic Favor'],
        supportHooks: ['risk wager payout hook', 'wager_surety immediate guard and loss floor', 'route contextual draft weighting']
    },
    conduit_cartographer: {
        id: 'conduit_cartographer',
        label: 'The Conduit Cartographer',
        fantasy: 'Turn every fair clue into a route through the hidden board.',
        decisionVerbs: ['peek', 'pin', 'read'],
        summary: 'Chain Echo-Conduit rewards, Scout Glints, peeks, and durable pins into reliable pair knowledge without erasing Mystery-route uncertainty.',
        dungeonInteractions: ['Echo-Conduit trait routes', 'Scout Glints', 'Mystery routes', 'hidden dungeon cards'],
        supportHooks: ['peek_charge_plus_one immediate charge', 'pin_cap_plus_one durable annotation capacity', 'Scout Glint deterministic reveal']
    },
    emergency_toolkit: {
        id: 'emergency_toolkit',
        label: 'The Emergency Toolkit',
        fantasy: 'Carry one clean correction for the board that went wrong.',
        decisionVerbs: ['inspect', 'remove', 'recover'],
        summary: 'Use Supply Cache tools and Stray Hook correction to reveal a blocker, remove only a completion-safe target, and recover the route.',
        dungeonInteractions: ['hidden blockers', 'completion-safe stray targets', 'Supply Cache', 'route recovery'],
        supportHooks: ['peek_charge_plus_one inspection charge', 'stray_charge_plus_one completion-safe correction', 'Supply Cache reveal-then-remove payout']
    },
    combo_shard_engine: {
        id: 'combo_shard_engine',
        label: 'The Catalyst',
        fantasy: 'Turn clean recall into enough momentum to survive the long descent.',
        decisionVerbs: ['chain', 'convert', 'accelerate'],
        summary: 'Convert clean play, parasite answers, and guard safety into bounded combo-shard momentum.',
        dungeonInteractions: ['combo shards', 'parasite floors', 'featured objectives', 'guard tokens'],
        supportHooks: ['combo_shard_plus_step shard cap', 'parasite_ward_once one-shot ward', 'parasite_ledger immediate ward and featured-objective hook']
    }
};

export const RELIC_BUILD_ARCHETYPE_LABELS: Record<RelicBuildArchetype, string> = {
    guard_tank: RELIC_BUILD_ARCHETYPE_DEFINITIONS.guard_tank.label,
    trap_control: RELIC_BUILD_ARCHETYPE_DEFINITIONS.trap_control.label,
    treasure_greed: RELIC_BUILD_ARCHETYPE_DEFINITIONS.treasure_greed.label,
    boss_hunter: RELIC_BUILD_ARCHETYPE_DEFINITIONS.boss_hunter.label,
    route_gambler: RELIC_BUILD_ARCHETYPE_DEFINITIONS.route_gambler.label,
    conduit_cartographer: RELIC_BUILD_ARCHETYPE_DEFINITIONS.conduit_cartographer.label,
    emergency_toolkit: RELIC_BUILD_ARCHETYPE_DEFINITIONS.emergency_toolkit.label,
    combo_shard_engine: RELIC_BUILD_ARCHETYPE_DEFINITIONS.combo_shard_engine.label
};

/**
 * Single source for draft odds. Add new `RelicId` here and in `game.ts` / encyclopedia.
 * Weights are relative within a draft; tier scaling favors higher rarities in later drafts.
 */
export const RELIC_DRAFT: Record<RelicId, RelicDraftRow> = {
    extra_shuffle_charge: {
        rarity: 'common',
        weight: 100,
        tags: ['shuffle'],
        archetypes: ['trap_control'],
        forbiddenWithContract: ['noShuffle']
    },
    first_shuffle_free_per_floor: {
        rarity: 'common',
        weight: 88,
        tags: ['shuffle'],
        archetypes: ['trap_control'],
        forbiddenWithContract: ['noShuffle']
    },
    memorize_bonus_ms: { rarity: 'common', weight: 92, tags: ['memorize'], archetypes: ['guard_tank', 'conduit_cartographer'] },
    memorize_under_short_memorize: { rarity: 'uncommon', weight: 52, tags: ['memorize'], archetypes: ['conduit_cartographer'] },
    region_shuffle_free_first: {
        rarity: 'common',
        weight: 85,
        tags: ['shuffle'],
        archetypes: ['trap_control', 'route_gambler'],
        forbiddenWithContract: ['noShuffle']
    },
    destroy_bank_plus_one: {
        rarity: 'uncommon',
        weight: 55,
        tags: ['destroy'],
        archetypes: ['trap_control', 'boss_hunter'],
        forbiddenWithContract: ['noDestroy']
    },
    combo_shard_plus_step: {
        rarity: 'uncommon',
        weight: 48,
        tags: ['combo', 'parasite'],
        archetypes: ['combo_shard_engine']
    },
    parasite_ward_once: { rarity: 'rare', weight: 28, tags: ['parasite'], archetypes: ['combo_shard_engine'] },
    peek_charge_plus_one: { rarity: 'uncommon', weight: 50, tags: ['peek', 'wager'], archetypes: ['conduit_cartographer', 'emergency_toolkit', 'route_gambler'] },
    stray_charge_plus_one: { rarity: 'rare', weight: 26, tags: ['search'], archetypes: ['emergency_toolkit'] },
    pin_cap_plus_one: { rarity: 'rare', weight: 24, tags: ['pin'], archetypes: ['conduit_cartographer'] },
    guard_token_plus_one: {
        rarity: 'rare',
        weight: 30,
        tags: ['guard', 'parasite', 'wager'],
        archetypes: ['guard_tank', 'combo_shard_engine', 'route_gambler']
    },
    shrine_echo: { rarity: 'uncommon', weight: 36, tags: ['favor', 'wager'], archetypes: ['treasure_greed', 'route_gambler'] },
    chapter_compass: { rarity: 'uncommon', weight: 34, tags: ['draft'], archetypes: ['boss_hunter', 'conduit_cartographer'] },
    wager_surety: { rarity: 'rare', weight: 22, tags: ['wager'], archetypes: ['boss_hunter', 'route_gambler', 'treasure_greed'] },
    parasite_ledger: { rarity: 'uncommon', weight: 38, tags: ['parasite'], archetypes: ['combo_shard_engine', 'boss_hunter'] },
    /*
     * Standing rules. These pay on a condition the board keeps offering rather than once at pickup,
     * so their weights sit a notch under the equivalent-rarity charge relics: a rule that fires all
     * run is worth more than a number that fires once.
     */
    opening_ledger: {
        rarity: 'common',
        weight: 86,
        tags: ['combo'],
        archetypes: ['conduit_cartographer', 'emergency_toolkit']
    },
    tithe_conduit: {
        rarity: 'common',
        weight: 80,
        tags: ['favor'],
        archetypes: ['treasure_greed', 'conduit_cartographer']
    },
    bulwark_plate: { rarity: 'uncommon', weight: 46, tags: ['guard'], archetypes: ['guard_tank'] },
    stasis_broker: {
        rarity: 'uncommon',
        weight: 42,
        tags: ['shuffle'],
        archetypes: ['trap_control'],
        forbiddenWithContract: ['noShuffle']
    },
    echo_relay: { rarity: 'rare', weight: 24, tags: ['peek', 'memorize'], archetypes: ['conduit_cartographer'] },
    drift_appraiser: {
        rarity: 'rare',
        weight: 20,
        tags: ['favor', 'search'],
        archetypes: ['treasure_greed', 'route_gambler']
    }
};

/** Stable iteration order for docs / balance checks. Keep alphabetical for compatibility with existing draft rolls. */
export const RELIC_POOL = [
    'bulwark_plate',
    'chapter_compass',
    'combo_shard_plus_step',
    'destroy_bank_plus_one',
    'drift_appraiser',
    'echo_relay',
    'extra_shuffle_charge',
    'first_shuffle_free_per_floor',
    'guard_token_plus_one',
    'memorize_bonus_ms',
    'memorize_under_short_memorize',
    'opening_ledger',
    'parasite_ledger',
    'parasite_ward_once',
    'peek_charge_plus_one',
    'pin_cap_plus_one',
    'region_shuffle_free_first',
    'shrine_echo',
    'stasis_broker',
    'stray_charge_plus_one',
    'tithe_conduit',
    'wager_surety'
] as const satisfies readonly RelicId[];

/**
 * The relics that put a standing rule in force instead of paying once at pickup. Named here so the
 * roster stays the single place that knows which relics are which kind.
 */
export const STANDING_RULE_RELIC_IDS: ReadonlySet<RelicId> = new Set<RelicId>([
    'bulwark_plate',
    'drift_appraiser',
    'echo_relay',
    'opening_ledger',
    'stasis_broker',
    'tithe_conduit'
]);

const RELIC_SYNERGY_RULES_VERSION = 14;
const ENDLESS_SYNERGY_RELICS = new Set<RelicId>(['chapter_compass', 'wager_surety', 'parasite_ledger']);
const SHORT_MEMORIZE_RELICS = new Set<RelicId>(['memorize_under_short_memorize', 'memorize_bonus_ms']);
const PARASITE_RELICS = new Set<RelicId>([
    'parasite_ward_once',
    'combo_shard_plus_step',
    'guard_token_plus_one',
    'parasite_ledger'
]);
const SHUFFLE_SEARCH_RELICS = new Set<RelicId>([
    'extra_shuffle_charge',
    'first_shuffle_free_per_floor',
    'region_shuffle_free_first',
    'stray_charge_plus_one',
    'stasis_broker'
]);
const ANCHOR_SPOTLIGHT_RELICS = new Set<RelicId>(['pin_cap_plus_one', 'peek_charge_plus_one']);
const WAGER_RELICS = new Set<RelicId>([
    'shrine_echo',
    'guard_token_plus_one',
    'peek_charge_plus_one',
    'wager_surety'
]);
const GREED_ROUTE_RELICS = new Set<RelicId>([
    'guard_token_plus_one',
    'peek_charge_plus_one',
    'wager_surety',
    'shrine_echo',
    'tithe_conduit',
    'drift_appraiser'
]);
const MYSTERY_ROUTE_RELICS = new Set<RelicId>([
    'peek_charge_plus_one',
    'pin_cap_plus_one',
    'stray_charge_plus_one',
    'chapter_compass',
    'echo_relay'
]);
const SAFE_ROUTE_RELICS = new Set<RelicId>([
    'guard_token_plus_one',
    'memorize_bonus_ms',
    'region_shuffle_free_first',
    'peek_charge_plus_one',
    'bulwark_plate'
]);

const getActiveTraitKinds = (run: RunState): TileTraitKind[] => [
    ...new Set(
        (run.board?.tiles ?? [])
            .map((tile) => tile.tileTraitKind)
            .filter((kind): kind is TileTraitKind => kind != null)
    )
];

const hasAnyMutator = (mutators: readonly MutatorId[], ids: readonly MutatorId[]): boolean =>
    ids.some((id) => mutators.includes(id));

const contextHasAnyMutator = (context: RelicDraftContext, ids: readonly MutatorId[]): boolean =>
    hasAnyMutator(context.currentMutators, ids) || hasAnyMutator(context.nextMutators, ids);

const isScheduledEndlessDraftRun = (run: RunState): boolean =>
    usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
    !run.wildMenuRun &&
    run.board?.floorArchetypeId != null;

const tierWeightScale = (rarity: RelicDraftRarity, tierIndex: number): number => {
    const t = Math.max(0, tierIndex);
    switch (rarity) {
        case 'common':
            return 1;
        case 'uncommon':
            return 1 + t * 0.14;
        case 'rare':
            return 1 + t * 0.32;
        default:
            return 1;
    }
};

/** Effective draft weight for one relic at a milestone tier (higher tier → relatively stronger rares). */
export const effectiveRelicDraftWeight = (id: RelicId, tierIndex: number): number => {
    const row = RELIC_DRAFT[id];
    return row.weight * tierWeightScale(row.rarity, tierIndex);
};

export const getRelicDraftRow = (id: RelicId): RelicDraftRow => RELIC_DRAFT[id];

export const getRelicBuildArchetypes = (id: RelicId): RelicBuildArchetype[] => [...RELIC_DRAFT[id].archetypes];

export const getRelicArchetypeLabels = (id: RelicId): string[] =>
    getRelicBuildArchetypes(id).map((archetype) => RELIC_BUILD_ARCHETYPE_LABELS[archetype]);

export const getRelicArchetypeSummary = (id: RelicId): string =>
    getRelicArchetypeLabels(id).join(' / ');

export const getRelicBuildArchetypeDefinition = (id: RelicBuildArchetype): RelicBuildArchetypeDefinition =>
    RELIC_BUILD_ARCHETYPE_DEFINITIONS[id];

export const getRelicBuildArchetypeSummaries = (): {
    id: RelicBuildArchetype;
    label: string;
    summary: string;
    fantasy: string;
    decisionVerbs: string[];
    dungeonInteractions: string[];
    supportHooks: string[];
    deferredHooks: string[];
    relicIds: RelicId[];
}[] =>
    RELIC_BUILD_ARCHETYPE_ORDER.map((id) => {
        const definition = getRelicBuildArchetypeDefinition(id);
        return {
            id,
            label: definition.label,
            summary: definition.summary,
            fantasy: definition.fantasy,
            decisionVerbs: [...definition.decisionVerbs],
            dungeonInteractions: [...definition.dungeonInteractions],
            supportHooks: [...definition.supportHooks],
            deferredHooks: [...(definition.deferredHooks ?? [])],
            relicIds: RELIC_POOL.filter((relicId) => RELIC_DRAFT[relicId].archetypes.includes(id))
        };
    });

export interface RunBuildArchetypeSignal {
    id: RelicBuildArchetype;
    label: string;
    score: number;
    summary: string;
    decisionVerbs: string[];
    supportingRelicIds: RelicId[];
}

export interface RunBuildProfile {
    primary: RunBuildArchetypeSignal | null;
    signals: RunBuildArchetypeSignal[];
    summary: string;
    tooltip: string;
}

export const runRelicIds = (value: unknown): RelicId[] => runArray(value);

export const runMutatorIds = (value: unknown): MutatorId[] => runArray(value);

export const hasRunRelic = (run: Pick<RunState, 'relicIds'>, id: RelicId): boolean => runRelicIds(run.relicIds).includes(id);

export const getRunBuildProfile = (run: Pick<RunState, 'relicIds'>): RunBuildProfile => {
    const scoreByArchetype = new Map<RelicBuildArchetype, { score: number; relicIds: RelicId[] }>();
    for (const relicId of runRelicIds(run.relicIds)) {
        const row = RELIC_DRAFT[relicId];
        if (!row) continue;
        for (const archetype of row.archetypes) {
            const current = scoreByArchetype.get(archetype) ?? { score: 0, relicIds: [] };
            current.score += 1;
            if (!current.relicIds.includes(relicId)) {
                current.relicIds.push(relicId);
            }
            scoreByArchetype.set(archetype, current);
        }
    }

    const signals = RELIC_BUILD_ARCHETYPE_ORDER.flatMap((id) => {
        const scored = scoreByArchetype.get(id);
        if (!scored || scored.score <= 0) return [];
        const definition = getRelicBuildArchetypeDefinition(id);
        return [{
            id,
            label: definition.label,
            score: scored.score,
            summary: definition.summary,
            decisionVerbs: [...definition.decisionVerbs],
            supportingRelicIds: [...scored.relicIds]
        }];
    }).sort((a, b) => b.score - a.score || RELIC_BUILD_ARCHETYPE_ORDER.indexOf(a.id) - RELIC_BUILD_ARCHETYPE_ORDER.indexOf(b.id));

    const primary = signals[0] ?? null;
    if (!primary) {
        return {
            primary: null,
            signals: [],
            summary: 'First relic still ahead',
            tooltip: 'Draft a relic to begin shaping a run build.'
        };
    }

    const topSignals = signals.slice(0, 3);
    return {
        primary,
        signals,
        summary: `${primary.label} · ${primary.score} build signal${primary.score === 1 ? '' : 's'}`,
        tooltip: topSignals
            .map((signal) => `${signal.label} x${signal.score}: ${signal.decisionVerbs.join(', ')}`)
            .join(' · ')
    };
};

export type RelicDecisionImpact =
    | 'action_economy'
    | 'route_risk'
    | 'information_scope'
    | 'protection'
    | 'extraction'
    | 'engine_momentum'
    | 'draft_shaping';

export interface RelicRoleAuditRow {
    relicId: RelicId;
    archetypeLabels: string[];
    decisionImpact: RelicDecisionImpact[];
    impactCopy: string;
    rescueDirection: 'clear' | 'copy_rescue' | 'mechanical_rescue' | 'deprioritize';
}

const RELIC_DECISION_IMPACT_LABELS: Record<RelicDecisionImpact, string> = {
    action_economy: 'Action',
    route_risk: 'Risk',
    information_scope: 'Info',
    protection: 'Guard',
    extraction: 'Cashout',
    engine_momentum: 'Momentum',
    draft_shaping: 'Draft'
};

const decisionImpactForRelic = (id: RelicId): RelicDecisionImpact[] => {
    const row = getRelicDraftRow(id);
    const impacts = new Set<RelicDecisionImpact>();
    if (row.tags.includes('shuffle') || row.tags.includes('destroy') || row.tags.includes('search')) impacts.add('action_economy');
    if (row.tags.includes('peek') || row.tags.includes('pin') || row.tags.includes('memorize')) impacts.add('information_scope');
    if (row.tags.includes('guard')) impacts.add('protection');
    if (row.tags.includes('wager')) impacts.add('route_risk');
    if (row.tags.includes('favor')) impacts.add('extraction');
    if (row.tags.includes('combo') || row.tags.includes('parasite')) impacts.add('engine_momentum');
    if (row.tags.includes('draft')) impacts.add('draft_shaping');
    return [...impacts];
};

const impactCopyForRelic = (id: RelicId): string => {
    const labels = getRelicArchetypeLabels(id);
    const verbs = getRelicBuildArchetypes(id)
        .flatMap((archetype) => getRelicBuildArchetypeDefinition(archetype).decisionVerbs)
        .slice(0, 3);
    return `${labels.join(' / ')}: ${verbs.join(', ')}.`;
};

export const getRelicRoleAuditRows = (): RelicRoleAuditRow[] =>
    RELIC_POOL.map((relicId) => {
        const impacts = decisionImpactForRelic(relicId);
        return {
            relicId,
            archetypeLabels: getRelicArchetypeLabels(relicId),
            decisionImpact: impacts,
            impactCopy: impactCopyForRelic(relicId),
            rescueDirection: impacts.length > 0 ? 'clear' : 'copy_rescue'
        };
    });

export const getRelicDecisionImpactCopy = (id: RelicId): string =>
    getRelicRoleAuditRows().find((row) => row.relicId === id)?.impactCopy ?? getRelicArchetypeSummary(id);

export const getRelicDecisionImpactLabels = (id: RelicId): string[] =>
    (getRelicRoleAuditRows().find((row) => row.relicId === id)?.decisionImpact ?? []).map(
        (impact) => RELIC_DECISION_IMPACT_LABELS[impact]
    );

export const getRelicDraftContext = (run: RunState, clearedFloor: number): RelicDraftContext => {
    const isScheduledEndless = isScheduledEndlessDraftRun(run);
    const nextMutators =
        isScheduledEndless
            ? pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, clearedFloor + 1, run.gameMode).mutators
            : [];
    const pendingRouteType = run.pendingRouteCardPlan?.routeType ?? null;
    const activeRouteType = run.board?.routeWorldProfile?.routeType ?? null;
    const routeType = pendingRouteType ?? activeRouteType;

    return {
        isScheduledEndless,
        clearedFloor,
        currentMutators: isScheduledEndless ? [...runMutatorIds(run.activeMutators)] : [],
        nextMutators,
        pendingRouteType: isScheduledEndless ? pendingRouteType : null,
        activeRouteType: isScheduledEndless ? activeRouteType : null,
        routeType: isScheduledEndless ? routeType : null,
        routePressure: isScheduledEndless && routeType ? routeType : 'none',
        routeReasonSource:
            isScheduledEndless && pendingRouteType
                ? 'pending_route'
                : isScheduledEndless && activeRouteType
                  ? 'active_board'
                  : null,
        startingLoadoutId: run.startingLoadoutId ?? null,
        activeTraitKinds: getActiveTraitKinds(run),
        activeOrAcceptedRiskWager: isScheduledEndless && run.endlessRiskWager != null,
        favorNearRelicPick: isScheduledEndless && run.relicFavorProgress >= 2,
        hasChapterCompass: hasRunRelic(run, 'chapter_compass')
    };
};

export const isRelicDraftEligible = (id: RelicId, run: RunState): boolean => {
    if (hasRunRelic(run, id)) {
        return false;
    }
    if (run.runRulesVersion < RELIC_SYNERGY_RULES_VERSION && ENDLESS_SYNERGY_RELICS.has(id)) {
        return false;
    }
    if (ENDLESS_SYNERGY_RELICS.has(id) && !isScheduledEndlessDraftRun(run)) {
        return false;
    }
    const forbidden = RELIC_DRAFT[id].forbiddenWithContract ?? [];
    return !forbidden.some((flag) => run.activeContract?.[flag]);
};

const getHardRelicDraftReason = (id: RelicId, context: RelicDraftContext): string | null => {
    if (!context.isScheduledEndless) {
        return null;
    }
    if (context.activeOrAcceptedRiskWager && WAGER_RELICS.has(id)) {
        return 'Protects wager';
    }
    if (context.favorNearRelicPick && id === 'shrine_echo') {
        return 'Turns Favor into relic picks';
    }
    if (contextHasAnyMutator(context, ['short_memorize']) && SHORT_MEMORIZE_RELICS.has(id)) {
        return 'Answers short memorize';
    }
    if (contextHasAnyMutator(context, ['score_parasite']) && PARASITE_RELICS.has(id)) {
        return 'Checks parasite pressure';
    }
    if (
        contextHasAnyMutator(context, ['wide_recall', 'category_letters', 'sticky_fingers']) &&
        SHUFFLE_SEARCH_RELICS.has(id)
    ) {
        return 'Fits next chapter';
    }
    if (
        contextHasAnyMutator(context, ['n_back_anchor', 'shifting_spotlight']) &&
        ANCHOR_SPOTLIGHT_RELICS.has(id)
    ) {
        return 'Tracks shifting reads';
    }
    if (id === 'chapter_compass' && context.currentMutators.length + context.nextMutators.length > 0) {
        return 'Improves future chapter drafts';
    }
    return null;
};

const getRouteRelicDraftReason = (id: RelicId, context: RelicDraftContext): string | null => {
    if (!context.isScheduledEndless || context.routeType == null) {
        return null;
    }
    if (context.routeType === 'greed' && GREED_ROUTE_RELICS.has(id)) {
        return 'Answers Greed pressure';
    }
    if (context.routeType === 'mystery' && MYSTERY_ROUTE_RELICS.has(id)) {
        return 'Reads Mystery routes';
    }
    if (context.routeType === 'safe' && SAFE_ROUTE_RELICS.has(id)) {
        return 'Supports Safe routing';
    }
    return null;
};

const getTraitBuildRelicDraftReason = (id: RelicId, context: RelicDraftContext): string | null => {
    if (!context.isScheduledEndless) {
        return null;
    }
    if (context.activeTraitKinds.length > 0) {
        const activeTraits = new Set(context.activeTraitKinds);
        const row = getTraitBuildRewardRowsForRelic(id).find((candidate) =>
            candidate.traitKinds.some((traitKind) => activeTraits.has(traitKind))
        );
        if (row) {
            return `Supports ${row.label}`;
        }
    }
    const loadoutRow = getTraitBuildRewardRowsForLoadout(context.startingLoadoutId).find((row) =>
        row.relicIds.includes(id)
    );
    return loadoutRow ? `Supports ${loadoutRow.label}` : null;
};

export const getRelicDraftReason = (id: RelicId, context: RelicDraftContext): string | null =>
    getHardRelicDraftReason(id, context) ??
    getRouteRelicDraftReason(id, context) ??
    getTraitBuildRelicDraftReason(id, context);

export const getRelicDraftOptionReasonRows = (
    reasons: Partial<Record<RelicId, string>> | null | undefined
): Array<{ id: RelicId; reason: string }> =>
    RELIC_POOL.flatMap((id) => {
        const reason = reasons?.[id];
        return reason ? [{ id, reason }] : [];
    });

export const hasRelicDraftOptionReasons = (
    reasons: Partial<Record<RelicId, string>> | null | undefined
): boolean => getRelicDraftOptionReasonRows(reasons).length > 0;

export const getContextualRelicDraftWeight = (
    id: RelicId,
    context: RelicDraftContext,
    tierIndex: number
): number => {
    const base = effectiveRelicDraftWeight(id, tierIndex);
    if (!context.isScheduledEndless) {
        return base;
    }

    let multiplier = 1;
    if (contextHasAnyMutator(context, ['short_memorize']) && SHORT_MEMORIZE_RELICS.has(id)) {
        multiplier *= id === 'memorize_under_short_memorize' ? 3 : 1.8;
    }
    if (contextHasAnyMutator(context, ['score_parasite']) && PARASITE_RELICS.has(id)) {
        multiplier *= id === 'parasite_ledger' || id === 'parasite_ward_once' ? 3 : 1.7;
    }
    if (
        contextHasAnyMutator(context, ['wide_recall', 'category_letters', 'sticky_fingers']) &&
        SHUFFLE_SEARCH_RELICS.has(id)
    ) {
        multiplier *= 1.8;
    }
    if (
        contextHasAnyMutator(context, ['n_back_anchor', 'shifting_spotlight']) &&
        ANCHOR_SPOTLIGHT_RELICS.has(id)
    ) {
        multiplier *= id === 'pin_cap_plus_one' ? 2.4 : 2;
    }
    if (context.activeOrAcceptedRiskWager && WAGER_RELICS.has(id)) {
        multiplier *= id === 'wager_surety' ? 3 : 2;
    }
    if (context.favorNearRelicPick && id === 'shrine_echo') {
        multiplier *= 2.5;
    }
    if (context.routeType === 'greed' && GREED_ROUTE_RELICS.has(id)) {
        multiplier *= id === 'wager_surety' || id === 'guard_token_plus_one' ? 1.55 : 1.35;
    }
    if (
        context.routeType === 'greed' &&
        contextHasAnyMutator(context, ['score_parasite']) &&
        PARASITE_RELICS.has(id)
    ) {
        multiplier *= 1.25;
    }
    if (context.routeType === 'mystery' && MYSTERY_ROUTE_RELICS.has(id)) {
        multiplier *= id === 'peek_charge_plus_one' ? 1.65 : 1.45;
    }
    if (context.routeType === 'safe' && SAFE_ROUTE_RELICS.has(id)) {
        multiplier *= 1.22;
    }
    if (context.activeTraitKinds.length > 0) {
        const activeTraits = new Set(context.activeTraitKinds);
        const traitBuildMatches = getTraitBuildRewardRowsForRelic(id).filter((row) =>
            row.traitKinds.some((traitKind) => activeTraits.has(traitKind))
        ).length;
        if (traitBuildMatches > 0) {
            multiplier *= 1 + Math.min(0.7, traitBuildMatches * 0.22);
        }
    }
    const loadoutTraitBuildMatches = getTraitBuildRewardRowsForLoadout(context.startingLoadoutId).filter((row) =>
        row.relicIds.includes(id)
    ).length;
    if (loadoutTraitBuildMatches > 0) {
        multiplier *= 1 + Math.min(0.55, loadoutTraitBuildMatches * 0.2);
    }
    if (id === 'chapter_compass' && getRelicDraftReason(id, context) != null) {
        multiplier *= 1.45;
    }
    if (context.hasChapterCompass && getRelicDraftReason(id, context) != null) {
        multiplier *= 1.35;
    }
    return base * multiplier;
};

export const relicDraftRarityLabel = (rarity: RelicDraftRarity): string => {
    switch (rarity) {
        case 'common':
            return 'Common';
        case 'uncommon':
            return 'Uncommon';
        case 'rare':
            return 'Rare';
        default:
            return rarity;
    }
};

/** @deprecated Older comfort/power split; draft uses {@link RELIC_DRAFT} rarities. */
export const RELIC_POOL_COMFORT: RelicId[] = RELIC_POOL.filter((id) => RELIC_DRAFT[id].rarity === 'common');

/** @deprecated Older comfort/power split; draft uses {@link RELIC_DRAFT} rarities. */
export const RELIC_POOL_POWER: RelicId[] = RELIC_POOL.filter((id) => RELIC_DRAFT[id].rarity !== 'common');

/**
 * Milestone index for a cleared floor (0 = first offer at floor 3), or null if not a milestone floor.
 */
export const relicMilestoneIndexForFloor = (clearedLevel: number): number | null => {
    if (clearedLevel < RELIC_FIRST_MILESTONE_FLOOR) {
        return null;
    }
    const delta = clearedLevel - RELIC_FIRST_MILESTONE_FLOOR;
    if (delta % RELIC_MILESTONE_STEP !== 0) {
        return null;
    }
    return delta / RELIC_MILESTONE_STEP;
};

/** @deprecated Use RELIC_FIRST_MILESTONE_FLOOR + RELIC_MILESTONE_STEP; kept for docs/tests sampling first three offers. */
export const RELIC_MILESTONE_FLOORS = [
    RELIC_FIRST_MILESTONE_FLOOR,
    RELIC_FIRST_MILESTONE_FLOOR + RELIC_MILESTONE_STEP,
    RELIC_FIRST_MILESTONE_FLOOR + RELIC_MILESTONE_STEP * 2
] as const;

const makeRng = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let x = s;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

export const needsRelicPick = (run: RunState): boolean => {
    if (run.gameMode === 'puzzle') {
        return false;
    }
    if (runNonNegativeInteger(run.lives) <= 0) {
        return false;
    }
    if (runNonNegativeInteger(run.relicTiersClaimed) >= MAX_RELIC_PICKS_PER_RUN) {
        return false;
    }
    if (run.status !== 'levelComplete' || !run.lastLevelResult) {
        return false;
    }
    const cleared = run.lastLevelResult.level;
    const idx = relicMilestoneIndexForFloor(cleared);
    if (idx === null) {
        return false;
    }
    return runNonNegativeInteger(run.relicTiersClaimed) <= idx && !run.relicOffer;
};

export const skipRelicOfferMilestone = (run: RunState): RunState => {
    if (run.status !== 'levelComplete' || !run.lastLevelResult) {
        return run;
    }
    const idx = relicMilestoneIndexForFloor(run.lastLevelResult.level);
    if (idx === null) {
        return run;
    }
    return {
        ...run,
        bonusRelicPicksNextOffer: 0,
        favorBonusRelicPicksNextOffer: 0,
        relicTiersClaimed: Math.max(runNonNegativeInteger(run.relicTiersClaimed), idx + 1),
        relicOffer: null
    };
};

const DRAFT_OPTION_COUNT = 3;
/**
 * @param clearedFloor — level just cleared; included in RNG seed for stable options per floor.
 * @param pickRound — increments within one milestone visit when the player takes multiple relics (reroll trio).
 */
export const rollRelicOptions = (
    run: RunState,
    tierIndex: number,
    clearedFloor: number,
    pickRound: number = 0
): RelicId[] => {
    const available = filterRelicPoolByContentLock(RELIC_POOL).filter((id) => isRelicDraftEligible(id, run));
    if (available.length <= DRAFT_OPTION_COUNT) {
        return available.slice(0, DRAFT_OPTION_COUNT);
    }

    const seed = hashStringToSeed(`relic:${run.runSeed}:${tierIndex}:${clearedFloor}:${pickRound}`);
    const rng = makeRng(seed);
    const context = getRelicDraftContext(run, clearedFloor);
    const picked: RelicId[] = [];

    if (context.isScheduledEndless) {
        const contextualCandidates = available.filter((id) => getHardRelicDraftReason(id, context) != null);
        const directAnswerCandidates = contextualCandidates.filter((id) => id !== 'chapter_compass');
        const spotlightCandidates = directAnswerCandidates.length > 0 ? directAnswerCandidates : contextualCandidates;
        const spotlight = pickWeightedWithoutReplacement(
            rng,
            spotlightCandidates.map((id) => ({
                value: id,
                weight: getContextualRelicDraftWeight(id, context, tierIndex)
            })),
            1
        )[0];
        if (spotlight) {
            picked.push(spotlight);
        }
    }

    const weighted = available
        .filter((id) => !picked.includes(id))
        .map((id) => ({
            value: id,
            weight: context.isScheduledEndless
                ? getContextualRelicDraftWeight(id, context, tierIndex)
                : effectiveRelicDraftWeight(id, tierIndex)
        }));

    return [...picked, ...pickWeightedWithoutReplacement(rng, weighted, DRAFT_OPTION_COUNT - picked.length)];
};

export const getRelicDraftOptionReasons = (
    run: RunState,
    clearedFloor: number,
    options: readonly RelicId[]
): Partial<Record<RelicId, string>> | undefined => {
    const context = getRelicDraftContext(run, clearedFloor);
    if (!context.isScheduledEndless) {
        return undefined;
    }
    const reasons: Partial<Record<RelicId, string>> = {};
    for (const id of options) {
        const reason = getRelicDraftReason(id, context);
        if (reason) {
            reasons[id] = reason;
        }
    }
    return hasRelicDraftOptionReasons(reasons) ? reasons : undefined;
};

export const RELIC_OFFER_SERVICE_CATALOG: Record<
    RelicOfferServiceId,
    { label: string; description: string; cost: number }
> = {
    reroll_offer: {
        label: 'Reroll offer',
        description: 'Spend shop gold to roll a fresh relic trio once this draft round.',
        cost: 2
    },
    ban_option: {
        label: 'Ban option',
        description: 'Spend shop gold to remove the first visible relic from this visit.',
        cost: 2
    },
    upgrade_offer: {
        label: 'Upgrade offer',
        description: 'Spend shop gold to bias the visible choices toward uncommon and rare relics.',
        cost: 3
    }
};

const relicOfferServiceUseCount = (run: RunState, serviceId: RelicOfferServiceId): number =>
    runNonNegativeInteger(run.relicOffer?.serviceUses?.[serviceId] ?? 0);

export const createRelicOfferServices = (run: RunState): RelicOfferServiceState[] => {
    const offer = run.relicOffer;
    const wallet = runNonNegativeInteger(run.shopGold);
    return RELIC_OFFER_SERVICE_IDS.map((serviceId) => {
        const base = RELIC_OFFER_SERVICE_CATALOG[serviceId];
        let unavailableReason: string | null = null;
        if (!offer) {
            unavailableReason = 'No relic offer is open.';
        } else if (relicOfferServiceUseCount(run, serviceId) > 0) {
            unavailableReason = 'Already used this relic service during this visit.';
        } else if (wallet < base.cost) {
            unavailableReason = 'Not enough shop gold.';
        } else if (offer.options.length === 0) {
            unavailableReason = 'No relic options remain.';
        } else if (serviceId === 'ban_option' && offer.options.length <= 1) {
            unavailableReason = 'Only one relic option remains.';
        } else if (serviceId === 'upgrade_offer' && offer.upgradedOffer) {
            unavailableReason = 'Offer already upgraded.';
        }
        return {
            serviceId,
            ...base,
            available: unavailableReason === null,
            unavailableReason,
            usedThisRound: relicOfferServiceUseCount(run, serviceId)
        };
    });
};

export interface RelicOfferServiceAction extends RelicOfferServiceState {
    effectPreview: string;
}

export const getRelicOfferServiceActions = (run: RunState): RelicOfferServiceAction[] =>
    createRelicOfferServices(run).map((service) => ({
        ...service,
        effectPreview:
            service.serviceId === 'reroll_offer'
                ? 'Fresh choices'
                : service.serviceId === 'ban_option'
                  ? 'Remove one option'
                  : 'Favor rare picks'
    }));

export const withRelicOfferServiceActions = <T extends RunState['relicOffer']>(run: RunState, offer: T): T =>
    offer
        ? {
              ...offer,
              services: getRelicOfferServiceActions({ ...run, relicOffer: offer })
          }
        : offer;

export interface RelicOfferServiceResult {
    run: RunState;
    applied: boolean;
    serviceId: RelicOfferServiceId;
    reason?: 'no_offer' | 'unavailable';
}

const upgradedRelicOptions = (
    run: RunState,
    tierIndex: number,
    clearedFloor: number,
    pickRound: number,
    bannedRelicIds: readonly RelicId[]
): RelicId[] => {
    const available = RELIC_POOL.filter((id) => isRelicDraftEligible(id, run) && !bannedRelicIds.includes(id));
    const preferred = available.filter((id) => RELIC_DRAFT[id].rarity !== 'common');
    const seed = hashStringToSeed(`relicUpgrade:${run.runSeed}:${tierIndex}:${clearedFloor}:${pickRound}`);
    const rng = makeRng(seed);
    const context = getRelicDraftContext(run, clearedFloor);
    const first = pickWeightedWithoutReplacement(
        rng,
        preferred.map((id) => ({
            value: id,
            weight: getContextualRelicDraftWeight(id, context, tierIndex) * 1.5
        })),
        Math.min(2, preferred.length)
    );
    const rest = pickWeightedWithoutReplacement(
        rng,
        available
            .filter((id) => !first.includes(id))
            .map((id) => ({ value: id, weight: getContextualRelicDraftWeight(id, context, tierIndex) })),
        DRAFT_OPTION_COUNT - first.length
    );
    return [...first, ...rest];
};

const fillRelicOptions = (
    run: RunState,
    tierIndex: number,
    clearedFloor: number,
    pickRound: number,
    currentOptions: readonly RelicId[],
    bannedRelicIds: readonly RelicId[]
): RelicId[] => {
    const options = [...currentOptions].filter((id, index, all) => all.indexOf(id) === index && !bannedRelicIds.includes(id));
    if (options.length >= DRAFT_OPTION_COUNT) {
        return options.slice(0, DRAFT_OPTION_COUNT);
    }
    const rolled = rollRelicOptions(run, tierIndex, clearedFloor, pickRound).filter(
        (id) => !bannedRelicIds.includes(id) && !options.includes(id)
    );
    options.push(...rolled);
    if (options.length >= DRAFT_OPTION_COUNT) {
        return options.slice(0, DRAFT_OPTION_COUNT);
    }
    const fallback = RELIC_POOL.filter(
        (id) => isRelicDraftEligible(id, run) && !bannedRelicIds.includes(id) && !options.includes(id)
    );
    return [...options, ...fallback].slice(0, DRAFT_OPTION_COUNT);
};

export const applyRelicOfferService = (
    run: RunState,
    serviceId: RelicOfferServiceId,
    targetRelicId?: RelicId
): RelicOfferServiceResult => {
    const offer = run.relicOffer;
    if (!offer || !run.lastLevelResult) {
        return { run, applied: false, serviceId, reason: 'no_offer' };
    }
    const service = createRelicOfferServices(run).find((row) => row.serviceId === serviceId);
    if (!service?.available) {
        return { run: { ...run, relicOffer: { ...offer, services: createRelicOfferServices(run) } }, applied: false, serviceId, reason: 'unavailable' };
    }
    const cleared = run.lastLevelResult.level;
    const tierIndex = relicMilestoneIndexForFloor(cleared);
    if (tierIndex === null) {
        return { run, applied: false, serviceId, reason: 'no_offer' };
    }

    const serviceUses = { ...(offer.serviceUses ?? {}), [serviceId]: relicOfferServiceUseCount(run, serviceId) + 1 };
    const bannedRelicIds = [...(offer.bannedRelicIds ?? [])];
    let pickRound = offer.pickRound;
    let upgradedOffer = offer.upgradedOffer ?? false;
    let options = [...offer.options];
    const paidRun: RunState = { ...run, shopGold: runNonNegativeInteger(run.shopGold) - service.cost };

    if (serviceId === 'ban_option') {
        const banTarget = targetRelicId && options.includes(targetRelicId) ? targetRelicId : options[0];
        if (!banTarget) {
            return {
                run: { ...run, relicOffer: { ...offer, services: createRelicOfferServices(run) } },
                applied: false,
                serviceId,
                reason: 'unavailable'
            };
        }
        bannedRelicIds.push(banTarget);
        options = options.filter((id) => id !== banTarget);
        options = fillRelicOptions(paidRun, tierIndex, cleared, pickRound + 1, options, bannedRelicIds);
    } else if (serviceId === 'reroll_offer') {
        pickRound += 1;
        options = fillRelicOptions(paidRun, tierIndex, cleared, pickRound, [], bannedRelicIds);
    } else {
        upgradedOffer = true;
        pickRound += 1;
        options = upgradedRelicOptions(paidRun, tierIndex, cleared, pickRound, bannedRelicIds);
    }

    if (options.length === 0) {
        return {
            run: { ...run, relicOffer: { ...offer, services: createRelicOfferServices(run) } },
            applied: false,
            serviceId,
            reason: 'unavailable'
        };
    }

    const nextOffer = {
        ...offer,
        options,
        pickRound,
        serviceUses,
        bannedRelicIds,
        upgradedOffer,
        contextualOptionReasons: getRelicDraftOptionReasons(paidRun, cleared, options)
    };
    const nextRun = { ...paidRun, relicOffer: nextOffer };
    return {
        run: { ...nextRun, relicOffer: { ...nextOffer, services: createRelicOfferServices(nextRun) } },
        applied: true,
        serviceId
    };
};
