import { afterEach, describe, expect, it, vi } from 'vitest';
vi.unmock('./globalRecord');
import { fetchGlobalRecord, submitGlobalRecord } from './globalRecord';
afterEach(() => vi.unstubAllGlobals());
describe('global record API client', () => {
    it('reads a single record and posts an untrusted raw name for server moderation', async () => {
        const record = { name: 'Ada', score: 100, at: '2026-10-11T00:00:00Z' };
        const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ record, accepted: true })));
        vi.stubGlobal('fetch', fetcher);
        expect((await fetchGlobalRecord()).record).toEqual(record);
        expect((await submitGlobalRecord(' Ada ', 100)).accepted).toBe(true);
        expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ name: ' Ada ', score: 100 }) });
    });
    it('rejects an invalid name before any network request', async () => {
        const fetcher = vi.fn();vi.stubGlobal('fetch', fetcher);
        await expect(submitGlobalRecord('s.h.1.t', 100)).rejects.toThrow('That name is not going on the board');
        expect(fetcher).not.toHaveBeenCalled();
    });
    it('does not treat a malformed response as an empty record', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
        await expect(fetchGlobalRecord()).rejects.toThrow('Global record unavailable');
    });
    it('shows a server rejection instead of claiming a successful save', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Please try again later' }), { status: 429 })));
        await expect(submitGlobalRecord('Ada', 100)).rejects.toThrow('Please try again later');
    });
});
