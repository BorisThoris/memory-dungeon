import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game';
import { getBoardTurnAnnouncementFacts } from './board-turn-event-facts';

describe('board-turn event facts', () => {
    it('captures normalized before/after HUD facts in the core boundary', () => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const before: RunState = {
            ...base,
            status: 'resolving',
            shopGold: 2,
            shuffleCharges: 0,
            regionShuffleCharges: 0,
            stickyBlockIndex: null,
            recallFocus: 1,
            recallMatchesThisFloor: 0,
            recallBonusScoreThisFloor: 0,
            forgottenTileIdsThisFloor: ['unstable-a'],
            traitRouteObjectiveRequiredThisFloor: 2,
            traitRouteObjectiveProgressThisFloor: 0,
            board: {
                ...base.board!,
                dungeonObjectiveId: 'find_exit',
                matchedPairs: 0,
                pairCount: 4,
                tiles: base.board!.tiles.map((tile) => ({
                    ...tile,
                    dungeonCardKind: undefined,
                    dungeonCardState: undefined
                }))
            }
        };
        const after: RunState = {
            ...before,
            status: 'playing',
            shopGold: 4,
            shuffleCharges: 1,
            regionShuffleCharges: 1,
            stickyBlockIndex: 3,
            recallFocus: 2,
            recallMatchesThisFloor: 1,
            recallBonusScoreThisFloor: 8,
            forgottenTileIdsThisFloor: [],
            traitRouteObjectiveProgressThisFloor: 1,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 1,
            hazardTileTriggersThisFloor: 2,
            hazardShuffleSnaresThisFloor: 1,
            hazardCascadeCachesThisFloor: 1,
            lanternWardScoutsThisFloor: 1,
            omenSealScoutsThisFloor: 1,
            mimicCacheClaimsThisFloor: 1,
            anchorSealUsesThisFloor: 1,
            loadedGatewayPlansThisFloor: 1,
            catalystAltarUpgradesThisFloor: 1,
            parasiteVesselConversionsThisFloor: 1,
            pinLatticeRewardsThisFloor: 1,
            safeHazardWardsUsedThisFloor: 1,
            board: {
                ...before.board!,
                matchedPairs: 1
            },
            stats: {
                ...before.stats,
                tileTraitMatches: {
                    ...before.stats.tileTraitMatches,
                    echo: before.stats.tileTraitMatches.echo + 1,
                    stasis: before.stats.tileTraitMatches.stasis + 1
                },
                volatileTraitShuffles: before.stats.volatileTraitShuffles + 1
            }
        };

        expect(getBoardTurnAnnouncementFacts(before, after)).toMatchObject({
            matchedPairsBefore: 0,
            matchedPairsAfter: 1,
            pairCountBefore: 4,
            pairCountAfter: 4,
            shopGoldBefore: 2,
            shopGoldAfter: 4,
            shuffleChargesBefore: 0,
            shuffleChargesAfter: 1,
            regionShuffleChargesBefore: 0,
            regionShuffleChargesAfter: 1,
            stickyBlockIndexBefore: null,
            stickyBlockIndexAfter: 3,
            matchedTraitKinds: ['echo', 'stasis'],
            volatileTraitShufflesBefore: 0,
            volatileTraitShufflesAfter: 1,
            objectiveBefore: { label: 'Trait routes', progress: 0, required: 2 },
            objectiveAfter: { label: 'Trait routes', progress: 1, required: 2 },
            recallFocusBefore: 1,
            recallFocusAfter: 2,
            recallMatchesBefore: 0,
            recallMatchesAfter: 1,
            recallBonusScoreBefore: 0,
            recallBonusScoreAfter: 8,
            forgottenTileCountBefore: 1,
            forgottenTileCountAfter: 0,
            dungeonEnemiesDefeatedBefore: 0,
            dungeonEnemiesDefeatedAfter: 1,
            enemyHazardsDefeatedBefore: 0,
            enemyHazardsDefeatedAfter: 1,
            hazardTilesBefore: expect.objectContaining({ totalTriggers: 0, shuffleSnares: 0 }),
            hazardTilesAfter: expect.objectContaining({
                totalTriggers: 2,
                shuffleSnares: 1,
                cascadeCaches: 1
            }),
            scoutsBefore: { lanternWard: 0, omenSeal: 0 },
            scoutsAfter: { lanternWard: 1, omenSeal: 1 },
            mimicCacheBefore: { claims: 0, bites: 0, guardBites: 0 },
            mimicCacheAfter: { claims: 1, bites: 0, guardBites: 0 },
            routeSpecialsBefore: {
                anchorSealUses: 0,
                loadedGatewayPlans: 0,
                catalystAltarUpgrades: 0,
                parasiteVesselConversions: 0,
                pinLatticeRewards: 0
            },
            routeSpecialsAfter: {
                anchorSealUses: 1,
                loadedGatewayPlans: 1,
                catalystAltarUpgrades: 1,
                parasiteVesselConversions: 1,
                pinLatticeRewards: 1
            },
            safeHazardWardsUsedBefore: 0,
            safeHazardWardsUsedAfter: 1
        });
    });

    it('normalizes malformed recall state before it reaches the event envelope', () => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const before = { ...base, recallFocus: Number.NaN } as RunState;
        const after = { ...base, recallFocus: 99.8 } as RunState;

        expect(getBoardTurnAnnouncementFacts(before, after)).toMatchObject({
            recallFocusBefore: 0,
            recallFocusAfter: 3
        });
    });
});
