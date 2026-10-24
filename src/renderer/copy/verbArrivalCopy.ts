import { CARVE_LINKS } from '../../shared/carve-rules';
import { HOLD_METER_SEGMENTS } from '../../shared/hold-rules';
import { REPRISE_TURNS } from '../../shared/reprise-rules';
import type { StaircaseVerb } from '../../shared/verb-staircase-rules';

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
