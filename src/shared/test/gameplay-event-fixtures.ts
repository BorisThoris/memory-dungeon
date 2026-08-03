import type {
    BoardTurnAnnouncementFacts,
    GameplayEvent
} from '../gameplay-core-contracts';

export type BoardTurnResolvedEventFixture = Extract<GameplayEvent, { type: 'board.turn_resolved' }>;

type BoardTurnAnnouncementFactsOverrides = Omit<
    Partial<BoardTurnAnnouncementFacts>,
    | 'hazardTilesBefore'
    | 'hazardTilesAfter'
    | 'scoutsBefore'
    | 'scoutsAfter'
    | 'mimicCacheBefore'
    | 'mimicCacheAfter'
    | 'routeSpecialsBefore'
    | 'routeSpecialsAfter'
> & {
    hazardTilesBefore?: Partial<BoardTurnAnnouncementFacts['hazardTilesBefore']>;
    hazardTilesAfter?: Partial<BoardTurnAnnouncementFacts['hazardTilesAfter']>;
    scoutsBefore?: Partial<BoardTurnAnnouncementFacts['scoutsBefore']>;
    scoutsAfter?: Partial<BoardTurnAnnouncementFacts['scoutsAfter']>;
    mimicCacheBefore?: Partial<BoardTurnAnnouncementFacts['mimicCacheBefore']>;
    mimicCacheAfter?: Partial<BoardTurnAnnouncementFacts['mimicCacheAfter']>;
    routeSpecialsBefore?: Partial<BoardTurnAnnouncementFacts['routeSpecialsBefore']>;
    routeSpecialsAfter?: Partial<BoardTurnAnnouncementFacts['routeSpecialsAfter']>;
};

export const createBoardTurnAnnouncementFactsFixture = (
    overrides: BoardTurnAnnouncementFactsOverrides = {}
): BoardTurnAnnouncementFacts => {
    const defaults: BoardTurnAnnouncementFacts = {
        matchedPairsBefore: 0,
        matchedPairsAfter: 1,
        pairCountBefore: 2,
        pairCountAfter: 2,
        shopGoldBefore: 0,
        shopGoldAfter: 0,
        shuffleChargesBefore: 0,
        shuffleChargesAfter: 0,
        regionShuffleChargesBefore: 0,
        regionShuffleChargesAfter: 0,
        stickyBlockIndexBefore: null,
        stickyBlockIndexAfter: null,
        matchedTraitKinds: [],
        mismatchedTraitKinds: [],
        volatileTraitShufflesBefore: 0,
        volatileTraitShufflesAfter: 0,
        objectiveBefore: null,
        objectiveAfter: null,
        recallFocusBefore: 1,
        recallFocusAfter: 1,
        recallMatchesBefore: 0,
        recallMatchesAfter: 0,
        recallMistakesBefore: 0,
        recallMistakesAfter: 0,
        recallBonusScoreBefore: 0,
        recallBonusScoreAfter: 0,
        forgottenTileCountBefore: 0,
        forgottenTileCountAfter: 0,
        dungeonEnemiesDefeatedBefore: 0,
        dungeonEnemiesDefeatedAfter: 0,
        enemyHazardHitsBefore: 0,
        enemyHazardHitsAfter: 0,
        enemyHazardsDefeatedBefore: 0,
        enemyHazardsDefeatedAfter: 0,
        hazardTilesBefore: {
            totalTriggers: 0,
            shuffleSnares: 0,
            cascadeCaches: 0,
            mirrorDecoys: 0,
            fragileCacheClaims: 0,
            fragileCacheBreaks: 0,
            tollCaches: 0,
            fuseCaches: 0,
            fuseExpiredClaims: 0
        },
        hazardTilesAfter: {
            totalTriggers: 0,
            shuffleSnares: 0,
            cascadeCaches: 0,
            mirrorDecoys: 0,
            fragileCacheClaims: 0,
            fragileCacheBreaks: 0,
            tollCaches: 0,
            fuseCaches: 0,
            fuseExpiredClaims: 0
        },
        scoutsBefore: { lanternWard: 0, omenSeal: 0 },
        scoutsAfter: { lanternWard: 0, omenSeal: 0 },
        mimicCacheBefore: { claims: 0, bites: 0, guardBites: 0 },
        mimicCacheAfter: { claims: 0, bites: 0, guardBites: 0 },
        routeSpecialsBefore: {
            anchorSealUses: 0,
            loadedGatewayPlans: 0,
            catalystAltarUpgrades: 0,
            parasiteVesselConversions: 0,
            pinLatticeRewards: 0
        },
        routeSpecialsAfter: {
            anchorSealUses: 0,
            loadedGatewayPlans: 0,
            catalystAltarUpgrades: 0,
            parasiteVesselConversions: 0,
            pinLatticeRewards: 0
        },
        safeHazardWardsUsedBefore: 0,
        safeHazardWardsUsedAfter: 0
    };
    return {
        ...defaults,
        ...overrides,
        hazardTilesBefore: { ...defaults.hazardTilesBefore, ...overrides.hazardTilesBefore },
        hazardTilesAfter: { ...defaults.hazardTilesAfter, ...overrides.hazardTilesAfter },
        scoutsBefore: { ...defaults.scoutsBefore, ...overrides.scoutsBefore },
        scoutsAfter: { ...defaults.scoutsAfter, ...overrides.scoutsAfter },
        mimicCacheBefore: { ...defaults.mimicCacheBefore, ...overrides.mimicCacheBefore },
        mimicCacheAfter: { ...defaults.mimicCacheAfter, ...overrides.mimicCacheAfter },
        routeSpecialsBefore: { ...defaults.routeSpecialsBefore, ...overrides.routeSpecialsBefore },
        routeSpecialsAfter: { ...defaults.routeSpecialsAfter, ...overrides.routeSpecialsAfter }
    };
};

type BoardTurnResolvedEventOverrides = Omit<
    Partial<BoardTurnResolvedEventFixture>,
    'announcement' | 'type'
> & {
    announcement?: BoardTurnAnnouncementFactsOverrides;
};

export const createBoardTurnResolvedEventFixture = (
    overrides: BoardTurnResolvedEventOverrides = {}
): BoardTurnResolvedEventFixture => {
    const { announcement, ...eventOverrides } = overrides;
    return {
        schemaVersion: 1,
        commandId: 'board-turn-fixture',
        eventId: 'board-turn-fixture:0',
        sequence: 0,
        source: { kind: 'system', id: 'board_turn' },
        type: 'board.turn_resolved',
        outcome: 'match',
        boardLevel: 1,
        flippedTileIds: ['a1', 'a2'],
        floaterTileIds: ['a1', 'a2'],
        matchedPairKey: 'a',
        matchedFindableKind: null,
        findablesClaimedBefore: 0,
        findablesClaimedAfter: 0,
        findablesTotalBefore: 0,
        findablesTotalAfter: 0,
        announcement: createBoardTurnAnnouncementFactsFixture(announcement),
        matchedRouteKind: null,
        traitInteractionTags: [],
        boardComplete: false,
        statusBefore: 'resolving',
        statusAfter: 'playing',
        livesBefore: 3,
        livesAfter: 3,
        totalScoreBefore: 0,
        totalScoreAfter: 0,
        triesBefore: 0,
        triesAfter: 1,
        matchesBefore: 0,
        matchesAfter: 1,
        mismatchesBefore: 0,
        mismatchesAfter: 0,
        currentStreakBefore: 0,
        currentStreakAfter: 1,
        comboShardsBefore: 0,
        comboShardsAfter: 0,
        guardTokensBefore: 0,
        guardTokensAfter: 0,
        ...eventOverrides
    };
};
