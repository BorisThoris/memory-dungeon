/**
 * User-visible strings for the milestone relic draft (GameScreen + RelicDraftOfferPanel).
 * Centralized for a11y review and future i18n (RDUI-007).
 */
import type { RelicId, RelicOfferState, RunState } from '../../shared/contracts';
import { hasRelicDraftOptionReasons } from '../../shared/relics';

/**
 * The sealed offering. Its whole job is to be honest about what is being traded — the card cannot
 * say what it is, so it has to say exactly what kind of thing it is and what you give up to take
 * it, or it reads as a shrug rather than a gamble.
 */
export const SEALED_RELIC_COPY = {
    tier: 'Sealed',
    title: 'A sealed offering',
    effect: 'Nobody has opened this one. It leans rarer than what is on the table.',
    impact: 'You do not get to know whether it suits the run you are actually in.',
    /** Said the moment it lands, because a gamble with no reveal is just a slower click. */
    revealed: (title: string): string => `The seal comes off: ${title}.`
} as const;

export const relicEffectLabels: Record<RelicId, string> = {
    extra_shuffle_charge: '+1 archive shuffle charge for trap halls (now)',
    first_shuffle_free_per_floor: 'First full-board shuffle each dungeon floor costs no charge',
    memorize_bonus_ms: 'Longer study window before patrol, trap, and room reads hide',
    destroy_bank_plus_one: '+1 breaker charge for trap control (now)',
    combo_shard_plus_step: 'Clean recall starts closer to combo-shard momentum',
    memorize_under_short_memorize: '+220ms scout time when Short memorize compresses the floor',
    parasite_ward_once: 'Ignore the next score-parasite life loss once',
    region_shuffle_free_first: 'First row shuffle or tile swap each dungeon floor costs no charge',
    peek_charge_plus_one: '+1 peek charge for Mystery rooms and hidden archives (now)',
    stray_charge_plus_one: '+1 stray remover charge for awkward route layouts (now)',
    pin_cap_plus_one: '+1 pinned memory mark on the dungeon board',
    guard_token_plus_one: '+1 guard token for enemy contact and recall slips (now, capped)',
    shrine_echo: 'Next relic milestone echoes into +1 extra selection',
    chapter_compass: '+1 peek now; future Endless drafts lean toward boss, chapter, and mutator answers',
    wager_surety: '+1 guard now; risk wagers pay +1 Favor and soften boss-route busts',
    parasite_ledger: '+1 parasite ward now; successful parasite floors slow the next parasite tax',
    opening_ledger: 'Every floor pays bonus score for the first match you resolve',
    tithe_conduit: 'Every Conduit match pays shop gold and score',
    bulwark_plate: 'Every Heavy match braces into a guard token, or score once guard is capped',
    stasis_broker: 'Every Stasis match buys a full-board shuffle charge',
    echo_relay: 'An Echo match beside Heavy grants a flash pair',
    drift_appraiser: 'A Drift match beside Cursed pays 2 gold and score'
};

/**
 * Display-only visit budget for the current `relicOffer` (not extra `RunState` fields).
 * Matches the state machine: `total = picksRemaining + pickRound` (selections remaining including this round,
 * plus completed rounds this visit). See `docs/epics/relic-draft-fluid-system/02-state-machine.md`.
 */
export function getRelicDraftVisitTotals(offer: RelicOfferState): { total: number; currentPick: number } {
    const total = offer.picksRemaining + offer.pickRound;
    const currentPick = total - offer.picksRemaining + 1;
    return { total, currentPick };
}

export function getRelicOfferTitle(tier: number): string {
    return `Relic draft · tier ${tier}`;
}

export function getRelicOfferSubtitle(
    clearedFloor: number,
    picksRemaining: number
): string {
    if (picksRemaining > 1) {
        return `Floor ${clearedFloor} cleared. Pick ${picksRemaining} relics — each applies immediately; new options after each pick.`;
    }
    return `Floor ${clearedFloor} cleared. Choose one relic — it applies immediately for the rest of the run.`;
}

/** Shown when this visit grants more than one pick. */
export function relicDraftProgressLine(offer: RelicOfferState): string | null {
    const { total, currentPick } = getRelicDraftVisitTotals(offer);
    if (total <= 1) {
        return null;
    }
    return `Pick ${currentPick} of ${total} this visit`;
}

export function relicDraftRoundAdvancedAnnouncement(): string {
    return 'The shrine redraws new relic choices.';
}

/**
 * When multiple picks are available, explain likely sources (no formula duplication).
 * See docs/epics/relic-draft-fluid-system/03-bonus-sources.md
 */
export function buildRelicDraftBonusFootnoteLines(run: RunState): string[] {
    const offer = run.relicOffer;
    if (!offer) {
        return [];
    }
    const { total } = getRelicDraftVisitTotals(offer);

    const lines: string[] = [];

    if (hasRelicDraftOptionReasons(offer.contextualOptionReasons)) {
        lines.push('At least one choice is chapter-aligned for this Endless route.');
    }

    if (total <= 1) {
        return lines;
    }

    if ((offer.favorBonusPicks ?? 0) > 0) {
        lines.push(
            `Featured-objective favor: +${offer.favorBonusPicks} relic ${
                offer.favorBonusPicks === 1 ? 'choice' : 'choices'
            } banked into this shrine.`
        );
    }
    if (run.activeContract?.bonusRelicDraftPick) {
        lines.push('Scholar contract: +1 choice at this shrine.');
    }
    if (run.metaRelicDraftExtraPerMilestone > 0) {
        lines.push('Meta unlock: +1 relic choice at each milestone.');
    }
    if (run.dailyDateKeyUtc) {
        lines.push('Daily: extra pick when the schedule grants it.');
    }
    if (run.activeMutators.includes('generous_shrine')) {
        lines.push('Generous Shrine mutator: +1 relic pick on this floor.');
    }

    return lines;
}
