import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { RouteCardKind, RouteNodeType, RunShopOfferState, RunState } from '../../shared/contracts';
import { canRerollShopOffers, getShopRerollCostForFloor } from '../../shared/shop-rules';
import { getTraitBuildRewardRowsForBoard } from '../../shared/trait-build-rewards';
import {
    playUiBackSfx,
    playUiClickSfx,
    playUiConfirmSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { OverlayActionDock } from '../ui';
import { useAppStore } from '../store/useAppStore';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import { getInventoryPayoffEngineSignal } from './inventoryScreenModel';
import styles from './ShopScreen.module.css';

type OfferStatus = 'available' | 'claimed' | 'insufficient' | 'incompatible';
type ShopOfferSignalTone = 'setup' | 'recall' | 'safety' | 'key' | 'control' | 'neutral';
type ShopOfferPayoffTone = 'gain' | 'cost' | 'blocked' | 'setup' | 'next';
type ShopOfferPayoffRow = { id: string; label: string; value: string; tone: ShopOfferPayoffTone };
type ShopOfferFitTone = 'setup' | 'route' | 'safety' | 'neutral';
type ShopOfferBoardMomentTone = 'scout' | 'setup' | 'control' | 'safety' | 'route';
type ShopOfferPayoffBurst = {
    label: 'Best buy' | 'Route unlock' | 'Prime burst' | 'Survival buy' | 'Blocked';
    value: string;
    tier: 'best' | 'route' | 'setup' | 'safety' | 'blocked';
};
type ShopOfferBoardMoment = {
    label: 'Board moment';
    value: string;
    tone: ShopOfferBoardMomentTone;
};
type ShopOfferBuyCue = {
    label: 'Buy cue' | 'Blocked cue' | 'Claimed cue';
    value: string;
    tone: 'available' | 'blocked' | 'claimed';
};
type ShopOfferImpactCue = {
    label: 'Buy route' | 'Prime combo' | 'Shield run' | 'Clear blocker' | 'Pair scout' | 'Buy burst' | 'Blocked' | 'Claimed';
    value: string;
    tone: 'route' | 'setup' | 'safety' | 'control' | 'scout' | 'payoff' | 'blocked' | 'claimed';
};
type ShopOfferHeatCue = {
    detail: string;
    label: 'Shop heat';
    tier: 'best' | 'route' | 'setup' | 'safety' | 'blocked' | 'claimed';
    value: 'Hot buy' | 'Live route' | 'Combo route' | 'Safety shield' | 'Blocked' | 'Claimed';
};
type ShopOfferBuyPlan = {
    first: string;
    keep: string;
    then: string;
    tone: ShopOfferImpactCue['tone'];
};

const SHOP_OFFER_SIGNAL_BY_ITEM: Record<
    RunShopOfferState['itemId'],
    { label: string; tone: ShopOfferSignalTone }[]
> = {
    heal_life: [{ label: 'Recovery', tone: 'safety' }],
    peek_charge: [{ label: 'Recall', tone: 'recall' }],
    region_shuffle_charge: [
        { label: 'Prime', tone: 'setup' },
        { label: 'Route link', tone: 'setup' }
    ],
    destroy_charge: [{ label: 'Control', tone: 'control' }],
    trait_cleanse: [
        { label: 'Safety', tone: 'safety' },
        { label: 'Trait fix', tone: 'control' }
    ],
    trait_routing_kit: [
        { label: 'Combo prime', tone: 'setup' },
        { label: 'Recall', tone: 'recall' }
    ],
    iron_key: [{ label: 'Key', tone: 'key' }],
    treasure_key: [{ label: 'Key', tone: 'key' }],
    shrine_key: [{ label: 'Key', tone: 'key' }],
    boss_key: [{ label: 'Key', tone: 'key' }],
    trap_key: [{ label: 'Key', tone: 'key' }],
    master_key: [
        { label: 'Any lock', tone: 'key' },
        { label: 'Safety', tone: 'safety' }
    ]
};

const shopOfferPayoffLine = (offer: RunShopOfferState): string => {
    switch (offer.itemId) {
        case 'heal_life':
            return '+1 life buffer';
        case 'peek_charge':
            return '+1 safe reveal';
        case 'region_shuffle_charge':
            return '+1 route-link charge';
        case 'destroy_charge':
            return '+1 pair control';
        case 'trait_cleanse':
            return 'soften Cursed/Volatile';
        case 'trait_routing_kit':
            return '+1 peek and +1 route link';
        case 'master_key':
            return 'opens any lock';
        default:
            return `opens ${offer.label.toLowerCase()} locks`;
    }
};

const shopOfferNextPlayLine = (offer: RunShopOfferState): string | null => {
    switch (offer.itemId) {
        case 'peek_charge':
            return 'confirm a chain pair';
        case 'region_shuffle_charge':
            return 'move traits into combo range';
        case 'destroy_charge':
            return 'clear one chain blocker';
        case 'trait_cleanse':
            return 'protect a risky combo';
        case 'trait_routing_kit':
            return 'prime a trait chain turn';
        case 'master_key':
            return 'enter any locked route';
        case 'iron_key':
        case 'treasure_key':
        case 'shrine_key':
        case 'boss_key':
        case 'trap_key':
            return 'open its locked route';
        case 'heal_life':
            return 'survive one more miss';
        default:
            return null;
    }
};

const shopOfferPayoffRows = (
    offer: RunShopOfferState,
    shopGold: number
): ShopOfferPayoffRow[] => {
    const status = offerStatus(offer, shopGold);
    const nextPlay = shopOfferNextPlayLine(offer);
    return [
        { id: 'gain', label: 'Payoff', value: shopOfferPayoffLine(offer), tone: 'gain' as const },
        nextPlay ? { id: 'next', label: 'Next move', value: nextPlay, tone: 'next' as const } : null,
        status === 'available'
            ? { id: 'cost', label: 'Cost', value: `${offer.cost}g`, tone: 'cost' as const }
            : {
                  id: 'blocked',
                  label: status === 'claimed' ? 'State' : 'Blocked',
                  value: statusText(offer, shopGold),
                  tone: 'blocked' as const
              },
        offer.itemId === 'region_shuffle_charge' || offer.itemId === 'trait_routing_kit'
            ? { id: 'setup', label: 'Use', value: 'link trait cards', tone: 'setup' as const }
            : null
    ].filter((row): row is ShopOfferPayoffRow => row != null);
};

const shopOfferPayoffBeatCount = (row: ShopOfferPayoffRow): 1 | 2 | 3 | 4 => {
    if (row.tone === 'gain') {
        return 4;
    }
    if (row.tone === 'next' || row.tone === 'setup') {
        return 3;
    }
    if (row.tone === 'blocked') {
        return 2;
    }
    return 1;
};

const shopOfferPayoffAction = (row: ShopOfferPayoffRow): 'Claim payoff' | 'Pay cost' | 'Earn gold' | 'Prime route' | 'Bank next' => {
    if (row.tone === 'gain') {
        return 'Claim payoff';
    }
    if (row.tone === 'cost') {
        return 'Pay cost';
    }
    if (row.tone === 'blocked') {
        return 'Earn gold';
    }
    if (row.tone === 'setup') {
        return 'Prime route';
    }
    return 'Bank next';
};

const shopOfferPayoffAudioCue = (
    row: ShopOfferPayoffRow
): 'shop-payoff-gain' | 'shop-payoff-cost' | 'shop-payoff-blocked' | 'shop-payoff-setup' | 'shop-payoff-next' => {
    if (row.tone === 'gain') {
        return 'shop-payoff-gain';
    }
    if (row.tone === 'cost') {
        return 'shop-payoff-cost';
    }
    if (row.tone === 'blocked') {
        return 'shop-payoff-blocked';
    }
    if (row.tone === 'setup') {
        return 'shop-payoff-setup';
    }
    return 'shop-payoff-next';
};

const shopOfferPayoffScreenCue = (row: ShopOfferPayoffRow): 'burst' | 'guard' | 'locked' | 'snap' | 'pulse' => {
    if (row.tone === 'gain') {
        return 'burst';
    }
    if (row.tone === 'cost') {
        return 'guard';
    }
    if (row.tone === 'blocked') {
        return 'locked';
    }
    if (row.tone === 'setup') {
        return 'snap';
    }
    return 'pulse';
};

const shopOfferSignalBeatCount = (tone: ShopOfferSignalTone): 2 | 3 | 4 => {
    if (tone === 'setup' || tone === 'key') {
        return 4;
    }
    if (tone === 'neutral') {
        return 2;
    }
    return 3;
};

const shopOfferSignalAction = (
    tone: ShopOfferSignalTone
): 'Prime route' | 'Reveal pair' | 'Shield run' | 'Open lock' | 'Clear blocker' | 'Read offer' => {
    if (tone === 'setup') {
        return 'Prime route';
    }
    if (tone === 'recall') {
        return 'Reveal pair';
    }
    if (tone === 'safety') {
        return 'Shield run';
    }
    if (tone === 'key') {
        return 'Open lock';
    }
    if (tone === 'control') {
        return 'Clear blocker';
    }
    return 'Read offer';
};

const shopOfferSignalAudioCue = (
    tone: ShopOfferSignalTone
): 'shop-signal-setup' | 'shop-signal-recall' | 'shop-signal-safety' | 'shop-signal-key' | 'shop-signal-control' | 'shop-signal-neutral' => {
    if (tone === 'setup') {
        return 'shop-signal-setup';
    }
    if (tone === 'recall') {
        return 'shop-signal-recall';
    }
    if (tone === 'safety') {
        return 'shop-signal-safety';
    }
    if (tone === 'key') {
        return 'shop-signal-key';
    }
    if (tone === 'control') {
        return 'shop-signal-control';
    }
    return 'shop-signal-neutral';
};

const shopOfferSignalScreenCue = (tone: ShopOfferSignalTone): 'snap' | 'pulse' | 'guard' | 'burst' => {
    if (tone === 'setup' || tone === 'key') {
        return 'burst';
    }
    if (tone === 'safety' || tone === 'control') {
        return 'guard';
    }
    if (tone === 'recall') {
        return 'pulse';
    }
    return 'snap';
};

const shopOfferRecommendationBeatCount = (tone: ShopOfferImpactCue['tone']): 2 | 3 | 4 => {
    if (tone === 'route' || tone === 'payoff') {
        return 4;
    }
    if (tone === 'setup' || tone === 'safety' || tone === 'control') {
        return 3;
    }
    return 2;
};

const shopOfferRecommendationAction = (
    tone: ShopOfferImpactCue['tone']
): 'Buy route' | 'Cash payoff' | 'Clear blocker' | 'Prime combo' | 'Read buy' | 'Shield run' => {
    if (tone === 'route') {
        return 'Buy route';
    }
    if (tone === 'payoff') {
        return 'Cash payoff';
    }
    if (tone === 'setup') {
        return 'Prime combo';
    }
    if (tone === 'safety') {
        return 'Shield run';
    }
    if (tone === 'control') {
        return 'Clear blocker';
    }
    return 'Read buy';
};

const shopOfferRecommendationAudioCue = (
    tone: ShopOfferImpactCue['tone']
):
    | 'shop-recommendation-blocked'
    | 'shop-recommendation-control'
    | 'shop-recommendation-neutral'
    | 'shop-recommendation-payoff'
    | 'shop-recommendation-route'
    | 'shop-recommendation-safety'
    | 'shop-recommendation-setup' => {
    if (tone === 'route') {
        return 'shop-recommendation-route';
    }
    if (tone === 'payoff') {
        return 'shop-recommendation-payoff';
    }
    if (tone === 'setup') {
        return 'shop-recommendation-setup';
    }
    if (tone === 'safety') {
        return 'shop-recommendation-safety';
    }
    if (tone === 'control') {
        return 'shop-recommendation-control';
    }
    if (tone === 'blocked') {
        return 'shop-recommendation-blocked';
    }
    return 'shop-recommendation-neutral';
};

const shopOfferRecommendationScreenCue = (
    tone: ShopOfferImpactCue['tone']
): 'blocked' | 'burst' | 'guard' | 'pulse' | 'snap' => {
    if (tone === 'route' || tone === 'payoff') {
        return 'burst';
    }
    if (tone === 'safety' || tone === 'control') {
        return 'guard';
    }
    if (tone === 'setup') {
        return 'pulse';
    }
    if (tone === 'blocked') {
        return 'blocked';
    }
    return 'snap';
};

const shopPayoffEngineBeatCount = (tone: ReturnType<typeof getInventoryPayoffEngineSignal>['tone']): 2 | 4 | 5 => {
    if (tone === 'super') {
        return 5;
    }
    if (tone === 'burst') {
        return 4;
    }
    return 2;
};

const shopPayoffEngineAction = (
    tone: ReturnType<typeof getInventoryPayoffEngineSignal>['tone']
): 'Push buy stack' | 'Prime buy route' | 'Choose buy' => {
    if (tone === 'super') {
        return 'Push buy stack';
    }
    if (tone === 'burst') {
        return 'Prime buy route';
    }
    return 'Choose buy';
};

const shopPayoffEngineAudioCue = (
    tone: ReturnType<typeof getInventoryPayoffEngineSignal>['tone']
): 'shop-payoff-engine-super' | 'shop-payoff-engine-burst' | 'shop-payoff-engine-setup' => {
    if (tone === 'super') {
        return 'shop-payoff-engine-super';
    }
    if (tone === 'burst') {
        return 'shop-payoff-engine-burst';
    }
    return 'shop-payoff-engine-setup';
};

const shopPayoffEngineScreenCue = (tone: ReturnType<typeof getInventoryPayoffEngineSignal>['tone']): 'super' | 'burst' | 'pulse' => {
    if (tone === 'super') {
        return 'super';
    }
    if (tone === 'burst') {
        return 'burst';
    }
    return 'pulse';
};

const KEY_SHOP_ITEM_IDS = new Set<RunShopOfferState['itemId']>([
    'iron_key',
    'treasure_key',
    'shrine_key',
    'boss_key',
    'trap_key',
    'master_key'
]);

const shopOfferFitRows = (
    offer: RunShopOfferState,
    run: RunState
): { id: string; label: string; value: string; tone: ShopOfferFitTone }[] => {
    const rows: { id: string; label: string; value: string; tone: ShopOfferFitTone }[] = [];
    if (offer.itemId === 'region_shuffle_charge' || offer.itemId === 'trait_routing_kit') {
        const traitBuildRows = getTraitBuildRewardRowsForBoard(run.board).slice(0, 1);
        if (traitBuildRows[0]) {
            rows.push({
                id: 'board-fit',
                label: 'Board fit',
                value: traitBuildRows[0].label,
                tone: 'setup'
            });
            rows.push({
                id: 'trait-link',
                label: 'Trait link',
                value: traitBuildRows[0].traitKinds.slice(0, 2).join(' + '),
                tone: 'setup'
            });
        }
    }
    if (KEY_SHOP_ITEM_IDS.has(offer.itemId) && run.pendingRouteCardPlan) {
        rows.push({
            id: 'route-fit',
            label: 'Route fit',
            value: routeTypeLabel(run.pendingRouteCardPlan.routeType),
            tone: 'route'
        });
    }
    if (offer.itemId === 'heal_life') {
        rows.push({
            id: 'life-fit',
            label: 'Run fit',
            value: run.lives <= 2 ? 'Low-life buffer' : 'Extra safety',
            tone: run.lives <= 2 ? 'safety' : 'neutral'
        });
    }
    return rows;
};

const shopOfferBoardMoment = (
    offer: RunShopOfferState,
    fitRows: ReturnType<typeof shopOfferFitRows>
): ShopOfferBoardMoment => {
    const routeFit = fitRows.find((row) => row.tone === 'route');
    if (routeFit) {
        return { label: 'Board moment', value: `Open ${routeFit.value.toLowerCase()}`, tone: 'route' };
    }
    const setupFit = fitRows.find((row) => row.tone === 'setup');
    switch (offer.itemId) {
        case 'peek_charge':
            return { label: 'Board moment', value: 'Light a hidden pair', tone: 'scout' };
        case 'region_shuffle_charge':
            return {
                label: 'Board moment',
                value: setupFit ? `Pull ${setupFit.value} together` : 'Pull traits together',
                tone: 'setup'
            };
        case 'destroy_charge':
            return { label: 'Board moment', value: 'Erase a blocker', tone: 'control' };
        case 'trait_cleanse':
            return { label: 'Board moment', value: 'Defuse risky traits', tone: 'safety' };
        case 'trait_routing_kit':
            return {
                label: 'Board moment',
                value: setupFit ? `Map ${setupFit.value}` : 'Map a trait combo',
                tone: 'setup'
            };
        case 'heal_life':
            return { label: 'Board moment', value: 'Absorb one miss', tone: 'safety' };
        case 'master_key':
            return { label: 'Board moment', value: 'Open any locked route', tone: 'route' };
        default:
            return { label: 'Board moment', value: 'Open its locked route', tone: 'route' };
    }
};

const shopOfferActionAriaLabel = (
    offer: RunShopOfferState,
    shopGold: number,
    fitRows: ReturnType<typeof shopOfferFitRows>,
    payoffBurst: ShopOfferPayoffBurst,
    boardMoment: ShopOfferBoardMoment,
    buyCue: ShopOfferBuyCue,
    impactCue: ShopOfferImpactCue,
    heatCue: ShopOfferHeatCue,
    buyPlan: ShopOfferBuyPlan,
    recommendationCopy = ''
): string => {
    const payoff = shopOfferPayoffRows(offer, shopGold)
        .map((row) => `${row.label}: ${row.value}`)
        .join('. ');
    const fit = fitRows.length > 0 ? ` Fit: ${fitRows.map((row) => `${row.label}: ${row.value}`).join('. ')}.` : '';
    const action = offer.purchased ? 'Claimed' : `Spend ${offer.cost}g`;
    return `${action} on ${offer.label}. ${heatCue.label}: ${heatCue.value}. ${heatCue.detail}. Impact cue: ${impactCue.label}: ${impactCue.value}. Buy plan: First: ${buyPlan.first}. Then: ${buyPlan.then}. Keep: ${buyPlan.keep}. ${payoffBurst.label}: ${payoffBurst.value}. ${boardMoment.label}: ${boardMoment.value}. ${buyCue.label}: ${buyCue.value}. ${recommendationCopy ? `${recommendationCopy} ` : ''}${payoff}.${fit} ${offer.description}`.trim();
};

const shopOfferBuyCue = (
    offer: RunShopOfferState,
    shopGold: number,
    boardMoment: ShopOfferBoardMoment
): ShopOfferBuyCue => {
    const status = offerStatus(offer, shopGold);
    if (status === 'claimed') {
        return { label: 'Claimed cue', value: 'Already in your run', tone: 'claimed' };
    }
    if (status === 'incompatible') {
        return {
            label: 'Blocked cue',
            value: offer.unavailableReason ?? 'This run cannot use it',
            tone: 'blocked'
        };
    }
    if (status === 'insufficient') {
        return {
            label: 'Blocked cue',
            value: `Need ${offer.cost - shopGold}g before ${boardMoment.value.toLowerCase()}`,
            tone: 'blocked'
        };
    }
    return {
        label: 'Buy cue',
        value: `Buy then ${boardMoment.value.toLowerCase()}`,
        tone: 'available'
    };
};

const shopOfferPayoffBurst = (
    offer: RunShopOfferState,
    shopGold: number,
    fitRows: ReturnType<typeof shopOfferFitRows>
): ShopOfferPayoffBurst => {
    const status = offerStatus(offer, shopGold);
    if (status !== 'available') {
        return {
            label: 'Blocked',
            value: statusText(offer, shopGold),
            tier: 'blocked'
        };
    }
    const routeFit = fitRows.find((row) => row.tone === 'route');
    if (routeFit) {
        return {
            label: 'Route unlock',
            value: routeFit.value,
            tier: 'route'
        };
    }
    const setupFit = fitRows.find((row) => row.tone === 'setup');
    if (setupFit) {
        return {
            label: 'Prime burst',
            value: setupFit.value,
            tier: 'setup'
        };
    }
    const safetyFit = fitRows.find((row) => row.tone === 'safety');
    if (safetyFit || offer.itemId === 'heal_life') {
        return {
            label: 'Survival buy',
            value: safetyFit?.value ?? shopOfferPayoffLine(offer),
            tier: 'safety'
        };
    }
    return {
        label: 'Best buy',
        value: shopOfferPayoffLine(offer),
        tier: 'best'
    };
};

const shopOfferImpactCue = (
    offer: RunShopOfferState,
    payoffBurst: ShopOfferPayoffBurst,
    boardMoment: ShopOfferBoardMoment,
    buyCue: ShopOfferBuyCue
): ShopOfferImpactCue => {
    if (buyCue.tone === 'claimed') {
        return { label: 'Claimed', value: 'Already owned', tone: 'claimed' };
    }
    if (buyCue.tone === 'blocked' || payoffBurst.tier === 'blocked') {
        return { label: 'Blocked', value: buyCue.value, tone: 'blocked' };
    }
    if (payoffBurst.tier === 'route' || boardMoment.tone === 'route') {
        return { label: 'Buy route', value: boardMoment.value, tone: 'route' };
    }
    if (payoffBurst.tier === 'setup' || boardMoment.tone === 'setup') {
        return { label: 'Prime combo', value: boardMoment.value, tone: 'setup' };
    }
    if (payoffBurst.tier === 'safety' || boardMoment.tone === 'safety' || offer.itemId === 'heal_life') {
        return { label: 'Shield run', value: boardMoment.value, tone: 'safety' };
    }
    if (boardMoment.tone === 'control') {
        return { label: 'Clear blocker', value: boardMoment.value, tone: 'control' };
    }
    if (boardMoment.tone === 'scout') {
        return { label: 'Pair scout', value: boardMoment.value, tone: 'scout' };
    }
    return { label: 'Buy burst', value: payoffBurst.value, tone: 'payoff' };
};

const shopOfferHeatCue = (
    offer: RunShopOfferState,
    payoffBurst: ShopOfferPayoffBurst,
    boardMoment: ShopOfferBoardMoment,
    buyCue: ShopOfferBuyCue,
    fitRows: ReturnType<typeof shopOfferFitRows>
): ShopOfferHeatCue => {
    if (buyCue.tone === 'claimed') {
        return {
            detail: 'Already in your run',
            label: 'Shop heat',
            tier: 'claimed',
            value: 'Claimed'
        };
    }
    if (buyCue.tone === 'blocked' || payoffBurst.tier === 'blocked') {
        return {
            detail: buyCue.value,
            label: 'Shop heat',
            tier: 'blocked',
            value: 'Blocked'
        };
    }
    const routeFit = fitRows.find((row) => row.tone === 'route');
    if (routeFit || payoffBurst.tier === 'route') {
        return {
            detail: boardMoment.value,
            label: 'Shop heat',
            tier: 'route',
            value: 'Live route'
        };
    }
    const setupFit = fitRows.find((row) => row.tone === 'setup');
    if (setupFit || payoffBurst.tier === 'setup') {
        return {
            detail: boardMoment.value,
            label: 'Shop heat',
            tier: 'setup',
            value: 'Combo route'
        };
    }
    if (payoffBurst.tier === 'safety' || boardMoment.tone === 'safety' || offer.itemId === 'heal_life') {
        return {
            detail: boardMoment.value,
            label: 'Shop heat',
            tier: 'safety',
            value: 'Safety shield'
        };
    }
    return {
        detail: payoffBurst.value,
        label: 'Shop heat',
        tier: 'best',
        value: 'Hot buy'
    };
};

const shopOfferBuyPlan = (
    payoffRows: ReturnType<typeof shopOfferPayoffRows>,
    boardMoment: ShopOfferBoardMoment,
    buyCue: ShopOfferBuyCue,
    impactCue: ShopOfferImpactCue
): ShopOfferBuyPlan => {
    const rewardRow = payoffRows.find((row) => row.id === 'gain');
    const nextRow = payoffRows.find((row) => row.id === 'next');
    const setupRow = payoffRows.find((row) => row.id === 'setup');
    const blockedRow = payoffRows.find((row) => row.id === 'blocked');
    const costRow = payoffRows.find((row) => row.id === 'cost');

    if (buyCue.tone !== 'available') {
        return {
            first: blockedRow?.value ?? buyCue.value,
            then: costRow?.value ?? 'Find shop gold',
            keep: boardMoment.value,
            tone: impactCue.tone
        };
    }

    return {
        first: rewardRow?.value ?? impactCue.value,
        then: setupRow?.value ?? nextRow?.value ?? boardMoment.value,
        keep: nextRow?.value ?? boardMoment.value,
        tone: impactCue.tone
    };
};

const formatShopRowsLabel = (
    label: string,
    rows: readonly { label: string; value?: string }[]
): string => {
    const rowCopy = rows.map((row) => `${row.label}${row.value ? `: ${row.value}` : ''}`).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const routeTypeLabel = (routeType: RouteNodeType): string =>
    routeType === 'safe' ? 'Safe route' : routeType === 'greed' ? 'Greedy route' : 'Mystery route';

const routeCardKindForRouteType = (routeType: RouteNodeType): RouteCardKind =>
    routeType === 'safe' ? 'safe_ward' : routeType === 'greed' ? 'greed_cache' : 'mystery_veil';

const routeCardLabel = (kind: RouteCardKind): string =>
    kind === 'safe_ward' ? 'Safe Ward' : kind === 'greed_cache' ? 'Greed Cache' : 'Mystery Veil';

const routeWorldLine = (routeType: RouteNodeType, cardLabel: string): string =>
    routeType === 'safe'
        ? `${routeTypeLabel(routeType)} locked in. The next floor adds ${cardLabel} support and suppresses route-added hazards.`
        : routeType === 'greed'
          ? `${routeTypeLabel(routeType)} locked in. The next floor adds ${cardLabel} rewards plus extra reward-risk pressure.`
          : `${routeTypeLabel(routeType)} locked in. The next floor adds deterministic ${cardLabel} veils with fair reveal counterplay.`;

const shopFooterBackDescription = (inFloorShop: boolean, nextCue: string): string =>
    inFloorShop ? `Return with ${nextCue.toLowerCase()}` : 'Review the route, rewards, and gold before leaving.';

const shopFooterContinueDescription = (
    run: RunState,
    inFloorShop: boolean,
    nextCue: string
): string => {
    if (inFloorShop) {
        return `Carry ${nextCue.toLowerCase()} back to the board.`;
    }
    if (run.pendingRouteCardPlan) {
        return `${routeTypeLabel(run.pendingRouteCardPlan.routeType)} starts with ${nextCue.toLowerCase()}.`;
    }
    return `Next floor starts with ${nextCue.toLowerCase()}.`;
};

const offerStatus = (offer: RunShopOfferState, shopGold: number): OfferStatus => {
    if (offer.purchased) {
        return 'claimed';
    }
    if (!offer.compatible) {
        return 'incompatible';
    }
    if (shopGold < offer.cost) {
        return 'insufficient';
    }
    return 'available';
};

const statusText = (offer: RunShopOfferState, shopGold: number): string => {
    const status = offerStatus(offer, shopGold);
    if (status === 'claimed') {
        return 'Claimed';
    }
    if (status === 'incompatible') {
        return offer.unavailableReason ?? 'Unavailable';
    }
    if (status === 'insufficient') {
        return 'Not enough shop gold';
    }
    return `${offer.cost}g`;
};

type ShopOfferLaneId = 'route' | 'setup' | 'safety' | 'control' | 'payoff' | 'blocked';

interface ShopOfferLaneMapEntry {
    id: ShopOfferLaneId;
    label: string;
    count: number;
    cue: string;
}

const SHOP_OFFER_LANE_ORDER: readonly ShopOfferLaneId[] = ['route', 'setup', 'safety', 'control', 'payoff', 'blocked'];

const SHOP_OFFER_LANE_LABEL: Record<ShopOfferLaneId, string> = {
    route: 'Route',
    setup: 'Setup',
    safety: 'Safety',
    control: 'Control',
    payoff: 'Payoff',
    blocked: 'Blocked'
};

const shopOfferLaneId = (impactCue: ShopOfferImpactCue): ShopOfferLaneId => {
    if (impactCue.tone === 'route') {
        return 'route';
    }
    if (impactCue.tone === 'setup') {
        return 'setup';
    }
    if (impactCue.tone === 'safety') {
        return 'safety';
    }
    if (impactCue.tone === 'control' || impactCue.tone === 'scout') {
        return 'control';
    }
    if (impactCue.tone === 'blocked' || impactCue.tone === 'claimed') {
        return 'blocked';
    }
    return 'payoff';
};

const buildShopOfferLaneMap = (run: RunState): ShopOfferLaneMapEntry[] => {
    const lanes = new Map<ShopOfferLaneId, { count: number; cue: string }>();
    for (const offer of run.shopOffers) {
        const fitRows = shopOfferFitRows(offer, run);
        const payoffBurst = shopOfferPayoffBurst(offer, run.shopGold, fitRows);
        const boardMoment = shopOfferBoardMoment(offer, fitRows);
        const buyCue = shopOfferBuyCue(offer, run.shopGold, boardMoment);
        const impactCue = shopOfferImpactCue(offer, payoffBurst, boardMoment, buyCue);
        const lane = shopOfferLaneId(impactCue);
        const existing = lanes.get(lane);
        lanes.set(lane, {
            count: (existing?.count ?? 0) + 1,
            cue: existing?.cue ?? impactCue.value
        });
    }
    return SHOP_OFFER_LANE_ORDER.flatMap((id) => {
        const lane = lanes.get(id);
        return lane ? [{ id, label: SHOP_OFFER_LANE_LABEL[id], count: lane.count, cue: lane.cue }] : [];
    });
};

const shopOfferLaneMapAttr = (laneMap: readonly ShopOfferLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${entry.count}`).join('>');

const shopOfferLaneAction = (lane: ShopOfferLaneMapEntry): string => {
    switch (lane.id) {
        case 'route':
            return 'Open route';
        case 'setup':
            return 'Prime buy';
        case 'safety':
            return 'Buy safety';
        case 'control':
            return 'Buy control';
        case 'payoff':
            return 'Cash payoff';
        case 'blocked':
            return 'Earn gold';
        default:
            return 'Choose offer';
    }
};

const shopOfferLaneRole = (
    lane: Pick<ShopOfferLaneMapEntry, 'count' | 'id'>
): 'Bank' | 'Buy' | 'Cashout' | 'Open' | 'Prime' | 'Stack' => {
    if (lane.count > 1 && lane.id !== 'blocked') {
        return 'Stack';
    }
    switch (lane.id) {
        case 'route':
            return 'Open';
        case 'setup':
            return 'Prime';
        case 'payoff':
            return 'Cashout';
        case 'blocked':
            return 'Bank';
        case 'safety':
        case 'control':
        default:
            return 'Buy';
    }
};

const shopOfferLaneActionMapAttr = (laneMap: readonly ShopOfferLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${shopOfferLaneAction(entry)}:${entry.count}`).join('>');

const shopOfferLaneRoleMapAttr = (laneMap: readonly ShopOfferLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${shopOfferLaneRole(entry)}:${entry.count}`).join('>');

const shopOfferLaneRoleId = (
    lane: Pick<ShopOfferLaneMapEntry, 'count' | 'id'>
): 'bank' | 'buy' | 'cashout' | 'open' | 'prime' | 'stack' => {
    const role = shopOfferLaneRole(lane);
    if (role === 'Bank') {
        return 'bank';
    }
    if (role === 'Cashout') {
        return 'cashout';
    }
    if (role === 'Open') {
        return 'open';
    }
    if (role === 'Prime') {
        return 'prime';
    }
    if (role === 'Stack') {
        return 'stack';
    }
    return 'buy';
};

const shopOfferLaneRoleIdMapAttr = (laneMap: readonly ShopOfferLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${shopOfferLaneRoleId(entry)}:${entry.count}`).join('>');

const shopOfferLaneMapLabel = (laneMap: readonly ShopOfferLaneMapEntry[]): string =>
    formatShopRowsLabel(
        'Shop offer lanes',
        laneMap.map((entry) => ({
            label: entry.label,
            value: `${shopOfferLaneRole(entry)} x${entry.count}. ${shopOfferLaneAction(entry)}. ${entry.cue.trim().replace(/[.!?]+$/, '')}`
        }))
    );

const shopOfferLaneBeatCount = (lane: Pick<ShopOfferLaneMapEntry, 'count' | 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'payoff' || lane.id === 'route' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'blocked' || lane.id === 'safety') {
        return 3;
    }
    return 2;
};

const shopOfferLaneAudioCue = (
    lane: Pick<ShopOfferLaneMapEntry, 'id'>
):
    | 'shop-lane-route'
    | 'shop-lane-setup'
    | 'shop-lane-safety'
    | 'shop-lane-control'
    | 'shop-lane-payoff'
    | 'shop-lane-blocked' => {
    switch (lane.id) {
        case 'route':
            return 'shop-lane-route';
        case 'setup':
            return 'shop-lane-setup';
        case 'safety':
            return 'shop-lane-safety';
        case 'control':
            return 'shop-lane-control';
        case 'payoff':
            return 'shop-lane-payoff';
        default:
            return 'shop-lane-blocked';
    }
};

const shopOfferLaneScreenCue = (
    lane: Pick<ShopOfferLaneMapEntry, 'count' | 'id'>
): 'burst' | 'pulse' | 'guard' | 'control' | 'blocked' => {
    if (lane.id === 'route' || lane.id === 'payoff' || lane.count > 1) {
        return 'burst';
    }
    if (lane.id === 'safety') {
        return 'guard';
    }
    if (lane.id === 'control') {
        return 'control';
    }
    if (lane.id === 'blocked') {
        return 'blocked';
    }
    return 'pulse';
};

const ShopScreen = () => {
    const rootRef = useRef<HTMLElement | null>(null);
    const {
        closeShopToFloorSummary,
        continueFromShop,
        purchaseShopOffer,
        rerollShopOffers,
        run,
        shopReturnMode,
        settings
    } = useAppStore(
        useShallow((state) => ({
            closeShopToFloorSummary: state.closeShopToFloorSummary,
            continueFromShop: state.continueFromShop,
            purchaseShopOffer: state.purchaseShopOffer,
            rerollShopOffers: state.rerollShopOffers,
            run: state.run,
            shopReturnMode: state.shopReturnMode,
            settings: state.settings
        }))
    );
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);

    useModalFocusTrap({
        containerRef: rootRef,
        onDocumentKeyDown: (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                resumeUiSfxContext();
                playUiBackSfx(uiGain);
                closeShopToFloorSummary();
                return true;
            }
            return false;
        }
    });

    if (!run || (run.status !== 'levelComplete' && shopReturnMode !== 'floor')) {
        return null;
    }

    const floor = run.lastLevelResult?.level ?? run.board?.level ?? run.stats.highestLevel;
    const inFloorShop = shopReturnMode === 'floor';
    const rerollCost = getShopRerollCostForFloor(run.board?.level ?? run.stats.highestLevel);
    const rerollAvailable = canRerollShopOffers(run);
    const pendingRouteCardKind = run.pendingRouteCardPlan
        ? routeCardKindForRouteType(run.pendingRouteCardPlan.routeType)
        : null;
    const payoffEngineSignal = getInventoryPayoffEngineSignal(run);
    const payoffEngineBeatCount = shopPayoffEngineBeatCount(payoffEngineSignal.tone);
    const payoffEngineAction = shopPayoffEngineAction(payoffEngineSignal.tone);
    const payoffEngineAudio = shopPayoffEngineAudioCue(payoffEngineSignal.tone);
    const payoffEngineScreenCue = shopPayoffEngineScreenCue(payoffEngineSignal.tone);
    const footerBackDescription = shopFooterBackDescription(inFloorShop, payoffEngineSignal.nextCue);
    const footerContinueDescription = shopFooterContinueDescription(run, inFloorShop, payoffEngineSignal.nextCue);
    const payoffEngineSignalLabel = formatShopRowsLabel('Shop payoff engine', [
        {
            label: payoffEngineSignal.label,
            value: `${payoffEngineAction}. ${payoffEngineSignal.value}. ${payoffEngineSignal.detail}. ${payoffEngineSignal.nextCue}`
        }
    ]);
    const offerLaneMap = buildShopOfferLaneMap(run);
    const primaryOfferLane = offerLaneMap[0] ?? null;
    const offerLaneMapAttr = shopOfferLaneMapAttr(offerLaneMap);
    const offerLaneRoleMapAttr = shopOfferLaneRoleMapAttr(offerLaneMap);
    const offerLaneRoleIdMapAttr = shopOfferLaneRoleIdMapAttr(offerLaneMap);
    const offerLaneMapAccessibleLabel = shopOfferLaneMapLabel(offerLaneMap);

    const onBack = (): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
        closeShopToFloorSummary();
    };

    const onContinue = (): void => {
        resumeUiSfxContext();
        playUiConfirmSfx(uiGain);
        continueFromShop();
    };

    return (
        <section
            aria-label="Vendor alcove"
            aria-modal="true"
            className={styles.overlay}
            data-pending-route-type={run.pendingRouteCardPlan?.routeType ?? 'none'}
            data-shop-gold={run.shopGold}
            data-shop-rerolls={run.shopRerolls}
            data-shop-return-mode={shopReturnMode ?? 'none'}
            data-testid="shop-screen"
            ref={rootRef}
            role="dialog"
            style={GAMEPLAY_VISUAL_CSS_VARS}
            tabIndex={-1}
        >
            <div className={styles.shell}>
                <header className={styles.header}>
                    <div className={styles.headerText}>
                        <span className={styles.eyebrow}>{inFloorShop ? `Floor ${floor}` : `Floor ${floor} clear`}</span>
                        <h2>Vendor alcove</h2>
                        <p>
                            {inFloorShop
                                ? 'Spend current shop gold, then return to the board. This vendor does not advance the floor.'
                                : run.pendingRouteCardPlan && pendingRouteCardKind
                                ? routeWorldLine(run.pendingRouteCardPlan.routeType, routeCardLabel(pendingRouteCardKind))
                                : 'Spend temporary shop gold before the next floor. Unspent gold expires when the run ends.'}
                        </p>
                    </div>
                    <div className={styles.purse} aria-label={`${run.shopGold} shop gold`}>
                        <span>Gold</span>
                        <strong>{run.shopGold}g</strong>
                    </div>
                </header>

                <div
                    aria-label={payoffEngineSignalLabel}
                    className={styles.payoffEngineStrip}
                    data-shop-payoff-engine-action={payoffEngineAction}
                    data-shop-payoff-engine-audio={payoffEngineAudio}
                    data-shop-payoff-engine-beats={payoffEngineBeatCount}
                    data-shop-payoff-engine-screen-cue={payoffEngineScreenCue}
                    data-shop-payoff-engine-tone={payoffEngineSignal.tone}
                    data-testid="shop-payoff-engine"
                >
                    <span>
                        <small>{payoffEngineSignal.label}</small>
                        <strong>{payoffEngineSignal.value}</strong>
                    </span>
                    <span>
                        <small>Live payoffs</small>
                        <strong>{payoffEngineSignal.detail}</strong>
                    </span>
                    <span>
                        <small>Next buy should help</small>
                        <strong>{payoffEngineSignal.nextCue}</strong>
                    </span>
                    <div aria-hidden="true" className={styles.payoffEngineBeatPips}>
                        {Array.from({ length: payoffEngineBeatCount }, (_, beatIndex) => (
                            <i
                                data-shop-payoff-engine-beat={beatIndex + 1}
                                data-shop-payoff-engine-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                key={beatIndex}
                            />
                        ))}
                    </div>
                </div>

                {offerLaneMap.length > 1 ? (
                    <div
                        aria-label={offerLaneMapAccessibleLabel}
                        className={styles.offerLaneMap}
                        data-shop-offer-lane-actions={shopOfferLaneActionMapAttr(offerLaneMap)}
                        data-shop-offer-lane-map={offerLaneMapAttr}
                        data-shop-offer-lane-role-ids={offerLaneRoleIdMapAttr}
                        data-shop-offer-lane-roles={offerLaneRoleMapAttr}
                        data-shop-primary-offer-lane={primaryOfferLane?.id ?? 'none'}
                        data-shop-primary-offer-lane-action={
                            primaryOfferLane ? shopOfferLaneAction(primaryOfferLane) : 'none'
                        }
                        data-shop-primary-offer-lane-audio={
                            primaryOfferLane ? shopOfferLaneAudioCue(primaryOfferLane) : 'none'
                        }
                        data-shop-primary-offer-lane-beats={
                            primaryOfferLane ? shopOfferLaneBeatCount(primaryOfferLane) : 0
                        }
                        data-shop-primary-offer-lane-cue={primaryOfferLane?.cue ?? 'none'}
                        data-shop-primary-offer-lane-role={primaryOfferLane ? shopOfferLaneRole(primaryOfferLane) : 'none'}
                        data-shop-primary-offer-lane-role-id={primaryOfferLane ? shopOfferLaneRoleId(primaryOfferLane) : 'none'}
                        data-shop-primary-offer-lane-screen-cue={
                            primaryOfferLane ? shopOfferLaneScreenCue(primaryOfferLane) : 'none'
                        }
                        data-testid="shop-offer-lane-map"
                    >
                        <span
                            aria-label={`Shop offer lane summary. ${offerLaneMap.length} ${
                                offerLaneMap.length === 1 ? 'lane' : 'lanes'
                            }. ${primaryOfferLane ? `${shopOfferLaneRole(primaryOfferLane)} ${primaryOfferLane.label}` : 'No lead lane'}.`}
                            className={styles.offerLaneMapSummary}
                            data-shop-offer-lane-count={offerLaneMap.length}
                            data-shop-offer-lane-summary-primary={primaryOfferLane?.id ?? 'none'}
                            data-shop-offer-lane-summary-primary-action={
                                primaryOfferLane ? shopOfferLaneAction(primaryOfferLane) : 'none'
                            }
                            data-shop-offer-lane-summary-primary-audio={
                                primaryOfferLane ? shopOfferLaneAudioCue(primaryOfferLane) : 'none'
                            }
                            data-shop-offer-lane-summary-primary-role={primaryOfferLane ? shopOfferLaneRole(primaryOfferLane) : 'none'}
                            data-shop-offer-lane-summary-primary-role-id={primaryOfferLane ? shopOfferLaneRoleId(primaryOfferLane) : 'none'}
                            data-shop-offer-lane-summary-primary-screen-cue={
                                primaryOfferLane ? shopOfferLaneScreenCue(primaryOfferLane) : 'none'
                            }
                            data-testid="shop-offer-lane-map-summary"
                        >
                            <small>Lanes</small>
                            <strong>
                                {offerLaneMap.length} {offerLaneMap.length === 1 ? 'lane' : 'lanes'}
                            </strong>
                            <b>{primaryOfferLane ? `${shopOfferLaneRole(primaryOfferLane)} ${primaryOfferLane.label}` : 'No lead lane'}</b>
                            <span aria-hidden="true" className={styles.offerLaneMapSummaryBeatPips}>
                                {Array.from({ length: Math.max(2, Math.min(5, offerLaneMap.length + 1)) }, (_, beatIndex) => (
                                    <i
                                        data-shop-offer-lane-map-summary-beat={beatIndex + 1}
                                        data-shop-offer-lane-map-summary-beat-focus={
                                            beatIndex === 0 ? primaryOfferLane?.id ?? 'none' : 'support'
                                        }
                                        data-shop-offer-lane-map-summary-beat-role-id={
                                            primaryOfferLane ? shopOfferLaneRoleId(primaryOfferLane) : 'none'
                                        }
                                        data-shop-offer-lane-map-summary-beat-screen-cue={
                                            primaryOfferLane ? shopOfferLaneScreenCue(primaryOfferLane) : 'none'
                                        }
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </span>
                        {primaryOfferLane ? (
                            <span
                                aria-label={`Primary shop lane. ${shopOfferLaneRole(primaryOfferLane)} ${primaryOfferLane.label}: ${shopOfferLaneAction(primaryOfferLane)}. ${primaryOfferLane.cue}. ${shopOfferLaneBeatCount(primaryOfferLane)} beats.`}
                                className={styles.offerLanePrimaryCue}
                                data-shop-primary-offer-lane={primaryOfferLane.id}
                                data-shop-primary-offer-lane-action={shopOfferLaneAction(primaryOfferLane)}
                                data-shop-primary-offer-lane-audio={shopOfferLaneAudioCue(primaryOfferLane)}
                                data-shop-primary-offer-lane-beats={shopOfferLaneBeatCount(primaryOfferLane)}
                                data-shop-primary-offer-lane-cue={primaryOfferLane.cue}
                                data-shop-primary-offer-lane-role={shopOfferLaneRole(primaryOfferLane)}
                                data-shop-primary-offer-lane-role-id={shopOfferLaneRoleId(primaryOfferLane)}
                                data-shop-primary-offer-lane-screen-cue={shopOfferLaneScreenCue(primaryOfferLane)}
                                data-testid="shop-primary-offer-lane"
                            >
                                <small>Best buy lane</small>
                                <strong>{shopOfferLaneRole(primaryOfferLane)}</strong>
                                <b>{shopOfferLaneAction(primaryOfferLane)}</b>
                                <em>{primaryOfferLane.cue}</em>
                                <span aria-hidden="true" className={styles.offerLanePrimaryBeatPips}>
                                    {Array.from({ length: shopOfferLaneBeatCount(primaryOfferLane) }, (_, beatIndex) => (
                                        <i
                                            data-shop-primary-offer-lane-beat={beatIndex + 1}
                                            data-shop-primary-offer-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                            key={beatIndex}
                                        />
                                    ))}
                                </span>
                            </span>
                        ) : null}
                        {offerLaneMap.map((lane) => (
                            <span
                                data-shop-offer-lane={lane.id}
                                data-shop-offer-lane-action={shopOfferLaneAction(lane)}
                                data-shop-offer-lane-audio={shopOfferLaneAudioCue(lane)}
                                data-shop-offer-lane-beats={shopOfferLaneBeatCount(lane)}
                                data-shop-offer-lane-role={shopOfferLaneRole(lane)}
                                data-shop-offer-lane-role-id={shopOfferLaneRoleId(lane)}
                                data-shop-offer-lane-screen-cue={shopOfferLaneScreenCue(lane)}
                                key={lane.id}
                            >
                                <small>{lane.label}</small>
                                <strong>{shopOfferLaneRole(lane)}</strong>
                                <b>{shopOfferLaneAction(lane)}</b>
                                <em>
                                    x{lane.count} / {lane.cue}
                                </em>
                                <span aria-hidden="true" className={styles.offerLaneBeatPips}>
                                    {Array.from({ length: shopOfferLaneBeatCount(lane) }, (_, beatIndex) => (
                                        <i
                                            data-shop-offer-lane-beat={beatIndex + 1}
                                            data-shop-offer-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                            key={beatIndex}
                                        />
                                    ))}
                                </span>
                            </span>
                        ))}
                    </div>
                ) : null}

                <div className={styles.stockGrid} aria-label="Vendor stock" role="list">
                    {run.shopOffers.map((offer) => {
                        const status = offerStatus(offer, run.shopGold);
                        const disabled = status !== 'available';
                        const signalChips = SHOP_OFFER_SIGNAL_BY_ITEM[offer.itemId] ?? [
                            { label: 'Offer', tone: 'neutral' as const }
                        ];
                        const payoffRows = shopOfferPayoffRows(offer, run.shopGold);
                        const fitRows = shopOfferFitRows(offer, run);
                        const payoffBurst = shopOfferPayoffBurst(offer, run.shopGold, fitRows);
                        const boardMoment = shopOfferBoardMoment(offer, fitRows);
                        const buyCue = shopOfferBuyCue(offer, run.shopGold, boardMoment);
                        const impactCue = shopOfferImpactCue(offer, payoffBurst, boardMoment, buyCue);
                        const heatCue = shopOfferHeatCue(offer, payoffBurst, boardMoment, buyCue, fitRows);
                        const buyPlan = shopOfferBuyPlan(payoffRows, boardMoment, buyCue, impactCue);
                        const recommendationCopy =
                            status === 'available' && fitRows.length > 0
                                ? `Best buy: ${fitRows[0]!.label} ${fitRows[0]!.value}.`
                                : '';
                        const recommendationAction = recommendationCopy
                            ? shopOfferRecommendationAction(impactCue.tone)
                            : null;
                        const recommendationAudioCue = recommendationCopy
                            ? shopOfferRecommendationAudioCue(impactCue.tone)
                            : null;
                        const recommendationBeatCount = recommendationCopy
                            ? shopOfferRecommendationBeatCount(impactCue.tone)
                            : 0;
                        const recommendationScreenCue = recommendationCopy
                            ? shopOfferRecommendationScreenCue(impactCue.tone)
                            : null;
                        const signalChipsLabel = formatShopRowsLabel(`${offer.label} offer signals`, signalChips);
                        const payoffRowsLabel = formatShopRowsLabel(`${offer.label} payoff`, payoffRows);
                        const fitRowsLabel = formatShopRowsLabel(`${offer.label} board fit`, fitRows);
                        return (
                            <article
                                className={styles.stockCard}
                                data-offer-id={offer.id}
                                data-offer-item-id={offer.itemId}
                                data-shop-heat={heatCue.tier}
                                data-shop-heat-value={heatCue.value}
                                data-shop-recommendation={recommendationCopy ? 'best-buy' : 'standard'}
                                data-shop-impact-cue={impactCue.label}
                                data-shop-impact-cue-tone={impactCue.tone}
                                data-shop-plan-first={buyPlan.first}
                                data-shop-plan-keep={buyPlan.keep}
                                data-shop-plan-then={buyPlan.then}
                                data-status={status}
                                data-testid={`shop-offer-${offer.itemId}`}
                                key={offer.id}
                                role="listitem"
                            >
                                <div className={styles.stockTopline}>
                                    <span className={styles.stockCategory}>{offer.category}</span>
                                    <span className={styles.stockCost}>{statusText(offer, run.shopGold)}</span>
                                </div>
                                <h3>{offer.label}</h3>
                                {recommendationCopy ? (
                                    <span
                                        aria-label={`${recommendationCopy} ${recommendationAction}. ${recommendationBeatCount} beats.`}
                                        className={styles.stockRecommendation}
                                        data-shop-recommendation-action={recommendationAction ?? 'none'}
                                        data-shop-recommendation-audio={recommendationAudioCue ?? 'none'}
                                        data-shop-recommendation-beats={recommendationBeatCount}
                                        data-shop-recommendation-screen-cue={recommendationScreenCue ?? 'none'}
                                        data-shop-recommendation-tone={impactCue.tone}
                                        data-testid={`shop-offer-${offer.itemId}-recommendation`}
                                    >
                                        <small>Best buy</small>
                                        <b>{recommendationAction}</b>
                                        <strong>{fitRows[0]!.value}</strong>
                                        <span aria-hidden="true" className={styles.stockRecommendationBeatPips}>
                                            {Array.from({ length: recommendationBeatCount }, (_, beatIndex) => (
                                                <i
                                                    data-shop-recommendation-beat={beatIndex + 1}
                                                    data-shop-recommendation-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                    key={beatIndex}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                <span
                                    aria-label={`${heatCue.label}: ${heatCue.value}. ${heatCue.detail}.`}
                                    className={styles.stockHeatCue}
                                    data-shop-heat-tier={heatCue.tier}
                                    data-testid={`shop-offer-${offer.itemId}-heat`}
                                >
                                    <small>{heatCue.label}</small>
                                    <strong>{heatCue.value}</strong>
                                    <em>{heatCue.detail}</em>
                                </span>
                                <span
                                    aria-label={`Shop impact cue: ${impactCue.label}: ${impactCue.value}.`}
                                    className={styles.stockImpactCue}
                                    data-shop-impact-cue-tone={impactCue.tone}
                                    data-testid={`shop-offer-${offer.itemId}-impact-cue`}
                                >
                                    <small>{impactCue.label}</small>
                                    <strong>{impactCue.value}</strong>
                                </span>
                                <span
                                    aria-label={`${payoffBurst.label}: ${payoffBurst.value}.`}
                                    className={styles.stockPayoffBurst}
                                    data-shop-payoff-burst-tier={payoffBurst.tier}
                                    data-testid={`shop-offer-${offer.itemId}-payoff-burst`}
                                >
                                    <small>{payoffBurst.label}</small>
                                    <strong>{payoffBurst.value}</strong>
                                </span>
                                <span
                                    aria-label={`${boardMoment.label}: ${boardMoment.value}.`}
                                    className={styles.stockBoardMoment}
                                    data-shop-board-moment-tone={boardMoment.tone}
                                    data-testid={`shop-offer-${offer.itemId}-board-moment`}
                                >
                                    <small>{boardMoment.label}</small>
                                    <strong>{boardMoment.value}</strong>
                                </span>
                                <span
                                    aria-label={`${buyCue.label}: ${buyCue.value}.`}
                                    className={styles.stockBuyCue}
                                    data-shop-buy-cue-tone={buyCue.tone}
                                    data-testid={`shop-offer-${offer.itemId}-buy-cue`}
                                >
                                    <small>{buyCue.label}</small>
                                    <strong>{buyCue.value}</strong>
                                </span>
                                <span
                                    aria-label={`Buy plan. First: ${buyPlan.first}. Then: ${buyPlan.then}. Keep: ${buyPlan.keep}.`}
                                    className={styles.stockBuyPlan}
                                    data-shop-buy-plan-tone={buyPlan.tone}
                                    data-testid={`shop-offer-${offer.itemId}-buy-plan`}
                                >
                                    <small>First</small>
                                    <strong>{buyPlan.first}</strong>
                                    <small>Then</small>
                                    <strong>{buyPlan.then}</strong>
                                    <small>Keep</small>
                                    <strong>{buyPlan.keep}</strong>
                                </span>
                                <div
                                    aria-label={signalChipsLabel}
                                    className={styles.stockSignalChips}
                                    data-testid={`shop-offer-${offer.itemId}-signals`}
                                >
                                    {signalChips.map((chip) => (
                                        <span
                                            data-shop-signal-action={shopOfferSignalAction(chip.tone)}
                                            data-shop-signal-audio={shopOfferSignalAudioCue(chip.tone)}
                                            data-shop-signal-beats={shopOfferSignalBeatCount(chip.tone)}
                                            data-shop-signal-screen-cue={shopOfferSignalScreenCue(chip.tone)}
                                            data-shop-signal-tone={chip.tone}
                                            key={`${offer.id}:${chip.label}`}
                                        >
                                            {chip.label}
                                            <b>{shopOfferSignalAction(chip.tone)}</b>
                                            <span aria-hidden="true" className={styles.stockSignalBeatPips}>
                                                {Array.from({ length: shopOfferSignalBeatCount(chip.tone) }, (_, beatIndex) => (
                                                    <i
                                                        data-shop-signal-beat={beatIndex + 1}
                                                        data-shop-signal-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                        key={beatIndex}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                                <div
                                    aria-label={payoffRowsLabel}
                                    className={styles.stockPayoffRows}
                                    data-testid={`shop-offer-${offer.itemId}-payoffs`}
                                >
                                    {payoffRows.map((row) => (
                                        <span
                                            data-shop-payoff-action={shopOfferPayoffAction(row)}
                                            data-shop-payoff-audio={shopOfferPayoffAudioCue(row)}
                                            data-shop-payoff-beats={shopOfferPayoffBeatCount(row)}
                                            data-shop-payoff-id={row.id}
                                            data-shop-payoff-screen-cue={shopOfferPayoffScreenCue(row)}
                                            data-shop-payoff-tone={row.tone}
                                            key={row.id}
                                        >
                                            <small>{row.label}</small>
                                            <strong>{row.value}</strong>
                                            <b>{shopOfferPayoffAction(row)}</b>
                                            <span aria-hidden="true" className={styles.stockPayoffBeatPips}>
                                                {Array.from({ length: shopOfferPayoffBeatCount(row) }, (_, beatIndex) => (
                                                    <i
                                                        data-shop-payoff-beat={beatIndex + 1}
                                                        data-shop-payoff-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                        key={beatIndex}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                                {fitRows.length > 0 ? (
                                    <div
                                        aria-label={fitRowsLabel}
                                        className={styles.stockFitRows}
                                        data-testid={`shop-offer-${offer.itemId}-fit`}
                                    >
                                        {fitRows.map((row) => (
                                            <span data-shop-fit-id={row.id} data-shop-fit-tone={row.tone} key={row.id}>
                                                <small>{row.label}</small>
                                                <strong>{row.value}</strong>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                <p>{offer.description}</p>
                                <button
                                    aria-label={shopOfferActionAriaLabel(
                                        offer,
                                        run.shopGold,
                                        fitRows,
                                        payoffBurst,
                                        boardMoment,
                                        buyCue,
                                        impactCue,
                                        heatCue,
                                        buyPlan,
                                        recommendationCopy
                                    )}
                                    className={styles.stockAction}
                                    data-shop-action-cue={impactCue.label}
                                    data-shop-action-tone={impactCue.tone}
                                    data-testid={`shop-offer-${offer.itemId}-action`}
                                    disabled={disabled}
                                    onClick={() => {
                                        resumeUiSfxContext();
                                        playUiClickSfx(uiGain);
                                        purchaseShopOffer(offer.id);
                                    }}
                                    type="button"
                                >
                                    <span>{offer.purchased ? 'Claimed' : `Spend ${offer.cost}g`}</span>
                                    <small>{`${buyPlan.first} -> ${buyPlan.keep}`}</small>
                                    <strong>{impactCue.label}</strong>
                                </button>
                            </article>
                        );
                    })}
                </div>

                <footer className={styles.footer}>
                    <OverlayActionDock
                        actions={[
                            {
                                label: inFloorShop ? 'Back to board' : 'Back to floor summary',
                                description: footerBackDescription,
                                onClick: onBack,
                                variant: 'secondary'
                            },
                            {
                                label: inFloorShop
                                    ? 'Return to board'
                                    : run.pendingRouteCardPlan
                                    ? `Continue to ${routeTypeLabel(run.pendingRouteCardPlan.routeType)} floor`
                                    : 'Continue',
                                description: footerContinueDescription,
                                onClick: onContinue,
                                variant: 'primary'
                            }
                        ]}
                        className={styles.footerActions}
                        leading={
                            <button
                                className={styles.rerollButton}
                                data-testid="shop-reroll-button"
                                disabled={!rerollAvailable}
                                onClick={() => {
                                    resumeUiSfxContext();
                                    playUiClickSfx(uiGain);
                                    rerollShopOffers();
                                }}
                                type="button"
                            >
                                <span>{run.shopRerolls >= 1 ? 'Stock rerolled' : 'Reroll stock'}</span>
                                <small>{run.shopRerolls >= 1 ? 'One reroll per visit' : `${rerollCost}g`}</small>
                            </button>
                        }
                        placement="dock"
                        testId="shop-action-dock"
                    />
                </footer>
            </div>
        </section>
    );
};

export default ShopScreen;
