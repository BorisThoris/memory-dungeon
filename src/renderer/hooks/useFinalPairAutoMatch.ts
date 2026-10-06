import { useEffect } from 'react';
import type { RunState } from '../../shared/contracts';
import { getFinalPair } from '../../shared/final-pair-rules';
import { useAppStore } from '../store/useAppStore';

export const useFinalPairAutoMatch = (run: RunState): void => {
    const pair = getFinalPair(run);
    const key = pair ? `${run.runSeed}:${run.board!.level}:${pair.map(tile => tile.id).join('|')}` : null;
    useEffect(() => {
        if (!key) return;
        // Let the preceding match land before turning over the last two cards.
        const timer = window.setTimeout(() => useAppStore.getState().autoMatchFinalPair(), 300);
        return () => window.clearTimeout(timer);
    }, [key]);
};
