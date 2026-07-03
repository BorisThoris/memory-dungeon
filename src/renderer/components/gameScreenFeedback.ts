import type { RunState } from '../../shared/contracts';

export type VisualHudAnnouncementSignalTone = 'chain' | 'reward' | 'risk' | 'guard' | 'trait' | 'objective' | 'info';

export interface VisualHudAnnouncementSignal {
    label: string;
    tone: VisualHudAnnouncementSignalTone;
}

export interface VisualHudAnnouncementDetail {
    label: string;
    tone: VisualHudAnnouncementSignalTone;
}

export interface VisualHudAnnouncementImpact {
    burstTier: 'none' | 'chain' | 'reward' | 'combo' | 'risk' | 'trait';
    details: VisualHudAnnouncementDetail[];
    level: 'low' | 'medium' | 'high';
}

export const getStackCashoutLaneCount = (labels: readonly string[]): number =>
    [
        labels.some(
            (label) =>
                /^Chain x/i.test(label) ||
                label === 'Shard cashout' ||
                label === 'One-away cashout' ||
                label === 'Cashout armed'
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
        normalized.includes('life lost') ||
        normalized.includes('lost reward target') ||
        normalized.includes('reward lost') ||
        normalized.includes('no match') ||
        normalized.includes('shuffle snare fired') ||
        normalized.includes('mirror decoy') ||
        normalized.includes('fragile cache broke') ||
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
        normalized.includes('reward') ||
        normalized.includes('shop gold') ||
        normalized.includes('combo shard') ||
        normalized.includes('favor') ||
        normalized.includes('cascade cache fired') ||
        normalized.includes('toll cache claimed') ||
        normalized.includes('fuse cache claimed late')
    ) {
        return { label: 'Reward', tone: 'reward' };
    }
    if (normalized.includes('guard token') || normalized.includes('ward blocked') || normalized.includes('hazard warded')) {
        return { label: 'Guard', tone: 'guard' };
    }
    if (normalized.includes('trait') || normalized.includes('perk pop')) {
        return { label: 'Trait', tone: 'trait' };
    }
    if (normalized.includes('objective') || normalized.includes('exit is ready') || normalized.includes('match resolved')) {
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
    const hasFutureRewardSetup =
        normalizedAnnouncement.includes('combo setup') ||
        normalizedAnnouncement.includes('guard setup') ||
        normalizedAnnouncement.includes('heal setup') ||
        normalizedAnnouncement.includes('combo prime') ||
        normalizedAnnouncement.includes('guard prime') ||
        normalizedAnnouncement.includes('heal prime');
    const hasImmediateRewardTarget =
        normalizedAnnouncement.includes('one-away cashout') ||
        normalizedAnnouncement.includes('one-away guard') ||
        normalizedAnnouncement.includes('one-away heal') ||
        normalizedAnnouncement.includes('cashout armed');

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
    if (normalizedAnnouncement.includes('lost reward target') || normalizedAnnouncement.includes('reward lost')) {
        pushUniqueDetail(details, { label: 'Lost reward', tone: 'risk' });
    }
    if (normalizedAnnouncement.includes('next chase')) {
        pushUniqueDetail(details, { label: 'Next chase', tone: 'chain' });
    }
    if (/\b(?:combo\s+)?shards?\b/.test(normalizedAnnouncement)) {
        const shardLabel = normalizedAnnouncement.includes('spent')
            ? 'Shard spent'
            : hasFutureRewardSetup && !hasImmediateRewardTarget
              ? 'Shard setup'
              : chainLabel || normalizedAnnouncement.includes('cashout') || normalizedAnnouncement.includes('complete') || normalizedAnnouncement.includes('gained')
              ? 'Shard cashout'
              : '+Shard';
        pushUniqueDetail(details, { label: shardLabel, tone: 'reward' });
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
    if (normalizedAnnouncement.includes('one-away cashout')) {
        pushUniqueDetail(details, { label: 'One-away cashout', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('cashout armed')) {
        pushUniqueDetail(details, { label: 'Cashout armed', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('one-away guard')) {
        pushUniqueDetail(details, { label: 'One-away guard', tone: 'guard' });
    } else if (normalizedAnnouncement.includes('one-away heal')) {
        pushUniqueDetail(details, { label: 'One-away heal', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('combo setup') || normalizedAnnouncement.includes('combo prime')) {
        pushUniqueDetail(details, { label: 'Combo prime', tone: 'reward' });
    } else if (normalizedAnnouncement.includes('guard setup') || normalizedAnnouncement.includes('guard prime')) {
        pushUniqueDetail(details, { label: 'Guard prime', tone: 'guard' });
    } else if (normalizedAnnouncement.includes('heal setup') || normalizedAnnouncement.includes('heal prime')) {
        pushUniqueDetail(details, { label: 'Heal prime', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('shop gold') || normalizedAnnouncement.includes('gold')) {
        pushUniqueDetail(details, { label: '+Gold', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('favor')) {
        pushUniqueDetail(details, { label: '+Favor', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('life restored')) {
        pushUniqueDetail(details, { label: '+Life', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('claimed:') || normalizedAnnouncement.includes('pickup')) {
        pushUniqueDetail(details, { label: 'Pickup', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('guard token') || normalizedAnnouncement.includes('ward blocked') || normalizedAnnouncement.includes('hazard warded')) {
        const guardLabel = normalizedAnnouncement.includes('spent')
            ? 'Guard spent'
            : normalizedAnnouncement.includes('gained')
              ? '+Guard'
              : 'Guarded';
        pushUniqueDetail(details, { label: guardLabel, tone: 'guard' });
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
    if (normalizedAnnouncement.includes('cascade cache fired')) {
        pushUniqueDetail(details, { label: 'Hazard payoff', tone: 'reward' });
        pushUniqueDetail(details, { label: 'Auto-clear', tone: 'chain' });
    } else if (
        normalizedAnnouncement.includes('shuffle snare fired') ||
        normalizedAnnouncement.includes('mirror decoy') ||
        normalizedAnnouncement.includes('fragile cache broke')
    ) {
        pushUniqueDetail(details, { label: 'Hazard trigger', tone: 'risk' });
    } else if (normalizedAnnouncement.includes('toll cache claimed') || normalizedAnnouncement.includes('fuse cache claimed late')) {
        pushUniqueDetail(details, { label: 'Hazard payout', tone: 'reward' });
    }
    if (normalizedAnnouncement.includes('moving enemy defeated') || normalizedAnnouncement.includes('dungeon enemy defeated')) {
        pushUniqueDetail(details, { label: 'Threat down', tone: 'guard' });
    }
    if (priority === 'error' || normalizedAnnouncement.includes('life lost') || normalizedAnnouncement.includes('no match')) {
        pushUniqueDetail(details, { label: normalizedAnnouncement.includes('no match') ? 'Miss' : 'Life lost', tone: 'risk' });
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
    remainingPairCount,
    lives
}: {
    announcement: string;
    priority: 'info' | 'error';
    runStatus: RunState['status'];
    remainingPairCount: number;
    lives: number;
}): string | null => {
    if (!announcement) {
        return null;
    }
    const normalizedAnnouncement = announcement.toLowerCase();

    if (runStatus === 'gameOver') {
        if (
            normalizedAnnouncement.includes('moving enemy contact') ||
            normalizedAnnouncement.includes('life lost') ||
            normalizedAnnouncement.includes('mimic cache bit')
        ) {
            return 'Next: review the run summary before starting the next descent.';
        }
        return null;
    }

    if (runStatus !== 'playing') {
        return null;
    }

    if (remainingPairCount === 0) {
        return 'Next: exit is ready.';
    }

    if (normalizedAnnouncement.includes('moving enemy contact')) {
        return lives <= 1
            ? 'Next: track the patrol path before risking the last life.'
            : 'Next: pause on the patrol path and choose a safe pair away from it.';
    }

    if (normalizedAnnouncement.includes('moving enemy defeated') || normalizedAnnouncement.includes('moving enemies defeated')) {
        return 'Next: threat removed; use the opened space to clear confirmed pairs.';
    }

    if (normalizedAnnouncement.includes('dungeon enemy defeated') || normalizedAnnouncement.includes('dungeon enemies defeated')) {
        return 'Next: pressure is down; keep clearing confirmed pairs.';
    }

    if (normalizedAnnouncement.includes('lost reward target') || normalizedAnnouncement.includes('reward lost')) {
        return 'Next: rebuild from a confirmed pair before chasing the lost reward again.';
    }

    if (normalizedAnnouncement.includes('chain') && normalizedAnnouncement.includes('broken')) {
        return 'Next: rebuild from a confirmed pair before chasing rewards.';
    }

    if (normalizedAnnouncement.includes('mimic cache bit')) {
        return lives <= 1
            ? 'Next: recover control before touching another risky cache.'
            : 'Next: treat unknown cache pairs as dangerous until confirmed.';
    }

    if (normalizedAnnouncement.includes('life lost')) {
        return lives <= 1
            ? 'Next: protect the last life before taking risks.'
            : 'Next: slow down and protect remaining lives.';
    }

    if (normalizedAnnouncement.includes('life restored')) {
        return 'Next: extra life secured; spend it only on controlled risks.';
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

    if (normalizedAnnouncement.includes('cashout armed')) {
        return 'Next: cashout is armed; take the safest confirmed match now.';
    }

    if (
        normalizedAnnouncement.includes('next reward') &&
        (normalizedAnnouncement.includes('combo setup') ||
            normalizedAnnouncement.includes('guard setup') ||
            normalizedAnnouncement.includes('heal setup') ||
            normalizedAnnouncement.includes('combo prime') ||
            normalizedAnnouncement.includes('guard prime') ||
            normalizedAnnouncement.includes('heal prime'))
    ) {
        return 'Next: prime the cashout with the safest confirmed match.';
    }

    if (
        normalizedAnnouncement.includes('next reward') &&
        (normalizedAnnouncement.includes('one-away cashout') ||
            normalizedAnnouncement.includes('one-away guard') ||
            normalizedAnnouncement.includes('one-away heal'))
    ) {
        return 'Next: cashout is one match away; take the safest confirmed match.';
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

    if (normalizedAnnouncement.includes('no match')) {
        return 'Next: cards reset; pick a remembered pair.';
    }

    if (normalizedAnnouncement.includes('guard token spent')) {
        return 'Next: guard absorbed the mistake; keep lives protected.';
    }

    if (normalizedAnnouncement.includes('guard token') && normalizedAnnouncement.includes('gained')) {
        return 'Next: guard can absorb the next unsafe hit before lives drop.';
    }

    if (normalizedAnnouncement.includes('guard cache ward blocked')) {
        return 'Next: hazard blocked; continue from the best safe match.';
    }

    if (normalizedAnnouncement.includes('lantern ward scouted')) {
        return 'Next: use the revealed threat marker to route around danger.';
    }

    if (normalizedAnnouncement.includes('omen seal revealed')) {
        return 'Next: treat the marked danger as known information before flipping.';
    }

    if (normalizedAnnouncement.includes('anchor seal')) {
        return 'Next: pressure is frozen; clear the best confirmed pair now.';
    }

    if (normalizedAnnouncement.includes('loaded gateway')) {
        return 'Next: finish this floor knowing the next route is prepared.';
    }

    if (normalizedAnnouncement.includes('catalyst altar')) {
        return 'Next: shard value converted; reassess remaining power charges.';
    }

    if (normalizedAnnouncement.includes('parasite vessel')) {
        return 'Next: pressure is reduced; keep the parasite answer controlled.';
    }

    if (normalizedAnnouncement.includes('pin lattice')) {
        return 'Next: planning paid out; preserve pins for uncertain pairs.';
    }

    if (normalizedAnnouncement.includes('mimic cache controlled')) {
        return 'Next: full loot is secured; resume clearing safe pairs.';
    }

    if (normalizedAnnouncement.includes('shuffle snare fired')) {
        return 'Next: board order changed; recheck positions before pairing.';
    }

    if (normalizedAnnouncement.includes('cascade cache fired')) {
        return 'Next: one safe pair cleared itself; update your mental map.';
    }

    if (normalizedAnnouncement.includes('mirror decoy')) {
        return 'Next: ignore the decoy result and return to confirmed pairs.';
    }

    if (normalizedAnnouncement.includes('fragile cache broke')) {
        return 'Next: reward broke, but the pair still counts as cleared.';
    }

    if (normalizedAnnouncement.includes('fuse cache claimed late')) {
        return 'Next: late fuse still pays consolation gold; clear safer pairs.';
    }

    if (normalizedAnnouncement.includes('toll cache claimed')) {
        return 'Next: gold gained, score toll paid; continue toward the exit.';
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

    if (normalizedAnnouncement.includes('combo shard')) {
        return 'Next: spend shards on powers when the board gets risky.';
    }

    if (normalizedAnnouncement.includes('shop gold')) {
        return 'Next: bank gold for shops, rests, or route events.';
    }

    if (normalizedAnnouncement.includes('match resolved')) {
        return `Next: ${remainingPairCount} ${remainingPairCount === 1 ? 'pair' : 'pairs'} left.`;
    }

    if (normalizedAnnouncement.includes('gambit')) {
        return 'Next: take the third flip only if the wager is worth it.';
    }

    if (priority === 'error' && lives > 0) {
        return lives === 1
            ? 'Next: protect the last life before taking risks.'
            : 'Next: slow down and protect remaining lives.';
    }

    return null;
};

export interface DungeonCombatLogRow {
    id: string;
    label: string;
    detail: string;
    tone: 'danger' | 'success' | 'info';
}

const pluralCombatLogLabel = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count} ${count === 1 ? singular : plural}`;

export const getDungeonCombatLogRows = (run: RunState): DungeonCombatLogRow[] => {
    const rows: DungeonCombatLogRow[] = [];

    if (run.enemyHazardHitsThisFloor > 0) {
        rows.push({
            id: 'patrol-contact',
            label: pluralCombatLogLabel(run.enemyHazardHitsThisFloor, 'patrol contact'),
            detail: run.lives <= 1 ? 'Critical health; avoid the next patrol path.' : 'Track the next patrol tile before flipping nearby.',
            tone: 'danger'
        });
    }

    if (run.enemyHazardsDefeatedThisFloor > 0) {
        rows.push({
            id: 'patrol-defeats',
            label: pluralCombatLogLabel(run.enemyHazardsDefeatedThisFloor, 'patrol defeated', 'patrols defeated'),
            detail: 'Moving threat removed from this floor.',
            tone: 'success'
        });
    }

    if (run.dungeonEnemiesDefeatedThisFloor > 0) {
        rows.push({
            id: 'dungeon-enemy-defeats',
            label: pluralCombatLogLabel(run.dungeonEnemiesDefeatedThisFloor, 'enemy pair defeated', 'enemy pairs defeated'),
            detail: 'Dungeon objective pressure converted into progress.',
            tone: 'success'
        });
    }

    if (run.safeHazardWardsUsedThisFloor > 0) {
        rows.push({
            id: 'ward-blocks',
            label: `${run.safeHazardWardsUsedThisFloor} hazard warded`,
            detail: 'A ward absorbed a trap or cache effect.',
            tone: 'info'
        });
    }

    return rows.slice(0, 4);
};
