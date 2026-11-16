import { tr } from '../../shared/i18n';
import { CARVE_LINKS } from '../../shared/carve-rules';
import { HOLD_METER_SEGMENTS } from '../../shared/hold-rules';
import { REPRISE_TURNS } from '../../shared/reprise-rules';
import type { StaircaseVerb } from '../../shared/verb-staircase-rules';
import type { GateOmen } from '../../shared/run-signature-rules';
import type { MatchRuleId } from '../../shared/match-rule-rules';

/** The verb staircase (`verb-staircase-rules.ts`): the line on the board crown on the floor a verb arrives. */
export const VERB_ARRIVAL_COPY = {
    kicker: (verb: StaircaseVerb): string => tr`New: ${verb === 'hold' ? tr.s('Hold') : verb === 'carve' ? tr.s('Carve') : tr.s('Reprise')}`,
    line: (verb: StaircaseVerb): string =>
        verb === 'hold'
            ? tr`${HOLD_METER_SEGMENTS} links of chain arm it. Hold, keep matching, then Release: every held pair breaks at once.`
            : verb === 'carve'
              ? tr`Spend ${CARVE_LINKS} links of the Hold meter to aim your next pop: it takes that side first and reaches further.`
              : tr`Once a floor, after good turns: your last ${REPRISE_TURNS} turns pay again, scores and chain.`
} as const;

/** A run's omen (`run-signature-rules.ts`): told on the board crown the floor it first shows. */
export const GATE_OMEN_COPY = {
    kicker: (count: number): string => (count > 1 ? tr.s('Two omens') : tr.s('An omen')),
    line: (omen: GateOmen): string =>
        omen === 'wanderer'
            ? tr.s('A Wanderer walks this run’s Gate: one pair a floor steps a cell every third turn, and leaves a footprint.')
            : omen === 'mask'
              ? tr.s('A mask is on this run’s Gate: one back a floor lies about its element, until you turn it.')
              : tr.s('A Sleeper lies in this run’s Gate: one pair a floor goes back down when you turn it, and wakes in another cell.'),
    /** The results screen, the run a family joins the omens (`discoveryAt`). */
    discovered: (omen: GateOmen | null, secondOmen: boolean): string | null =>
        omen
            ? tr`The dungeon remembers you: from your next run, ${omen === 'sleeper' ? tr.s('Sleepers') : omen === 'mask' ? 'masks' : tr.s('Wanderers')} can walk the Gate.`
            : secondOmen
              ? tr.s('The dungeon remembers you: from your next run, two omens walk the Gate.')
              : null
} as const;

/** A floor's match rule (`match-rule-rules.ts`): told on the board crown for the whole floor. */
export const MATCH_RULE_COPY = {
    kicker: (rule: MatchRuleId): string => (rule === 'opposites' ? tr.s('Opposites') : rule === 'triples' ? tr.s('Triples') : rule === 'sequences' ? tr.s('Sequences') : tr.s('Element pairs')),
    line: (rule: MatchRuleId): string =>
        rule === 'opposites'
            ? tr.s('Every pair is one picture in two opposite elements: ember with tide, moss with bone. A card’s partner wears the other colour.')
            : rule === 'triples'
              ? tr.s('Cards with three pips on the back come in threes. Turn two of a three and they wait face up: the third claims all three, any other card is a miss.')
              : rule === 'sequences'
                ? tr.s('Some pictures come in threes, numbered by the pips on their backs. Turn one, two, three of one picture, in that order, to claim them; out of order is a miss.')
              : tr.s('Any two cards of one element are a pair, whatever the picture. The backs keep their element hidden: remember the colours you turn. Marked cards keep their own partner.'),
    /** Said while two of a three wait face up for their third. */
    waiting: tr.s('Two of three: turn the third.'),
    /** Said while a Sequences one and two wait for their three. */
    waitingInOrder: tr.s('One, two: now the three.')
} as const;

/** The Flurry (`flurry-rules.ts`): told through a deep floor's study, while it can still grab. */
export const FLURRY_COPY = {
    kicker: tr.s('Flurry'),
    line: tr.s('Tap both cards of a pair while the faces are up and they are yours now. Two that are not a pair end the study.'),
    grabbed: (count: number): string => (count === 1 ? tr.s('One pair grabbed. Keep going, or stop and study.') : tr`${count} pairs grabbed. Keep going, or stop and study.`)
} as const;
