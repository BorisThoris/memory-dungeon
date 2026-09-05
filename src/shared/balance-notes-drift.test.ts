import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGauntletRun } from './game-core';
import { PRESENTATION_MUTATOR_MATCH_PENALTIES } from './turn-resolution';
import { pressureDurationMs } from './classic-run-setup';
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

    it('gauntlet presets and default match run-mode-catalog / createGauntletRun', () => {
        const md = readBalanceNotes();
        expect(md).toMatch(/5\s*\/\s*10\s*\/\s*15/);
        // The three durations are Classic setup options now, not a card of their own.
        const minutes = (['timed_5', 'timed_10', 'timed_15'] as const).map((id) =>
            Math.round((pressureDurationMs(id) ?? 0) / 60_000)
        );
        expect(minutes).toEqual([5, 10, 15]);
        expect(createGauntletRun(0).gauntletSessionDurationMs).toBe(10 * 60 * 1000);
        expect(md).toMatch(/10\s*m/);
    });
});
