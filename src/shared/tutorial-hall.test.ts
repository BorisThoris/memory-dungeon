import { describe, expect, it } from 'vitest';
import { advanceTutorial, resolveTutorial, selectTutorialTile, startTutorial, TUTORIAL_LESSONS, tutorialTarget } from './tutorial-hall';

describe('guided tutorial rooms', () => {
    for (const lesson of TUTORIAL_LESSONS) {
        it(`${lesson.title} is playable card by card through the real rules`, () => {
            let session = startTutorial(lesson);
            for (const step of lesson.steps) {
                for (const card of step.cards) {
                    expect(tutorialTarget(session)).toBe(card);
                    session = selectTutorialTile(session, card);
                    expect(session.hint).toBe('');
                }
                expect(session.phase).toBe('resolve');
                session = resolveTutorial(session);
                expect(session.run.board?.flippedTileIds).toHaveLength(0);
                if (lesson.reaction && session.step < 2) {
                    expect(session.run.elementStreak?.links).toBe(session.step + 1);
                    expect(session.run.elementReactionsThisFloor ?? 0).toBe(0);
                }
                session = advanceTutorial(session);
            }
            expect(session.phase).toBe('complete');
            if (lesson.reaction) {
                expect(session.run.elementReactionsThisFloor).toBeGreaterThan(0);
                expect(session.run.lastRealmEvent?.kind).toBe(lesson.reaction);
            }
            if (lesson.id === 'combo') expect(session.run.stats.currentStreak).toBe(0);
            if (lesson.id === 'cast-ember') expect(session.run.board!.tiles.filter(tile => tile.vined)).toHaveLength(0);
            if (lesson.id === 'cast-tide') expect(session.run.board!.tiles.filter(tile => tile.fuse != null)).toHaveLength(0);
            if (lesson.id === 'cast-bone') expect(session.run.board!.tiles.some(tile => (tile.frost ?? 0) > 0)).toBe(true);
            if (lesson.id === 'cast-moss') expect(session.run.board!.tiles.some(tile => tile.vined)).toBe(true);
        });
    }
    it('cannot skip steps, double-resolve, or mutate the practice board with a wrong click', () => {
        const session = startTutorial(TUTORIAL_LESSONS[0]!);
        const wrong = selectTutorialTile(session, 'f-1');
        expect(wrong.run).toBe(session.run);
        expect(tutorialTarget(wrong)).toBe('a-1');
        expect(advanceTutorial(session)).toBe(session);
        expect(resolveTutorial(session)).toBe(session);
        expect(startTutorial(TUTORIAL_LESSONS[0]!).run).not.toBe(session.run);
    });
});
