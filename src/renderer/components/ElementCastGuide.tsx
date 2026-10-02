import { useId } from 'react';
import type { RunState } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { ELEMENT_MATCH_RULES, ELEMENT_WASH_CAP, ELEMENT_WASH_PER_TIER, elementCastPower } from '../../shared/element-group-rules';
import { ARENA_GROUND_RULES } from '../../shared/element-ground-rules';
import { resonanceOf, resonanceTier, runElementResonance } from '../../shared/element-resonance-rules';
import { TILE_SUITS } from '../../shared/tile-suit-rules';
import styles from './ElementCastGuide.module.css';

/** Native popover: keyboard, Escape and outside dismissal without taking over board input. */
export function ElementCastGuide({ run }: { run: Pick<RunState, 'stats' | 'realmId' | 'realmSecondaryId' | 'elementResonance'> }) {
    const id = useId();
    const combo = run.stats.currentStreak;
    const resonance = runElementResonance(run);
    return <>
        <button className={styles.trigger} type="button" popoverTarget={id} aria-label="How elemental matches work" data-testid="element-cast-guide">Casts</button>
        <span id={id} className={styles.panel} popover="auto" role="dialog" aria-label="Elemental cast rules" data-testid="element-cast-rules"
            onToggle={(event) => { event.currentTarget.dataset.castGuideOpen = String(event.newState === 'open'); }}>
            <strong className={styles.heading}>Every match changes the world</strong>
            <span>Every elemental pair casts. No pop or random roll required.</span>
            <span>Base reach: 2 steps, or 3 in the element’s own arena.</span>
            <span>Every 3 combo: +1 step of reach. Combo 6, resonance tier 2, or a multi-pair pop: up to 2 targets. Each resonance tier adds another step.</span>
            {TILE_SUITS.map((suit) => {
                const power = elementCastPower(combo, resonanceTier(resonanceOf(resonance, suit)));
                return <span className={styles.rule} key={suit}>
                    <strong>{ELEMENT_NAMES[suit]} · {suit === 'tide' ? `up to ${ELEMENT_WASH_CAP + ELEMENT_WASH_PER_TIER * power.extraReach} carried` : `${power.targets} target${power.targets === 1 ? '' : 's'}`} · +{power.extraReach} reach</strong>
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
