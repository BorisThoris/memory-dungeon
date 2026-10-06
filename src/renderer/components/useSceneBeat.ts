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
