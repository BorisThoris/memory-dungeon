import { describe, expect, it } from 'vitest';

import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    getTraitInteractionLaneId,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr
} from './traitInteractionLaneMap';

describe('traitInteractionLaneMap', () => {
    it('groups trait interaction copy into stable visible lanes', () => {
        /*
         * Gen 201 rebuilt this against the four interactions that exist. It used to feed the
         * grouper "Braced guard ward", "Danger pressure" and "Doom pays penalty" - none of which
         * any trait in the game has ever said - to prove that the guard and risk lanes worked. They
         * did work; nothing could reach them. And "Conduit + Echo: peek spark" landed in a lane
         * called Shard, so the board drew a peek charge as a combo shard.
         *
         * The lines below are the real ones, from TILE_TRAIT_INTERACTION_TAGS.
         */
        const laneMap = buildTraitInteractionLaneMap([
            'Conduit + Echo: peek spark',
            'Conduit: adjacent trait charge',
            'Conduit + Stasis: lock pulse',
            'Stasis: nearby trait blocked',
            'Echo recall focus'
        ]);

        expect(laneMap).toEqual([
            { id: 'tool', label: 'Tool', count: 2, cue: 'Conduit + Echo: peek spark' },
            { id: 'block', label: 'Block', count: 2, cue: 'Conduit + Stasis: lock pulse' },
            { id: 'recall', label: 'Recall', count: 1, cue: 'Echo recall focus' }
        ]);
        expect(traitInteractionLaneMapAttr(laneMap)).toBe('tool:2>block:2>recall:1');
        expect(traitInteractionLaneActionMapAttr(laneMap)).toBe(
            'tool:Use tool:2>block:Deny match:2>recall:Set memory:1'
        );
        expect(formatTraitInteractionLaneMapLabel('Trait interaction lanes', laneMap)).toBe(
            'Trait interaction lanes. Tool: 2. Use tool. Conduit + Echo: peek spark. Block: 2. Deny match. Conduit + Stasis: lock pulse. Recall: 1. Set memory. Echo recall focus.'
        );
        expect(getTraitInteractionLaneAction('block')).toBe('Deny match');
    });

    it('puts every interaction the game can actually produce in a lane that names it honestly', () => {
        // The four live tags, each checked by hand against what it does to the run.
        expect(getTraitInteractionLaneId('Conduit + Echo: peek spark')).toBe('tool');
        expect(getTraitInteractionLaneId('Conduit: adjacent trait charge')).toBe('tool');
        expect(getTraitInteractionLaneId('Conduit + Stasis: lock pulse')).toBe('block');
        expect(getTraitInteractionLaneId('Stasis: nearby trait blocked')).toBe('block');
    });

    it('keeps block ahead of recall for pure lockout effects', () => {
        expect(getTraitInteractionLaneId('Stasis card blocks next match')).toBe('block');
        expect(getTraitInteractionLaneId('Echo recall focus')).toBe('recall');
        expect(getTraitInteractionLaneId('Plain score bump')).toBe('score');
    });

    it('ignores malformed trait interaction line arrays before grouping lanes', () => {
        expect(buildTraitInteractionLaneMap({ length: 2 } as unknown as string[])).toEqual([]);
        expect(buildTraitInteractionLaneMap([
            'Conduit + Echo: peek spark',
            Number.NaN,
            '',
            null
        ] as unknown as string[])).toEqual([
            { id: 'tool', label: 'Tool', count: 1, cue: 'Conduit + Echo: peek spark' }
        ]);
    });
});
