import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    getLocalizationCopySurfaceRows,
    LOCALIZATION_FOUNDATION_DECISION,
    localizationReadyForNewCopy
} from './localization-readiness';

describe('REG-055 localization extraction foundation', () => {
    it('keeps English-only v1 while documenting future stack and copy homes', () => {
        expect(LOCALIZATION_FOUNDATION_DECISION.shippingLocale).toBe('en');
        expect(LOCALIZATION_FOUNDATION_DECISION.uiPromise).toBe('english_only_v1');
        expect(LOCALIZATION_FOUNDATION_DECISION.futureStack).toBe('react-i18next');
        expect(LOCALIZATION_FOUNDATION_DECISION.nonEnglishUiPromised).toBe(false);
    });

    it('routes new player-facing copy into stable shared or renderer copy modules', () => {
        const rows = getLocalizationCopySurfaceRows();
        expect(rows.find((row) => row.surface === 'mechanics')?.owner).toContain('src/shared');
        expect(rows.find((row) => row.surface === 'game_over')?.owner).toContain('src/renderer/copy');
        expect(rows.every((row) => row.stableIds)).toBe(true);
        expect(localizationReadyForNewCopy('src/renderer/components/GameScreen.tsx', 'inline paragraph')).toBe(false);
        expect(localizationReadyForNewCopy('src/renderer/copy/gameOverScreen.ts', 'copy key')).toBe(true);
    });
});

describe('the copy-surface registry', () => {
    it('names owners that actually exist', () => {
        // The registry pointed at src/renderer/copy/inventoryScreen.ts for a long time after that
        // file stopped being imported by anything — a map of where copy lives is worth nothing if
        // it can name a file that does not.
        for (const row of getLocalizationCopySurfaceRows()) {
            if (!row.owner.startsWith('src/')) {
                continue;
            }
            expect(existsSync(join(process.cwd(), row.owner)), `${row.surface} names a missing owner: ${row.owner}`).toBe(
                true
            );
        }
    });

    it('has at least one surface that is a real module', () => {
        expect(getLocalizationCopySurfaceRows().some((row) => row.owner.startsWith('src/'))).toBe(true);
    });
});
