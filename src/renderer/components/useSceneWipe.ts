import { useEffect, useState } from 'react';
import { SCENE_WIPE_MS } from './SceneWipe';

/**
 * The wipe, keyed to a room change: the room the screen opens on is not a change, the first
 * move into the shop is a wipe `in`, the move back out a wipe `out`, and each is one key so it
 * plays once and leaves after its length.
 */
export const useSceneWipe = (room: 'dungeon' | 'shop'): { key: string; direction: 'in' | 'out' } | null => {
    // The room change is read while rendering (React's "adjust state on a prop change"), so the wipe
    // starts in the same render as the move, not in an effect's second pass.
    const [seen, setSeen] = useState({ room, changes: 0 });
    const [wipe, setWipe] = useState<{ key: string; direction: 'in' | 'out' } | null>(null);
    if (seen.room !== room) {
        const changes = seen.changes + 1;
        setSeen({ room, changes });
        setWipe({ key: `wipe:${room}:${changes}`, direction: room === 'shop' ? 'in' : 'out' });
    }
    useEffect(() => {
        if (!wipe) return undefined;
        const timer = window.setTimeout(() => setWipe((current) => (current?.key === wipe.key ? null : current)), SCENE_WIPE_MS + 40);
        return () => window.clearTimeout(timer);
    }, [wipe]);
    return wipe;
};
