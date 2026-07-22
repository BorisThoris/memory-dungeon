import { describe, expect, it } from 'vitest';
import { getOverlayDecisionPolicyRow, getOverlayDecisionPolicyRows } from './overlay-decision-policy';

describe('REG-097 overlay decision policy', () => {
    it('defines one-hand, keyboard, focus, and chrome contracts for every modal kind', () => {
        const rows = getOverlayDecisionPolicyRows();
        expect(rows.map((row) => row.kind)).toEqual(['alert', 'decision', 'sheet']);
        expect(getOverlayDecisionPolicyRow('decision')?.oneHandPlacement).toMatch(/sticky/i);
        expect(getOverlayDecisionPolicyRow('unknown' as Parameters<typeof getOverlayDecisionPolicyRow>[0])).toMatchObject({
            kind: 'alert',
            modalKind: 'alert'
        });
        expect(rows.every((row) => row.keyboardPath.includes('Tab trap'))).toBe(true);
        expect(rows.every((row) => row.usesExistingChrome)).toBe(true);
        expect(rows.every((row) => row.finalLicensedAssetRequired === false)).toBe(true);
    });
});
