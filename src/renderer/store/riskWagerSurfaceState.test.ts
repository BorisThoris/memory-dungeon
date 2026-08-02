import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { ENDLESS_RISK_WAGER_MIN_STREAK } from '../../shared/contracts';
import { createRiskWagerSurfaceResult } from './riskWagerSurfaceState';

describe('riskWagerSurfaceState', () => {
    it('ignores missing runs', () => {
        expect(createRiskWagerSurfaceResult(null)).toEqual({ kind: 'ignored' });
    });

    it('ignores an existing run when no wager is available', () => {
        const run = createNewRun(0);
        expect(createRiskWagerSurfaceResult(run)).toEqual({ kind: 'ignored' });
    });

    it('journals an eligible wager through the deterministic core', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            status: 'levelComplete' as const,
            relicOffer: null,
            endlessRiskWager: null,
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 4,
                scoreGained: 100,
                rating: 'S' as const,
                livesRemaining: 3,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par' as const,
                featuredObjectiveCompleted: true
            }
        };
        const result = createRiskWagerSurfaceResult(run);

        expect(result.kind).toBe('applied');
        if (result.kind === 'applied') {
            expect(result.patch.run.endlessRiskWager?.targetLevel).toBe(5);
            expect(result.patch.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'risk_wager.accept' })
            ]);
            expect(result.events).toEqual([
                expect.objectContaining({ type: 'risk_wager.accepted' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.route_gambler.wager_accepted' })
            ]);
        }
    });
});
