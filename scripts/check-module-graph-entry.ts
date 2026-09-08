/**
 * Entering the shared graph through the game barrel must not kill the process.
 *
 * `save-data` once read `RELIC_POOL` during its own module body, and any entry point that loaded
 * `relics` first died on `Cannot access 'RELIC_POOL' before initialization`; this project has
 * shipped a build whose renderer went blank for exactly that reason. The relics are gone
 * (Gen 176), the lesson is not: Vitest's ESM loader does not reproduce module order, the CJS
 * transform every `tsx` script in this repo runs under does, so the guard lives here and enters
 * through the widest barrel, the way the renderer does.
 *
 * Keep the game import first.
 */
import { createNewRun } from '../src/shared/game';
import { createDefaultSaveData, normalizeSaveData } from '../src/shared/save-data';

const failures: string[] = [];

const run = createNewRun(0, { runSeed: 42_001 });
if (!run.board || run.board.tiles.length === 0) {
    failures.push('createNewRun produced no board when the graph is entered through game.');
}

const save = createDefaultSaveData();
if (!(save.schemaVersion > 0)) {
    failures.push('createDefaultSaveData produced no schema version.');
}

// Normalization reads the content catalogs that used to be read too early; a lookup that
// silently resolved to nothing would fail here.
const restored = normalizeSaveData({ ...save, bestScore: 1234 });
if (restored.bestScore !== 1234) {
    failures.push('A valid best score was dropped from a restored save.');
}

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    console.error('Module graph entry check failed');
    process.exit(1);
}

console.log('Module graph entry check passed (game -> save-data loads clean)');
