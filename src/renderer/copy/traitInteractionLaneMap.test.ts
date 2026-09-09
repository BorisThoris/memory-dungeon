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
        const laneMap = buildTraitInteractionLaneMap([
            'Conduit + Echo: peek spark',
            'Braced guard ward',
            'Shuffle charge primed',
            'Danger pressure',
            'Conduit + Stasis: lock pulse',
            'Echo recall focus',
            'Doom pays penalty'
        ]);

        expect(laneMap).toEqual([
            { id: 'shard', label: 'Shard', count: 1, cue: 'Conduit + Echo: peek spark' },
            { id: 'guard', label: 'Guard', count: 1, cue: 'Braced guard ward' },
            { id: 'tool', label: 'Tool', count: 1, cue: 'Shuffle charge primed' },
            { id: 'risk', label: 'Risk', count: 2, cue: 'Danger pressure' },
            { id: 'block', label: 'Block', count: 1, cue: 'Conduit + Stasis: lock pulse' },
            { id: 'recall', label: 'Recall', count: 1, cue: 'Echo recall focus' }
        ]);
        expect(traitInteractionLaneMapAttr(laneMap)).toBe('shard:1>guard:1>tool:1>risk:2>block:1>recall:1');
        expect(traitInteractionLaneActionMapAttr(laneMap)).toBe(
            'shard:Cash shard:1>guard:Protect run:1>tool:Use tool:1>risk:Watch hazard:2>block:Deny match:1>recall:Set memory:1'
        );
        expect(formatTraitInteractionLaneMapLabel('Trait interaction lanes', laneMap)).toBe(
            'Trait interaction lanes. Shard: 1. Cash shard. Conduit + Echo: peek spark. Guard: 1. Protect run. Braced guard ward. Tool: 1. Use tool. Shuffle charge primed. Risk: 2. Watch hazard. Danger pressure. Block: 1. Deny match. Conduit + Stasis: lock pulse. Recall: 1. Set memory. Echo recall focus.'
        );
        expect(getTraitInteractionLaneAction('block')).toBe('Deny match');
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
            { id: 'shard', label: 'Shard', count: 1, cue: 'Conduit + Echo: peek spark' }
        ]);
    });
});
