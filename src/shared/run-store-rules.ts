import type { ChainTier } from './chain-tier-rules';
import type { RunState } from './contracts';
import { grantMisses, missBankCap, missesLeft } from './miss-bank';
import { hasRelic, isRelicId, RELICS, usesCampUpgrades, isCampUpgrade, relicRank, campUpgradeBenefit, CAMP_UPGRADE_MAX_RANK, type RelicId } from './run-relic-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';
import { essenceOf, focusOf, FOCUS_EFFECTS, FOCUS_ESSENCE_COST, PRIME_ESSENCE_COST, isElementalStoreId, storeElement, usesElementalLoot, type ElementalStoreId } from './elemental-loot-rules';
import { TILE_SUITS } from './tile-suit-rules';
import { ELEMENT_NAMES } from './element-alchemy-rules';

/** Every third clear opens camp. Rules 58 spend gold on three ranked upgrades or supplies.
 * Legacy stores remain deterministic for older replay rules. Shared tables skip the stop. */
export const STORE_STOP_EVERY_FLOORS = 3;

export const isStoreStopFloor = (clearedLevel: number | null | undefined): boolean => {
    const level = runNonNegativeInteger(clearedLevel ?? 0);
    return level > 0 && level % STORE_STOP_EVERY_FLOORS === 0;
};

export const GOLD_FLOOR_CLEAR_BASE = 2;
/** Gold a clear pays per turn under par, and the most it pays that way. */
export const GOLD_PER_TURN_UNDER_PAR = 1;
export const GOLD_UNDER_PAR_CAP = 3;
/** What the rung the floor cleared at adds: the ladder's celebration, in coin. */
export const GOLD_BY_CLEAR_TIER: Readonly<Record<ChainTier, number>> = { none: 0, clean: 1, sharp: 2, fever: 3 };

/** What a floor clear pays into the purse. */
export const floorClearGold = ({ tier, turnsUnderPar }: { tier: ChainTier; turnsUnderPar: number }): number =>
    GOLD_FLOOR_CLEAR_BASE +
    GOLD_BY_CLEAR_TIER[tier] +
    Math.min(GOLD_UNDER_PAR_CAP, runNonNegativeInteger(turnsUnderPar)) * GOLD_PER_TURN_UNDER_PAR;

export type StoreItemId = 'miss' | 'peek' | 'shuffle' | 'bomb' | RelicId | ElementalStoreId;

export interface StoreItemDefinition {
    id: StoreItemId;
    title: string;
    body: string;
    basePrice: number;
    /** Added to the price for every earlier purchase of this item in the run. */
    priceStep: number;
    /** A consumable can be bought again; a relic once, and kept to the end of the run. */
    kind: 'consumable' | 'relic' | 'focus' | 'prime';
}

export const STORE_ITEMS: readonly StoreItemDefinition[] = [
    {
        id: 'miss',
        title: 'Another miss',
        body: 'One more miss before the run ends, good for three floors past this one, up to what your bank holds.',
        basePrice: 4,
        priceStep: 2,
        kind: 'consumable'
    },
    {
        id: 'peek',
        title: 'A peek',
        body: 'One peek charge: turn a hidden card over and put it back.',
        basePrice: 3,
        priceStep: 1,
        kind: 'consumable'
    },
    {
        id: 'shuffle',
        title: 'A shuffle',
        body: 'One full-board shuffle charge.',
        basePrice: 3,
        priceStep: 1,
        kind: 'consumable'
    },
    {
        id: 'bomb',
        title: 'A bomb',
        body: 'Flip a card, then bomb it: its pair leaves the board. No miss, no turn, the chain stands.',
        basePrice: 4,
        priceStep: 2,
        kind: 'consumable'
    },
    // Relics (2026-09-24, `run-relic-rules.ts`): bought once, kept to the end of the run.
    ...RELICS.map(
        (relic): StoreItemDefinition => ({
            id: relic.id,
            title: relic.title,
            body: relic.body,
            basePrice: relic.price,
            priceStep: 0,
            kind: 'relic'
        })
    )
];

/** All four elements are available: the finds constrain the build, not another stock roll. */
export const ELEMENTAL_STORE_ITEMS: readonly StoreItemDefinition[] = TILE_SUITS.flatMap(suit => [
    { id: `focus_${suit}` as const, title: `${ELEMENT_NAMES[suit]} focus`,
        body: `${FOCUS_EFFECTS[suit]} +1 cast tier for reach and targets. Lasts this run.`,
        basePrice: 6, priceStep: 3, kind: 'focus' as const },
    { id: `prime_${suit}` as const, title: `Bottle ${ELEMENT_NAMES[suit]}`,
        body: `Prime ${ELEMENT_NAMES[suit]} for the next floor. Match another element to react. A miss breaks it. Replaces your streak; one bottle per stop.`,
        basePrice: 3, priceStep: 1, kind: 'prime' as const }
]);
/** Always available at camp: build a run, or spend on immediate help. */
export const CAMP_ITEMS: readonly StoreItemDefinition[] = [
    { id: 'long_look', title: 'Long Look', body: 'More time to memorize every board.', basePrice: 8, priceStep: 6, kind: 'relic' },
    { id: 'deep_pockets', title: 'Deep Pockets', body: 'Also restores 1 miss now, lasting three floors.', basePrice: 8, priceStep: 6, kind: 'relic' },
    { id: 'gilded_chain', title: 'Gilded Chain', body: 'Earn extra gold as you keep matching without a miss.', basePrice: 6, priceStep: 5, kind: 'relic' },
    ...STORE_ITEMS.filter(item => ['miss', 'peek', 'bomb'].includes(item.id))
];
const ALL_STORE_ITEMS = [...STORE_ITEMS, ...ELEMENTAL_STORE_ITEMS];

export type StoreRun = Pick<
    RunState,
    'gold' | 'storePurchases' | 'missBank' | 'board' | 'peekCharges' | 'shuffleCharges' | 'bombCharges' | 'relics' | 'storeStock'
    | 'runRulesVersion' | 'elementalEssence' | 'elementalFocus' | 'elementStreak' | 'elementalPrimeFloor'
>;

/**
 * What a stop has on its shelves. Rolled once from the seed and the floor, so a shared run
 * stocks the same shelves for everyone and a replay buys what was there:
 *
 * - a miss is always for sale: the bank is the run's life, and a stop that could not sell one
 *   would be a stop the run could not afford to reach;
 * - the first stop (floor 3) always has a bomb, because the starter bomb is spent by then;
 * - of the other consumables, each is in about two stops of three;
 * - of the relics not yet owned, two.
 *
 * The vault draws what is stocked and leaves the shelf bare for what is not (`StoreVault`), so
 * the stops read as different rooms and a relic is something you find rather than pick.
 */
export const rollStoreStock = (runSeed: number, floor: number, owned: readonly RelicId[], rulesVersion = 54): StoreItemId[] => {
    if (usesCampUpgrades({ runRulesVersion: rulesVersion })) return CAMP_ITEMS.map(item => item.id);
    if (usesElementalLoot({ runRulesVersion: rulesVersion })) return ELEMENTAL_STORE_ITEMS.map(item => item.id);
    const rng = createMulberry32(hashStringToSeed(`store-stock:${Math.floor(runSeed)}:${Math.floor(floor)}`));
    const stock: StoreItemId[] = ['miss'];
    for (const id of ['peek', 'shuffle', 'bomb'] as const) {
        if ((id === 'bomb' && floor <= STORE_STOP_EVERY_FLOORS) || rng() < 0.67) stock.push(id);
    }
    const relics = RELICS.map((relic) => relic.id).filter((id) => !owned.includes(id));
    const picked = shuffleWithRng(rng, [...relics]).slice(0, 2).sort((a, b) => relics.indexOf(a) - relics.indexOf(b));
    return [...stock, ...picked];
};

/** Whether the stop sells the item: everything, on a run stocked before stops were rolled. */
export const isStocked = (run: Pick<RunState, 'storeStock'>, id: StoreItemId): boolean =>
    run.storeStock === undefined || run.storeStock.includes(id);

export const runGold = (run: Pick<RunState, 'gold'>): number => runNonNegativeInteger(run.gold ?? 0);

export const storePurchaseCount = (run: Pick<RunState, 'storePurchases'>, id: StoreItemId): number =>
    runNonNegativeInteger(run.storePurchases?.[id] ?? 0);

export const storePrice = (run: Pick<RunState, 'storePurchases'> & Partial<Pick<RunState, 'runRulesVersion'>>, id: StoreItemId): number => {
    const item = (usesCampUpgrades(run) ? CAMP_ITEMS : ALL_STORE_ITEMS).find((candidate) => candidate.id === id)!;
    return item.basePrice + item.priceStep * storePurchaseCount(run, id);
};

export interface StoreOfferRow {
    id: StoreItemId;
    title: string;
    body: string;
    price: number;
    /** Why it cannot be bought right now, or `null` when it can. */
    blocked: 'gold' | 'full' | 'no_bank' | 'owned' | 'essence' | 'prepared' | 'max_rank' | null;
    kind: StoreItemDefinition['kind'];
    rank?: number;
    goldShortfall?: number;
    essenceCost?: number;
    essenceHeld?: number;
}

/** The sheet's rows, priced for this run and marked with why each cannot be bought, if it cannot. */
export const storeOffer = (run: StoreRun): StoreOfferRow[] =>
    (usesCampUpgrades(run) ? CAMP_ITEMS : usesElementalLoot(run) ? ELEMENTAL_STORE_ITEMS : STORE_ITEMS).filter((item) => isStocked(run, item.id)).map((item) => {
        const price = storePrice(run, item.id);
        let blocked: StoreOfferRow['blocked'] = null;
        let essenceCost: number | undefined;
        let essenceHeld: number | undefined;
        let body = item.body;
        if (isElementalStoreId(item.id)) {
            const suit = storeElement(item.id);
            essenceCost = item.kind === 'focus' ? FOCUS_ESSENCE_COST : PRIME_ESSENCE_COST;
            essenceHeld = essenceOf(run.elementalEssence, suit);
            if (item.kind === 'prime' && run.elementalPrimeFloor === run.board?.level) blocked = 'prepared';
            else if (essenceHeld < essenceCost) blocked = 'essence';
            if (item.kind === 'focus') body = `Rank ${focusOf(run, suit)} → ${focusOf(run, suit) + 1}. ${body}`;
        }
        if (item.id === 'miss') {
            const left = missesLeft(run);
            if (left == null) blocked = 'no_bank';
            else if (left >= missBankCap(run)) blocked = 'full';
        }
        const rank = usesCampUpgrades(run) && isCampUpgrade(item.id) ? relicRank(run, item.id) : undefined;
        if (rank !== undefined && isCampUpgrade(item.id)) {
            body = rank >= CAMP_UPGRADE_MAX_RANK ? `${campUpgradeBenefit(item.id, rank)}. Maximum rank.`
                : item.id === 'long_look' ? `Study time: +${rank} → +${rank + 1} seconds on every floor.`
                : item.id === 'deep_pockets' ? `Miss capacity: ${4 + rank} → ${5 + rank}. Restores 1 miss now, lasting three floors.`
                : `Combo payout: ${rank ? rank + 1 : 0} → ${rank + 2} gold every 5 matches in a row.`;
            if (item.id === 'deep_pockets' && missesLeft(run) == null) blocked = 'no_bank';
            if (rank >= CAMP_UPGRADE_MAX_RANK) blocked = 'max_rank';
        } else if (isRelicId(item.id) && hasRelic(run, item.id)) blocked = 'owned';
        if (blocked === null && runGold(run) < price) blocked = 'gold';
        return { id: item.id, title: item.title, body, price, blocked, kind: item.kind, rank, goldShortfall: Math.max(0, price - runGold(run)), ...(essenceCost === undefined ? {} : { essenceCost, essenceHeld }) };
    });

/** The purchase, or `null` when the sheet would have said no. */
export const buyStoreItem = <R extends StoreRun>(run: R, id: StoreItemId): R | null => {
    const row = storeOffer(run).find((candidate) => candidate.id === id);
    if (!row || row.blocked !== null) {
        return null;
    }
    const paid: R = {
        ...run,
        gold: runGold(run) - row.price,
        storePurchases: { ...run.storePurchases, [id]: storePurchaseCount(run, id) + 1 }
    };
    if (isElementalStoreId(id)) {
        const suit = storeElement(id);
        const elementalEssence = { ...run.elementalEssence, [suit]: essenceOf(run.elementalEssence, suit) - row.essenceCost! };
        return row.kind === 'focus'
            ? { ...paid, elementalEssence, elementalFocus: { ...run.elementalFocus, [suit]: focusOf(run, suit) + 1 } }
            : { ...paid, elementalEssence, elementStreak: { suit, links: 2 }, elementalPrimeFloor: run.board?.level ?? 0 };
    }
    switch (id) {
        case 'miss':
            // Bought on this floor, so it lasts as long as a miss earned here would.
            return { ...paid, missBank: grantMisses(run.missBank ?? [], run.board?.level ?? 1, 1, missBankCap(run)) };
        case 'peek':
            return { ...paid, peekCharges: runNonNegativeInteger(run.peekCharges) + 1 };
        case 'shuffle':
            return { ...paid, shuffleCharges: runNonNegativeInteger(run.shuffleCharges) + 1 };
        case 'bomb':
            return { ...paid, bombCharges: runNonNegativeInteger(run.bombCharges) + 1 };
        default:
            return {
                ...paid, relics: [...new Set([...(run.relics ?? []), id])],
                ...(usesCampUpgrades(run) && id === 'deep_pockets'
                    ? { missBank: grantMisses(run.missBank ?? [], run.board?.level ?? 1, 1, 4 + (row.rank ?? 0) + 1) } : {})
            };
    }
};
