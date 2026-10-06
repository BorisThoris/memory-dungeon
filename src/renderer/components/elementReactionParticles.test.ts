import { describe, expect, it } from 'vitest';
import { advanceTutorial, resolveTutorial, selectTutorialTile, startTutorial, TUTORIAL_LESSONS } from '../../shared/tutorial-hall';
import { collectElementReactionParticles } from './elementReactionParticles';
import { boardParticleBudget, createBoardParticleSystem } from './boardParticleSystem';
import { getTileTransform } from './tileBoardTransform';

function steamTurn() {
    let session = startTutorial(TUTORIAL_LESSONS.find(lesson => lesson.id === 'steam')!);
    for (const step of session.lesson.steps.slice(0, 2)) {
        for (const id of step.cards) session = selectTutorialTile(session, id);
        session = advanceTutorial(resolveTutorial(session));
    }
    for (const id of session.lesson.steps[2]!.cards) session = selectTutorialTile(session, id);
    return { before: session.run.board!, after: resolveTutorial(session).run.board! };
}

describe('chemistry in the shared particle pool', () => {
    it.each(['low', 'medium', 'high'] as const)('shows both scales with a fixed %s budget', quality => {
        const { before, after } = steamTurn();
        const cues = collectElementReactionParticles(before, after, quality, false, false, 1);
        expect(cues.length).toBeGreaterThan(1);
        expect(cues.length).toBeLessThanOrEqual(quality === 'low' ? 6 : quality === 'medium' ? 10 : 14);
        expect(cues.every(cue => cue.shape === 'vapor' && cue.priority === 'event')).toBe(true);
        expect(cues.some(cue => cue.delay! < 0.3)).toBe(true);
        expect(cues.some(cue => cue.delay! >= 0.3)).toBe(true);
        const pool = createBoardParticleSystem();
        for (const cue of cues) pool.emit(cue);
        expect(pool.advance(1.5)).toBeLessThanOrEqual(boardParticleBudget(quality));
        expect(pool.advance(5)).toBe(0);
        pool.dispose();
    });
    it('never replays when mounting, resuming, or using reduced motion', () => {
        const { before, after } = steamTurn();
        expect(collectElementReactionParticles(null, after, 'high', false, false, 0)).toEqual([]);
        expect(collectElementReactionParticles(after, after, 'high', false, false, 0)).toEqual([]);
        expect(collectElementReactionParticles(before, after, 'high', false, true, 0)).toEqual([]);
        expect(collectElementReactionParticles(before, { ...after, elementCast: { ...after.elementCast!, reactions: undefined } }, 'high', false, false, 0)).toEqual([]);
    });
    it('places contact effects at the card current position after movement', () => {
        const { before, after } = steamTurn();
        const reaction = after.elementCast!.reactions![0]!;
        const id = reaction.changes[0]!.tileId;
        const cell = after.tiles.findIndex(tile => tile.id === id);
        const tiles = [...after.tiles];
        [tiles[cell], tiles[11]] = [tiles[11]!, tiles[cell]!];
        const moved = { ...after, tiles };
        const target = getTileTransform(tiles[11]!, 11, moved.columns, moved.rows, false, true, false);
        const cues = collectElementReactionParticles(before, moved, 'high', false, false, 0);
        expect(cues.some(cue => cue.x === target.baseX + target.layoutJitterX && cue.y === target.baseY + target.layoutJitterY)).toBe(true);
    });
});
