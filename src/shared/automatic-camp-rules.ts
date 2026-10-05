import type { RunState } from './contracts';
import { isPassAndPlayRun } from './pass-and-play-rules';
import { CAMP_UPGRADE_IDS, relicRank } from './run-relic-rules';
import { buyStoreItem, isStoreStopFloor, storeOffer, type StoreOfferRow } from './run-store-rules';
import { missesLeft } from './miss-bank';

export const AUTOMATIC_CAMP_RULES_VERSION = 61;
export interface CampReward {
    run: RunState;
    receipt: string | null;
}

/** One deterministic reward between floors. No random roll, dialog, or repeated spending.
 * Preview and application share this function; only floor advancement commits the result.
 * Earlier shared-run versions retain their original progression rules.
 */
export function automaticCampReward(run: RunState): CampReward {
    if (
        (run.runRulesVersion ?? 0) < AUTOMATIC_CAMP_RULES_VERSION ||
        run.status !== 'levelComplete' ||
        !run.board ||
        !isStoreStopFloor(run.board.level) ||
        isPassAndPlayRun(run.passAndPlay)
    ) {
        return { run, receipt: null };
    }
    const available = storeOffer(run).filter((row) => row.blocked === null);
    const find = (id: string) => available.find((row) => row.id === id);
    const upgrades = [...CAMP_UPGRADE_IDS].sort((a, b) => relicRank(run, a) - relicRank(run, b));
    // Rescue a nearly empty bank first, otherwise grow the least developed affordable upgrade.
    let reward: StoreOfferRow | undefined = (missesLeft(run) ?? Infinity) <= 1 ? find('miss') : undefined;
    reward ??= upgrades.map(find).find(Boolean);
    reward ??= find('miss');
    reward ??= (run.bombCharges ?? 0) < 1 ? find('bomb') : undefined;
    reward ??= run.peekCharges < 1 ? find('peek') : undefined;
    if (!reward) return { run, receipt: 'Camp: gold saved for your next upgrade.' };
    const rewarded = buyStoreItem(run, reward.id);
    if (!rewarded) return { run, receipt: null };
    const benefit = reward.rank === undefined ? reward.title : `${reward.title} ${reward.rank + 1}/3`;
    return { run: rewarded, receipt: `Camp: ${benefit} · ${reward.price} gold used automatically.` };
}
