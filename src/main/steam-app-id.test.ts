import { describe, expect, it } from 'vitest';
import { parseSteamAppId } from './steam-app-id';

describe('parseSteamAppId', () => {
    it.each([
        ['480', 480],
        [' 480 ', 480],
        ['4294967295', 4_294_967_295]
    ])('accepts decimal uint32 app id %j', (rawValue, expected) => {
        expect(parseSteamAppId(rawValue)).toBe(expected);
    });

    it.each([undefined, '', '   ', '0', '-1', '+480', '480garbage', '4.8e2', '4294967296'])(
        'rejects malformed or out-of-range app id %j',
        (rawValue) => {
            expect(parseSteamAppId(rawValue)).toBeUndefined();
        }
    );
});
