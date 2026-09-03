import { describe, expect, it } from 'vitest';
import { HARDCODED_COPY_BASELINE, findHardcodedCopy, scanComponentCopy } from '../../scripts/copy-locality';

/**
 * Localizing this game means handing a translator a set of files. Copy already lives mostly in
 * `src/renderer/copy/` and the shared catalogs, so the expensive half is done — what was missing
 * was anything stopping the next component from hardcoding a sentence, and any idea of how much
 * already was.
 *
 * The baseline ratchets down. It is not an assertion that 54 is acceptable; it is an assertion that
 * 55 would be worse and that nobody should reach that number by accident.
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

    it('keeps the baseline honest by failing if it drifts far below the real count', () => {
        // A baseline left high after copy moves out stops catching regressions, so it has to be
        // lowered when the number drops rather than left as slack.
        const found = scanComponentCopy();
        expect(HARDCODED_COPY_BASELINE - found.length).toBeLessThanOrEqual(5);
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
});
