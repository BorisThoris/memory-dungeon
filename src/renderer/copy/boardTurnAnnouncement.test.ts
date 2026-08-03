import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { buildBoardTurnAnnouncement } from './boardTurnAnnouncement';

describe('boardTurnAnnouncement', () => {
    it('projects a stacked match from authoritative turn facts', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({
                boardLevel: 2,
                currentStreakAfter: 4,
                comboShardsAfter: 1,
                guardTokensAfter: 1,
                announcement: {
                    matchedPairsAfter: 1,
                    pairCountBefore: 4,
                    pairCountAfter: 4,
                    shopGoldAfter: 2,
                    matchedTraitKinds: ['echo', 'stasis'],
                    objectiveBefore: { label: 'Disarm traps', progress: 0, required: 2 },
                    objectiveAfter: { label: 'Disarm traps', progress: 1, required: 2 }
                }
            })
        );

        expect(presentation).toEqual({
            consumedGameplayFeedbackEventIds: [],
            dedupeKey: 'board-turn:board-turn-fixture:0',
            message:
                '1 guard token gained. 1 available. Match resolved. 1/4 pairs cleared. Trait combo surge: Echo and Stasis resolved. Chain started: x3. Reward loop online. Next reward: Combo prime: x6 +1 shard in 2 matches. Disarm traps: 1/2. Combo shard gained. 1 available. 2 shop gold gained. 2 available. Payoff stack: 4 payoffs cashed. Cash stack now.',
            priority: 'info'
        });
    });

    it('projects mismatch trait penalties and volatile movement without state comparison', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({
                outcome: 'mismatch',
                matchedPairKey: null,
                matchesAfter: 0,
                mismatchesAfter: 1,
                currentStreakAfter: 0,
                announcement: {
                    matchedPairsAfter: 0,
                    mismatchedTraitKinds: ['volatile', 'mirror'],
                    volatileTraitShufflesAfter: 1
                }
            })
        );

        expect(presentation.message).toBe(
            'No match. Recover with a safe match. Chain reset. Trait surge: 2 penalties applied: Volatile and Mirror. Volatile trait shuffled hidden cards.'
        );
    });

    it('prioritizes authoritative life loss over generic mismatch copy', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({
                outcome: 'mismatch',
                matchedPairKey: null,
                matchesAfter: 0,
                mismatchesAfter: 1,
                livesAfter: 2,
                announcement: { matchedPairsAfter: 0 }
            })
        );

        expect(presentation).toMatchObject({
            message: 'Life lost. 2 lives remain.',
            priority: 'error'
        });
    });

    it('projects recall and enemy consequences from the same replayable envelope', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({
                announcement: {
                    matchedPairsAfter: 1,
                    pairCountBefore: 4,
                    pairCountAfter: 4,
                    recallFocusBefore: 1,
                    recallFocusAfter: 2,
                    recallMatchesAfter: 1,
                    recallBonusScoreAfter: 8,
                    forgottenTileCountBefore: 1,
                    forgottenTileCountAfter: 0,
                    dungeonEnemiesDefeatedAfter: 1,
                    enemyHazardsDefeatedAfter: 1
                }
            })
        );

        expect(presentation.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 2/3; +8 memory score. 1 unstable tile memory stabilized. Moving enemy defeated. 1 cleared this floor. Dungeon enemy defeated. 1 defeated this floor.'
        );
    });

    it('projects every board-owned hazard and route-special consequence in stable order', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({
                announcement: {
                    hazardTilesAfter: {
                        totalTriggers: 2,
                        shuffleSnares: 1,
                        cascadeCaches: 1
                    },
                    scoutsAfter: { lanternWard: 1, omenSeal: 1 },
                    mimicCacheAfter: { claims: 1 },
                    routeSpecialsAfter: {
                        anchorSealUses: 1,
                        loadedGatewayPlans: 1,
                        catalystAltarUpgrades: 1,
                        parasiteVesselConversions: 1,
                        pinLatticeRewards: 1
                    },
                    safeHazardWardsUsedAfter: 1
                }
            })
        );

        expect(presentation.message).toBe(
            'Match resolved. 1/2 pairs cleared. Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Lantern Ward scouted a hidden threat. Omen Seal revealed hidden danger. Mimic Cache controlled. Full loot claimed. Anchor Seal froze rotating pressure. Loaded Gateway prepared the next route. Catalyst Altar converted a shard into reward. Parasite Vessel reduced pressure. Pin Lattice rewarded deliberate planning. Guard Cache ward blocked a hazard.'
        );
    });

    it('makes a typed mimic bite an error without inspecting lives or guard state', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({
                announcement: {
                    mimicCacheAfter: { claims: 1, bites: 1, guardBites: 1 }
                }
            })
        );

        expect(presentation).toMatchObject({
            message: expect.stringContaining('Mimic Cache bit. Guard absorbed the hit.'),
            priority: 'error'
        });
    });

    it('consumes same-command typed feedback and avoids duplicate resource gain copy', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture({ comboShardsAfter: 1 }),
            [{
                commandId: 'board-turn-fixture',
                eventId: 'board-turn-fixture:1',
                message: 'Shard Spark added one combo shard.',
                priority: 'info'
            }]
        );

        expect(presentation).toMatchObject({
            consumedGameplayFeedbackEventIds: ['board-turn-fixture:1'],
            message: 'Shard Spark added one combo shard. Match resolved. 1/2 pairs cleared.'
        });
        expect(presentation.message).not.toContain('available');
    });

    it('preserves every same-command proc message and its strongest priority', () => {
        const presentation = buildBoardTurnAnnouncement(
            createBoardTurnResolvedEventFixture(),
            [
                {
                    commandId: 'board-turn-fixture',
                    eventId: 'board-turn-fixture:1',
                    message: 'First proc resolved.',
                    priority: 'info'
                },
                {
                    commandId: 'board-turn-fixture',
                    eventId: 'board-turn-fixture:3',
                    message: 'Second proc exposed a threat.',
                    priority: 'error'
                },
                {
                    commandId: 'another-command',
                    eventId: 'another-command:1',
                    message: 'Unrelated feedback.',
                    priority: 'info'
                }
            ]
        );

        expect(presentation).toMatchObject({
            consumedGameplayFeedbackEventIds: [
                'board-turn-fixture:1',
                'board-turn-fixture:3'
            ],
            message: 'First proc resolved. Second proc exposed a threat. Match resolved. 1/2 pairs cleared.',
            priority: 'error'
        });
    });
});
