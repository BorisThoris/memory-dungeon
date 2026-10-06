import { useId } from 'react';
import type { RunState } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { elementReactionResult } from '../../shared/element-reaction-feedback';
import { elementWashCapacity, elementCastPower } from '../../shared/element-group-rules';
import { resonanceOf, resonanceTier, runElementResonance, pendingElementReaction, elementReactionSummary, ELEMENT_REACTIONS } from '../../shared/element-resonance-rules';
import { TILE_SUITS, getTileSuit } from '../../shared/tile-suit-rules';
import { runChainTier, type ChainMomentumRun } from '../../shared/chain-tier-rules';
import { CHAIN_MULT } from '../../shared/chunk-break-rules';
import { focusOf } from '../../shared/elemental-loot-rules';
import { ELEMENT_ACTION, ARENA_ACTION, focusSummary } from '../copy/elementClarity';
import { useTutorialHall } from './tutorialHallContext';
import styles from './ElementCastGuide.module.css';

/** A glance reference. Guided examples live in the Tutorial Hall. */
export function ElementCastGuide({ run }: { run: Pick<RunState, 'stats' | 'board' | 'realmId' | 'realmSecondaryId' | 'elementResonance' | 'elementalFocus' | 'elementalEssence' | 'elementStreak' | 'realmAttunement'> & ChainMomentumRun }) {
    const id = useId();
    const openTutorial = useTutorialHall();
    const resonance = runElementResonance(run);
    const lastCast = run.board?.elementCast;
    const multiplier = CHAIN_MULT[runChainTier(run)];
    return <>
        <button className={styles.trigger} type="button" popoverTarget={id} aria-label="How elemental matches work" data-testid="element-cast-guide">Casts</button>
        <div id={id} className={styles.panel} popover="auto" role="dialog" aria-label="Elemental cast rules" data-testid="element-cast-rules"
            onToggle={(event) => { event.currentTarget.dataset.castGuideOpen = String(event.newState === 'open'); }}>
            <div className={styles.content} data-testid="element-cast-scroll">
                <strong className={styles.heading}>Every pair casts</strong>
                <div className={styles.grid}>{TILE_SUITS.map(suit => {
                    const pending = pendingElementReaction(run, suit);
                    const focus = focusOf(run, suit);
                    const power = elementCastPower(run.stats.currentStreak, resonanceTier(resonanceOf(resonance, suit)) + focus, 1, multiplier);
                    return <div className={styles.rule} key={suit}>
                        <strong><span aria-hidden="true">{getTileSuit(suit).rune} </span>{ELEMENT_NAMES[suit]}</strong>
                        <span>{ELEMENT_ACTION[suit]}</span>
                        <small>{suit === 'tide' ? elementWashCapacity(power) : power.targets}+ cards · +{power.extraReach} reach</small>
                        {pending ? <span className={styles.preview} data-testid={`element-next-${suit}`}><strong>{pending.definition.name} ×{pending.potency}</strong><br />{elementReactionSummary(pending.definition.kind, pending.potency)}</span> : null}
                        {focus > 0 ? <small>{focusSummary(suit, focus)}</small> : null}
                    </div>;
                })}</div>
                <p className={styles.formula}>Same element twice → switch element. A miss breaks the streak.</p>
                {openTutorial ? <div className={styles.recipes} aria-label="Practise combinations">{Object.values(ELEMENT_REACTIONS).map(reaction => <button type="button" key={reaction.kind} onClick={() => openTutorial(reaction.kind)}>
                    <span>{reaction.elements.map(suit => ELEMENT_NAMES[suit]).join(' + ')}</span><strong>{reaction.name} ↗</strong>
                </button>)}</div> : null}
                {run.realmId ? <span className={styles.arena}>{ARENA_ACTION[run.realmId]}</span> : null}
                {run.realmSecondaryId ? <span>{ARENA_ACTION[run.realmSecondaryId]}</span> : null}
                {lastCast ? <details className={styles.receipt} data-testid="element-cast-receipt"><summary>Last match · {ELEMENT_NAMES[lastCast.suit]}{lastCast.reaction ? ` + ${lastCast.reaction}` : ''}</summary>
                    {lastCast.reactions?.map(reaction => <div className={styles.reactionResult} key={`${reaction.scope}:${reaction.kind}`} data-testid={`reaction-result-${reaction.scope}`}>
                        <strong>{reaction.scope === 'ground' ? 'Ground' : 'Amplified'} · {ELEMENT_REACTIONS[reaction.kind].name} ×{reaction.potency}</strong>
                        <span>{elementReactionResult(reaction)}</span>
                    </div>)}
                    <p>{lastCast.detail}</p>
                </details> : null}
            </div>
            <div className={styles.actions}>{openTutorial ? <button className={styles.close} type="button" onClick={() => openTutorial()}>Tutorial Hall</button> : null}<button className={styles.close} type="button" popoverTarget={id} popoverTargetAction="hide">Back</button></div>
        </div>
    </>;
}
