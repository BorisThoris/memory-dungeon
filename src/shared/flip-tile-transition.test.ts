import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase, flipTile } from './game';

describe('flipTile refusals', () => {
    const litRun = () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 4242 }));
        const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden');
        return {
            run: { ...run, lanternLitTileIds: [hidden[2]!.id, hidden[3]!.id], flashPairRevealedTileIds: [hidden[4]!.id] },
            hidden
        };
    };

    it('hands back the same run when the open card is tapped again, leaving lit faces lit', () => {
        const { run, hidden } = litRun();
        const opened = flipTile(run, hidden[0]!.id);
        expect(opened.lanternLitTileIds).toEqual([]);
        const relit = { ...opened, lanternLitTileIds: [hidden[2]!.id] };
        expect(flipTile(relit, hidden[0]!.id)).toBe(relit);
    });

    it('hands back the same run for the sticky-blocked card', () => {
        const { run } = litRun();
        const blocked = { ...run, stickyBlockIndex: 1 };
        expect(flipTile(blocked, blocked.board!.tiles[1]!.id)).toBe(blocked);
    });

    it('clears what the lantern and a flash lit on a real flip', () => {
        const { run, hidden } = litRun();
        const next = flipTile(run, hidden[0]!.id);
        expect(next.board!.flippedTileIds).toEqual([hidden[0]!.id]);
        expect(next.lanternLitTileIds).toEqual([]);
        expect(next.flashPairRevealedTileIds).toEqual([]);
    });
});
