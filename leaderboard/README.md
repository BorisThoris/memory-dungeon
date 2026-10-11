# Memory Dungeon global record

The menu names the Dungeon Master: one global record with a public name and score. At game end, an eligible run with a
strictly higher score can claim it. Ties and lower scores do not prompt or replace the record.
Practice/debug runs are excluded. An unavailable service never blocks finishing or restarting.

`GET /record` reads it; `POST /record` submits `{name, score}`. One SQLite Durable Object keeps
one row, atomically compares and replaces it, and limits each IP to 30 submissions per hour.
The server checks names independently using Bobball's complete multilingual filter, copied from
`bobball/game/names.js` on 2026-10-11, with additional whole-name regex checks for phonetic fake
names (including spaced, leetspeak and homoglyph variants). The same module runs in the browser,
both before submission and when reading a record for display. No Bobball data or deployment is changed.

Scores are client reported, as expected for this browser beta. This service is not authoritative
gameplay verification; a determined player can forge a score. There is no stored score history.

Deploy: `wrangler deploy --config leaderboard/wrangler.toml`. Local API checks use
`wrangler dev --config leaderboard/wrangler.toml --port 8793`, followed by
`node leaderboard/check-api.mjs http://127.0.0.1:8793` against a fresh local state directory.
Never run the mutating API checks against production.
