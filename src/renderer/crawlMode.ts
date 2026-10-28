/**
 * The crawl prototype (`crawl-rules.ts`): a run started with `?crawl=1` in the address puts a hero and
 * monsters on the board. Off unless asked for.
 */
export const crawlRequested = (): boolean => {
    try {
        return typeof location !== 'undefined' && new URLSearchParams(location.search).get('crawl') === '1';
    } catch {
        return false;
    }
};
