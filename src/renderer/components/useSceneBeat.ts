import { useEffect, useRef, useState } from 'react';

/**
 * A beat: true for `ms` after `key` changes to something new, false otherwise. The first key the
 * component mounts with is the state it opened on, not a beat - a resumed run does not punch in.
 */
export const useBeat = (key: string | null, ms: number): boolean => {
    const seen = useRef<string | null | undefined>(undefined);
    const [on, setOn] = useState(false);
    useEffect(() => {
        if (seen.current === undefined) {
            seen.current = key;
            return undefined;
        }
        if (key === null || key === seen.current) return undefined;
        seen.current = key;
        setOn(true);
        const timer = window.setTimeout(() => setOn(false), ms);
        return () => window.clearTimeout(timer);
    }, [key, ms]);
    return on;
};
