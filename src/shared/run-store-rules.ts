import type { ChainTier } from './chain-tier-rules';
import type { RunState } from './contracts';
import { MISS_BANK_CAP, missesLeft } from './miss-bank';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The store, back - one mechanic, on its own, measured against the loop.
 *
 * Gen 174 took the shop out with the gold it spent, because the floor-clear vendor and the door
 * it stood behind were stops in a loop of momentum (`docs/REMOVED_DUNGEON_LAYER.md`). What made
 * it worth bringing back on 2026-09-23 is the miss bank: for the first time a run has one thing
 * worth buying - another miss before the run ends - and a floor cleared well has something to
 * earn toward it. So gold is back as a run currency, earned only at a floor clear, and the store
 * is a sheet on the pause menu rather than a door between floors: there is never a moment the
 * game waits for the player to shop.
 *
 * Prices climb with each purchase of the same thing in a run, so gold is a decision and not a
 * subscription: the first extra miss is cheap, the fourth is not.
 */
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

export type StoreItemId = 'miss' | 'peek' | 'shuffle';

export interface StoreItemDefinition {
    id: StoreItemId;
    title: string;
    body: string;
    basePrice: number;
    /** Added to the price for every earlier purchase of this item in the run. */
    priceStep: number;
}

export const STORE_ITEMS: readonly StoreItemDefinition[] = [
    {
        id: 'miss',
        title: 'Another miss',
        body: 'One more miss before the run ends. Never more than four in hand.',
        basePrice: 4,
        priceStep: 2
    },
    {
        id: 'peek',
        title: 'A peek',
        body: 'One peek charge: turn a hidden card over and put it back.',
        basePrice: 3,
        priceStep: 1
    },
    {
        id: 'shuffle',
        title: 'A shuffle',
        body: 'One full-board shuffle charge.',
        basePrice: 3,
        priceStep: 1
    }
];

export type StoreRun = Pick<RunState, 'gold' | 'storePurchases' | 'missBankCarry' | 'peekCharges' | 'shuffleCharges'>;

export const runGold = (run: Pick<RunState, 'gold'>): number => runNonNegativeInteger(run.gold ?? 0);

export const storePurchaseCount = (run: Pick<RunState, 'storePurchases'>, id: StoreItemId): number =>
    runNonNegativeInteger(run.storePurchases?.[id] ?? 0);

export const storePrice = (run: Pick<RunState, 'storePurchases'>, id: StoreItemId): number => {
    const item = STORE_ITEMS.find((candidate) => candidate.id === id)!;
    return item.basePrice + item.priceStep * storePurchaseCount(run, id);
};

export interface StoreOfferRow {
    id: StoreItemId;
    title: string;
    body: string;
    price: number;
    /** Why it cannot be bought right now, or `null` when it can. */
    blocked: 'gold' | 'full' | 'no_bank' | null;
}

/** The sheet's rows, priced for this run and marked with why each cannot be bought, if it cannot. */
export const storeOffer = (run: StoreRun): StoreOfferRow[] =>
    STORE_ITEMS.map((item) => {
        const price = storePrice(run, item.id);
        let blocked: StoreOfferRow['blocked'] = null;
        if (item.id === 'miss') {
            const left = missesLeft(run);
            if (left == null) blocked = 'no_bank';
            else if (left >= MISS_BANK_CAP) blocked = 'full';
        }
        if (blocked === null && runGold(run) < price) blocked = 'gold';
        return { id: item.id, title: item.title, body: item.body, price, blocked };
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
    switch (id) {
        case 'miss':
            return { ...paid, missBankCarry: Math.min(MISS_BANK_CAP, (missesLeft(run) ?? 0) + 1) };
        case 'peek':
            return { ...paid, peekCharges: runNonNegativeInteger(run.peekCharges) + 1 };
        case 'shuffle':
            return { ...paid, shuffleCharges: runNonNegativeInteger(run.shuffleCharges) + 1 };
    }
};
