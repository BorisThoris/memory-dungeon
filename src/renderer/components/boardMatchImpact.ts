/** Shared choreography: a quick lift, a decisive contact, then a short damped recovery. */
export const MATCH_CONTACT_SECONDS = 0.14;

/** Seed the card and particle choreography from the same committed-event time, before any frame. */
export const beginMatchImpact = (frame: {
    matchedVictoryBurstT0Ref: { current: number | null };
    prevTileMatchedRef: { current: boolean };
}, time: number): void => {
    if (frame.prevTileMatchedRef.current) return;
    frame.matchedVictoryBurstT0Ref.current = time;
    frame.prevTileMatchedRef.current = true;
};

export const sampleMatchImpact = (seconds: number, reduceMotion: boolean) => {
    if (reduceMotion || seconds < 0 || seconds > 0.42) return { z: 0, scaleX: 1, scaleY: 1 };
    if (seconds < 0.065) {
        const lift = Math.sin(seconds / 0.065 * Math.PI / 2);
        return { z: lift * 0.18, scaleX: 1 + lift * 0.035, scaleY: 1 + lift * 0.035 };
    }
    if (seconds < MATCH_CONTACT_SECONDS) {
        const fall = Math.pow((seconds - 0.065) / (MATCH_CONTACT_SECONDS - 0.065), 2);
        return { z: 0.18 - fall * 0.22, scaleX: 1.035 + fall * 0.065, scaleY: 1.035 - fall * 0.115 };
    }
    const recovery = Math.exp(-(seconds - MATCH_CONTACT_SECONDS) * 18);
    return { z: -0.04 * recovery, scaleX: 1 + 0.1 * recovery, scaleY: 1 - 0.08 * recovery };
};
