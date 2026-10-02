import { useId } from 'react';
import type { RunState } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { ELEMENT_MATCH_RULES, elementWashCapacity, elementCastPower } from '../../shared/element-group-rules';
import { ARENA_GROUND_RULES } from '../../shared/element-ground-rules';
import { resonanceOf, resonanceTier, runElementResonance } from '../../shared/element-resonance-rules';
import { TILE_SUITS } from '../../shared/tile-suit-rules';
import { runChainTier, type ChainMomentumRun } from '../../shared/chain-tier-rules';
import { CHAIN_MULT } from '../../shared/chunk-break-rules';
import styles from './ElementCastGuide.module.css';

/** Native popover: keyboard, Escape and outside dismissal without taking over board input. */
export function ElementCastGuide({ run }: { run: Pick<RunState, 'stats' | 'board' | 'realmId' | 'realmSecondaryId' | 'elementResonance'> & ChainMomentumRun }) {
    const id = useId();
    const combo = run.stats.currentStreak;
    const resonance = runElementResonance(run);
    const multiplier = CHAIN_MULT[runChainTier(run)];
    return <>
        <button className={styles.trigger} type="button" popoverTarget={id} aria-label="How elemental matches work" data-testid="element-cast-guide">Casts</button>
        <span id={id} className={styles.panel} popover="auto" role="dialog" aria-label="Elemental cast rules" data-testid="element-cast-rules"
            onToggle={(event) => { event.currentTarget.dataset.castGuideOpen = String(event.newState === 'open'); }}>
            <strong className={styles.heading}>Every match changes the world</strong>
            <span>Every elemental pair casts. No pop or random roll required.</span>
            <span>Base reach: 2 steps, or 3 in the element’s own arena.</span>
            <span>Spells spread through touching elemental blocks. Fire, Frost and Grove start with 2 targets; every 6 combo, 2 resonance tiers, extra popped pair, and multiplier doubling adds one, up to 6. Your current multiplier is ×{multiplier}.</span>
            <span>Every 3 combo and every resonance tier adds one step of reach. One playable pair is kept free.</span>
            <span>Water starts at 6 carried cards, plus 2 per added step of reach or target strength.</span>
            {TILE_SUITS.map((suit) => {
                const power = elementCastPower(combo, resonanceTier(resonanceOf(resonance, suit)), 1, multiplier);
                return <span className={styles.rule} key={suit}>
                    <strong>{ELEMENT_NAMES[suit]} · {suit === 'tide' ? `up to ${elementWashCapacity(power)} carried` : `${power.targets} target${power.targets === 1 ? '' : 's'}`} · +{power.extraReach} reach</strong>
                    <span>{ELEMENT_MATCH_RULES[suit]}</span>
                </span>;
            })}
            {run.realmId ? <span className={styles.arena}>{ARENA_GROUND_RULES[run.realmId]}</span> : null}
            {run.realmSecondaryId ? <span>{ARENA_GROUND_RULES[run.realmSecondaryId]}</span> : null}
            <span>Ground stays after cards leave. Match on roots for +1 gold. Ice anchors against elemental movement. Overlapping elements react locally; two consecutive matches also prime your stronger streak reaction.</span>
            <span>Cards drink their own element and resist their counter. Casts seek vulnerable targets. If none remain, the ground still changes. The last playable pair is always freed.</span>
            <button className={styles.close} type="button" popoverTarget={id} popoverTargetAction="hide">Back to the board</button>
        </span>
    </>;
}
