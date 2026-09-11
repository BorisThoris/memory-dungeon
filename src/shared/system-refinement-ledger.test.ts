import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameplayInteractionGraph } from './gameplay-interaction-graph';
import {
    simulateRunOccupancy,
    simulateSystemOccupancy,
    SYSTEM_OCCUPANCY_BASELINE_FLOORS,
    SYSTEM_OCCUPANCY_COUNTERS
} from './system-occupancy-simulation';
import {
    staleLedgerIds,
    strandedLedgerIds,
    SYSTEM_REFINEMENT_LEDGER,
    SYSTEM_REFINEMENT_SWEEP_GENERATION,
    systemRefinementLedgerById,
    unevidencedLedgerIds,
    unexaminedSystemIds
} from './system-refinement-ledger';

describe('every system in the game has been passed over', () => {
    it('leaves no mechanic unexamined, and no ledger entry pointing at nothing', () => {
        /*
         * This is the check behind the claim. "Refine every system" is a statement about coverage,
         * and coverage is worth what the thing checking it is worth - so: every mechanic the
         * interaction graph knows about must carry a verdict, and every verdict must name a
         * mechanic that exists.
         *
         * The consequence worth having is the one on the next person: a new mechanic cannot ship
         * without someone writing down what state it is in, because the graph will list it and this
         * will fail until the ledger does too.
         */
        expect(unexaminedSystemIds(), 'systems nobody has said anything about').toEqual([]);
        expect(strandedLedgerIds(), 'ledger entries naming a mechanic the graph does not have').toEqual([]);
        expect(systemRefinementLedgerById().size).toBe(SYSTEM_REFINEMENT_LEDGER.length);
        expect(SYSTEM_REFINEMENT_LEDGER.length).toBeGreaterThanOrEqual(gameplayInteractionGraph.mechanics.length);
    });

    it('records a real finding for every entry, so "confirmed" is never a shrug', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            // A note shorter than a sentence is someone ticking a box rather than looking.
            expect(entry.note.length, `${entry.id} note is too short to be a finding`).toBeGreaterThan(60);
            expect(entry.note.trim().endsWith('.'), `${entry.id} note is not a sentence`).toBe(true);
        }
    });

    it('changed more systems than it confirmed unchanged, which is what a refinement pass means', () => {
        const changed = SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === 'changed').length;
        const confirmed = SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === 'confirmed').length;
        const removed = SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === 'removed').length;

        expect(changed + confirmed + removed).toBe(SYSTEM_REFINEMENT_LEDGER.length);
        // Not a target to chase later - a description of what the passes actually did.
        expect(changed).toBeGreaterThanOrEqual(18);
        expect(removed).toBeGreaterThanOrEqual(1);
    });
});

describe('the ledger describes the game as it stands', () => {
    /*
     * Gen 213. The ledger recorded *what* had been examined and never *when relative to the game*:
     * 34 of the 48 entries were stamped Gen 200-202, written before the deal became a shuffle, the
     * authored floors were redrawn, the census learned to measure a run, or par stopped being a
     * flat rate. Nothing about reading those entries distinguished them from current evidence.
     *
     * Two rules give the stamp teeth. Every entry must be stamped at or after the sweep constant,
     * so raising it is the act of re-walking all forty-eight; and every entry must carry evidence a
     * test can re-check, so the walk cannot be done with a find-and-replace. The second is what
     * makes the first honest.
     */
    it('has walked every entry at or after the current sweep', () => {
        expect(staleLedgerIds(), `entries predating Gen ${SYSTEM_REFINEMENT_SWEEP_GENERATION}`).toEqual([]);
    });

    it('carries evidence for every entry, including the ones exempt from the census', () => {
        expect(unevidencedLedgerIds(), 'entries that are a sentence and nothing behind it').toEqual([]);
    });
});

/**
 * The live game: source a player's build is made of, with comments stripped.
 *
 * Comments are stripped because this ledger is largely a record of removals, and the comment that
 * says a thing was removed necessarily names it. A record of what went is not the thing coming
 * back. Tests are excluded for the same reason - a test asserting a mechanic is absent has to spell
 * it - and so is the ledger itself, which quotes every string it is checking.
 */
const readLiveSource = (): { path: string; text: string }[] => {
    const root = join(import.meta.dirname, '..', '..');
    const skipped = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'coverage', 'release', 'test-results']);
    const files: string[] = [];
    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory)) {
            if (skipped.has(entry)) continue;
            const full = join(directory, entry);
            if (statSync(full).isDirectory()) walk(full);
            else files.push(full);
        }
    };
    walk(join(root, 'src'));
    walk(join(root, 'scripts'));
    return files
        .map((file) => relative(root, file))
        .filter((path) => extname(path) === '.ts' || extname(path) === '.tsx')
        .filter((path) => !/\.test\.tsx?$/.test(path))
        .filter((path) => path !== join('src', 'shared', 'system-refinement-ledger.ts'))
        .map((path) => ({
            path,
            text: readFileSync(join(root, path), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
        }));
};

describe('what the ledger says is gone, and what it says is still wired', () => {
    const live = readLiveSource();
    const namedBy = (token: string): string[] => live.filter((file) => file.text.includes(token)).map((f) => f.path);

    it('reads a repository, so an empty corpus cannot pass every absence check', () => {
        // Without this, a broken walk would make every `gone` assertion below trivially true.
        expect(live.length).toBeGreaterThan(200);
    });

    it('finds nothing in the live game that a removal entry says went', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            for (const token of entry.gone ?? []) {
                expect(namedBy(token), `${entry.id} says "${token}" is gone`).toEqual([]);
            }
        }
    });

    it('finds everything a standing entry depends on', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            for (const token of entry.present ?? []) {
                expect(namedBy(token).length, `${entry.id} depends on "${token}"`).toBeGreaterThan(0);
            }
        }
    });
});

describe('the numbers the ledger quotes', () => {
    /*
     * Gen 208. Notes quote measurements - "0.408 of floors", "1.000 x 4.46" - and a measurement
     * written into prose goes stale the moment the game moves. Two of the first seven had: the
     * gambit said 0.408 against a census reading 0.446, and the turn resolution said 4.46 turns a
     * floor against 4.95. Neither is a big number and that is the point; nobody would catch them by
     * reading, and both are the kind of figure a later generation reasons from.
     *
     * So the note names its counter and the census re-measures it here. Gen 213 tightened the match
     * from two decimals to three - at two, the pin's 0.163 and the 0.158 it replaced are the same
     * number - and stopped requiring the word "Occupancy", because several notes say the share in
     * words and were carrying a counter nothing checked. A run-scoped charge is read off the run
     * census, because that is the census entitled to band it (Gen 207).
     */
    const floorReport = simulateSystemOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });
    const runReport = simulateRunOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });
    const runScoped = new Set(
        SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.scope === 'run').map((counter) => counter.id)
    );
    const measured = (counterId: string): { share: number; perFloor: number } => {
        if (runScoped.has(counterId)) {
            const row = runReport.rows.find((candidate) => candidate.key === counterId)!;
            return { share: row.runFloorShare, perFloor: row.perFloor };
        }
        const row = floorReport.rows.find((candidate) => candidate.key === counterId)!;
        return { share: row.floorShare, perFloor: row.perFloor };
    };

    it('names a counter for every note that quotes a share', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            if (!/\b0\.\d{3}\b/.test(entry.note)) continue;
            expect(entry.counter, `${entry.id} quotes a share without naming its counter`).toBeTruthy();
        }
    });

    it('names a real counter, so a renamed one cannot go unnoticed', () => {
        const ids = new Set(SYSTEM_OCCUPANCY_COUNTERS.map((counter) => counter.id));
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            if (!entry.counter) continue;
            expect(ids.has(entry.counter), `${entry.id} names ${entry.counter}`).toBe(true);
        }
    });

    it('quotes what the census says today, not what it said when the note was written', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            if (!entry.counter) continue;
            const { share, perFloor } = measured(entry.counter);
            // Compared as the printed figure rather than by tolerance: the pin reads 0.1625, and
            // "within 0.0005 of 0.163" is false for the number the census would print.
            const quoted = [...entry.note.matchAll(/\b\d\.\d{3}\b/g)].map((match) => match[0]);
            expect(quoted, `${entry.id} names a counter but quotes no share`).not.toEqual([]);
            expect(
                quoted.includes(share.toFixed(3)),
                `${entry.id} quotes ${quoted.join(', ')}; the census reads ${share.toFixed(3)}`
            ).toBe(true);
            // Same rule for the intensity: what the census would print, not a tolerance around it.
            const intensity = new RegExp(`${share.toFixed(3)} x (\\d+\\.\\d\\d)`).exec(entry.note);
            if (intensity) {
                expect(intensity[1], `${entry.id} intensity`).toBe(perFloor.toFixed(2));
            }
        }
    });
});
