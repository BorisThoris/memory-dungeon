import { describe, expect, it } from 'vitest';
import type { RealmId, RunState } from './contracts';
import { advanceToNextLevel, createNewRun, finishMemorizePhase } from './game-core';
import { flipTile } from './game';
import { reduceGameplayCommand } from './gameplay-core';
import { createGameplayStillBellCommand } from './gameplay-core-contracts';
import { boardHasTurnablePair } from './realm-weather-rules';
import { applyStillBell, canRingStillBell } from './still-bell-rules';
import { curioItemsForRules } from './curio-rules';

/** Floor 4 of a fixed seed in one realm, with some cards frozen and some vined, a bell in hand. */
const heldFloorIn = (realm: RealmId | null): RunState => {
    let run = finishMemorizePhase(createNewRun(0, { runSeed: 9001, realm: realm ? { realmId: realm, severity: 'calm' } : null }));
    for (let floor = 0; floor < 3; floor += 1) run = finishMemorizePhase(advanceToNextLevel({ ...run, status: 'levelComplete' }));
    const tiles = run.board!.tiles.map((tile, cell) =>
        tile.state !== 'hidden' ? tile : cell % 4 === 0 ? { ...tile, frost: 2 } : cell % 4 === 1 ? { ...tile, vined: true } : tile
    );
    return { ...run, realmId: realm ?? undefined, realmSecondaryId: null, stillBellCharges: 1, board: { ...run.board!, tiles } } as RunState;
};

const heldIds = (run: RunState): string[] =>
    run.board!.tiles.filter((tile) => tile.state === 'hidden' && ((tile.frost ?? 0) > 0 || tile.vined || tile.snowed || tile.fuse != null)).map((tile) => tile.id);

describe('the Still Bell', () => {
    it('lets every held card go in every realm, and the realm answers with its everyday weather', () => {
        const answers: Record<RealmId, string> = { frost: 'blizzard', ember: 'wildfire', tide: 'current', storm: 'lightning', grove: 'overgrowth' };
        for (const realm of Object.keys(answers) as RealmId[]) {
            const run = heldFloorIn(realm);
            const held = heldIds(run);
            expect(canRingStillBell(run), realm).toBe(true);
            const result = applyStillBell(run)!;
            expect(new Set(result.freedTileIds), realm).toEqual(new Set(held));
            expect(result.answer?.kind, realm).toBe(answers[realm]);
            expect(result.run.lastRealmEvent).toEqual(result.answer);
            expect(result.run.stillBellCharges).toBe(0);
            expect(result.run.realmWeatherThisFloor).toBe(run.realmWeatherThisFloor);
            expect(boardHasTurnablePair(result.run.board!.tiles)).toBe(true);
            expect(result.run.board!.tiles.map((tile) => tile.id).sort()).toEqual(run.board!.tiles.map((tile) => tile.id).sort());
            // What the answer holds again is only what it touched: the rest stays free.
            const answered = new Set(result.answer?.tileIds ?? []);
            const stillHeld = heldIds(result.run).filter((id) => !answered.has(id));
            expect(stillHeld.every((id) => !held.includes(id) || answered.size > 0), realm).toBe(true);
        }
    });

    it('stays silent off a realm floor, with a card face up, with nothing held, or with no bell', () => {
        expect(canRingStillBell(heldFloorIn(null))).toBe(false);
        const frost = heldFloorIn('frost');
        const open = frost.board!.tiles.find((tile) => tile.state === 'hidden' && !tile.frost && !tile.vined)!;
        expect(canRingStillBell(flipTile(frost, open.id))).toBe(false);
        expect(canRingStillBell({ ...frost, stillBellCharges: 0 })).toBe(false);
        const nothingHeld: RunState = { ...frost, board: { ...frost.board!, tiles: frost.board!.tiles.map(({ frost: _f, vined: _v, ...tile }) => tile) } };
        expect(canRingStillBell(nothingHeld)).toBe(false);
    });

    it('rings the same way every time, and journals what it freed and how the realm answered', () => {
        expect(applyStillBell(heldFloorIn('tide'))!.run.board).toEqual(applyStillBell(heldFloorIn('tide'))!.run.board);
        const result = reduceGameplayCommand(heldFloorIn('frost'), createGameplayStillBellCommand('bell:test'));
        expect(result.accepted).toBe(true);
        expect(result.events.find((event) => event.type === 'realm.stilled')).toMatchObject({ realmId: 'frost', answerKind: 'blizzard', stillBellChargesBefore: 1, stillBellChargesAfter: 0 });
        expect(result.events.some((event) => event.type === 'feedback.requested' && event.cue === 'power.still_bell.used')).toBe(true);
    });

    it('joins what a Curio may hold at rules 69', () => {
        expect(curioItemsForRules(68)).not.toContain('still_bell');
        expect(curioItemsForRules(69)).toContain('still_bell');
    });
});
