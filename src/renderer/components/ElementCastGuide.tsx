import { useId } from 'react';
import type { RunState } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { ELEMENT_MATCH_RULES, elementWashCapacity, elementCastPower } from '../../shared/element-group-rules';
import { ARENA_GROUND_RULES } from '../../shared/element-ground-rules';
import { resonanceOf, resonanceTier, runElementResonance } from '../../shared/element-resonance-rules';
import { TILE_SUITS, getTileSuit } from '../../shared/tile-suit-rules';
import { runChainTier, type ChainMomentumRun } from '../../shared/chain-tier-rules';
import { CHAIN_MULT } from '../../shared/chunk-break-rules';
import { focusOf } from '../../shared/elemental-loot-rules';
import { ELEMENT_ACTION, ARENA_ACTION, focusSummary } from '../copy/elementClarity';
import styles from './ElementCastGuide.module.css';

/** The glance view explains decisions; precise rules are one optional disclosure away. */
export function ElementCastGuide({ run }: { run: Pick<RunState, 'stats' | 'board' | 'realmId' | 'realmSecondaryId' | 'elementResonance' | 'elementalFocus' | 'elementalEssence'> & ChainMomentumRun }) {
    const id = useId();
    const combo = run.stats.currentStreak;
    const resonance = runElementResonance(run);
    const multiplier = CHAIN_MULT[runChainTier(run)];
    return <>
        <button className={styles.trigger} type="button" popoverTarget={id} aria-label="How elemental matches work" data-testid="element-cast-guide">Casts</button>
        <div id={id} className={styles.panel} popover="auto" role="dialog" aria-label="Elemental cast rules" data-testid="element-cast-rules"
            onToggle={(event) => { event.currentTarget.dataset.castGuideOpen = String(event.newState === 'open'); }}>
            <strong className={styles.heading}>Match → Cast</strong>
            <span>Every pair casts. Combos make it stronger.</span>
            <div className={styles.grid}>{TILE_SUITS.map((suit) => {
                const focus = focusOf(run, suit);
                const power = elementCastPower(combo, resonanceTier(resonanceOf(resonance, suit)) + focus, 1, multiplier);
                return <div className={styles.rule} key={suit}>
                    <strong><span aria-hidden="true">{getTileSuit(suit).rune} </span>{ELEMENT_NAMES[suit]}</strong>
                    <span>{ELEMENT_ACTION[suit]}</span>
                    <small>{suit === 'tide' ? `${elementWashCapacity(power)} carried` : `${power.targets} targets`} · +{power.extraReach} reach</small>
                    {focus > 0 ? <small>{focusSummary(suit, focus)}</small> : null}
                </div>;
            })}</div>
            <span>Same element ×2 → different element → reaction</span>
            {run.realmId ? <span className={styles.arena}>{ARENA_ACTION[run.realmId]}</span> : null}
            {run.realmSecondaryId ? <span>{ARENA_ACTION[run.realmSecondaryId]}</span> : null}
            <details className={styles.details}>
                <summary>Details & status key</summary>
                <p>▲ number: burning · ◆ number: frozen turns · ♣ ×: vines hold · ♣ +: harvest gold · ◆ +: calm on match.</p>
                <p>Base reach: 2 steps; 3 in the matching arena. Each 3 combo and each resonance or focus tier adds a step.</p>
                <p>Fire, Frost and Grove start at 2 targets. Each 6 combo, 2 tiers, extra popped pair or multiplier doubling adds 1, up to 6. Multiplier now: ×{multiplier}. Water starts at 6 cards, plus 2 per extra reach or target.</p>
                {TILE_SUITS.map(suit => <p key={suit}><strong>{ELEMENT_NAMES[suit]}: </strong>{ELEMENT_MATCH_RULES[suit]}</p>)}
                {run.realmId ? <p>{ARENA_GROUND_RULES[run.realmId]}</p> : null}
                {run.realmSecondaryId ? <p>{ARENA_GROUND_RULES[run.realmSecondaryId]}</p> : null}
                <p>Own element charges; counter-element resists. Touching blocks share a cast. Ordinary casts keep cards playable. Arena holds leave another pair free; breaking a held group frees it.</p>
                <p>Ground persists. Roots yield +1 gold; ice anchors. Floors drop 2 essence, +1 for a reaction. Forge every 3 floors.</p>
            </details>
            <button className={styles.close} type="button" popoverTarget={id} popoverTargetAction="hide">Back</button>
        </div>
    </>;
}
