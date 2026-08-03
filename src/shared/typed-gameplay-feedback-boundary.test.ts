import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('typed gameplay feedback boundary', () => {
    it('projects core feedback by event identity without renderer state', () => {
        const projector = read('src/renderer/copy/gameplayEventAnnouncement.ts');

        expect(projector).toContain('buildGameplayEventAnnouncement');
        expect(projector).toContain('buildGameplayEventBatchAnnouncement');
        expect(projector).toContain('gameplay-event:${feedback.eventId}');
        expect(projector).toContain('gameplay-command:${commandId}:${consumedEventIds.join');
        expect(projector).not.toContain('RunState');
        expect(projector).not.toContain('shopGold');
        expect(projector).not.toContain('guardTokens');
        expect(projector).not.toContain('enemyHazardHitsThisFloor');
    });

    it('enforces event-only HUD feedback with a core-side completeness invariant', () => {
        const hook = read('src/renderer/hooks/useHudPoliteLiveAnnouncement.ts');
        const adapter = read('src/renderer/store/gameplayFeedbackAdapter.ts');
        const gameScreen = read('src/renderer/components/GameScreen.tsx');
        const completeness = read('src/shared/gameplay-feedback-completeness.ts');
        const simulation = read('src/shared/gameplay-core-simulation.ts');

        expect(adapter).toContain('getLatestGameplayFeedbackBatch');
        expect(adapter).toContain('presentation.commandId === latestCommandId');
        expect(hook).toContain('buildGameplayEventBatchAnnouncement(unannouncedFeedback)');
        expect(hook).toContain('buildBoardTurnAnnouncement(');
        expect(completeness).toContain('inspectGameplayFeedbackCompleteness');
        expect(completeness).toContain("event.type === 'feedback.requested' || event.type === 'board.turn_resolved'");
        expect(simulation).toContain('inspectGameplayFeedbackCompleteness({');
        expect(gameScreen).toContain('getLatestGameplayFeedbackBatch({ gameplayEventJournal })');
        expect(gameScreen).toContain('gameplayFeedbackBatch: typedGameplayFeedbackBatch');
        expect(gameScreen).not.toContain('getLatestGameplayFeedback({ gameplayEventJournal })');
        for (const retiredOwner of [
            'actionSnapRef',
            'legacy-action:',
            'hasUnconsumedGameplayFeedback',
            'consumedActionGameplayFeedbackEventIdsRef',
            'lifeDelta',
            'guardDelta',
            'objectiveDelta',
            'recallMistakeDelta',
            'enemyHazardHitDelta'
        ]) {
            expect(hook, retiredOwner).not.toContain(retiredOwner);
        }

        const hookCallStart = gameScreen.indexOf('useHudPoliteLiveAnnouncement({');
        const hookCallEnd = gameScreen.indexOf('\n    });', hookCallStart);
        const hookCall = gameScreen.slice(hookCallStart, hookCallEnd);
        for (const retiredInput of [
            'lives:',
            'guardTokens:',
            'comboShards:',
            'shopGold:',
            'objectiveProgress:',
            'recallFocus:',
            'forgottenTileCountThisFloor:',
            'enemyHazardHitsThisFloor:'
        ]) {
            expect(hookCall, retiredInput).not.toContain(retiredInput);
        }
    });

    it('forbids score-parasite snapshot inference now that the core emits every milestone', () => {
        const core = read('src/shared/gameplay-core.ts');
        const hook = read('src/renderer/hooks/useHudPoliteLiveAnnouncement.ts');
        const gameScreen = read('src/renderer/components/GameScreen.tsx');

        expect(core).toContain("cue: 'hazard.score_parasite.drain_warning'");
        expect(core).toContain('pressureBefore < 3 && advanced.parasiteFloors === 3');
        for (const retiredOwner of [
            'parasiteSnapRef',
            'scoreParasiteActive',
            'parasiteFloors:',
            'parasiteWardRemaining:'
        ]) {
            expect(hook, retiredOwner).not.toContain(retiredOwner);
        }
        const hookCallStart = gameScreen.indexOf('useHudPoliteLiveAnnouncement({');
        const hookCall = gameScreen.slice(hookCallStart, hookCallStart + 3_000);
        expect(hookCall).not.toContain('scoreParasiteActive');
        expect(hookCall).not.toContain('parasiteFloors:');
        expect(hookCall).not.toContain('parasiteWardRemaining:');
    });

    it('requires typed power events to retain their memory consequence facts', () => {
        const contracts = read('src/shared/gameplay-core-contracts.ts');
        const core = read('src/shared/gameplay-core.ts');

        expect(contracts.match(/forgottenTileCountBefore/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
        expect(contracts.match(/forgottenTileCountAfter/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
        expect(core).toContain('memoryAidEventFacts(run, nextRun)');
        expect(core).toContain('memoryAidFeedbackSuffix(run, nextRun)');
        expect(core).toContain('enemyHazardHitsBefore');
        expect(core).toContain('enemyHazardHitsAfter');
    });
});
