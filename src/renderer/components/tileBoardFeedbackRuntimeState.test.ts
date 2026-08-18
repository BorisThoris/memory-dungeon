import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import {
    buildBoardChainOpportunityBeatSfxSignature,
    buildBoardFeedbackFocusState,
    buildBoardFeedbackLiveAnnouncementState
} from './tileBoardFeedbackRuntimeState';

describe('tileBoardFeedbackRuntimeState', () => {
    it('builds focused tile feedback state including trait reward hot text', () => {
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            matchedPairs: 0,
            flippedTileIds: [],
            floorArchetypeId: null,
            featuredObjectiveId: null,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'Rune', state: 'hidden', routeCardKind: 'greed_cache' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'Rune', state: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'Key', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'Key', state: 'hidden' }
            ]
        };

        const state = buildBoardFeedbackFocusState({
            chainContext: {
                comboShards: 2,
                currentStreak: 4,
                lives: 2
            },
            focusedTileLiveLabel: {
                board,
                debugPeekActive: false,
                destroyEligibleTileIds: [],
                destroyPowerVisualActive: false,
                focusedTileId: 'a1',
                pairProximityHintsEnabled: false,
                peekEligibleTileIds: [],
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set<string>(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: [],
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set<string>(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false,
                traitRewardHotTileIds: [],
                traitRouteHintText: null,
                traitRouteTargetTileIds: []
            },
            runStatus: 'playing'
        });

        expect(state.traitRewardHotText).toBeTruthy();
        expect(state.focusedTileLabel).toContain('Route card: Greed cache');
    });

    it('builds live announcement text and beat signature', () => {
        const liveMessage = buildBoardFeedbackLiveAnnouncementState({
            boardChainAccessibilitySummary: {
                followupCount: 0,
                label: '2 routes ready.',
                payoffStackCount: 0,
                primaryLine: 'Routes ready',
                readyCount: 2,
                rewardHotCount: 0,
                secondaryLine: null,
                setupCount: 0,
                surgeCount: 0,
                tone: 'ready'
            },
            boardOpportunityCompassRows: [
                {
                    action: 'Cash now',
                    detail: 'Two pairs are primed',
                    id: 'chain',
                    impactCue: 'route cashout',
                    label: 'Cash route',
                    tone: 'chain',
                    value: '2 pairs'
                }
            ],
            boardOpportunityLaneMapLiveText: ' Lane map says cash first.',
            boardPayoffStack: null,
            focusedTileLabel: 'Rune tile',
            rewardLead: null,
            traitModeCue: null
        });

        expect(liveMessage).toContain('Focus: Rune tile');
        expect(
            buildBoardChainOpportunityBeatSfxSignature({
                opportunity: {
                    beatSignal: {
                        beatCount: 5,
                        tier: 'cashout'
                    },
                    nextActionId: 'cashout',
                    nextTarget: '2 pairs'
                },
                runStatus: 'playing'
            })
        ).toBe('cashout:5:cashout:2 pairs');
        expect(
            buildBoardChainOpportunityBeatSfxSignature({
                opportunity: {
                    beatSignal: null,
                    nextActionId: 'cashout',
                    nextTarget: null
                },
                runStatus: 'playing'
            })
        ).toBeNull();
    });
});
