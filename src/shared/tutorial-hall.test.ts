import { describe, expect, it } from 'vitest';
import { advanceTutorial, resolveTutorial, selectTutorialTile, startTutorial, TUTORIAL_LESSONS, tutorialTarget } from './tutorial-hall';

describe('guided tutorial rooms', () => {
    for (const lesson of TUTORIAL_LESSONS) {
        it(`${lesson.title} is playable card by card through the real rules`, () => {
            let session = startTutorial(lesson);
            for (const step of lesson.steps) {
                const before = session.run;
                for (const card of step.cards) {
                    expect(tutorialTarget(session)).toBe(card);
                    session = selectTutorialTile(session, card);
                    expect(session.hint).toBe('');
                }
                expect(session.phase).toBe('resolve');
                session = resolveTutorial(session);
                expect(session.run.board?.flippedTileIds).toHaveLength(0);
                const tiles = session.run.board!.tiles;
                if (lesson.counter) {
                    if (session.step === 0) {
                        expect(tiles.filter(tile => tile.pairKey === 'b').map(tile => tile.empowered)).toEqual([1, 1]);
                        expect(session.run.board!.elementCast!.contacts.filter(contact => contact.tileId.startsWith('e-')).every(contact => contact.outcome === 'neutralized')).toBe(true);
                    } else {
                        const suit = lesson.elements[0]!;
                        expect(session.run.elementResonance![suit]! - before.elementResonance![suit]!).toBe(3);
                    }
                }
                if (lesson.id === 'cultivation') {
                    if (session.step === 0) expect(tiles.filter(tile => tile.pairKey === 'e').map(tile => tile.seeded)).toEqual([2, 2]);
                    else expect((session.run.gold ?? 0) - (before.gold ?? 0)).toBe(4);
                }
                if (lesson.id === 'ice-anchors') {
                    if (session.step === 0) {
                        expect([tiles[5]!.id, tiles[7]!.id]).toEqual(['e-1', 'e-2']);
                        expect(tiles.some((tile, index) => tile.id !== before.board!.tiles[index]!.id)).toBe(true);
                    } else {
                        expect(session.run.board!.elementCast!.reactions?.[0]?.kind).toBe('melt');
                        expect(session.run.board!.elementalGround?.[5]).toBe('ember');
                    }
                }
                if (lesson.id === 'ground-chemistry') {
                    expect(session.run.board!.elementCast!.reactions?.map(reaction => [reaction.scope, reaction.kind])).toEqual([['ground', 'steam']]);
                    expect(session.run.elementReactionsThisFloor ?? 0).toBe(0);
                    expect(session.run.elementStreak?.links).toBe(1);
                }
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
