import type { BoardState, FeaturedObjectiveId, HazardTileKind, Tile } from './contracts';
import { CORE_SAFE_MEMORY_TAX, type MechanicTokenId, type MemoryTaxScore } from './mechanic-feedback';
import { DECOY_PAIR_KEY } from './tile-identity';

export type HazardTileFamily = 'penalty' | 'reward' | 'dual';
export type HazardTileTrigger = 'flip' | 'mismatch' | 'match';
export type HazardTileTriggerScope = HazardTileTrigger | 'match_or_mismatch';
export type HazardTileOutcomeKind =
    | 'shuffle_hidden_preview'
    | 'cascade_remove_preview'
    | 'decoy_misdirect_preview'
    | 'fragile_cache_preview'
    | 'toll_cache_preview'
    | 'fuse_cache_preview';
export type HazardTileObjectiveImpact = 'preserves' | 'can_forfeit' | 'can_help' | 'blocked_target' | 'special_case';
export type HazardTileBalanceTone = 'favorable' | 'risky' | 'neutral';
export type HazardTileBlockedReason =
    | 'no_hazard'
    | 'unknown_hazard'
    | 'wrong_trigger'
    | 'no_safe_targets';

export interface HazardTileDefinition {
    kind: HazardTileKind;
    family: HazardTileFamily;
    label: string;
    prototypeOnly: false;
    enabledInNormalRuns: true;
    trigger: HazardTileTriggerScope;
    triggerScope: string;
    outcomeKind: HazardTileOutcomeKind;
    telegraph: string;
    focusHint: string;
    outcomePreview: string;
    resultCopy: string;
    liveAnnouncement: string;
    reducedMotionLiveAnnouncement: string;
    breakLiveAnnouncement?: string;
    reducedMotionBreakLiveAnnouncement?: string;
    objectiveInteraction: string;
    targetPolicy: string;
    reducedMotionCopy: string;
    ariaLabel: string;
    tokens: MechanicTokenId[];
    memoryTax: MemoryTaxScore;
    canTargetDecoy: false;
    canTargetExit: false;
}

export interface HazardTileBoardSummaryRow {
    kind: HazardTileKind;
    label: string;
    family: HazardTileFamily;
    count: number;
    trigger: HazardTileTriggerScope;
    telegraph: string;
    resultCopy: string;
    objectiveInteraction: string;
    tokens: MechanicTokenId[];
}

export interface HazardTileBoardSummary {
    hasHazards: boolean;
    totalHazardTiles: number;
    rows: HazardTileBoardSummaryRow[];
    hudLabel: string | null;
    hudDetail: string | null;
}

export interface HazardTileObjectiveImpactRow {
    objectiveId: FeaturedObjectiveId | 'findables';
    impact: HazardTileObjectiveImpact;
    copy: string;
    tokens: MechanicTokenId[];
}

export interface HazardTileObjectiveBalanceRow {
    kind: HazardTileKind;
    label: string;
    family: HazardTileFamily;
    balanceTone: HazardTileBalanceTone;
    pressureNote: string;
    rewardNote: string;
    memoryNote: string;
    objectiveImpacts: HazardTileObjectiveImpactRow[];
    tokens: MechanicTokenId[];
}

export interface HazardTileTelegraph {
    hasHazard: boolean;
    kind: HazardTileKind | null;
    label: string | null;
    telegraph: string | null;
    ariaLabel: string | null;
    prototypeOnly: boolean;
    enabledInNormalRuns: boolean;
}

export interface HazardTileLiveCopy {
    kind: HazardTileKind;
    label: string;
    focusHint: string;
    liveAnnouncement: string;
    reducedMotionLiveAnnouncement: string;
    breakLiveAnnouncement?: string;
    reducedMotionBreakLiveAnnouncement?: string;
    ariaLabel: string;
    tokens: MechanicTokenId[];
}

export interface HazardTileOutcomePreviewInput {
    tile: Tile;
    trigger: HazardTileTrigger;
    candidateTargetTiles?: readonly Tile[];
}

export interface HazardTileOutcomePreview {
    kind: HazardTileKind | null;
    trigger: HazardTileTrigger;
    wouldTrigger: boolean;
    prototypeOnly: boolean;
    normalRunBlocked: boolean;
    outcomeKind: HazardTileOutcomeKind | null;
    affectedTileIds: string[];
    skippedUnsafeTargetIds: string[];
    blockedReason: HazardTileBlockedReason | null;
    invariants: {
        preservesBoardCompletion: true;
        excludesDecoys: true;
        excludesExits: true;
    };
}

const hazardMemoryTax = (score: Partial<MemoryTaxScore>): MemoryTaxScore => ({
    ...CORE_SAFE_MEMORY_TAX,
    ...score
});

export const HAZARD_TILE_DEFINITIONS: Record<HazardTileKind, HazardTileDefinition> = {
    shuffle_snare: {
        kind: 'shuffle_snare',
        family: 'penalty',
        label: 'Shuffle Snare',
        prototypeOnly: false,
        enabledInNormalRuns: true,
        trigger: 'mismatch',
        triggerScope: 'First resolving mismatch that includes either snare tile.',
        outcomeKind: 'shuffle_hidden_preview',
        telegraph: 'Warns that a wrong pair reshuffles safe hidden tiles.',
        focusHint: 'Wrong pairs reshuffle safe hidden tiles.',
        outcomePreview: 'Mismatch would move only hidden non-objective tiles; exits and decoys stay anchored.',
        resultCopy: 'Mismatch reshuffles safe hidden tiles and clears stale pins only when the snare actually fires.',
        liveAnnouncement: 'Shuffle Snare fired. Hidden safe tiles reordered.',
        reducedMotionLiveAnnouncement: 'Shuffle Snare fired. Hidden safe tiles reordered without motion.',
        objectiveInteraction: 'Counts as a hazard trigger; does not spend player shuffle charges or change objective completion directly.',
        targetPolicy: 'May move only hidden normal tiles, never exits, decoys, dungeon cards, route cards, pickups, or other hazards.',
        reducedMotionCopy: 'Hidden safe tiles would reorder after the mismatch.',
        ariaLabel: 'Shuffle snare. A mismatch triggers a hidden safe tile shuffle.',
        tokens: ['risk', 'armed', 'hidden_known', 'forfeit'],
        memoryTax: hazardMemoryTax({ spatialDisruption: 2, hiddenPunishment: 1, uiComprehensionLoad: 2 }),
        canTargetDecoy: false,
        canTargetExit: false
    },
    cascade_cache: {
        kind: 'cascade_cache',
        family: 'reward',
        label: 'Cascade Cache',
        prototypeOnly: false,
        enabledInNormalRuns: true,
        trigger: 'match',
        triggerScope: 'Successful pair match that includes both cache tiles.',
        outcomeKind: 'cascade_remove_preview',
        telegraph: 'Shows that a clean match removes one safe hidden pair.',
        focusHint: 'Clean matches clear one safe hidden pair.',
        outcomePreview: 'Match removes one eligible hidden safe pair without touching exits or decoys.',
        resultCopy: 'Clean match removes one complete safe hidden pair and advances board completion.',
        liveAnnouncement: 'Cascade Cache fired. One safe hidden pair cleared.',
        reducedMotionLiveAnnouncement: 'Cascade Cache fired. One safe hidden pair cleared without motion.',
        objectiveInteraction: 'Counts as a hazard trigger and match momentum; never claims featured objective credit for the removed pair.',
        targetPolicy: 'May remove only a complete hidden normal pair, never exits, decoys, dungeon cards, route cards, pickups, or other hazards.',
        reducedMotionCopy: 'One eligible safe hidden pair clears after the match.',
        ariaLabel: 'Cascade cache. A match clears one safe hidden pair.',
        tokens: ['reward', 'momentum', 'resolved', 'safe'],
        memoryTax: hazardMemoryTax({ informationBypass: 1, mistakeRecovery: 1, uiComprehensionLoad: 1 }),
        canTargetDecoy: false,
        canTargetExit: false
    },
    mirror_decoy: {
        kind: 'mirror_decoy',
        family: 'dual',
        label: 'Mirror Decoy',
        prototypeOnly: false,
        enabledInNormalRuns: true,
        trigger: 'mismatch',
        triggerScope: 'Mismatch involving the singleton mirror tile.',
        outcomeKind: 'decoy_misdirect_preview',
        telegraph: 'Marks a suspicious singleton that copies a nearby symbol but never counts as a pair.',
        focusHint: 'Suspicious singleton: copied symbol, no valid pair.',
        outcomePreview: 'Flip exposes the copied-symbol warning; only a mismatch involving it counts as a hazard trigger.',
        resultCopy: 'A mismatch involving the copied-symbol decoy may leave it face-up without blocking floor completion.',
        liveAnnouncement: 'Mirror Decoy misled the mismatch. It cannot form a pair.',
        reducedMotionLiveAnnouncement: 'Mirror Decoy misled the mismatch. It cannot form a pair.',
        objectiveInteraction: 'Counts as a hazard trigger only on mismatch paths and can fail glass-witness style objectives like other decoy exposure.',
        targetPolicy: 'Never targets another tile; it is itself the singleton decoy and cannot become an exit or valid pair.',
        reducedMotionCopy: 'The decoy warning would stay visible after flip.',
        ariaLabel: 'Mirror decoy. This singleton copies a symbol but never forms a pair.',
        tokens: ['risk', 'hidden_known', 'armed', 'forfeit'],
        memoryTax: hazardMemoryTax({ informationBypass: 1, hiddenPunishment: 1, uiComprehensionLoad: 2 }),
        canTargetDecoy: false,
        canTargetExit: false
    },
    fragile_cache: {
        kind: 'fragile_cache',
        family: 'reward',
        label: 'Fragile Cache',
        prototypeOnly: false,
        enabledInNormalRuns: true,
        trigger: 'match_or_mismatch',
        triggerScope: 'Clean match claims the cache; mismatch involving either cache tile breaks the bonus.',
        outcomeKind: 'fragile_cache_preview',
        telegraph: 'Shows a greed cache that pays only if matched cleanly before a mismatch touches it.',
        focusHint: 'Clean match pays a bonus; a mismatch breaks the cache.',
        outcomePreview: 'Match would claim a small bonus; mismatch would remove only the cache marker and keep the pair matchable.',
        resultCopy: 'Clean match pays the fragile bonus; mismatch breaks only the bonus marker and preserves board completion.',
        liveAnnouncement: 'Fragile Cache claimed. Bonus score added.',
        reducedMotionLiveAnnouncement: 'Fragile Cache claimed. Bonus score added.',
        breakLiveAnnouncement: 'Fragile Cache broke. Its bonus is gone, but the pair still matches.',
        reducedMotionBreakLiveAnnouncement: 'Fragile Cache broke. Its bonus is gone, but the pair still matches.',
        objectiveInteraction: 'Counts as a hazard trigger; clean claim can help score goals while a mismatch can forfeit flip-par pacing.',
        targetPolicy: 'Targets no other tile; mismatch removes only this pair hazard marker and never changes exits, decoys, rewards, or objectives.',
        reducedMotionCopy: 'Cache claim or break is summarized without extra motion.',
        ariaLabel: 'Fragile cache. Match cleanly for bonus score; mismatch breaks the cache bonus.',
        tokens: ['reward', 'risk', 'forfeit', 'momentum'],
        memoryTax: hazardMemoryTax({ hiddenPunishment: 1, uiComprehensionLoad: 2 }),
        canTargetDecoy: false,
        canTargetExit: false
    },
    toll_cache: {
        kind: 'toll_cache',
        family: 'dual',
        label: 'Toll Cache',
        prototypeOnly: false,
        enabledInNormalRuns: true,
        trigger: 'match',
        triggerScope: 'Successful pair match that includes both toll cache tiles.',
        outcomeKind: 'toll_cache_preview',
        telegraph: 'Shows a greed cache that converts part of the match score into shop gold.',
        focusHint: 'Clean match pays shop gold but takes a small score toll.',
        outcomePreview: 'Match would grant one shop gold and subtract a small score toll, never dropping the match below zero.',
        resultCopy: 'Clean match pays shop gold by converting part of that match score; bypassing it denies the payout.',
        liveAnnouncement: 'Toll Cache claimed. Shop gold gained; score toll paid.',
        reducedMotionLiveAnnouncement: 'Toll Cache claimed. Shop gold gained; score toll paid.',
        objectiveInteraction: 'Counts as a hazard trigger; can help economy while making score-based objectives tighter.',
        targetPolicy: 'Targets no other tile; it only changes the matched pair payout and never spends scarce resources silently.',
        reducedMotionCopy: 'Shop gold gain and score toll are summarized without extra motion.',
        ariaLabel: 'Toll cache. Match cleanly for shop gold while paying a small score toll.',
        tokens: ['reward', 'risk', 'cost', 'momentum'],
        memoryTax: hazardMemoryTax({ hiddenPunishment: 1, uiComprehensionLoad: 2 }),
        canTargetDecoy: false,
        canTargetExit: false
    },
    fuse_cache: {
        kind: 'fuse_cache',
        family: 'dual',
        label: 'Fuse Cache',
        prototypeOnly: false,
        enabledInNormalRuns: true,
        trigger: 'match',
        triggerScope: 'Successful pair match; full payout only during the first three floor resolutions.',
        outcomeKind: 'fuse_cache_preview',
        telegraph: 'Shows a greed cache whose full payout expires after three resolutions.',
        focusHint: 'Claim in the first three resolutions for full payout.',
        outcomePreview: 'Early match grants score and shop gold; late match keeps only consolation gold.',
        resultCopy: 'Clean match pays a timed greed reward; after the fuse expires, the pair still matches for a smaller payout.',
        liveAnnouncement: 'Fuse Cache claimed early. Full payout gained.',
        reducedMotionLiveAnnouncement: 'Fuse Cache claimed early. Full payout gained.',
        breakLiveAnnouncement: 'Fuse Cache claimed late. Fuse expired; consolation gold gained.',
        reducedMotionBreakLiveAnnouncement: 'Fuse Cache claimed late. Fuse expired; consolation gold gained.',
        objectiveInteraction: 'Counts as a hazard trigger; rewards fast clean extraction while normal mismatch and flip-par pressure still apply.',
        targetPolicy: 'Targets no other tile; it only changes the matched pair payout and never changes board completion.',
        reducedMotionCopy: 'Fuse payout timing is summarized without extra motion.',
        ariaLabel: 'Fuse cache. Match in the first three resolutions for full payout.',
        tokens: ['reward', 'risk', 'cost', 'momentum'],
        memoryTax: hazardMemoryTax({ hiddenPunishment: 1, uiComprehensionLoad: 2 }),
        canTargetDecoy: false,
        canTargetExit: false
    }
};

export const getHazardTileDefinitions = (): HazardTileDefinition[] => Object.values(HAZARD_TILE_DEFINITIONS);

export const getHazardTileDefinition = (kind: HazardTileKind): HazardTileDefinition => HAZARD_TILE_DEFINITIONS[kind];

export const getHazardTileLiveCopy = (kind: HazardTileKind): HazardTileLiveCopy => {
    const definition = getHazardTileDefinition(kind);
    return {
        kind: definition.kind,
        label: definition.label,
        focusHint: definition.focusHint,
        liveAnnouncement: definition.liveAnnouncement,
        reducedMotionLiveAnnouncement: definition.reducedMotionLiveAnnouncement,
        breakLiveAnnouncement: definition.breakLiveAnnouncement,
        reducedMotionBreakLiveAnnouncement: definition.reducedMotionBreakLiveAnnouncement,
        ariaLabel: definition.ariaLabel,
        tokens: definition.tokens
    };
};

export const getHazardTileLiveCopies = (): HazardTileLiveCopy[] =>
    getHazardTileDefinitions().map((definition) => getHazardTileLiveCopy(definition.kind));

const objectiveImpact = (
    objectiveId: HazardTileObjectiveImpactRow['objectiveId'],
    impact: HazardTileObjectiveImpact,
    copy: string,
    tokens: MechanicTokenId[]
): HazardTileObjectiveImpactRow => ({ objectiveId, impact, copy, tokens });

export const HAZARD_TILE_OBJECTIVE_BALANCE_ROWS: readonly HazardTileObjectiveBalanceRow[] = [
    {
        kind: 'shuffle_snare',
        label: HAZARD_TILE_DEFINITIONS.shuffle_snare.label,
        family: HAZARD_TILE_DEFINITIONS.shuffle_snare.family,
        balanceTone: 'risky',
        pressureNote: 'Adds spatial disruption after a mismatch without spending player shuffle charges.',
        rewardNote: 'No direct reward; its value is pressure, not payout.',
        memoryNote: 'Raises location memory tax because safe hidden cards move after the miss.',
        objectiveImpacts: [
            objectiveImpact('scholar_style', 'preserves', 'Hazard shuffling does not count as a player shuffle or destroy action.', ['safe', 'objective']),
            objectiveImpact('glass_witness', 'preserves', 'The snare does not reveal a decoy by itself.', ['safe', 'objective']),
            objectiveImpact('cursed_last', 'preserves', 'The cursed pair stays intact and must still be matched by player action.', ['safe', 'objective']),
            objectiveImpact('flip_par', 'can_forfeit', 'The mismatch that triggers the snare can push the floor over flip-par pacing.', ['risk', 'forfeit']),
            objectiveImpact('findables', 'preserves', 'Findable pickup tiles are excluded from snare shuffle targets.', ['safe', 'reward'])
        ],
        tokens: ['risk', 'armed', 'hidden_known', 'forfeit']
    },
    {
        kind: 'cascade_cache',
        label: HAZARD_TILE_DEFINITIONS.cascade_cache.label,
        family: HAZARD_TILE_DEFINITIONS.cascade_cache.family,
        balanceTone: 'favorable',
        pressureNote: 'Reduces remaining board work after a clean match.',
        rewardNote: 'Pays tempo by removing one safe hidden pair, but does not claim pickup or objective rewards for that pair.',
        memoryNote: 'Lowers future memory load by removing a known-safe pair from the board.',
        objectiveImpacts: [
            objectiveImpact('scholar_style', 'preserves', 'Cascade removal is not a player shuffle or destroy action.', ['safe', 'objective']),
            objectiveImpact('glass_witness', 'preserves', 'Cascade targets exclude decoys and cannot expose the witness decoy.', ['safe', 'objective']),
            objectiveImpact('cursed_last', 'blocked_target', 'Cascade must not remove the cursed pair; the player still owns cursed-last timing.', ['locked', 'safe', 'objective']),
            objectiveImpact('flip_par', 'can_help', 'A clean cascade can reduce remaining required matches without adding a mismatch.', ['reward', 'momentum']),
            objectiveImpact('findables', 'blocked_target', 'Findable pickup pairs are excluded so rewards are claimed or forfeited by player action.', ['locked', 'reward'])
        ],
        tokens: ['reward', 'momentum', 'resolved', 'safe']
    },
    {
        kind: 'mirror_decoy',
        label: HAZARD_TILE_DEFINITIONS.mirror_decoy.label,
        family: HAZARD_TILE_DEFINITIONS.mirror_decoy.family,
        balanceTone: 'neutral',
        pressureNote: 'Adds a singleton read test without changing pair count.',
        rewardNote: 'No direct reward; the payoff is avoiding a false match and preserving objectives.',
        memoryNote: 'Adds symbol ambiguity while remaining completion-safe.',
        objectiveImpacts: [
            objectiveImpact('scholar_style', 'preserves', 'Revealing the mirror does not spend shuffle or destroy actions.', ['safe', 'objective']),
            objectiveImpact('glass_witness', 'can_forfeit', 'Revealing a decoy can fail glass-witness style objectives.', ['risk', 'forfeit', 'objective']),
            objectiveImpact('cursed_last', 'preserves', 'The singleton decoy is not the cursed pair and cannot resolve it early.', ['safe', 'objective']),
            objectiveImpact('flip_par', 'can_forfeit', 'A false mirror read can add mismatch pressure against flip par.', ['risk', 'forfeit']),
            objectiveImpact('findables', 'preserves', 'The mirror targets no pickup tile and cannot claim findables.', ['safe', 'reward'])
        ],
        tokens: ['risk', 'hidden_known', 'armed', 'forfeit']
    },
    {
        kind: 'fragile_cache',
        label: HAZARD_TILE_DEFINITIONS.fragile_cache.label,
        family: HAZARD_TILE_DEFINITIONS.fragile_cache.family,
        balanceTone: 'risky',
        pressureNote: 'Creates greed pressure around clean matching without changing the pair graph.',
        rewardNote: 'Pays a small score bonus only when the marked pair is matched before mismatch pressure breaks it.',
        memoryNote: 'Adds a remembered risk/reward target but does not move, hide, or remove other cards.',
        objectiveImpacts: [
            objectiveImpact('scholar_style', 'preserves', 'Fragile claim or break does not count as player shuffle or destroy action.', ['safe', 'objective']),
            objectiveImpact('glass_witness', 'preserves', 'Fragile cache never targets or reveals the decoy by itself.', ['safe', 'objective']),
            objectiveImpact('cursed_last', 'preserves', 'Fragile cache does not remove or auto-resolve the cursed pair.', ['safe', 'objective']),
            objectiveImpact('flip_par', 'can_forfeit', 'The mismatch that breaks the cache can push the floor over flip-par pacing.', ['risk', 'forfeit']),
            objectiveImpact('findables', 'preserves', 'Findable pickup tiles are excluded from fragile cache assignment.', ['safe', 'reward'])
        ],
        tokens: ['reward', 'risk', 'forfeit', 'momentum']
    },
    {
        kind: 'toll_cache',
        label: HAZARD_TILE_DEFINITIONS.toll_cache.label,
        family: HAZARD_TILE_DEFINITIONS.toll_cache.family,
        balanceTone: 'neutral',
        pressureNote: 'Creates economy pressure by trading some immediate score for shop gold.',
        rewardNote: 'Pays one shop gold on a clean match without silently spending shards, guard, keys, or lives.',
        memoryNote: 'Adds a remembered greed target but does not move, hide, or remove other cards.',
        objectiveImpacts: [
            objectiveImpact('scholar_style', 'preserves', 'Toll cache claim does not count as player shuffle or destroy action.', ['safe', 'objective']),
            objectiveImpact('glass_witness', 'preserves', 'Toll cache never targets or reveals the decoy by itself.', ['safe', 'objective']),
            objectiveImpact('cursed_last', 'preserves', 'Toll cache does not remove or auto-resolve the cursed pair.', ['safe', 'objective']),
            objectiveImpact('flip_par', 'can_help', 'A clean toll claim is still a normal match resolution, but its score toll tightens score goals.', ['reward', 'cost']),
            objectiveImpact('findables', 'preserves', 'Findable pickup tiles are excluded from toll cache assignment.', ['safe', 'reward'])
        ],
        tokens: ['reward', 'risk', 'cost', 'momentum']
    },
    {
        kind: 'fuse_cache',
        label: HAZARD_TILE_DEFINITIONS.fuse_cache.label,
        family: HAZARD_TILE_DEFINITIONS.fuse_cache.family,
        balanceTone: 'risky',
        pressureNote: 'Adds turn-count extraction pressure without real-time timers or hidden state changes.',
        rewardNote: 'Pays stronger score and gold only if claimed before three floor resolutions, then drops to consolation gold.',
        memoryNote: 'Adds a remembered greed target and route-planning priority without moving or transforming cards.',
        objectiveImpacts: [
            objectiveImpact('scholar_style', 'preserves', 'Fuse cache claim does not count as player shuffle or destroy action.', ['safe', 'objective']),
            objectiveImpact('glass_witness', 'preserves', 'Fuse cache never targets or reveals the decoy by itself.', ['safe', 'objective']),
            objectiveImpact('cursed_last', 'preserves', 'Fuse cache does not remove or auto-resolve the cursed pair.', ['safe', 'objective']),
            objectiveImpact('flip_par', 'can_help', 'Fast fuse extraction is a normal match resolution, but chasing it can pressure flip-par choices.', ['reward', 'risk']),
            objectiveImpact('findables', 'preserves', 'Findable pickup tiles are excluded from fuse cache assignment.', ['safe', 'reward'])
        ],
        tokens: ['reward', 'risk', 'cost', 'momentum']
    }
];

export const getHazardTileObjectiveBalanceRows = (): HazardTileObjectiveBalanceRow[] => [
    ...HAZARD_TILE_OBJECTIVE_BALANCE_ROWS
];

export const getHazardTileObjectiveImpact = (
    kind: HazardTileKind,
    objectiveId: HazardTileObjectiveImpactRow['objectiveId']
): HazardTileObjectiveImpactRow =>
    HAZARD_TILE_OBJECTIVE_BALANCE_ROWS
        .find((row) => row.kind === kind)!
        .objectiveImpacts.find((impact) => impact.objectiveId === objectiveId)!;

export const getHazardTileBoardSummary = (board: BoardState | null | undefined): HazardTileBoardSummary => {
    if (!board) {
        return {
            hasHazards: false,
            totalHazardTiles: 0,
            rows: [],
            hudLabel: null,
            hudDetail: null
        };
    }

    const counts = new Map<HazardTileKind, number>();
    for (const tile of board.tiles) {
        if (tile.tileHazardKind && tile.state !== 'matched' && tile.state !== 'removed') {
            counts.set(tile.tileHazardKind, (counts.get(tile.tileHazardKind) ?? 0) + 1);
        }
    }

    const rows = getHazardTileDefinitions()
        .map((definition): HazardTileBoardSummaryRow | null => {
            const count = counts.get(definition.kind) ?? 0;
            return count > 0
                ? {
                      kind: definition.kind,
                      label: definition.label,
                      family: definition.family,
                      count,
                      trigger: definition.trigger,
                      telegraph: definition.telegraph,
                      resultCopy: definition.resultCopy,
                      objectiveInteraction: definition.objectiveInteraction,
                      tokens: definition.tokens
                  }
                : null;
        })
        .filter((row): row is HazardTileBoardSummaryRow => row != null);

    const totalHazardTiles = rows.reduce((sum, row) => sum + row.count, 0);
    const hudLabel = rows.length > 0 ? `${totalHazardTiles} hazard tile${totalHazardTiles === 1 ? '' : 's'}` : null;
    const hudDetail =
        rows.length > 0
        ? rows.map((row) => `${row.label} x${row.count}: ${row.telegraph}`).join(' ')
        : null;

    return {
        hasHazards: rows.length > 0,
        totalHazardTiles,
        rows,
        hudLabel,
        hudDetail
    };
};

export const getHazardTileTelegraph = (tile: Tile): HazardTileTelegraph => {
    if (!tile.tileHazardKind) {
        return {
            hasHazard: false,
            kind: null,
            label: null,
            telegraph: null,
            ariaLabel: null,
            prototypeOnly: false,
            enabledInNormalRuns: false
        };
    }

    const definition = HAZARD_TILE_DEFINITIONS[tile.tileHazardKind];
    if (!definition) {
        return {
            hasHazard: false,
            kind: tile.tileHazardKind,
            label: null,
            telegraph: null,
            ariaLabel: null,
            prototypeOnly: true,
            enabledInNormalRuns: false
        };
    }

    return {
        hasHazard: true,
        kind: definition.kind,
        label: definition.label,
        telegraph: definition.focusHint,
        ariaLabel: definition.ariaLabel,
        prototypeOnly: definition.prototypeOnly,
        enabledInNormalRuns: definition.enabledInNormalRuns
    };
};

const previewInvariants = (): HazardTileOutcomePreview['invariants'] => ({
    preservesBoardCompletion: true,
    excludesDecoys: true,
    excludesExits: true
});

const emptyPreview = (
    input: HazardTileOutcomePreviewInput,
    blockedReason: HazardTileBlockedReason,
    kind: HazardTileKind | null = input.tile.tileHazardKind ?? null,
    outcomeKind: HazardTileOutcomeKind | null = kind ? (HAZARD_TILE_DEFINITIONS[kind]?.outcomeKind ?? null) : null
): HazardTileOutcomePreview => ({
    kind,
    trigger: input.trigger,
    wouldTrigger: false,
    prototypeOnly: kind != null ? (HAZARD_TILE_DEFINITIONS[kind]?.prototypeOnly ?? true) : false,
    normalRunBlocked: kind != null && !(kind ? HAZARD_TILE_DEFINITIONS[kind]?.enabledInNormalRuns : false),
    outcomeKind,
    affectedTileIds: [],
    skippedUnsafeTargetIds: [],
    blockedReason,
    invariants: previewInvariants()
});

const isUnsafeHazardTarget = (tile: Tile): boolean =>
    tile.pairKey === DECOY_PAIR_KEY ||
    tile.dungeonCardKind != null ||
    tile.routeSpecialKind != null ||
    tile.routeCardKind != null ||
    tile.findableKind != null ||
    tile.tileHazardKind != null;

const isEligibleHazardTarget = (tile: Tile): boolean => tile.state === 'hidden' && !isUnsafeHazardTarget(tile);

const targetLimitForOutcome = (outcomeKind: HazardTileOutcomeKind): number | null =>
    outcomeKind === 'cascade_remove_preview'
        ? 1
        : outcomeKind === 'decoy_misdirect_preview' ||
            outcomeKind === 'fragile_cache_preview' ||
            outcomeKind === 'toll_cache_preview' ||
            outcomeKind === 'fuse_cache_preview'
          ? 0
          : null;

export const previewHazardTileOutcome = (input: HazardTileOutcomePreviewInput): HazardTileOutcomePreview => {
    const kind = input.tile.tileHazardKind;
    if (!kind) return emptyPreview(input, 'no_hazard');

    const definition = HAZARD_TILE_DEFINITIONS[kind];
    if (!definition) return emptyPreview(input, 'unknown_hazard', kind);
    const triggerMatches =
        definition.trigger === input.trigger ||
        (definition.trigger === 'match_or_mismatch' && (input.trigger === 'match' || input.trigger === 'mismatch'));
    if (!triggerMatches) {
        return emptyPreview(input, 'wrong_trigger', kind, definition.outcomeKind);
    }

    const candidateTargets = input.candidateTargetTiles ?? [];
    const skippedUnsafeTargetIds = candidateTargets.filter(isUnsafeHazardTarget).map((tile) => tile.id);
    const eligibleTargets = candidateTargets.filter(isEligibleHazardTarget);
    const limit = targetLimitForOutcome(definition.outcomeKind);
    const affectedTileIds = limit == null ? eligibleTargets.map((tile) => tile.id) : eligibleTargets.slice(0, limit).map((tile) => tile.id);

    if (
        definition.outcomeKind !== 'decoy_misdirect_preview' &&
        definition.outcomeKind !== 'fragile_cache_preview' &&
        definition.outcomeKind !== 'toll_cache_preview' &&
        definition.outcomeKind !== 'fuse_cache_preview' &&
        affectedTileIds.length === 0
    ) {
        return {
            ...emptyPreview(input, 'no_safe_targets', kind, definition.outcomeKind),
            skippedUnsafeTargetIds
        };
    }

    return {
        kind,
        trigger: input.trigger,
        wouldTrigger: true,
        prototypeOnly: definition.prototypeOnly,
        normalRunBlocked: false,
        outcomeKind: definition.outcomeKind,
        affectedTileIds,
        skippedUnsafeTargetIds,
        blockedReason: null,
        invariants: previewInvariants()
    };
};
