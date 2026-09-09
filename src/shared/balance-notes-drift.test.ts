import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_MUTATOR_MATCH_PENALTIES } from './turn-resolution';
import { SYMBOL_BAND_LAST_LEVEL_LETTER, SYMBOL_BAND_LAST_LEVEL_NUMERIC } from './tile-symbol-catalog';

const __dirname = dirname(fileURLToPath(import.meta.url));

const readBalanceNotes = (): string =>
    readFileSync(join(__dirname, '../../docs/BALANCE_NOTES.md'), 'utf8');

describe('docs/BALANCE_NOTES.md drift guard (REF-040)', () => {
    it('symbol band table matches tile-symbol-catalog exports', () => {
        const md = readBalanceNotes();
        expect(md).toContain(`SYMBOL_BAND_LAST_LEVEL_NUMERIC\` (${SYMBOL_BAND_LAST_LEVEL_NUMERIC})`);
        expect(md).toContain(`SYMBOL_BAND_LAST_LEVEL_LETTER\` (${SYMBOL_BAND_LAST_LEVEL_LETTER})`);
    });

    it('presentation mutator penalty table matches game.ts exports', () => {
        const md = readBalanceNotes();
        expect(md).toContain(`| \`wide_recall\` | ${PRESENTATION_MUTATOR_MATCH_PENALTIES.wide_recall} |`);
        expect(md).toContain(`| \`silhouette_twist\` | ${PRESENTATION_MUTATOR_MATCH_PENALTIES.silhouette_twist} |`);
        expect(md).toContain(`| \`distraction_channel\` | ${PRESENTATION_MUTATOR_MATCH_PENALTIES.distraction_channel} |`);
    });
});
