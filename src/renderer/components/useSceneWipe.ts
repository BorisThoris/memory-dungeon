import { useEffect, useRef, useState } from 'react';
import { SCENE_WIPE_MS } from './SceneWipe';

/**
 * The wipe, keyed to a room change: the room the screen opens on is not a change, the first
 * move into the shop is a wipe `in`, the move back out a wipe `out`, and each is one key so it
 * plays once and leaves after its length.
 */
export const useSceneWipe = (room: 'dungeon' | 'shop'): { key: string; direction: 'in' | 'out' } | null => {
    const previous = useRef<'dungeon' | 'shop' | null>(null);
    const [wipe, setWipe] = useState<{ key: string; direction: 'in' | 'out' } | null>(null);
    useEffect(() => {
        if (previous.current === null) {
            previous.current = room;
            return undefined;
        }
        if (previous.current === room) return undefined;
        previous.current = room;
        const next = { key: `wipe:${room}:${Date.now()}`, direction: room === 'shop' ? ('in' as const) : ('out' as const) };
        setWipe(next);
        const timer = window.setTimeout(() => setWipe((current) => (current?.key === next.key ? null : current)), SCENE_WIPE_MS + 40);
        return () => window.clearTimeout(timer);
    }, [room]);
    return wipe;
};
