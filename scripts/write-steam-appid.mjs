#!/usr/bin/env node
/**
 * Writes `steam_appid.txt` for packaging from STEAM_APP_ID and refuses to ship the Spacewar
 * test id (480). The demo and the full game are separate Steam apps, so the packager names the
 * flavour (MEMORY_DUNGEON_BUILD_FLAVOUR=demo|full) and the id that belongs to it.
 *
 *   STEAM_APP_ID=1234567 MEMORY_DUNGEON_BUILD_FLAVOUR=demo yarn package:win
 */
import { writeFileSync } from 'node:fs';

const SPACEWAR_APP_ID = '480';
const flavour = (process.env.MEMORY_DUNGEON_BUILD_FLAVOUR ?? 'full').trim().toLowerCase() === 'demo' ? 'demo' : 'full';
const raw = (process.env.STEAM_APP_ID ?? '').trim();

if (!/^\d+$/.test(raw)) {
    console.error(`[steam-appid] STEAM_APP_ID is required to package the ${flavour} build (got "${raw || '<unset>'}").`);
    process.exit(1);
}
if (raw === SPACEWAR_APP_ID) {
    console.error('[steam-appid] STEAM_APP_ID=480 is the Spacewar test id and must not ship. Use the demo or full app id.');
    process.exit(1);
}

writeFileSync('steam_appid.txt', `${raw}\n`);
console.log(`[steam-appid] wrote steam_appid.txt=${raw} for the ${flavour} build`);
