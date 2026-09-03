import { describe, expect, it } from 'vitest';
import {
    findUnreachableMembers,
    readAppStateMembers,
    REACHABILITY_EXEMPTIONS
} from '../../../scripts/store-action-reachability';

describe('the store reachability audit', () => {
    it('tells actions apart from state', () => {
        const members = readAppStateMembers(
            [
                'export interface AppState {',
                '    hydrated: boolean;',
                '    saveReadFailureNotice: string | null;',
                '    startRun: () => void;',
                '    pickRelic: (relicId: RelicId) => void;',
                '}'
            ].join('\n')
        );

        expect(members).toEqual([
            { kind: 'state', name: 'hydrated' },
            { kind: 'state', name: 'saveReadFailureNotice' },
            { kind: 'action', name: 'startRun' },
            { kind: 'action', name: 'pickRelic' }
        ]);
    });

    it('reports a member no consumer mentions', () => {
        const members = readAppStateMembers(
            ['export interface AppState {', '    shownThing: string;', '    hiddenThing: string;', '}'].join('\n')
        );

        expect(findUnreachableMembers(members, ['const x = state.shownThing;'])).toEqual([
            { kind: 'state', name: 'hiddenThing' }
        ]);
    });

    it('honours the named exemptions rather than a bare count', () => {
        const [name] = Object.keys(REACHABILITY_EXEMPTIONS);
        const members = readAppStateMembers(
            ['export interface AppState {', `    ${name}: () => void;`, '}'].join('\n')
        );

        // A count would let a genuinely dead member hide behind a total that happens to match.
        expect(findUnreachableMembers(members, [])).toEqual([]);
        expect(Object.values(REACHABILITY_EXEMPTIONS).every((reason) => reason.length > 20)).toBe(true);
    });
});
