import { describe, expect, it } from 'vitest';

import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    getTraitInteractionLaneId,
    getTraitInteractionLaneRole,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr,
    traitInteractionLaneRoleMapAttr
} from './traitInteractionLaneMap';

describe('traitInteractionLaneMap', () => {
    it('groups trait interaction copy into stable visible lanes', () => {
        const laneMap = buildTraitInteractionLaneMap([
            'Echo + Sealed: combo shard',
            'Mirror + Stasis: guard ward',
            'Shuffle charge primed',
            'Volatile curse pressure',
            'Stasis buffered Sealed',
            'Echo + Mirror: recall focus',
            'Perk pop: Cursed Opener pays gold'
        ]);

        expect(laneMap).toEqual([
            { id: 'shard', label: 'Shard', count: 1, cue: 'Echo + Sealed: combo shard' },
            { id: 'guard', label: 'Guard', count: 1, cue: 'Mirror + Stasis: guard ward' },
            { id: 'tool', label: 'Tool', count: 1, cue: 'Shuffle charge primed' },
            { id: 'risk', label: 'Risk', count: 2, cue: 'Volatile curse pressure' },
            { id: 'block', label: 'Block', count: 1, cue: 'Stasis buffered Sealed' },
            { id: 'recall', label: 'Recall', count: 1, cue: 'Echo + Mirror: recall focus' }
        ]);
        expect(traitInteractionLaneMapAttr(laneMap)).toBe('shard:1>guard:1>tool:1>risk:2>block:1>recall:1');
        expect(traitInteractionLaneActionMapAttr(laneMap)).toBe(
            'shard:Cash shard:1>guard:Protect run:1>tool:Use tool:1>risk:Watch hazard:2>block:Deny match:1>recall:Set memory:1'
        );
        expect(traitInteractionLaneRoleMapAttr(laneMap)).toBe(
            'shard:Cashout:1>guard:Protect:1>tool:Tool:1>risk:Risk:2>block:Block:1>recall:Recall:1'
        );
        expect(formatTraitInteractionLaneMapLabel('Trait interaction lanes', laneMap)).toBe(
            'Trait interaction lanes. Shard Cashout x1. Cash shard. Echo + Sealed: combo shard. Guard Protect x1. Protect run. Mirror + Stasis: guard ward. Tool Tool x1. Use tool. Shuffle charge primed. Risk Risk x2. Watch hazard. Volatile curse pressure. Block Block x1. Deny match. Stasis buffered Sealed. Recall Recall x1. Set memory. Echo + Mirror: recall focus.'
        );
        expect(getTraitInteractionLaneAction('block')).toBe('Deny match');
        expect(getTraitInteractionLaneRole({ id: 'block' })).toBe('Block');
    });

    it('keeps block ahead of recall for pure lockout effects', () => {
        expect(getTraitInteractionLaneId('Sealed card blocks next match')).toBe('block');
        expect(getTraitInteractionLaneId('Echo mirror recall focus')).toBe('recall');
        expect(getTraitInteractionLaneId('Plain score bump')).toBe('score');
    });
});
