import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchEconomy } from './turn-match-economy-rules';

describe('resolveTurnMatchEconomy', () => {
    it('closes the wallet: a match pays no gold and clears any gold an older save carried (Gen 174)', () => {
        const run = { ...createNewRun(0), shopGold: 5 };

        const result = resolveTurnMatchEconomy({
            run,
            dungeonKeysDelta: 0,
            dungeonMasterKeysDelta: 0,
            matchedDungeonKind: null,
            matchedDungeonKeyKind: 'iron'
        });

        expect(result.shopGold).toBe(0);
        expect(result.dungeonKeys).toBe(run.dungeonKeys);
    });

    it('adds a dungeon key only when a key card was matched', () => {
        const run = createNewRun(0);

        const noKey = resolveTurnMatchEconomy({
            run,
            dungeonKeysDelta: 0,
            dungeonMasterKeysDelta: 0,
            matchedDungeonKind: 'treasure',
            matchedDungeonKeyKind: 'iron'
        });
        expect(noKey.dungeonKeys).toBe(run.dungeonKeys);

        const key = resolveTurnMatchEconomy({
            run,
            dungeonKeysDelta: 1,
            dungeonMasterKeysDelta: 0,
            matchedDungeonKind: 'key',
            matchedDungeonKeyKind: 'iron'
        });
        expect(key.dungeonKeys.iron).toBe((run.dungeonKeys.iron ?? 0) + 1);
    });

    it('spends master keys when a dungeon reward consumes one', () => {
        const run = { ...createNewRun(0), dungeonMasterKeys: 2 };

        const result = resolveTurnMatchEconomy({
            run,
            dungeonKeysDelta: 0,
            dungeonMasterKeysDelta: -1,
            matchedDungeonKind: null,
            matchedDungeonKeyKind: 'iron'
        });

        expect(result.dungeonMasterKeys).toBe(1);
    });

    it('normalizes malformed economy counters and reward deltas before applying them', () => {
        const run = { ...createNewRun(0), shopGold: Number.NaN, dungeonMasterKeys: Number.NaN };

        const result = resolveTurnMatchEconomy({
            run,
            dungeonKeysDelta: Number.NaN,
            dungeonMasterKeysDelta: Number.NaN,
            matchedDungeonKind: null,
            matchedDungeonKeyKind: 'iron'
        });

        expect(result.shopGold).toBe(0);
        expect(result.dungeonMasterKeys).toBe(0);
    });
});
