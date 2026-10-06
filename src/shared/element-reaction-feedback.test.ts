import { describe, expect, it } from 'vitest';
import type { ElementReactionImpact, Tile } from './contracts';
import { createAlchemyLog } from './element-alchemy-rules';
import { ELEMENT_REACTION_KINDS, resolveElementReaction } from './element-resonance-rules';
import { elementReactionResult } from './element-reaction-feedback';
import { advanceTutorial, resolveTutorial, selectTutorialTile, startTutorial, TUTORIAL_LESSONS } from './tutorial-hall';

describe('committed elemental reaction receipts', () => {
    it.each(ELEMENT_REACTION_KINDS)('%s records only changes made in its scope', kind => {
        const tiles: Tile[] = Array.from({ length: 3 }, (_, index) => ({ id: `t${index}`, pairKey: `p${index}`, symbol: 'A', label: 'A',
            suit: 'ember', state: 'hidden', fuse: 3, vined: true, seeded: 1, frost: 2, rime: true }));
        const untouched = { ...tiles[2]! };
        const outcome = resolveElementReaction(kind, 2, tiles, [0, 0, 1], createAlchemyLog());
        expect(tiles[2]).toEqual(untouched);
        expect(outcome.changes.length).toBeGreaterThan(0);
        expect(outcome.changes.every(change => ['t0', 't1'].includes(change.tileId))).toBe(true);
        expect(new Set(outcome.changes.map(change => `${change.tileId}:${change.effect}`)).size).toBe(outcome.changes.length);
        for (const change of outcome.changes) {
            const tile = tiles.find(candidate => candidate.id === change.tileId)!;
            if (change.effect === 'doused') expect(tile.fuse).toBeUndefined();
            if (change.effect === 'growth-cleared') expect([tile.vined, tile.seeded]).toEqual([undefined, undefined]);
            if (change.effect === 'thawed') expect([tile.frost, tile.rime]).toEqual([undefined, undefined]);
            if (change.effect === 'ripened') expect(tile.seeded).toBe(2);
            if (change.effect === 'charged') expect(tile.empowered).toBe(1);
            if (change.effect === 'revealed') expect(outcome.litTileIds).toContain(tile.id);
        }
    });

    it('retains both local and amplified receipts through the real turn pipeline', () => {
        let session = startTutorial(TUTORIAL_LESSONS.find(lesson => lesson.id === 'steam')!);
        const before = JSON.stringify(session.run);
        for (const step of session.lesson.steps) {
            for (const id of step.cards) session = selectTutorialTile(session, id);
            session = advanceTutorial(resolveTutorial(session));
        }
        const cast = session.run.board!.elementCast!;
        expect(cast.reactions?.map(reaction => [reaction.scope, reaction.kind, reaction.potency])).toEqual([
            ['ground', 'steam', 1], ['streak', 'steam', 2]
        ]);
        expect(new Set(cast.reactions?.map(reaction => reaction.eventKey)).size).toBe(2);
        expect(cast.reaction).toBe('Steam');
        expect(JSON.parse(JSON.stringify(cast)).reactions).toEqual(cast.reactions);
        expect(JSON.stringify(startTutorial(session.lesson).run)).toBe(before);
    });

    it('reports actual revealed faces instead of the recipe maximum', () => {
        const impact: ElementReactionImpact = { kind: 'steam', scope: 'streak', potency: 12, sourceCells: [0],
            changes: [{ tileId: 'one', effect: 'revealed' }], gold: 0, score: 0, stillTurns: 0, resonanceGain: 0 };
        expect(elementReactionResult(impact)).toBe('1 revealed');
        expect(elementReactionResult({ ...impact, changes: [] })).toBe('No cards changed');
        expect(elementReactionResult({ ...impact, kind: 'freezeover', changes: [], stillTurns: 13 })).toBe('13 calm turns');
    });
});
