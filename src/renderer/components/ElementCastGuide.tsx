import { useId } from 'react';
import type { RunState } from '../../shared/contracts';
import { ELEMENT_NAMES, ELEMENT_NEUTRALIZES } from '../../shared/element-alchemy-rules';
import { ELEMENT_MATCH_RULES, elementWashCapacity, elementCastPower } from '../../shared/element-group-rules';
import { ARENA_GROUND_RULES } from '../../shared/element-ground-rules';
import { resonanceOf, resonanceTier, runElementResonance, pendingElementReaction, elementReactionSummary, ELEMENT_REACTIONS } from '../../shared/element-resonance-rules';
import { TILE_SUITS, getTileSuit } from '../../shared/tile-suit-rules';
import { runChainTier, type ChainMomentumRun } from '../../shared/chain-tier-rules';
import { CHAIN_MULT } from '../../shared/chunk-break-rules';
import { focusOf } from '../../shared/elemental-loot-rules';
import { ELEMENT_ACTION, ARENA_ACTION, focusSummary } from '../copy/elementClarity';
import styles from './ElementCastGuide.module.css';

/** The glance view explains decisions; precise rules are one optional disclosure away. */
export function ElementCastGuide({ run }: { run: Pick<RunState, 'stats' | 'board' | 'realmId' | 'realmSecondaryId' | 'elementResonance' | 'elementalFocus' | 'elementalEssence' | 'elementStreak' | 'realmAttunement'> & ChainMomentumRun }) {
    const id = useId();
    const combo = run.stats.currentStreak;
    const resonance = runElementResonance(run);
    const lastCast = run.board?.elementCast;
    const multiplier = CHAIN_MULT[runChainTier(run)];
    return <>
        <button className={styles.trigger} type="button" popoverTarget={id} aria-label="How elemental matches work" data-testid="element-cast-guide" title={lastCast?.detail}>{lastCast?.headline ?? 'Casts'}</button>
        <div id={id} className={styles.panel} popover="auto" role="dialog" aria-label="Elemental cast rules" data-testid="element-cast-rules"
            onToggle={(event) => { event.currentTarget.dataset.castGuideOpen = String(event.newState === 'open'); }}>
            <div className={styles.content} data-testid="element-cast-scroll">
            <strong className={styles.heading}>Match → Cast</strong>
            <span>Every pair casts. Combos make it stronger.</span>
            {lastCast ? <div className={styles.receipt} data-testid="element-cast-receipt">
                <strong>Last match · {ELEMENT_NAMES[lastCast.suit]}{lastCast.reaction ? ` + ${lastCast.reaction}` : ''}</strong>
                <span>{lastCast.detail}</span>
            </div> : null}
            <div className={styles.grid}>{TILE_SUITS.map((suit) => {
                const pending = pendingElementReaction(run, suit);
                const focus = focusOf(run, suit);
                const power = elementCastPower(combo, resonanceTier(resonanceOf(resonance, suit)) + focus, 1, multiplier);
                return <div className={styles.rule} key={suit}>
                    <strong><span aria-hidden="true">{getTileSuit(suit).rune} </span>{ELEMENT_NAMES[suit]}</strong>
                    <span>{ELEMENT_ACTION[suit]}</span>
                    <small>Current strength: {suit === 'tide' ? elementWashCapacity(power) : power.targets}+ cards · +{power.extraReach} reach</small>
                    <small>Resists {ELEMENT_NAMES[ELEMENT_NEUTRALIZES[suit]]}. Own element charges it.</small>
                    {pending ? <span className={styles.preview} data-testid={`element-next-${suit}`}><strong>Next match: {pending.definition.name} ×{pending.potency}</strong><br />{elementReactionSummary(pending.definition.kind, pending.potency)} · bursts up to {pending.potency} extra pairs of each reacting element.</span> : null}
                    {focus > 0 ? <small>{focusSummary(suit, focus)}</small> : null}
                </div>;
            })}</div>
            <span>Same element twice → switch element for an amplified reaction. A miss breaks the streak.</span>
            {run.realmId ? <span className={styles.arena}>{ARENA_ACTION[run.realmId]}</span> : null}
            {run.realmSecondaryId ? <span>{ARENA_ACTION[run.realmSecondaryId]}</span> : null}
            <details className={styles.details}>
                <summary>Six combinations · same rules on every arena</summary>
                <p>Every match paints ground. Different elements react at power 1 around the matched cards. A primed streak uses the same recipe across the board at higher power.</p>
                {Object.values(ELEMENT_REACTIONS).map(reaction => <p key={reaction.kind}><strong>{reaction.elements.map(suit => ELEMENT_NAMES[suit]).join(' + ')} → {reaction.name}</strong><br />{elementReactionSummary(reaction.kind, 1)}</p>)}
                <p>Only the ground under your matched cards chooses the local reaction; neighbours do not. Combined reactions bypass individual card resistance. The first different material in board order wins. Bare cells use the arena, or its second element when your cast matches the first. Painting ground changes what the next match reacts with.</p>
            </details>
            <details className={styles.details}>
                <summary>Details & status key</summary>
                <p>▲ number: burning · ◆ number: frozen turns · ♣ ×: vines hold · ♣ +: harvest gold · ◆ +: calm on match.</p>
                <p>Base reach: 2 steps; 3 in the matching arena. Each 3 combo and each resonance or focus tier adds a step.</p>
                <p>Fire, Frost and Grove start with a 2-card budget. Each 6 combo, 2 tiers, extra popped pair or multiplier doubling adds 1, up to 6. A cast always finishes the connected block it reaches, even beyond its budget and reach. Multiplier now: ×{multiplier}. Water starts at 6 cards, plus 2 per extra reach or target.</p>
                {TILE_SUITS.map(suit => <p key={suit}><strong>{ELEMENT_NAMES[suit]}: </strong>{ELEMENT_MATCH_RULES[suit]}</p>)}
                {run.realmId ? <p>{ARENA_GROUND_RULES[run.realmId]}</p> : null}
                {run.realmSecondaryId ? <p>{ARENA_GROUND_RULES[run.realmSecondaryId]}</p> : null}
                <p>Own element charges; counter-element resists. Blocks connect through touching edges, never diagonals or empty cells. One charge per card per turn; every 4 charges matched pays 1 gold and all charges add resonance. Ice and vines block turning. Holds cover at least two complete pairs and leave another pair free; breaking a held group frees it. Blocked attempts stay visible with their reason.</p>
                <p>Ground persists. Roots yield +1 gold; ice anchors. Floors drop 2 essence, +1 for an amplified reaction. Forge every 3 floors.</p>
            </details>
            </div>
            <button className={styles.close} type="button" popoverTarget={id} popoverTargetAction="hide">Back</button>
        </div>
    </>;
}
