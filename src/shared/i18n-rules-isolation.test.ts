import { describe, expect, it, vi } from 'vitest';

/*
 * The language must never reach the rules (docs/LOCALIZATION_PLAN.md): the same seeds played by
 * the same soak players end the same way whether the copy is English or the pseudo-locale, which
 * changes every translated string. Modules are re-imported per language so module-level copy
 * evaluates under the locale, exactly as at boot.
 */
const playAll = async (locale: 'en' | 'en-XA'): Promise<unknown[]> => {
    vi.resetModules();
    const i18n = await import('./i18n');
    i18n.setActiveLocale(locale, null);
    const { SOAK_PLAYERS, soakRun } = await import('./run-soak');
    const reports = [];
    for (const [name, player] of Object.entries(SOAK_PLAYERS)) {
        for (const seed of [7_001, 211_459]) {
            const report = soakRun({ seed, player, playerName: name, maxFloors: 12 });
            reports.push({ ...report, violations: report.violations.length });
        }
    }
    i18n.setActiveLocale('en', null);
    return reports;
};

describe('locale isolation', () => {
    it('plays identical runs in English and in the pseudo-locale', async () => {
        const english = await playAll('en');
        const pseudo = await playAll(process.env.ISO_SECOND === 'en' ? 'en' : 'en-XA');
        const differences = english.flatMap((row, index) => {
            const a = row as Record<string, unknown>;
            const b = pseudo[index] as Record<string, unknown>;
            return Object.keys(a)
                .filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
                .map((key) => `${String(a.player)}#${String(a.seed)}.${key}: ${JSON.stringify(a[key]).slice(0, 120)} vs ${JSON.stringify(b[key]).slice(0, 120)}`);
        });
        expect(differences).toEqual([]);
    }, 240_000);
});
