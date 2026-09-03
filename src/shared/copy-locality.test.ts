import { describe, expect, it } from 'vitest';
import { HARDCODED_COPY_BASELINE, findHardcodedCopy, scanComponentCopy } from '../../scripts/copy-locality';

/**
 * Localizing this game means handing a translator a set of files. Copy already lives mostly in
 * `src/renderer/copy/` and the shared catalogs, so the expensive half is done — what was missing
 * was anything stopping the next component from hardcoding a sentence, and any idea of how much
 * already was.
 *
 * The baseline ratcheted down to zero, so this is now a rule rather than a budget: a component may
 * not carry a player-facing sentence at all. What is left to decide about localization is which
 * languages to pay for, which is the state it should have been in all along.
 */
describe('copy locality', () => {
    it('does not let components grow new player-facing prose', () => {
        const found = scanComponentCopy();
        if (found.length > HARDCODED_COPY_BASELINE) {
            for (const row of found) {
                console.log(`COPY ${row.file}: ${row.text}`);
            }
        }
        expect(
            found.length,
            `hardcoded prose in components rose to ${found.length} (baseline ${HARDCODED_COPY_BASELINE}); move it into src/renderer/copy/`
        ).toBeLessThanOrEqual(HARDCODED_COPY_BASELINE);
    });

    it('holds the baseline at zero rather than leaving slack behind', () => {
        // A baseline left above the real count stops catching regressions.
        expect(HARDCODED_COPY_BASELINE).toBe(0);
    });
});

describe('the detector itself', () => {
    it('finds a sentence a player would read', () => {
        const found = findHardcodedCopy(`const x = 'Spend temporary shop gold before the next floor.';`, 'a.tsx');
        expect(found).toHaveLength(1);
    });

    it('ignores identifiers, class names and short labels', () => {
        for (const source of [
            `className="settingsScreenPanelHeader"`,
            `<div data-testid="relic-draft-offer-panel" />`,
            `const id = 'trait-interaction-echo:sealed-combo';`,
            `const label = 'Shop gold';`,
            `const url = 'https://store.steampowered.com/app/1';`
        ]) {
            expect(findHardcodedCopy(source, 'a.tsx')).toEqual([]);
        }
    });

    it('ignores prose passed to an attribute that is never read as words', () => {
        expect(findHardcodedCopy(`<div className="a very long class name string here ok" />`, 'a.tsx')).toEqual([]);
    });

    it('does not mistake an interpolated template for a fixed string', () => {
        expect(findHardcodedCopy('const s = `Floor ${level} of the endless cycle awaits`;', 'a.tsx')).toEqual([]);
    });

    it('leaves developer diagnostics alone', () => {
        // A thrown message is read by whoever is debugging the build, never by a player; moving it
        // into a copy module would put a developer's sentence in front of a translator.
        for (const source of [
            `throw new Error('Main menu background could not allocate a 2D drawing context.');`,
            `console.warn('Steam achievement activation returned false for this run.');`
        ]) {
            expect(findHardcodedCopy(source, 'a.tsx')).toEqual([]);
        }
    });

    it('reads a comment quoting the copy as documentation, not as a second copy', () => {
        // A JSDoc line naming the string a prop renders explains the copy; asking someone to move
        // it into a copy module would only delete the explanation.
        const source = [
            '/** Room the door leads to: "Keeper Chamber via Safe passage", when one is offered. */',
            'const label = roomLabel;'
        ].join('\n');

        expect(findHardcodedCopy(source, 'a.tsx')).toEqual([]);
    });
});
