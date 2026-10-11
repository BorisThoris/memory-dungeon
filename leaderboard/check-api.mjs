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
for (const score of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, '900']) assert.equal((await request({ name: 'Ada', score })).status, 400);
await Promise.all([101, 110, 105, 109, 120, 119].map(score => request({ name: 'Boris', score })));
const final = await request();
assert.deepEqual({ name: final.body.record.name, score: final.body.record.score }, { name: 'Boris', score: 120 });
assert.equal(final.cors, 'https://html-classic.itch.zone');
assert.equal((await request({ name: 'Ada', score: 1000 }, { Origin: 'https://unrelated.example' })).status, 403);
for (let i = 0; i < 30; i++) await request({ name: 'Ada', score: 1 });
assert.equal((await request({ name: 'Ada', score: 1 })).status, 429);
console.log('PASS: first record, ties/lower, exact name filters, numeric validation, concurrent replacement, CORS, rate limit.');
