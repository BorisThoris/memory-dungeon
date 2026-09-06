import { useEffect, useState } from 'react';
import type { RunState } from '../../shared/contracts';
import { getLatestBoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { getReg114DuckRow } from './audioMixDuckingPolicy';

/**
 * The music steps aside for a Fever break.
 *
 * Peggle cuts the bed for the fever moment; here the break's sting and shatter phrase get one
 * beat of room. Projected from the latest resolved turn (the same event the stage pulse reads),
 * held for `FEVER_DUCK_MS`, then released — a board that re-renders for any other reason never
 * ducks twice, because the duck is keyed to the event that earned it.
 */
export const FEVER_DUCK_MS = 900;

export const FEVER_DUCK_MULTIPLIER = getReg114DuckRow('fever_break')?.musicVolumeMultiplier ?? 1;

/** The event id a duck should be keyed to, or null when the latest turn did not break at Fever. */
export const feverDuckEventId = (run: RunState | null | undefined): string | null => {
    if (!run) return null;
    const latest = getLatestBoardTurnResolvedEvent(run);
    if (!latest) return null;
    const { chunkPairsBrokenAfter, chunkPairsBrokenBefore, chainTierAfter } = latest.announcement;
    return chunkPairsBrokenAfter > chunkPairsBrokenBefore && chainTierAfter === 'fever' ? latest.eventId : null;
};

/** Pure: what the music gain is multiplied by, given the duck-worthy event and the one already spent. */
export const feverDuckMultiplier = (eventId: string | null, expiredEventId: string | null): number =>
    eventId !== null && eventId !== expiredEventId ? FEVER_DUCK_MULTIPLIER : 1;

export const useFeverDuck = (run: RunState | null | undefined): number => {
    const eventId = feverDuckEventId(run);
    const [expiredEventId, setExpiredEventId] = useState<string | null>(null);
    useEffect(() => {
        if (eventId === null) {
            return undefined;
        }
        const release = window.setTimeout(() => setExpiredEventId(eventId), FEVER_DUCK_MS);
        return () => window.clearTimeout(release);
    }, [eventId]);
    return feverDuckMultiplier(eventId, expiredEventId);
};
