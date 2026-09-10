import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * A feedback branch may not outlive the announcement it watches.
 *
 * `gameScreenFeedback.ts` reads the *text* of a run announcement and decides what chip to show and
 * what to advise next. That makes it silently rot-prone in a way a type checker cannot see: remove
 * the system that produced "Guard Cache ward blocked" and the branch watching for those words is
 * still there, still compiling, still tested, and now unreachable.
 *
 * Gen 201 found twenty-one such branches, several of them holding in-run advice about patrol paths
 * and banking gold for shops. This is the check that would have caught them the day the systems
 * left: collect every string the shipping code can emit, and require each branch needle to appear
 * somewhere in it.
 */
const ROOT = path.resolve(__dirname, '../../..');
const FEEDBACK = path.join(ROOT, 'src/renderer/components/gameScreenFeedback.ts');

const sourceFiles = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(full, out);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
};

/*
 * Needles the projector composes rather than reads whole - chip labels it emits itself, and trait
 * route wording assembled at runtime. Each is listed by hand so that adding to this set is a
 * deliberate act rather than a silent one.
 */
const COMPOSED_NEEDLES = new Set([
    'Pickup',
    'Pickup cashout',
    'Route paid',
    'Route cashout',
    'Trait cashout',
    'Perk pop',
    'Stack cashout',
    'Super stack',
    'trait route prime found',
    'trait route setup found',
    'risks'
]);

describe('in-run feedback branches stay reachable', () => {
    it('never watches for an announcement the shipping game cannot produce', () => {
        const corpus = sourceFiles(path.join(ROOT, 'src'))
            .filter((file) => file !== FEEDBACK)
            .map((file) => readFileSync(file, 'utf8'))
            .join('\n')
            .toLowerCase();

        const feedback = readFileSync(FEEDBACK, 'utf8');
        const needles = [...new Set([...feedback.matchAll(/includes\('([^']+)'\)/g)].map((match) => match[1]!))];
        expect(needles.length).toBeGreaterThan(30);

        const unreachable = needles
            .filter((needle) => !COMPOSED_NEEDLES.has(needle))
            .filter((needle) => !corpus.includes(needle.toLowerCase()));

        expect(unreachable, `feedback branches nothing can trigger: ${unreachable.join(', ')}`).toEqual([]);
    });
});
