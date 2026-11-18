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

Scores are client reported. This service is not authoritative gameplay verification; a determined
player can still forge a score (the game has no run replay a server could check). Since 2026-11-18:

- Scores above 10,000,000,000 are refused. Near-perfect simulated play reached 24.6 million by
  floor 80, and Endless keeps climbing, so the cap stops only impossible values such as 2^53.
- Current builds send what the run was beside the claim: `floor`, `shareKey` (replays the board)
  and `rules`. Older builds send only `{name, score}`, which is still accepted.
- The last 500 submissions are logged with that evidence, whether they were accepted, and a short
  one-way hash of the sender's address (not the address).
- With the `RECORD_ADMIN_TOKEN` secret (`wrangler secret put RECORD_ADMIN_TOKEN --config
  leaderboard/wrangler.toml`, 32+ characters) and `Authorization: Bearer <token>`:
  `GET /admin/submissions` lists the last 100, and `DELETE /admin/record` clears the record so the
  next eligible run sets a new one. Without the token both answer 404.
- Runs played with pair-distance hints on (assisted) never offer the record (owner, 2026-11-18).

Deploy: `wrangler deploy --config leaderboard/wrangler.toml`. Local API checks use
`wrangler dev --config leaderboard/wrangler.toml --port 8793`, followed by
`node leaderboard/check-api.mjs http://127.0.0.1:8793` against a fresh local state directory
(start `wrangler dev` with `--var RECORD_ADMIN_TOKEN:<token>` and export the same token to check the
admin routes).
Never run the mutating API checks against production.
