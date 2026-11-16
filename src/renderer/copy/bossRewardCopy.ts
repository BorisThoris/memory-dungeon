import { tr } from '../../shared/i18n';
import type { BossReward, RealmDoor } from '../../shared/contracts';
import { BOSS_WILD_GOLD, bossRewardFor, type BlueprintId } from '../../shared/boss-reward-rules';

/**
 * Boss rewards by the door (`boss-reward-rules.ts`, DGE-026): what each door before an act boss says the
 * boss will give, and the line when it falls.
 */
export const BLUEPRINT_TITLES: Readonly<Record<BlueprintId, string>> = {
    lantern_of_recall: tr.s('Lantern of Recall'),
    misers_vault: tr.s("Miser's Vault"),
    cartographers_thread: tr.s("Cartographer's Thread"),
    keystone_heart: tr.s('Keystone Heart'),
    unmasking_glass: tr.s('Unmasking Glass'),
    echo_chamber: tr.s('Echo Chamber')
};

export const BOSS_DOOR_COPY = {
    title: tr.s('Before the boss'),
    subtitle: tr.s('The door you take is how hard it fights, and what it gives when it falls')
} as const;

const describe = (reward: BossReward): string =>
    reward.kind === 'clear'
        ? tr.s('The clear, nothing more')
        : reward.kind === 'gold'
          ? tr`+${reward.gold} gold`
          : tr`Blueprint: ${BLUEPRINT_TITLES[reward.blueprint as BlueprintId] ?? reward.blueprint}`;

/** The line on a door before an act boss. */
export const bossDoorRewardLine = (door: RealmDoor, held: readonly BlueprintId[]): string => describe(bossRewardFor(door.severity, held));

/** What the fallen boss gave, for the clear's notes. */
export const bossRewardNote = (reward: BossReward | null | undefined): string | null =>
    reward == null ? null : reward.kind === 'clear' ? null : reward.kind === 'gold' ? tr`The boss paid ${BOSS_WILD_GOLD} gold` : tr`The boss left a blueprint: ${BLUEPRINT_TITLES[reward.blueprint as BlueprintId] ?? reward.blueprint}`;
