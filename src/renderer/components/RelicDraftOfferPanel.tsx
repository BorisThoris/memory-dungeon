import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent
} from 'react';
import type { RelicId, RelicOfferServiceState } from '../../shared/contracts';
import {
    getRelicArchetypeLabels,
    getRelicDraftRow,
    getRelicDecisionImpactCopy,
    relicDraftRarityLabel,
    type RelicOfferServiceAction,
    type RelicDraftRarity
} from '../../shared/relics';
import { getTraitBuildDraftHintForRelic } from '../../shared/trait-build-rewards';
import { relicDraftRoundAdvancedAnnouncement } from '../copy/relicDraftOffer';
import styles from './RelicDraftOffer.module.css';

/**
 * RDUI-006: Escape does not dismiss this overlay — GameScreen does not close the relic draft on Escape;
 * the player must choose a relic. (Pause via P is already blocked while `relicOffer` is active; see REF-010.)
 */
const rarityClass = (r: RelicDraftRarity): string => {
    switch (r) {
        case 'common':
            return styles.card_common;
        case 'uncommon':
            return styles.card_uncommon;
        case 'rare':
            return styles.card_rare;
        default:
            return styles.card_common;
    }
};

interface RelicDraftOfferPanelProps {
    optionIds: RelicId[];
    descriptionById: Record<RelicId, string>;
    reasonById?: Partial<Record<RelicId, string>>;
    onPick: (id: RelicId) => void;
    serviceActions?: (RelicOfferServiceAction | RelicOfferServiceState)[];
    onUseService?: (serviceId: RelicOfferServiceAction['serviceId'], targetRelicId?: RelicId) => void;
    /** Advances when options reroll mid-visit (multi-pick). */
    pickRound: number;
}

const RelicDraftOfferPanel = ({
    optionIds,
    descriptionById,
    reasonById,
    onPick,
    serviceActions: rawServiceActions = [],
    onUseService,
    pickRound
}: RelicDraftOfferPanelProps) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const prevPickRoundRef = useRef<number | null>(null);
    const [politeMessage, setPoliteMessage] = useState('');
    const serviceActions = rawServiceActions.map((service) => ({
        ...service,
        effectPreview:
            service.serviceId === 'reroll_offer'
                ? 'Fresh choices'
                : service.serviceId === 'ban_option'
                  ? 'Remove one option'
                  : 'Favor rare picks'
    }));

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
        queueMicrotask(() => {
            setPoliteMessage(msg);
        });
        const clearId = window.setTimeout(() => {
            setPoliteMessage('');
        }, 1500);
        return () => {
            window.clearTimeout(clearId);
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
        const active = document.activeElement;
        let idx = buttons.indexOf(active as HTMLButtonElement);
        if (idx < 0) {
            idx = 0;
        } else {
            idx = (idx + delta + buttons.length) % buttons.length;
        }
        buttons[idx]?.focus();
    }, []);

    const onGridKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>): void => {
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const root = gridRef.current;
            const buttons = root ? ([...root.querySelectorAll('button')] as HTMLButtonElement[]) : [];

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                event.stopPropagation();
                moveFocus(1);
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                event.stopPropagation();
                moveFocus(-1);
                return;
            }
            if (event.key === 'Home' && buttons.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                buttons[0]?.focus();
                return;
            }
            if (event.key === 'End' && buttons.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                buttons[buttons.length - 1]?.focus();
            }
        },
        [moveFocus]
    );

    return (
        <div className={styles.panelRoot}>
            <div aria-live="polite" className={styles.liveRegion} role="status">
                {politeMessage}
            </div>
            <div
                className={styles.grid}
                onKeyDown={onGridKeyDown}
                ref={gridRef}
                role="group"
                aria-label="Relic choices"
            >
                {optionIds.map((id, index) => {
                    const row = getRelicDraftRow(id);
                    const desc = descriptionById[id] ?? id;
                    const reason = reasonById?.[id];
                    const archetypes = getRelicArchetypeLabels(id);
                    const impactCopy = getRelicDecisionImpactCopy(id);
                    const traitBuildHint = getTraitBuildDraftHintForRelic(id);
                    const ariaTier = relicDraftRarityLabel(row.rarity);
                    const staggerStyle: CSSProperties = {
                        '--relic-card-stagger': index
                    } as CSSProperties;
                    return (
                        <button
                            aria-label={`${ariaTier} relic: ${desc}. ${impactCopy}${traitBuildHint ? `. ${traitBuildHint}` : ''}${reason ? `. ${reason}` : ''}`}
                            className={`${styles.card} ${rarityClass(row.rarity)}`}
                            data-testid="relic-offer-card"
                            key={`${id}-${pickRound}`}
                            onClick={() => onPick(id)}
                            style={staggerStyle}
                            type="button"
                        >
                            <span aria-hidden className={styles.runeStrip} />
                            {reason ? <span className={styles.reason}>{reason}</span> : null}
                            <span className={styles.archetypes}>{archetypes.join(' · ')}</span>
                            <span className={styles.impact}>{impactCopy}</span>
                            {traitBuildHint ? <span className={styles.impact}>{traitBuildHint}</span> : null}
                            <p className={styles.body}>{desc}</p>
                        </button>
                    );
                })}
            </div>
            {serviceActions.length > 0 ? (
                <div className={styles.serviceRow} data-testid="relic-offer-services">
                    {serviceActions.map((service) => (
                        <button
                            className={styles.serviceButton}
                            disabled={!service.available}
                            key={service.serviceId}
                            onClick={() => onUseService?.(service.serviceId, optionIds[0])}
                            title={service.unavailableReason ?? service.description}
                            type="button"
                        >
                            <span>{service.label}</span>
                            <small>
                                {service.cost}g · {service.available ? service.effectPreview : service.unavailableReason}
                            </small>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default RelicDraftOfferPanel;
