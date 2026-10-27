import { CARVE_LINKS } from '../../shared/carve-rules';
import { HOLD_METER_SEGMENTS } from '../../shared/hold-rules';
import { REPRISE_TURNS } from '../../shared/reprise-rules';
import type { StaircaseVerb } from '../../shared/verb-staircase-rules';
import type { GateOmen } from '../../shared/run-signature-rules';
import type { MatchRuleId } from '../../shared/match-rule-rules';

/** The verb staircase (`verb-staircase-rules.ts`): the line on the board crown on the floor a verb arrives. */
export const VERB_ARRIVAL_COPY = {
    kicker: (verb: StaircaseVerb): string => `New: ${verb === 'hold' ? 'Hold' : verb === 'carve' ? 'Carve' : 'Reprise'}`,
    line: (verb: StaircaseVerb): string =>
        verb === 'hold'
            ? `${HOLD_METER_SEGMENTS} links of chain arm it. Hold, keep matching, then Release: every held pair breaks at once.`
            : verb === 'carve'
              ? `Spend ${CARVE_LINKS} links of the Hold meter to aim your next pop: it takes that side first and reaches further.`
              : `Once a floor, after good turns: your last ${REPRISE_TURNS} turns pay again, scores and chain.`
} as const;

/** A run's omen (`run-signature-rules.ts`): told on the board crown the floor it first shows. */
export const GATE_OMEN_COPY = {
    kicker: (count: number): string => (count > 1 ? 'Two omens' : 'An omen'),
    line: (omen: GateOmen): string =>
        omen === 'wanderer'
            ? 'A Wanderer walks this run’s Gate: one pair a floor steps a cell every third turn, and leaves a footprint.'
            : omen === 'mask'
              ? 'A mask is on this run’s Gate: one back a floor lies about its element, until you turn it.'
              : 'A Sleeper lies in this run’s Gate: one pair a floor goes back down when you turn it, and wakes in another cell.',
    /** The results screen, the run a family joins the omens (`discoveryAt`). */
    discovered: (omen: GateOmen | null, secondOmen: boolean): string | null =>
        omen
            ? `The dungeon remembers you: from your next run, ${omen === 'sleeper' ? 'Sleepers' : omen === 'mask' ? 'masks' : 'Wanderers'} can walk the Gate.`
            : secondOmen
              ? 'The dungeon remembers you: from your next run, two omens walk the Gate.'
              : null
} as const;

/** A floor's match rule (`match-rule-rules.ts`): told on the board crown for the whole floor. */
export const MATCH_RULE_COPY = {
    kicker: (rule: MatchRuleId): string => (rule === 'opposites' ? 'Opposites' : rule === 'triples' ? 'Triples' : rule === 'sequences' ? 'Sequences' : 'Element pairs'),
    line: (rule: MatchRuleId): string =>
        rule === 'opposites'
            ? 'Every pair is one picture in two opposite elements: ember with tide, moss with bone. A card’s partner wears the other colour.'
            : rule === 'triples'
              ? 'Cards with three pips on the back come in threes. Turn two of a three and they wait face up: the third claims all three, any other card is a miss.'
              : rule === 'sequences'
                ? 'Some pictures come in threes, numbered by the pips on their backs. Turn one, two, three of one picture, in that order, to claim them; out of order is a miss.'
              : 'Any two cards of one element are a pair, whatever the picture. The backs keep their element hidden: remember the colours you turn. Marked cards keep their own partner.',
    /** Said while two of a three wait face up for their third. */
    waiting: 'Two of three: turn the third.',
    /** Said while a Sequences one and two wait for their three. */
    waitingInOrder: 'One, two: now the three.'
} as const;
