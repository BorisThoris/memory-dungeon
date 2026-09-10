/*
 * Gen 201 removed twenty-one branches from this file.
 *
 * Everything here keys off the text of a run announcement, so a branch survives exactly as long as
 * something can still say the words it is watching for. Twenty-one could not: guard caches and
 * lantern wards, omen and anchor seals, loaded gateways, mimic caches, shuffle snares, cascade,
 * fragile, toll and fuse caches, shop gold, hazard wards, moving and dungeon enemies, and the exit
 * being ready. Every one of those left with the dungeon layer and the hazards, and no code path in
 * the game has produced any of them since Gen 176.
 *
 * They were not harmless. Each was a sentence of in-run advice - "pause on the patrol path",
 * "bank gold for shops, rests, or route events" - waiting to tell a player to manage something the
 * game does not have. Checked mechanically: collect every string the shipping code can emit, and
 * a branch whose needle appears nowhere in that corpus cannot fire.
 */
import type { RunState } from '../../shared/contracts';

export type VisualHudAnnouncementSignalTone = 'chain' | 'reward' | 'risk' | 'guard' | 'trait' | 'objective' | 'info';

interface VisualHudAnnouncementSignal {
    label: string;
    tone: VisualHudAnnouncementSignalTone;
}

export interface VisualHudAnnouncementDetail {
    label: string;
    tone: VisualHudAnnouncementSignalTone;
}

interface VisualHudAnnouncementImpact {
    burstTier: 'none' | 'chain' | 'reward' | 'combo' | 'risk' | 'trait';
    details: VisualHudAnnouncementDetail[];
    level: 'low' | 'medium' | 'high';
}

export const getStackCashoutLaneCount = (labels: readonly string[]): number =>
    [
        labels.some(
            (label) =>
                /^Chain x/i.test(label)
        ),
        labels.includes('Pickup') || labels.includes('Pickup cashout'),
        labels.includes('Route paid') || labels.includes('Route cashout'),
        labels.includes('Trait cashout') || labels.includes('Perk pop'),
        labels.includes('Stack cashout') || labels.includes('Super stack')
    ].filter(Boolean).length;

const chainWordToNumber: Record<string, number> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
};

export const getVisualHudAnnouncementSignal = (
    announcement: string,
    priority: 'info' | 'error'
): VisualHudAnnouncementSignal | null => {
    if (!announcement) {
        return null;
    }
    const normalized = announcement.toLowerCase();
    if (
        priority === 'error' ||
        normalized.includes('no match') ||
        (normalized.includes('chain') && normalized.includes('broken'))
    ) {
        return { label: 'Risk', tone: 'risk' };
    }
    if (
        normalized.includes('chain times') ||
        normalized.includes('chain started') ||
        normalized.includes('surge hit') ||
        normalized.includes('combo hit') ||
        normalized.includes('streak') ||
        normalized.includes('chain cascade')
    ) {
        return { label: 'Chain', tone: 'chain' };
    }
    if (
        normalized.includes('reward cascade') ||
        normalized.includes('combo cascade') ||
        normalized.includes('claimed:') ||
        normalized.includes('cashout') ||
        normalized.includes('reward')
    ) {
        return { label: 'Reward', tone: 'reward' };
    }
    if (normalized.includes('trait') || normalized.includes('perk pop')) {
        return { label: 'Trait', tone: 'trait' };
    }
    if (normalized.includes('objective') || normalized.includes('match resolved')) {
        return { label: 'Objective', tone: 'objective' };
    }
    return { label: 'Action', tone: 'info' };
};

const pushUniqueDetail = (
    details: VisualHudAnnouncementDetail[],
    detail: VisualHudAnnouncementDetail
): void => {
    if (!details.some((existing) => existing.label === detail.label && existing.tone === detail.tone)) {
        details.push(detail);
    }
};

const getChainMultiplierLabel = (normalizedAnnouncement: string): string | null => {
    const numericMatch = normalizedAnnouncement.match(/chain(?:\s+times|\s+x| x)(?:\s*)(\d+)/i);
    if (numericMatch?.[1]) {
        return `x${numericMatch[1]}`;
    }

    const milestoneMatch = normalizedAnnouncement.match(/\b(?:chain started|surge hit|combo hit):\s*x(\d+)\b/i);
    if (milestoneMatch?.[1]) {
        return `x${milestoneMatch[1]}`;
    }

    const wordMatch = normalizedAnnouncement.match(/chain times ([a-z]+)/i);
    const wordValue = wordMatch?.[1] ? chainWordToNumber[wordMatch[1]] : undefined;
    return wordValue ? `x${wordValue}` : null;
};

export const getVisualHudAnnouncementImpact = (
    announcement: string,
    priority: 'info' | 'error'
): VisualHudAnnouncementImpact => {
    const details: VisualHudAnnouncementDetail[] = [];
    if (!announcement) {
        return { burstTier: 'none', details, level: 'low' };
    }

    const normalizedAnnouncement = announcement.toLowerCase();
    const chainLabel = getChainMultiplierLabel(normalizedAnnouncement);

    if (chainLabel) {
        pushUniqueDetail(details, { label: `Chain ${chainLabel}`, tone: 'chain' });
    } else if (/\b\d+\s+match streak\b|\bstreak\s+x?\d+\b|\bcurrent streak\b|\bstreak live\b/.test(normalizedAnnouncement)) {
        pushUniqueDetail(details, { label: 'Streak live', tone: 'chain' });
    }
    if (normalizedAnnouncement.includes('combo cascade')) {
        pushUniqueDetail(details, { label: 'Combo cascade', tone: 'chain' });
        pushUniqueDetail(details, { label: 'Reward cascade', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('reward cascade')) {
        pushUniqueDetail(details, { label: 'Reward cascade', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('chain cascade')) {
        pushUniqueDetail(details, { label: 'Chain cascade', tone: 'chain' });
    }
    if (normalizedAnnouncement.includes('chain') && normalizedAnnouncement.includes('broken')) {
        pushUniqueDetail(details, { label: 'Chain break', tone: 'risk' });
    }
    if (normalizedAnnouncement.includes('super stack')) {
        pushUniqueDetail(details, { label: 'Super stack', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('payoff stack')) {
        pushUniqueDetail(details, { label: 'Payoff stack', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('stack cashout')) {
        pushUniqueDetail(details, { label: 'Stack cashout', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('cashout hit')) {
        pushUniqueDetail(details, { label: 'Cashout hit', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('reward cashout')) {
        pushUniqueDetail(details, { label: 'Reward cashout', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('perk pop')) {
        pushUniqueDetail(details, { label: 'Perk pop', tone: 'trait' });
    }
    if (normalizedAnnouncement.includes('trait cashout')) {
        pushUniqueDetail(details, { label: 'Trait cashout', tone: 'trait' });
    } else if (normalizedAnnouncement.includes('trait surge') || normalizedAnnouncement.includes('trait combo surge')) {
        pushUniqueDetail(details, { label: 'Trait surge', tone: 'trait' });
    }
    if (normalizedAnnouncement.includes('pickup cashout')) {
        pushUniqueDetail(details, { label: 'Pickup cashout', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('route cashout')) {
        pushUniqueDetail(details, { label: 'Route cashout', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('combo hit')) {
        pushUniqueDetail(details, { label: 'Combo hit', tone: 'chain' });
    } else if (normalizedAnnouncement.includes('chain hit')) {
        pushUniqueDetail(details, { label: 'Chain hit', tone: 'chain' });
    }
    if (normalizedAnnouncement.includes('claimed:') || normalizedAnnouncement.includes('pickup')) {
        pushUniqueDetail(details, { label: 'Pickup', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('trait routes') || normalizedAnnouncement.includes('trait route')) {
        pushUniqueDetail(details, { label: normalizedAnnouncement.includes('complete') ? 'Route paid' : 'Route progress', tone: 'trait' });
    } else if (normalizedAnnouncement.includes('trait resolved')) {
        pushUniqueDetail(details, { label: 'Trait payoff', tone: 'trait' });
    } else if (normalizedAnnouncement.includes('trait penalty')) {
        pushUniqueDetail(details, { label: 'Trait penalty', tone: 'risk' });
    }
    if (normalizedAnnouncement.includes('objective')) {
        pushUniqueDetail(details, { label: normalizedAnnouncement.includes('missed') || normalizedAnnouncement.includes('failed') ? 'Objective missed' : 'Objective', tone: 'objective' });
    }
    if (priority === 'error' || normalizedAnnouncement.includes('no match')) {
        pushUniqueDetail(details, { label: 'Miss', tone: 'risk' });
    }
    if (
        normalizedAnnouncement.includes('no match') &&
        /\b(recover|rebuild|known pair|safe match|remembered pair|choose another opener)\b/.test(normalizedAnnouncement)
    ) {
        pushUniqueDetail(details, { label: 'Recover', tone: 'risk' });
    }
    if (normalizedAnnouncement.includes('gambit')) {
        pushUniqueDetail(details, { label: 'Gambit', tone: 'objective' });
    }

    const level =
        priority === 'error' ||
        details.some((detail) => detail.tone === 'risk') ||
        chainLabel === 'x5' ||
        chainLabel === 'x6' ||
        chainLabel === 'x7' ||
        chainLabel === 'x8' ||
        chainLabel === 'x9' ||
        chainLabel === 'x10'
            ? 'high'
            : details.length >= 2 || details.some((detail) => detail.label === 'Trait surge')
              ? 'medium'
              : 'low';

    const visibleDetails = details.slice(0, 4);
    const hasRisk = visibleDetails.some((detail) => detail.tone === 'risk');
    const hasChain = visibleDetails.some((detail) => detail.tone === 'chain');
    const hasReward = visibleDetails.some((detail) => detail.tone === 'reward' || detail.tone === 'guard');
    const hasTrait = visibleDetails.some((detail) => detail.tone === 'trait');
    const hasObjective = visibleDetails.some((detail) => detail.tone === 'objective');
    const burstTier =
        hasRisk
            ? 'risk'
            : hasChain && (hasReward || hasTrait || hasObjective)
              ? 'combo'
              : hasChain
                ? 'chain'
                : hasReward
                  ? 'reward'
                  : hasTrait
                    ? 'trait'
                  : 'none';

    return { burstTier, details: visibleDetails, level };
};

export const getVisualHudAnnouncementFollowup = ({
    announcement,
    priority,
    runStatus,
    remainingPairCount
}: {
    announcement: string;
    priority: 'info' | 'error';
    runStatus: RunState['status'];
    remainingPairCount: number;
}): string | null => {
    if (!announcement) {
        return null;
    }
    const normalizedAnnouncement = announcement.toLowerCase();

    if (runStatus === 'gameOver') {
        return null;
    }

    if (runStatus !== 'playing') {
        return null;
    }

    if (remainingPairCount === 0) {
        // Gen 201: this said "exit is ready". There is no exit - a floor ends when the board does.
        return 'Next: the floor is clear.';
    }

    if (normalizedAnnouncement.includes('chain') && normalizedAnnouncement.includes('broken')) {
        return 'Next: rebuild from a confirmed pair before chasing rewards.';
    }


    if (
        normalizedAnnouncement.includes('trait route prime found') ||
        normalizedAnnouncement.includes('trait route setup found')
    ) {
        return 'Next: use Swap on the marked cards to create the route.';
    }

    if (normalizedAnnouncement.includes('pickup cashout')) {
        return 'Next: pickup reward applied; keep the streak alive with a confirmed pair.';
    }

    if (normalizedAnnouncement.includes('route cashout')) {
        return 'Next: route value is banked; chase the safest chainable payoff.';
    }

    if (normalizedAnnouncement.includes('perk pop')) {
        return 'Next: perk payoff landed; route the next trait or chain cashout.';
    }

    if (normalizedAnnouncement.includes('trait cashout')) {
        return 'Next: trait payoff landed; look for the next connected trait card.';
    }

    if (
        (normalizedAnnouncement.includes('trait surge') || normalizedAnnouncement.includes('trait combo surge')) &&
        (normalizedAnnouncement.includes('risks') ||
            normalizedAnnouncement.includes('penalties applied') ||
            normalizedAnnouncement.includes('no match'))
    ) {
        return 'Next: multiple trait penalties landed; use the safest confirmed pair before touching that cluster again.';
    }

    if (normalizedAnnouncement.includes('combo cascade') || normalizedAnnouncement.includes('combo burst')) {
        return 'Next: combo burst landed; cash the safest remaining payoff before the chain cools.';
    }

    if (normalizedAnnouncement.includes('stack cashout')) {
        return 'Next: stacked payoff banked; protect the streak with a confirmed pair.';
    }

    if (normalizedAnnouncement.includes('reward cascade') || normalizedAnnouncement.includes('reward burst')) {
        return 'Next: reward burst landed; keep the payoff loop alive with a safe match.';
    }

    if (normalizedAnnouncement.includes('trait surge') || normalizedAnnouncement.includes('trait combo surge')) {
        return 'Next: trait surge landed; look for the next multi-trait route.';
    }

    if (normalizedAnnouncement.includes('trait routes')) {
        return normalizedAnnouncement.includes('complete')
            ? 'Next: route cashout banked; spend it when the board gets risky.'
            : 'Next: line up another trait interaction before the floor ends.';
    }

    // The line after a miss (thesis §67): the cards reset, pick a remembered pair, and nothing about
    // what it cost, because it cost nothing.
    if (normalizedAnnouncement.includes('no match')) {
        return 'Next: cards reset; pick a remembered pair.';
    }






    if (normalizedAnnouncement.includes('pin lattice')) {
        return 'Next: planning paid out; preserve pins for uncertain pairs.';
    }







    if (normalizedAnnouncement.includes('claimed:')) {
        return 'Next: pickup reward applied; keep clearing confirmed pairs.';
    }

    if (normalizedAnnouncement.includes('recall broken') || normalizedAnnouncement.includes('memory aid used')) {
        return 'Next: rebuild recall with a confirmed pair.';
    }

    if (normalizedAnnouncement.includes('chain times')) {
        return 'Next: preserve the streak with the best safe match.';
    }

    if (normalizedAnnouncement.includes('trait resolved') || normalizedAnnouncement.includes('trait penalty')) {
        return normalizedAnnouncement.includes('penalty')
            ? 'Next: trait penalty landed; rebuild from a confirmed pair.'
            : 'Next: trait payoff landed; look for the next chainable interaction.';
    }


    if (normalizedAnnouncement.includes('match resolved')) {
        return `Next: ${remainingPairCount} ${remainingPairCount === 1 ? 'pair' : 'pairs'} left.`;
    }

    if (normalizedAnnouncement.includes('gambit')) {
        return 'Next: take the third flip only if the wager is worth it.';
    }

    if (priority === 'error') {
        return 'Next: cards reset; pick a remembered pair.';
    }

    return null;
};
