import type { BossReward, RealmDoor } from '../../shared/contracts';
import { BOSS_WILD_GOLD, bossRewardFor, type BlueprintId } from '../../shared/boss-reward-rules';

/**
 * Boss rewards by the door (`boss-reward-rules.ts`, DGE-026): what each door before an act boss says the
 * boss will give, and the line when it falls.
 */
export const BLUEPRINT_TITLES: Readonly<Record<BlueprintId, string>> = {
    lantern_of_recall: 'Lantern of Recall',
    misers_vault: "Miser's Vault",
    cartographers_thread: "Cartographer's Thread",
    keystone_heart: 'Keystone Heart',
    unmasking_glass: 'Unmasking Glass',
    echo_chamber: 'Echo Chamber'
};

export const BOSS_DOOR_COPY = {
    title: 'Before the boss',
    subtitle: 'The door you take is how hard it fights, and what it gives when it falls'
} as const;

const describe = (reward: BossReward): string =>
    reward.kind === 'clear'
        ? 'The clear, nothing more'
        : reward.kind === 'gold'
          ? `+${reward.gold} gold`
          : `Blueprint: ${BLUEPRINT_TITLES[reward.blueprint as BlueprintId] ?? reward.blueprint}`;

/** The line on a door before an act boss. */
export const bossDoorRewardLine = (door: RealmDoor, held: readonly BlueprintId[]): string => describe(bossRewardFor(door.severity, held));

/** What the fallen boss gave, for the clear's notes. */
export const bossRewardNote = (reward: BossReward | null | undefined): string | null =>
    reward == null ? null : reward.kind === 'clear' ? null : reward.kind === 'gold' ? `The boss paid ${BOSS_WILD_GOLD} gold` : `The boss left a blueprint: ${BLUEPRINT_TITLES[reward.blueprint as BlueprintId] ?? reward.blueprint}`;
