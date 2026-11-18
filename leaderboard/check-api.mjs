import assert from 'node:assert/strict';
const base = process.argv[2];
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base || '')) throw Error('Use a fresh LOCAL worker; never production.');
const request = async (body, extra = {}) => {
    const response = await fetch(base + '/record', { headers: { Origin: 'https://html-classic.itch.zone', 'Content-Type': 'application/json', ...extra },
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cors: response.headers.get('Access-Control-Allow-Origin') };
};
assert.equal((await request()).body.record, null);
assert.equal((await request({ name: 'Ada', score: 100 })).body.accepted, true);
for (const score of [99, 100]) assert.equal((await request({ name: 'Boris', score })).body.accepted, false);
for (const name of ['s.h.1.t', 'fuсk', 'сука', 'example.com', 'Nick Gera', 'N1ck.G3ra', 'Ben Dover', 'Mike Hunt', 'Hugh Jass', 'Sir Nick Gera', 'Ben Dover Jr']) assert.equal((await request({ name, score: 999 })).status, 400);
for (const score of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, '900', 10_000_000_001, Number.MAX_SAFE_INTEGER]) assert.equal((await request({ name: 'Ada', score })).status, 400);
await Promise.all([101, 110, 105, 109, 120, 119].map(score => request({ name: 'Boris', score })));
const final = await request();
assert.deepEqual({ name: final.body.record.name, score: final.body.record.score }, { name: 'Boris', score: 120 });
assert.equal(final.cors, 'https://html-classic.itch.zone');
assert.equal((await request(undefined, { Origin: 'app://game' })).cors, 'app://game');
assert.equal((await request({ name: 'Ada', score: 1000 }, { Origin: 'https://unrelated.example' })).status, 403);
// A current build also says which run it was; an older one sends only name and score, and both are taken.
assert.equal((await request({ name: 'Cleo', score: 121, floor: 12, shareKey: 'endless:100:42', rules: 100 })).body.accepted, true);
// The admin routes answer only to the token the local worker was started with (`--var RECORD_ADMIN_TOKEN:...`).
const token = process.env.RECORD_ADMIN_TOKEN;
const admin = (path, method, auth) => fetch(base + path, { method, headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
assert.equal((await admin('/admin/submissions', 'GET')).status, 404);
assert.equal((await admin('/admin/submissions', 'GET', 'x'.repeat(40))).status, 404);
if (token) {
    const log = await (await admin('/admin/submissions', 'GET', token)).json();
    assert.ok(log.submissions.some((row) => row.name === 'Cleo' && row.floor === 12 && row.shareKey === 'endless:100:42' && row.rules === 100));
    assert.ok(log.submissions.every((row) => /^[0-9a-f]{16}$/.test(row.ip)));
    assert.equal((await admin('/admin/record', 'GET', token)).status, 405);
    assert.equal((await (await admin('/admin/record', 'DELETE', token)).json()).cleared, true);
    assert.equal((await request()).body.record, null);
    assert.equal((await request({ name: 'Ada', score: 5 })).body.accepted, true);
}
for (let i = 0; i < 30; i++) await request({ name: 'Ada', score: 1 });
assert.equal((await request({ name: 'Ada', score: 1 })).status, 429);
console.log(`PASS: first record, ties/lower, exact name filters, numeric validation and ceiling, run evidence, concurrent replacement, CORS, ${token ? 'admin log and reset, ' : 'admin refusal (no token given), '}rate limit.`);
