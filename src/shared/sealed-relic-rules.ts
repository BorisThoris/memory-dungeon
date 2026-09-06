import type { RelicId, RunState } from './contracts';
import { filterRelicPoolByContentLock } from './content-lock-state';
import { getRelicDraftRow, isRelicDraftEligible, RELIC_POOL } from './relics';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * The sealed offering: a fourth card on the relic draft that will not tell you what it is.
 *
 * The draft was arithmetic. Three cards, three full descriptions, and the correct answer is
 * whichever number is largest for the build you are already playing — a screen you solve rather
 * than a decision you make. Nothing in the whole run was ever a gamble.
 *
 * So one card is sealed. It is drawn from the same pool the offer itself draws from, it is picked
 * with the same command as any other relic, and it is a real relic the whole time — the hiding is
 * presentation, not a different set of rules. What you trade is control: the three you can read
 * are chosen to fit the run you are in, and this one is chosen only to be *rarer* than they are.
 *
 * That is the deal, stated plainly on the card. Better odds of something strong, no promise it is
 * something you need. A player who takes it every time will be right often and stranded sometimes,
 * which is the only shape of gamble worth putting on a screen.
 */
export const SEALED_RELIC_RARITY_ORDER = ['rare', 'uncommon', 'common'] as const;

/**
 * Draws the sealed option for one draft round.
 *
 * Excludes everything already on the table: sealing a card the player can also read unsealed
 * beside it would make the seal a lie the first time they noticed.
 *
 * Prefers the rarest band that has anything eligible left, which is what makes the trade worth
 * taking. Returns null when the pool has nothing left to seal — a small pool, a heavily banned
 * offer — rather than repeating a visible option.
 */
export const rollSealedRelic = (
    run: RunState,
    tierIndex: number,
    clearedFloor: number,
    pickRound: number,
    visibleOptions: readonly RelicId[]
): RelicId | null => {
    const onTheTable = new Set<RelicId>(visibleOptions);
    const available = filterRelicPoolByContentLock(RELIC_POOL).filter(
        (id) => !onTheTable.has(id) && isRelicDraftEligible(id, run)
    );
    if (available.length === 0) {
        return null;
    }

    const rng = createMulberry32(
        hashStringToSeed(`sealed:${run.runSeed}:${run.runRulesVersion}:${tierIndex}:${clearedFloor}:${pickRound}`)
    );
    for (const rarity of SEALED_RELIC_RARITY_ORDER) {
        const band = available.filter((id) => getRelicDraftRow(id).rarity === rarity);
        if (band.length > 0) {
            return band[pickRngIndex(rng, band.length)] ?? band[0]!;
        }
    }
    return available[pickRngIndex(rng, available.length)] ?? available[0]!;
};

/** True when this id is the sealed card of the run's open offer. */
export const isSealedRelicOption = (run: RunState, relicId: RelicId): boolean =>
    run.relicOffer?.sealedRelicId === relicId;
