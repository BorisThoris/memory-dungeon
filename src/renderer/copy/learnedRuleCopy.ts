import type { LearnedRule } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';

/** The dungeon learns you (`learned-rule-rules.ts`, DGE-022): what the floor says it learned, before the first flip. */
export const LEARNED_RULE_COPY = {
    kicker: 'It learned you',
    line: (rule: LearnedRule): string => {
        const element = ELEMENT_NAMES[rule.suit];
        const learned = `You match ${element} most.`;
        if (rule.id === 'masked_suit') return `${learned} This floor, ${element} cards hide behind masks.`;
        if (rule.id === 'wandering_suit') return `${learned} This floor, the Wanderers are ${element} cards.`;
        return `${learned} This floor, the Sleepers are ${element} pairs.`;
    }
} as const;
