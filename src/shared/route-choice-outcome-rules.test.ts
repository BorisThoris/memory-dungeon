import { describe, expect, it } from 'vitest';

import { createPlayablePathFixture } from './playable-path-fixtures';
import { applyRouteChoiceOutcome } from './route-choice-outcome-rules';

describe('route choice outcome rules', () => {
    it('rejects invalid status and missing choices without mutating the run', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;

        expect(applyRouteChoiceOutcome({ ...run, status: 'playing' as const }, run.lastLevelResult!.routeChoices![0]!.id))
            .toMatchObject({ applied: false, reason: 'invalid_status' });
        expect(applyRouteChoiceOutcome(run, 'missing-choice')).toMatchObject({
            run,
            applied: false,
            reason: 'missing_choice'
        });
    });

    it('applies safe, greed, and mystery outcomes from playable fixtures', () => {
        const safeRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const safeChoice = safeRun.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!;
        expect(applyRouteChoiceOutcome(safeRun, safeChoice.id)).toMatchObject({
            applied: true,
            routeType: 'safe'
        });

        const greedRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const greedChoice = greedRun.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!;
        expect(applyRouteChoiceOutcome(greedRun, greedChoice.id)).toMatchObject({
            applied: true,
            routeType: 'greed'
        });

        const mysteryRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const mysteryChoice = mysteryRun.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!;
        expect(applyRouteChoiceOutcome(mysteryRun, mysteryChoice.id)).toMatchObject({
            applied: true,
            routeType: 'mystery'
        });
    });
});
