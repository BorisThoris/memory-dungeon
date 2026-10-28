import { runBlueprints } from './boss-reward-rules';
import { applyFusion, availableFusions, FUSION_PRICE, isSnowballRelicId, SNOWBALL_RELICS_FROM } from './snowball-relic-rules';
import type { RunState } from './contracts';
import { isPassAndPlayRun } from './pass-and-play-rules';
import { campUpgradeIdsFor, relicRank } from './run-relic-rules';
import { applyEvolution, availableEvolutions, declineEvolution, EVOLUTION_PRICE, EVOLUTIONS } from './relic-evolution-rules';
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
export function automaticCampReward(start: RunState): CampReward {
    let run = start;
    if (
        (run.runRulesVersion ?? 0) < AUTOMATIC_CAMP_RULES_VERSION ||
        run.status !== 'levelComplete' ||
        !run.board ||
        !isStoreStopFloor(run.board.level) ||
        isPassAndPlayRun(run.passAndPlay)
    ) {
        return { run, receipt: null };
    }
    // An evolution on offer comes first (`relic-evolution-rules.ts`): bought if the gold is there, lost for the run if not.
    const offered = availableEvolutions(run);
    if (offered.length > 0) {
        const recipe = offered[0]!;
        const evolved = applyEvolution(run, recipe.id);
        if (evolved) return { run: evolved, receipt: `Camp: ${recipe.title} evolved · ${EVOLUTION_PRICE} gold used automatically.` };
        run = declineEvolution(run, recipe.id);
    }
    // A fusion on offer (rules 102) is the sims' first buy when the gold is there.
    const fusion = availableFusions(run)[0];
    const fused = fusion ? applyFusion(run, fusion.id) : null;
    if (fusion && fused) return { run: fused, receipt: `Camp: ${fusion.title} fused · ${FUSION_PRICE} gold used automatically.` };
    const available = storeOffer(run).filter((row) => row.blocked === null);
    const find = (id: string) => available.find((row) => row.id === id);
    const upgrades = [...campUpgradeIdsFor(run)].sort((a, b) => relicRank(run, a) - relicRank(run, b));
    const preference = (run.runRulesVersion ?? 0) >= 64 ? run.campPreference : undefined;
    const preferred = preference === 'study' ? ['long_look', 'peek']
        : preference === 'score' ? ['gilded_chain']
        : preference === 'survive' ? ['miss', 'deep_pockets', 'bomb']
        // Evolve (`feat-unlocks.ts`): the relics the run's blueprints ask for, toward an evolution.
        : preference === 'evolve' ? [...new Set(EVOLUTIONS.filter((recipe) => runBlueprints(run).includes(recipe.id)).flatMap((recipe) => recipe.from))] : [];
    // Rescue a nearly empty bank first, otherwise grow the least developed affordable upgrade.
    let reward: StoreOfferRow | undefined = preferred.map(find).find(Boolean);
    reward ??= (missesLeft(run) ?? Infinity) <= 1 ? find('miss') : undefined;
    reward ??= upgrades.map(find).find(Boolean);
    // From rules 100 the shelf is drawn from the seed (`snowball-relic-rules.ts`); the sims' camp takes a relic that grows when it has no rank to buy.
    reward ??= (run.runRulesVersion ?? 0) >= SNOWBALL_RELICS_FROM ? available.find((row) => isSnowballRelicId(row.id)) : undefined;
    reward ??= find('miss');
    reward ??= (run.bombCharges ?? 0) < 1 ? find('bomb') : undefined;
    reward ??= run.peekCharges < 1 ? find('peek') : undefined;
    if (!reward) return { run, receipt: 'Camp: gold saved for your next upgrade.' };
    const rewarded = buyStoreItem(run, reward.id);
    if (!rewarded) return { run, receipt: null };
    const benefit = reward.rank === undefined ? reward.title : `${reward.title} ${reward.rank + 1}/3`;
    return { run: rewarded, receipt: `Camp: ${benefit} · ${reward.price} gold used automatically.` };
}
