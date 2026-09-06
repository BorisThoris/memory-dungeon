import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { RelicId, RelicOfferServiceState } from '../../shared/contracts';
import { RELIC_CATALOG } from '../../shared/game-catalog';
import {
    getRelicArchetypeLabels,
    getRelicDraftRow,
    getRelicDecisionImpactCopy,
    relicDraftRarityLabel,
    type RelicOfferServiceAction,
    type RelicDraftRarity
} from '../../shared/relics';
import { playRelicChoiceCrescendoSfx, resumeAudioContext, type RelicChoiceCrescendoSfxTier } from '../audio/gameSfx';
import { getTraitBuildDraftHintForRelic } from '../../shared/trait-build-rewards';
import { relicDraftRoundAdvancedAnnouncement, SEALED_RELIC_COPY } from '../copy/relicDraftOffer';
import styles from './RelicDraftOffer.module.css';

/**
 * Relic milestone. Three cards that each say one thing: tier, build tag, the effect, one
 * line on what it does for the run. A service row under them. Escape does not dismiss this
 * overlay; the player must choose (RDUI-006).
 */

interface RelicDraftOfferPanelProps {
    optionIds: RelicId[];
    /** Relics already owned; a duplicate offer says so on the card. */
    currentRelicIds?: readonly RelicId[];
    descriptionById: Record<RelicId, string>;
    reasonById?: Partial<Record<RelicId, string>>;
    onPick: (id: RelicId) => void;
    serviceActions?: (RelicOfferServiceAction | RelicOfferServiceState)[];
    onUseService?: (serviceId: RelicOfferServiceAction['serviceId'], targetRelicId?: RelicId) => void;
    /** Advances when options reroll mid-visit (multi-pick). */
    pickRound: number;
    /** The offer's sealed option, or null when the pool had nothing left to seal. */
    sealedRelicId?: RelicId | null;
    sfxGain?: number;
}

const SFX_TIER_BY_RARITY: Record<RelicDraftRarity, RelicChoiceCrescendoSfxTier> = {
    common: 'prime',
    uncommon: 'stack',
    rare: 'rare'
};

const SFX_BEATS_BY_RARITY: Record<RelicDraftRarity, number> = { common: 2, uncommon: 3, rare: 4 };

const servicePreview = (service: RelicOfferServiceAction | RelicOfferServiceState): string =>
    'effectPreview' in service
        ? service.effectPreview
        : service.serviceId === 'reroll_offer'
          ? 'Fresh choices'
          : service.serviceId === 'ban_option'
            ? 'Remove one option'
            : 'Favor rare picks';

const RelicDraftOfferPanel = ({
    currentRelicIds = [],
    descriptionById,
    onPick,
    onUseService,
    optionIds,
    pickRound,
    reasonById,
    sealedRelicId = null,
    serviceActions = [],
    sfxGain = 0
}: RelicDraftOfferPanelProps) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const prevPickRoundRef = useRef<number | null>(null);
    const lastSfxSignatureRef = useRef<string | null>(null);
    const [politeMessage, setPoliteMessage] = useState('');

    useEffect(() => {
        const prev = prevPickRoundRef.current;
        if (prev === null) {
            prevPickRoundRef.current = pickRound;
            return undefined;
        }
        prevPickRoundRef.current = pickRound;
        if (pickRound <= prev) {
            return undefined;
        }
        const msg = relicDraftRoundAdvancedAnnouncement();
        let active = true;
        let announceId: number | null = null;
        let clearId: number | null = null;
        // Clear first so a repeated announcement re-fires in the live region.
        queueMicrotask(() => {
            if (!active) {
                return;
            }
            setPoliteMessage('');
            announceId = window.setTimeout(() => {
                announceId = null;
                if (!active) {
                    return;
                }
                setPoliteMessage(msg);
                clearId = window.setTimeout(() => {
                    if (active) {
                        setPoliteMessage('');
                    }
                }, 1500);
            }, 0);
        });
        return () => {
            active = false;
            if (announceId !== null) {
                window.clearTimeout(announceId);
            }
            if (clearId !== null) {
                window.clearTimeout(clearId);
            }
        };
    }, [pickRound]);

    const optionIdsKey = optionIds.join(',');

    useEffect(() => {
        const id = window.requestAnimationFrame(() => {
            gridRef.current?.querySelector('button')?.focus();
        });
        return () => window.cancelAnimationFrame(id);
    }, [optionIdsKey, pickRound]);

    const moveFocus = useCallback((delta: number): void => {
        const root = gridRef.current;
        if (!root) {
            return;
        }
        const buttons = [...root.querySelectorAll('button')] as HTMLButtonElement[];
        if (buttons.length === 0) {
            return;
        }
        let idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        idx = idx < 0 ? 0 : (idx + delta + buttons.length) % buttons.length;
        buttons[idx]?.focus();
    }, []);

    const onGridKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>): void => {
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const buttons = gridRef.current ? ([...gridRef.current.querySelectorAll('button')] as HTMLButtonElement[]) : [];
            const handlers: Record<string, () => void> = {
                ArrowRight: () => moveFocus(1),
                ArrowLeft: () => moveFocus(-1),
                Home: () => buttons[0]?.focus(),
                End: () => buttons[buttons.length - 1]?.focus()
            };
            const handler = handlers[event.key];
            if (!handler || buttons.length === 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            handler();
        },
        [moveFocus]
    );

    const playChoiceSfx = useCallback(
        (id: RelicId, rarity: RelicDraftRarity): void => {
            const signature = `${pickRound}:${id}:${rarity}`;
            if (lastSfxSignatureRef.current === signature || sfxGain <= 0) {
                return;
            }
            lastSfxSignatureRef.current = signature;
            resumeAudioContext();
            playRelicChoiceCrescendoSfx(sfxGain, SFX_TIER_BY_RARITY[rarity], SFX_BEATS_BY_RARITY[rarity]);
        },
        [pickRound, sfxGain]
    );

    return (
        <div className={styles.panel}>
            <div aria-live="polite" className={styles.liveRegion} role="status">
                {politeMessage}
            </div>
            <div aria-label="Relic choices" className={styles.grid} onKeyDown={onGridKeyDown} ref={gridRef} role="group">
                {optionIds.map((id) => {
                    const row = getRelicDraftRow(id);
                    const title = RELIC_CATALOG[id]?.title ?? id;
                    const effect = descriptionById[id] ?? id;
                    const reason = reasonById?.[id];
                    // Archetype labels read "The Warden / The Conduit Cartographer: guard, absorb, stabilize.";
                    // the chip carries the name, the accessible name carries the whole line.
                    const archetypes = getRelicArchetypeLabels(id);
                    const tag = archetypes[0]?.split(':')[0] ?? null;
                    const buildHint = getTraitBuildDraftHintForRelic(id);
                    const impact = getRelicDecisionImpactCopy(id);
                    const tier = relicDraftRarityLabel(row.rarity);
                    const owned = currentRelicIds.includes(id);
                    return (
                        <button
                            aria-label={`${tier} relic: ${title}. ${effect} ${impact}${archetypes.length > 0 ? ` ${archetypes.join(' ')}` : ''}${
                                buildHint ? ` ${buildHint}.` : ''
                            }${owned ? ' Already owned; stacks.' : ''}${reason ? ` ${reason}` : ''}`}
                            className={styles.card}
                            data-rarity={row.rarity}
                            data-testid="relic-offer-card"
                            key={`${id}-${pickRound}`}
                            onClick={() => onPick(id)}
                            onFocus={() => playChoiceSfx(id, row.rarity)}
                            onMouseEnter={() => playChoiceSfx(id, row.rarity)}
                            type="button"
                        >
                            <span className={styles.cardHead}>
                                <span className={styles.tier}>{tier}</span>
                                {tag ? <span className={styles.tag}>{tag}</span> : null}
                            </span>
                            <strong className={styles.title}>{title}</strong>
                            <span className={styles.effect}>{effect}</span>
                            <span className={styles.impact}>{impact}</span>
                            {buildHint ? <span className={styles.build}>{buildHint}</span> : null}
                            {owned ? <span className={styles.note}>Already owned. Stacks.</span> : null}
                            {reason ? <span className={styles.note}>{reason}</span> : null}
                        </button>
                    );
                })}
                {sealedRelicId ? (
                    /*
                     * Deliberately built from copy alone: nothing here reads the relic catalog for
                     * the sealed id, so no title, effect, rarity chip or accessible name can leak
                     * what the card is. The id only leaves this component through `onPick`.
                     */
                    <button
                        aria-label={`${SEALED_RELIC_COPY.tier} relic: ${SEALED_RELIC_COPY.title}. ${SEALED_RELIC_COPY.effect} ${SEALED_RELIC_COPY.impact}`}
                        className={styles.card}
                        data-rarity="sealed"
                        data-testid="relic-offer-sealed-card"
                        key={`sealed-${pickRound}`}
                        onClick={() => onPick(sealedRelicId)}
                        type="button"
                    >
                        <span className={styles.cardHead}>
                            <span className={styles.tier}>{SEALED_RELIC_COPY.tier}</span>
                        </span>
                        <strong className={styles.title}>{SEALED_RELIC_COPY.title}</strong>
                        <span className={styles.effect}>{SEALED_RELIC_COPY.effect}</span>
                        <span className={styles.impact}>{SEALED_RELIC_COPY.impact}</span>
                    </button>
                ) : null}
            </div>
            <div className={styles.footer}>
                <span className={styles.footerLine}>Pick one. It stays for the rest of the run.</span>
                {serviceActions.length > 0 ? (
                    <div className={styles.services} data-testid="relic-offer-services">
                        {serviceActions.map((service) => (
                            <button
                                className={styles.service}
                                disabled={!service.available}
                                key={service.serviceId}
                                onClick={() => onUseService?.(service.serviceId, optionIds[0])}
                                title={service.unavailableReason ?? service.description}
                                type="button"
                            >
                                <span>{service.label}</span>
                                <small>
                                    {service.cost}g · {service.available ? servicePreview(service) : service.unavailableReason}
                                </small>
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default RelicDraftOfferPanel;
