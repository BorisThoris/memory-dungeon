import { useEffect, useState } from 'react';

/**
 * A beat: true for `ms` after `key` changes to something new, false otherwise. The first key the
 * component mounts with is the state it opened on, not a beat - a resumed run does not punch in.
 */
export const useBeat = (key: string | null, ms: number): boolean => {
    const [beat, setBeat] = useState({ key, on: false });
    // Adjust with the prop, before painting: a reset cannot leave a cancelled beat stuck on.
    if (beat.key !== key) setBeat({ key, on: key !== null });
    useEffect(() => {
        if (!beat.on || key === null) return undefined;
        const timer = window.setTimeout(() => setBeat(current => current.key === key ? { key, on: false } : current), ms);
        return () => window.clearTimeout(timer);
    }, [key, ms, beat.on]);
    return beat.key === key && beat.on;
};

/**
 * The last thing `value` was, held for `ms` after it arrived even when `value` goes back to null:
 * a shower of coins started on a beat keeps falling after the beat that paid it has gone. A new
 * value (by `keyOf`) replaces the held one and starts its own hold.
 */
export const useHeld = <T,>(value: T | null, keyOf: (held: T) => string, ms: number): T | null => {
    const key = value === null ? null : keyOf(value);
    const [held, setHeld] = useState<{ key: string | null; value: T | null }>({ key, value });
    if (key !== null && key !== held.key) setHeld({ key, value });
    useEffect(() => {
        if (held.value === null || held.key === null) return undefined;
        const heldKey = held.key;
        const timer = window.setTimeout(() => setHeld(current => current.key === heldKey ? { key: heldKey, value: null } : current), ms);
        return () => window.clearTimeout(timer);
    }, [held.key, held.value, ms]);
    return value ?? held.value;
};
