import { useEffect, useRef } from 'react';
import type { BoardState, GameplayEventJournalEntry } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { playItemEffectSfx } from '../audio/gameSfx';
import { itemEffectsFromEvents, publishItemEffects } from '../components/itemEffects';

/**
 * Reads the gameplay journal for items just used and plays them (`itemEffects.ts`): their effect on
 * the board, the shake, and the sound. The journal on mount is what the screen opened on (a restore,
 * a resumed run), so nothing in it plays; only events written after are new.
 */
export const useItemEffectPublisher = ({
    journal,
    board,
    sfxGain
}: {
    journal: readonly GameplayEventJournalEntry[] | undefined;
    board: BoardState | null | undefined;
    sfxGain: number;
}): void => {
    const seen = useRef<Set<string> | null>(null);
    const previousBoard = useRef(board);
    useEffect(() => {
        const entries = Array.isArray(journal) ? journal : [];
        if (seen.current === null) {
            seen.current = new Set(entries.map((entry) => entry.eventId));
            previousBoard.current = board;
            return;
        }
        const fresh = entries.filter((entry) => !seen.current!.has(entry.eventId));
        for (const entry of fresh) seen.current.add(entry.eventId);
        // The journal is bounded; forget ids that fell off it so the set stays as small as it is.
        if (seen.current.size > entries.length * 2 + 64) seen.current = new Set(entries.map((entry) => entry.eventId));
        const effects = itemEffectsFromEvents(fresh as unknown as GameplayEvent[], previousBoard.current, board);
        previousBoard.current = board;
        if (effects.length === 0) return;
        publishItemEffects(effects);
        for (const kind of new Set(effects.map((effect) => effect.kind))) playItemEffectSfx(sfxGain, kind);
    }, [journal, board, sfxGain]);
};
