import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string =>
    readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('board-turn feedback ownership boundary', () => {
    it('keeps the renderer projector event-only and free of gameplay reconstruction', () => {
        const source = readSource('src/renderer/store/matchScorePop.ts');
        const forbiddenRuntimeDependencies = [
            'detectClaimedFindableKind',
            'getMatchFloaterAnchorTileIds',
            'getMismatchFloaterAnchorTileIds',
            'resolveTileTraitEffects',
            'RunState',
            'Date.now('
        ];

        for (const dependency of forbiddenRuntimeDependencies) {
            expect(source, dependency).not.toContain(dependency);
        }
        expect(source).toMatch(/buildMatchScorePopPayload\(\s*turnEvent: BoardTurnResolvedEvent/u);
        expect(source).toMatch(/buildMismatchScorePopPayload\(\s*turnEvent: BoardTurnResolvedEvent/u);
    });

    it('requires the live controller to project the typed event directly', () => {
        const source = readSource('src/renderer/store/runResolutionController.ts');

        expect(source).toContain('resolveBoardTurnThroughGameplayCore(run, encore)');
        expect(source).not.toContain('resolveBoardTurnWithEvent');
        expect(source).toContain("item.type === 'board.turn_resolved'");
        expect(source).toContain('buildMatchScorePopPayload(event)');
        expect(source).toContain('buildMismatchScorePopPayload(event)');
        expect(source).not.toMatch(/build(?:Match|Mismatch)ScorePopPayload\(run,\s*next/u);
    });

    it('keeps pickup feedback on schema-validated turn events instead of board snapshot diffs', () => {
        const contracts = readSource('src/shared/gameplay-core-contracts.ts');
        const core = readSource('src/shared/gameplay-core.ts');
        const turnFacts = readSource('src/shared/board-turn-event-facts.ts');
        const adapter = readSource('src/renderer/store/gameplayFeedbackAdapter.ts');
        const gameScreen = readSource('src/renderer/components/GameScreen.tsx');
        const announcementHook = readSource('src/renderer/hooks/useHudPoliteLiveAnnouncement.ts');
        const turnAnnouncement = readSource('src/renderer/copy/boardTurnAnnouncement.ts');
        const hudCopy = readSource('src/renderer/copy/hudActionFeedback.ts');

        for (const [path, source] of [
            ['GameScreen.tsx', gameScreen],
            ['useHudPoliteLiveAnnouncement.ts', announcementHook],
            ['hudActionFeedback.ts', hudCopy]
        ] as const) {
            expect(source, path).not.toContain('detectClaimedFindableKind');
            expect(source, path).not.toContain('pickupSnapRef');
            expect(source, path).not.toContain('pickupToastSnapshotRef');
        }

        expect(adapter).toContain('getLatestBoardTurnResolvedEvent');
        expect(adapter).toContain("event.type === 'board.turn_resolved'");
        for (const field of [
            'findablesClaimedBefore',
            'findablesClaimedAfter',
            'findablesTotalBefore',
            'findablesTotalAfter'
        ]) {
            expect(contracts, field).toContain(field);
            expect(core, field).toContain(field);
        }
        expect(gameScreen).toContain('getLatestBoardTurnResolvedEvent({ gameplayEventJournal })');
        expect(gameScreen).toContain('typedBoardTurnEvent.matchedFindableKind');
        expect(gameScreen).toMatch(/getPickupStackToastText = \(\s*turnEvent: BoardTurnResolvedEvent/u);
        expect(gameScreen).toContain('getPickupStackToastText(typedBoardTurnEvent)');
        expect(gameScreen).toContain('turnEvent.findablesClaimedAfter');
        expect(gameScreen).toContain('turnEvent.findablesTotalAfter');
        expect(gameScreen).not.toContain('PickupStackToastState');
        expect(turnAnnouncement).toContain('turnEvent.matchedFindableKind');
        expect(turnAnnouncement).toContain('board-turn:${turnEvent.eventId}');

        expect(contracts).toContain('announcement: boardTurnAnnouncementFactsSchema');
        expect(core).toContain('announcement: getBoardTurnAnnouncementFacts(run, nextRun)');
        expect(turnFacts).toContain('matchedTraitKinds: TILE_TRAIT_COUNT_KINDS.filter');
        expect(turnFacts).toContain('objectiveBefore: getGameplayFeedbackObjectiveSnapshot(before)');
        expect(turnAnnouncement).toMatch(/buildBoardTurnAnnouncement = \(\s*turnEvent: BoardTurnResolvedEvent/u);
        expect(turnAnnouncement).not.toContain('RunState');
        expect(announcementHook).toContain('buildBoardTurnAnnouncement(');
        expect(announcementHook).toContain('{ reduceMotion }');
        for (const field of [
            'hazardTilesBefore',
            'hazardTilesAfter',
            'scoutsBefore',
            'scoutsAfter',
            'mimicCacheBefore',
            'mimicCacheAfter',
            'routeSpecialsBefore',
            'routeSpecialsAfter',
            'safeHazardWardsUsedBefore',
            'safeHazardWardsUsedAfter'
        ]) {
            expect(contracts, field).toContain(field);
            expect(turnFacts, field).toContain(field);
            expect(turnAnnouncement, field).toContain(field);
        }
        expect(turnAnnouncement).toContain('CHAIN_MILESTONE_THRESHOLDS');
        expect(turnAnnouncement).toContain('hazardTileAnnouncementLines');
        for (const forbiddenInference of [
            'matchedPairs - snap.matchedPairs',
            'mismatches - snap.mismatches',
            'changedTileTraitLabels',
            'tileTraitMatches',
            'tileTraitMismatches',
            'volatileTraitShuffles'
        ]) {
            expect(announcementHook, forbiddenInference).not.toContain(forbiddenInference);
        }

        for (const removedSnapshotOwner of [
            'chainSnapRef',
            'hazardSnapRef',
            'lanternSnapRef',
            'omenSnapRef',
            'mimicSnapRef',
            'routeSpecialSnapRef',
            'safeWardSnapRef',
            'CHAIN_MILESTONE_THRESHOLDS',
            'getHazardTileLiveCopy'
        ]) {
            expect(announcementHook, removedSnapshotOwner).not.toContain(removedSnapshotOwner);
        }

        const hookCallStart = gameScreen.indexOf('useHudPoliteLiveAnnouncement({');
        const hookCall = gameScreen.slice(hookCallStart, hookCallStart + 4_000);
        for (const removedInput of [
            'matchedPairs:',
            'pairCount:',
            'mismatches:',
            'tileTraitMatches:',
            'tileTraitMismatches:',
            'volatileTraitShuffles:',
            'chainMatchStreak:',
            'chainAnnounceActive:',
            'hazardTileTriggersThisFloor:',
            'hazardShuffleSnaresThisFloor:',
            'hazardCascadeCachesThisFloor:',
            'hazardMirrorDecoysThisFloor:',
            'hazardFragileCacheClaimsThisFloor:',
            'hazardFragileCacheBreaksThisFloor:',
            'hazardTollCachesThisFloor:',
            'hazardFuseCachesThisFloor:',
            'hazardFuseCacheExpiredClaimsThisFloor:',
            'lanternWardScoutsThisFloor:',
            'omenSealScoutsThisFloor:',
            'mimicCacheClaimsThisFloor:',
            'mimicCacheBitesThisFloor:',
            'mimicCacheGuardBitesThisFloor:',
            'anchorSealUsesThisFloor:',
            'loadedGatewayPlansThisFloor:',
            'catalystAltarUpgradesThisFloor:',
            'parasiteVesselConversionsThisFloor:',
            'pinLatticeRewardsThisFloor:',
            'safeHazardWardsUsedThisFloor:'
        ]) {
            expect(hookCall, removedInput).not.toContain(removedInput);
        }
    });
});
