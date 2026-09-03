/**
 * Entering the shared graph through `relics` must not kill the process.
 *
 * `relics` reaches `save-data` through nine hops - trait-build-rewards, tile-trait-rules,
 * bonus-rewards, gameplay-core, board-turn-event-facts, turn-resolution, game and
 * run-summary-rules. While `save-data` read `RELIC_POOL` during its own module body, any
 * entry point that loaded `relics` first died on `Cannot access 'RELIC_POOL' before
 * initialization`, and this project has already shipped a build whose renderer went blank
 * for exactly that reason. Vitest's ESM loader does not reproduce the order; the CJS
 * transform every `tsx` script in this repo runs under does, so the guard lives here.
 *
 * Keep the relics import first.
 */
import { RELIC_POOL } from '../src/shared/relics';
import { createDefaultSaveData, normalizeSaveData } from '../src/shared/save-data';

const failures: string[] = [];

if (RELIC_POOL.length === 0) {
    failures.push('RELIC_POOL is empty when the graph is entered through relics.');
}

const save = createDefaultSaveData();
if (!(save.schemaVersion > 0)) {
    failures.push('createDefaultSaveData produced no schema version.');
}

// The relic-id guard is the binding that was read too early; exercise it both ways so a
// lookup that silently resolves to nothing would fail here too.
const firstRelic = RELIC_POOL[0]!;
const restored = normalizeSaveData({
    ...save,
    playerStats: { ...save.playerStats, relicPickCounts: { [firstRelic]: 2, not_a_relic: 5 } }
});
if (restored.playerStats?.relicPickCounts?.[firstRelic] !== 2) {
    failures.push('A real relic id was dropped from a restored save.');
}
if (restored.playerStats?.relicPickCounts && 'not_a_relic' in restored.playerStats.relicPickCounts) {
    failures.push('A bogus relic id survived save normalization.');
}

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    console.error('Module graph entry check failed');
    process.exit(1);
}

console.log('Module graph entry check passed (relics -> save-data loads clean)');
