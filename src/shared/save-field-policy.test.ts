import { describe, expect, it } from 'vitest';
import {
    findFieldsWithoutPolicy,
    readPolicyRoots,
    readSaveDataFields,
    SAVE_FIELD_POLICY_EXEMPTIONS
} from '../../scripts/save-field-policy';

describe('readSaveDataFields', () => {
    it('reads the fields the interface declares, optional ones included', () => {
        const source = [
            'export interface SaveData {',
            '    schemaVersion: number;',
            '    runHistory?: RunHistoryRecord[];',
            '    playerStats?: PlayerStatsPersisted;',
            '}'
        ].join('\n');

        expect(readSaveDataFields(source)).toEqual(['schemaVersion', 'runHistory', 'playerStats']);
    });

    it('reads nothing rather than guessing when the interface is not there', () => {
        expect(readSaveDataFields('export interface Something {}')).toEqual([]);
    });
});

describe('readPolicyRoots', () => {
    it('treats a dotted entry as covering its root, since that is what the policy is about', () => {
        const roots = readPolicyRoots("field: 'runHistory.shareKey'\nfield: 'settings.pairProximityHintsEnabled'");
        expect([...roots].sort()).toEqual(['runHistory', 'settings']);
    });
});

describe('findFieldsWithoutPolicy', () => {
    it('reports a field the policy does not name', () => {
        expect(findFieldsWithoutPolicy(['runHistory', 'newThing'], new Set(['runHistory']))).toEqual(['newThing']);
    });

    it('says nothing about a field exempt by name', () => {
        const exempt = Object.keys(SAVE_FIELD_POLICY_EXEMPTIONS)[0] ?? 'schemaVersion';
        expect(findFieldsWithoutPolicy([exempt], new Set())).toEqual([]);
    });

    it('keeps every exemption paired with a reason, not just a name', () => {
        for (const [field, reason] of Object.entries(SAVE_FIELD_POLICY_EXEMPTIONS)) {
            expect(reason.trim().length, `${field} needs a reason`).toBeGreaterThan(20);
        }
    });
});
