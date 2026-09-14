import type { RunState } from '../../shared/contracts';
import { getReg114DuckRow } from './audioMixDuckingPolicy';

/**
 * The music steps back while a turn hangs.
 *
 * Thesis §46.4: the gap between the second flip and the resolution "should have the music duck
 * slightly too. A moment of near-silence before a resolution is the cheapest tension in audio
 * design." The run is in `resolving` from the second flip until the core resolves the turn, so
 * the duck follows that status and needs no timer of its own: it starts on the flip and ends the
 * frame the match or the miss is known, which is where the break's own audio (and the Fever duck,
 * `feverDuck.ts`) take over.
 */
export const RESOLUTION_GAP_DUCK_MULTIPLIER = getReg114DuckRow('resolution_gap')?.musicVolumeMultiplier ?? 1;

/** Pure: what the music gain is multiplied by while the turn is unresolved. */
export const resolutionGapDuckMultiplier = (run: RunState | null | undefined): number =>
    run?.status === 'resolving' ? RESOLUTION_GAP_DUCK_MULTIPLIER : 1;
