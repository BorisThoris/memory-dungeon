import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { RouteCardKind, RouteNodeType, RunShopOfferState } from '../../shared/contracts';
import { canRerollShopOffers, getShopRerollCostForFloor } from '../../shared/shop-rules';
import {
    playUiBackSfx,
    playUiClickSfx,
    playUiConfirmSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { FittedGrid, OverlayActionDock } from '../ui';
import { useAppStore } from '../store/useAppStore';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import styles from './ShopScreen.module.css';

type OfferStatus = 'available' | 'claimed' | 'insufficient' | 'incompatible';

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

                {/*
                  * Five offers at a readable size are taller than a phone. They page rather
                  * than shrink or clip: the same fitted grid the Codex and the Collection use,
                  * so the vendor never grows a scrollbar and never cuts an offer mid-sentence.
                  */}
                <FittedGrid
                    ariaLabel="Vendor stock"
                    emptyState="The vendor has nothing left this visit."
                    items={run.shopOffers}
                    itemNoun="offers"
                    keyForItem={(offer) => offer.id}
                    minColumnWidth={230}
                    renderItem={(offer) => {
                        const status = offerStatus(offer, run.shopGold);
                        return (
                            <article
                                className={styles.stockCard}
                                data-offer-id={offer.id}
                                data-offer-item-id={offer.itemId}
                                data-status={status}
                                data-testid={`shop-offer-${offer.itemId}`}
                            >
                                <div className={styles.stockTopline}>
                                    <span className={styles.stockCategory}>{offer.category}</span>
                                    <span className={styles.stockCost}>{statusText(offer, run.shopGold)}</span>
                                </div>
                                <h3>{offer.label}</h3>
                                <p>{offer.description}</p>
                                <button
                                    className={styles.stockAction}
                                    disabled={status !== 'available'}
                                    onClick={() => {
                                        resumeUiSfxContext();
                                        playUiClickSfx(uiGain);
                                        purchaseShopOffer(offer.id);
                                    }}
                                    type="button"
                                >
                                    {offer.purchased ? 'Claimed' : `Spend ${offer.cost}g`}
                                </button>
                            </article>
                        );
                    }}
                    resetKey={`shop:${run.shopOffers.length}`}
                    rowHeight={158}
                    testId="shop-stock"
                />

                <footer className={styles.footer}>
                    <OverlayActionDock
                        actions={[
                            {
                                label: inFloorShop ? 'Back to board' : 'Back to floor summary',
                                onClick: onBack,
                                variant: 'secondary'
                            },
                            {
                                label: inFloorShop
                                    ? 'Return to board'
                                    : run.pendingRouteCardPlan
                                    ? `Continue to ${routeTypeLabel(run.pendingRouteCardPlan.routeType)} floor`
                                    : 'Continue',
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
