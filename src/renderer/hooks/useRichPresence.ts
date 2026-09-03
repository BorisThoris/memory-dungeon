import { useEffect, useRef } from 'react';
import type { GameMode } from '../../shared/contracts';
import { buildRichPresence, richPresenceEquals, type RichPresenceState } from '../../shared/rich-presence';
import { desktopClient } from '../desktop-client';

/**
 * Keeps the player's Steam presence in step with what they are doing.
 *
 * Only pushed when it actually changes: presence is a network call to the Steam client, and a run
 * re-renders constantly, so sending the same string every frame would be wasteful and pointless.
 * Outside Steam the desktop client's no-op fallback runs instead, so this costs nothing in a
 * browser build.
 */
export const useRichPresence = (input: { floor: number | null; gameMode: GameMode | null; inRun: boolean }): void => {
    const lastSent = useRef<RichPresenceState | null>(null);

    useEffect(() => {
        const next = buildRichPresence(input);
        if (richPresenceEquals(lastSent.current, next)) {
            return;
        }
        lastSent.current = next;
        // Cosmetic: never awaited, never surfaced. A failure here must not touch the run.
        void desktopClient.setRichPresence(next)?.catch?.(() => {});
    }, [input.floor, input.gameMode, input.inRun]);
};
