import { CARVE_LINKS } from '../../shared/carve-rules';
import { HOLD_METER_SEGMENTS } from '../../shared/hold-rules';
import { REPRISE_TURNS } from '../../shared/reprise-rules';
import type { StaircaseVerb } from '../../shared/verb-staircase-rules';
import type { GateOmen } from '../../shared/run-signature-rules';

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
