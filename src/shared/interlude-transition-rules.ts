import type { RunState } from './contracts';

export const createDeadInterludeGameOverRun = (run: RunState): RunState | null => {
    if (run.status !== 'gameOver' && run.lives > 0) {
        return null;
    }

    return {
        ...run,
        status: 'gameOver',
        lives: 0,
        pendingRouteCardPlan: null,
        sideRoom: null,
        relicOffer: null,
        shopOffers: []
    };
};
