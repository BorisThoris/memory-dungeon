import { clean, reject } from '../src/renderer/records/playerNames.mjs';

// 'app://game' is the desktop build (src/main/app-protocol.ts); 'null' is any build older than that.
const allowedOrigin = (origin) => origin === 'app://game' || origin === 'null' || origin === 'https://html-classic.itch.zone' ||
    origin === 'https://html.itch.zone' || origin === 'https://boristhoris.itch.io' ||
    /^https:\/\/(?:[a-z0-9-]+\.)?memory-dungeon-git\.pages\.dev$/.test(origin) ||
    origin === 'https://memory-dungeon-test.modaxxx009.workers.dev' ||
    /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin);

/*
 * Scores are still client reported (README). Two things make a forged record survivable:
 * - MAX_SCORE refuses impossible numbers. Near-perfect simulated play reached 24.6 million by floor
 *   80 (2026-11-18, the soak's careful player with no misses); Endless climbs further, so the cap is
 *   set far above any real run and stops only values like 2^53.
 * - Every submission is logged with what the client said about the run (floor, share key, rules),
 *   and an admin token can read the log and clear the record (`/admin/...`).
 */
const MAX_SCORE = 10_000_000_000;
const SUBMISSIONS_KEPT = 500;
const evidence = (body) => ({
    floor: Number.isSafeInteger(body.floor) && body.floor > 0 ? body.floor : null,
    shareKey: typeof body.shareKey === 'string' && body.shareKey.length <= 200 ? body.shareKey : null,
    rules: Number.isSafeInteger(body.rules) && body.rules > 0 ? body.rules : null
});

/** One coordinator, one row: every compare-and-replace runs inside a SQL transaction. */
export class GlobalRecord {
    constructor(ctx) {
        this.ctx = ctx;
        this.sql = ctx.storage.sql;
        this.sql.exec('CREATE TABLE IF NOT EXISTS record (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, score INTEGER NOT NULL, at TEXT NOT NULL)');
        this.sql.exec('CREATE TABLE IF NOT EXISTS limits (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
        this.sql.exec('CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, ip TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, accepted INTEGER NOT NULL, floor INTEGER, share_key TEXT, rules INTEGER)');
    }
    current() {
        const record = [...this.sql.exec('SELECT name,score,at FROM record WHERE id=1')][0] ?? null;
        return record && !reject(record.name) ? record : null;
    }
    async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/admin/submissions') {
            return Response.json({ submissions: [...this.sql.exec('SELECT at,ip,name,score,accepted,floor,share_key AS shareKey,rules FROM submissions ORDER BY id DESC LIMIT 100')] });
        }
        if (path === '/admin/record') {
            // Clears a forged or vandalised record; the next eligible run sets a new one.
            this.sql.exec('DELETE FROM record WHERE id=1');
            return Response.json({ record: null, cleared: true });
        }
        if (request.method === 'GET') return Response.json({ record: this.current() });
        const body = await request.json();
        // Validate again at the persistence boundary; the browser is never trusted for moderation.
        const why = typeof body.name === 'string' && body.name.length <= 256 ? reject(body.name) : 'Choose a name';
        if (why) return Response.json({ error: why }, { status: 400 });
        if (!Number.isSafeInteger(body.score) || body.score <= 0 || body.score > MAX_SCORE) return Response.json({ error: 'Invalid score' }, { status: 400 });
        const said = evidence(body);
        const result = this.ctx.storage.transactionSync(() => {
            const now = Date.now();
            this.sql.exec('DELETE FROM limits WHERE expires<=?', now);
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            const old = [...this.sql.exec('SELECT count FROM limits WHERE ip=?', ip)][0];
            if ((old?.count ?? 0) >= 30) return { error: 'Please try again later' };
            this.sql.exec('INSERT INTO limits(ip,count,expires) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET count=limits.count+1', ip, 1, now + 3600000);
            const previous = this.current();
            const accepted = !previous || body.score > previous.score;
            const at = new Date(now).toISOString();
            this.sql.exec('INSERT INTO submissions(at,ip,name,score,accepted,floor,share_key,rules) VALUES(?,?,?,?,?,?,?,?)', at, request.headers.get('X-Submitter') || 'unknown', clean(body.name), body.score, accepted ? 1 : 0, said.floor, said.shareKey, said.rules);
            this.sql.exec('DELETE FROM submissions WHERE id <= (SELECT MAX(id) FROM submissions) - ?', SUBMISSIONS_KEPT);
            if (!accepted) return { accepted: false, record: previous };
            this.sql.exec('INSERT INTO record(id,name,score,at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,score=excluded.score,at=excluded.at', clean(body.name), body.score, at);
            return { accepted: true, record: this.current() };
        });
        return Response.json(result, { status: result.error ? 429 : 200 });
    }
}

/** A short one-way id for the log: enough to see one address submitting many records, not the address. */
const submitterId = async (ip) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`memory-dungeon-record:${ip}`));
    return [...new Uint8Array(digest).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const sameSecret = async (given, expected) => {
    const hash = async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [a, b] = await Promise.all([hash(given), hash(expected)]);
    return a.every((byte, index) => byte === b[index]);
};

/** `GET /admin/submissions` and `DELETE /admin/record`, only with `Authorization: Bearer <RECORD_ADMIN_TOKEN>`. */
const admin = async (request, env, path, json) => {
    const token = env.RECORD_ADMIN_TOKEN;
    const given = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!token || token.length < 32 || !given || !(await sameSecret(given, token))) return json({ error: 'Not found' }, 404);
    const allowed = (path === '/admin/record' && request.method === 'DELETE') || (path === '/admin/submissions' && request.method === 'GET');
    if (!allowed) return json({ error: 'Method not allowed' }, 405);
    if (!env.GLOBAL_RECORD) return json({ error: 'Record service unavailable' }, 503);
    const stub = env.GLOBAL_RECORD.get(env.GLOBAL_RECORD.idFromName('global'));
    const response = await stub.fetch(new Request(`https://record${path}`, { method: request.method }));
    return json(await response.json(), response.status);
};

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
        if (allowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
        const json = (body, status) => Response.json(body, { status, headers });
        if (origin && !allowedOrigin(origin)) return json({ error: 'Origin not allowed' }, 403);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
        const path = new URL(request.url).pathname;
        if (path === '/admin/record' || path === '/admin/submissions') return admin(request, env, path, json);
        if (path !== '/record') return json({ error: 'Not found' }, 404);
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
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const response = await stub.fetch(new Request('https://record/record', { method: request.method,
            headers: { 'CF-Connecting-IP': ip, 'X-Submitter': await submitterId(ip) },
            ...(body ? { body: JSON.stringify(body) } : {}) }));
        return new Response(response.body, { status: response.status, headers });
    }
};
