import { clean, reject } from '../src/renderer/records/playerNames.mjs';

const allowedOrigin = (origin) => origin === 'null' || origin === 'https://html-classic.itch.zone' ||
    origin === 'https://html.itch.zone' || origin === 'https://boristhoris.itch.io' ||
    /^https:\/\/(?:[a-z0-9-]+\.)?memory-dungeon-git\.pages\.dev$/.test(origin) ||
    origin === 'https://memory-dungeon-test.modaxxx009.workers.dev' ||
    /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin);

/** One coordinator, one row: every compare-and-replace runs inside a SQL transaction. */
export class GlobalRecord {
    constructor(ctx) {
        this.ctx = ctx;
        this.sql = ctx.storage.sql;
        this.sql.exec('CREATE TABLE IF NOT EXISTS record (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, score INTEGER NOT NULL, at TEXT NOT NULL)');
        this.sql.exec('CREATE TABLE IF NOT EXISTS limits (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
    }
    current() {
        const record = [...this.sql.exec('SELECT name,score,at FROM record WHERE id=1')][0] ?? null;
        return record && !reject(record.name) ? record : null;
    }
    async fetch(request) {
        if (request.method === 'GET') return Response.json({ record: this.current() });
        const body = await request.json();
        // Validate again at the persistence boundary; the browser is never trusted for moderation.
        const why = typeof body.name === 'string' && body.name.length <= 256 ? reject(body.name) : 'Choose a name';
        if (why) return Response.json({ error: why }, { status: 400 });
        if (!Number.isSafeInteger(body.score) || body.score <= 0) return Response.json({ error: 'Invalid score' }, { status: 400 });
        const result = this.ctx.storage.transactionSync(() => {
            const now = Date.now();
            this.sql.exec('DELETE FROM limits WHERE expires<=?', now);
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            const old = [...this.sql.exec('SELECT count FROM limits WHERE ip=?', ip)][0];
            if ((old?.count ?? 0) >= 30) return { error: 'Please try again later' };
            this.sql.exec('INSERT INTO limits(ip,count,expires) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET count=limits.count+1', ip, 1, now + 3600000);
            const previous = this.current();
            if (previous && body.score <= previous.score) return { accepted: false, record: previous };
            this.sql.exec('INSERT INTO record(id,name,score,at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,score=excluded.score,at=excluded.at', clean(body.name), body.score, new Date(now).toISOString());
            return { accepted: true, record: this.current() };
        });
        return Response.json(result, { status: result.error ? 429 : 200 });
    }
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
        if (allowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
        const json = (body, status) => Response.json(body, { status, headers });
        if (origin && !allowedOrigin(origin)) return json({ error: 'Origin not allowed' }, 403);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
        if (new URL(request.url).pathname !== '/record') return json({ error: 'Not found' }, 404);
        if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
        if (!env.GLOBAL_RECORD) return json({ error: 'Record service unavailable' }, 503);
        let body;
        if (request.method === 'POST') {
            const raw = await request.text();
            if (raw.length > 2048) return json({ error: 'Request too large' }, 413);
            try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid request' }, 400); }
            if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400);
        }
        const stub = env.GLOBAL_RECORD.get(env.GLOBAL_RECORD.idFromName('global'));
        const response = await stub.fetch(new Request('https://record/record', { method: request.method,
            headers: { 'CF-Connecting-IP': request.headers.get('CF-Connecting-IP') || 'unknown' },
            ...(body ? { body: JSON.stringify(body) } : {}) }));
        return new Response(response.body, { status: response.status, headers });
    }
};
