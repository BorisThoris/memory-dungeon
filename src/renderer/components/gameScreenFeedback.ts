import type { RunState } from '../../shared/contracts';

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

    if (normalizedAnnouncement.includes('trait routes')) {
        return normalizedAnnouncement.includes('complete')
            ? 'Next: route reward claimed; spend the resource when the board gets risky.'
            : 'Next: line up another trait interaction before the floor ends.';
    }

    if (normalizedAnnouncement.includes('match resolved')) {
        return `Next: ${remainingPairCount} ${remainingPairCount === 1 ? 'pair' : 'pairs'} left.`;
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
        return 'Next: hazard blocked; continue from the safest known pair.';
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
        return 'Next: preserve the streak with the safest known match.';
    }

    if (normalizedAnnouncement.includes('gambit')) {
        return 'Next: take the third flip only if the wager is worth it.';
    }

    if (normalizedAnnouncement.includes('combo shard')) {
        return 'Next: spend shards on powers when the board gets risky.';
    }

    if (normalizedAnnouncement.includes('shop gold')) {
        return 'Next: bank gold for shops, rests, or route events.';
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
