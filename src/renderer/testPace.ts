/**
 * Whether new runs start at the test pace (`descent-pace-rules.ts`): always on the test deployment
 * (`memory-dungeon-test`), and anywhere the address carries `?pace=fast`. A tester meets every act,
 * act boss and the Warden in one sitting; the run counts toward no record and says so on the run bar.
 */
/**
 * Cash in (`combo-cash-in-rules.ts`): the owner's prototype of a push-your-luck combo, on a run only
 * when the address carries `?combo2=1`, so it can be played before it ships.
 */
export const comboCashInRequested = (location: Pick<Location, 'search'> | undefined = globalThis.location): boolean =>
    !!location && new URLSearchParams(location.search).get('combo2') === '1';

export const fastDescentRequested = (location: Pick<Location, 'hostname' | 'search'> | undefined = globalThis.location): boolean => {
    if (!location) return false;
    if (location.hostname.includes('memory-dungeon-test')) return true;
    return new URLSearchParams(location.search).get('pace') === 'fast';
};
