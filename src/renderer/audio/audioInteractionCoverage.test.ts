import { describe, expect, it } from 'vitest';
import { AUDIO_INTERACTION_COVERAGE, audioCoverageRowsByDomain, getAudioCoverageRows } from './audioInteractionCoverage';

describe('REG-037 audio interaction coverage', () => {
    it('covers major runtime domains with sampled fallbacks or intentional silence', () => {
        expect(getAudioCoverageRows()).toBe(AUDIO_INTERACTION_COVERAGE);
        expect(new Set(AUDIO_INTERACTION_COVERAGE.map((row) => row.domain))).toEqual(
            new Set(['startup', 'menu', 'settings', 'gameplay', 'overlay', 'meta'])
        );
        expect(AUDIO_INTERACTION_COVERAGE.every((row) => row.reducedMotionSafe)).toBe(true);
        expect(AUDIO_INTERACTION_COVERAGE.every((row) => row.cooldownPolicy.length > 0)).toBe(true);
        expect(AUDIO_INTERACTION_COVERAGE.every((row) => row.semanticMoment.length > 0)).toBe(true);
        expect(AUDIO_INTERACTION_COVERAGE.filter((row) => row.decision === 'silent').map((row) => row.id)).toEqual([
            'passive_scroll'
        ]);
    });

    it('documents core gameplay mix roles separately from UI/meta roles', () => {
        const gameplay = audioCoverageRowsByDomain('gameplay');
        expect(gameplay.map((row) => row.id)).toEqual([
            'tile_flip',
            'resolve_match',
            'trait_route_cashout',
            'chain_milestone_hit',
            'chain_reward_cashout',
            'chain_reward_armed',
            'resolved_cascade_accent',
            'stacked_reward_setup',
            'stacked_reward_burst',
            'super_stacked_reward_burst',
            'payoff_intensity_cross_modal',
            'aggregate_payoff_floaters',
            'chain_opportunity_beat',
            'primary_feedback_lane_cues',
            'gameplay_status_action_cues',
            'resolve_mismatch',
            'chain_break_miss',
            'trait_mismatch_surge',
            'mismatch_recovery_crescendo',
            'reward_perk_pop',
            'relic_choice_crescendo',
            'board_power',
            'gauntlet_pressure'
        ]);
        expect(gameplay.find((row) => row.id === 'resolve_match')?.mixRole).toMatch(/reward/i);
        expect(gameplay.find((row) => row.id === 'trait_route_cashout')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'trait_route_cashout')?.mixRole).toMatch(/trait-surge/i);
        expect(gameplay.find((row) => row.id === 'chain_milestone_hit')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'chain_milestone_hit')?.cooldownPolicy).toMatch(/threshold/i);
        expect(gameplay.find((row) => row.id === 'chain_reward_cashout')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'chain_reward_cashout')?.mixRole).toMatch(/payoff accent/i);
        expect(gameplay.find((row) => row.id === 'chain_reward_armed')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'chain_reward_armed')?.mixRole).toMatch(/anticipatory chime/i);
        expect(gameplay.find((row) => row.id === 'resolved_cascade_accent')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'resolved_cascade_accent')?.mixRole).toMatch(/cascade sweep/i);
        expect(gameplay.find((row) => row.id === 'stacked_reward_setup')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'stacked_reward_setup')?.cooldownPolicy).toMatch(/two-lane payoffs/i);
        expect(gameplay.find((row) => row.id === 'stacked_reward_setup')?.mixRole).toMatch(/stacked-payoff pop/i);
        expect(gameplay.find((row) => row.id === 'stacked_reward_burst')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'stacked_reward_burst')?.cooldownPolicy).toMatch(/reward-perk|multi-lane payoff/i);
        expect(gameplay.find((row) => row.id === 'stacked_reward_burst')?.mixRole).toMatch(/cashout sparkle/i);
        expect(gameplay.find((row) => row.id === 'super_stacked_reward_burst')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'super_stacked_reward_burst')?.cooldownPolicy).toMatch(/perk-trigger lanes/i);
        expect(gameplay.find((row) => row.id === 'super_stacked_reward_burst')?.mixRole).toMatch(/top-tier triangle flourish/i);
        expect(gameplay.find((row) => row.id === 'payoff_intensity_cross_modal')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'payoff_intensity_cross_modal')?.interaction).toMatch(
            /prime, cashout, stack, surge, or risk/i
        );
        expect(gameplay.find((row) => row.id === 'payoff_intensity_cross_modal')?.callsite).toMatch(
            /playMatchPayoffSfx/i
        );
        expect(gameplay.find((row) => row.id === 'payoff_intensity_cross_modal')?.mixRole).toMatch(
            /prime.*cashout.*stack.*surge.*risk/i
        );
        expect(gameplay.find((row) => row.id === 'aggregate_payoff_floaters')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'aggregate_payoff_floaters')?.callsite).toMatch(
            /jackpot.*reward burst.*payoff summary.*payoff chips.*payoff lanes.*payoff ladder.*stage payoff stack/i
        );
        expect(gameplay.find((row) => row.id === 'aggregate_payoff_floaters')?.mixRole).toMatch(
            /cashout.*stack.*super.*payoff chips.*payoff lanes.*payoff ladders.*audio roles.*screen cues/i
        );
        expect(gameplay.find((row) => row.id === 'chain_opportunity_beat')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'chain_opportunity_beat')?.callsite).toMatch(
            /playChainOpportunityBeatSfx/i
        );
        expect(gameplay.find((row) => row.id === 'chain_opportunity_beat')?.cooldownPolicy).toMatch(
            /signature-gated/i
        );
        expect(gameplay.find((row) => row.id === 'chain_opportunity_beat')?.mixRole).toMatch(
            /two-beat setup.*five-beat cashout.*anticipation tick/i
        );
        expect(gameplay.find((row) => row.id === 'primary_feedback_lane_cues')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'primary_feedback_lane_cues')?.callsite).toMatch(
            /TileBoard trait interaction lanes.*GameScreen.*RunShell/i
        );
        expect(gameplay.find((row) => row.id === 'primary_feedback_lane_cues')?.mixRole).toMatch(
            /action verb.*beat count.*audio role.*screen cue/i
        );
        expect(gameplay.find((row) => row.id === 'primary_feedback_lane_cues')?.mixRole).toMatch(
            /trait_route_focus.*trait_route_guard.*trait_route_reward.*trait_route_surge/i
        );
        expect(gameplay.find((row) => row.id === 'gameplay_status_action_cues')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'pressure'
        });
        expect(gameplay.find((row) => row.id === 'gameplay_status_action_cues')?.callsite).toMatch(
            /RunShell objective line/i
        );
        expect(gameplay.find((row) => row.id === 'gameplay_status_action_cues')?.mixRole).toMatch(
            /reward.*pressure.*guard.*pulse.*snap/i
        );
        expect(gameplay.find((row) => row.id === 'board_power')?.semanticMoment).toBe('arm');
        expect(gameplay.find((row) => row.id === 'board_power')?.callsite).toMatch(/RunShell/i);
        expect(gameplay.find((row) => row.id === 'board_power')?.mixRole).toMatch(/tool crescendo/i);
        expect(gameplay.find((row) => row.id === 'resolve_mismatch')?.mixRole).toMatch(/fail/i);
        expect(gameplay.find((row) => row.id === 'chain_break_miss')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'fail'
        });
        expect(gameplay.find((row) => row.id === 'trait_mismatch_surge')?.mixRole).toMatch(/trait-surge risk/i);
        expect(gameplay.find((row) => row.id === 'mismatch_recovery_crescendo')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'fail'
        });
        expect(gameplay.find((row) => row.id === 'mismatch_recovery_crescendo')?.callsite).toMatch(
            /lane map.*chip stack.*playMismatchRecoveryCrescendoSfx/i
        );
        expect(gameplay.find((row) => row.id === 'mismatch_recovery_crescendo')?.cooldownPolicy).toMatch(
            /signature-gated/i
        );
        expect(gameplay.find((row) => row.id === 'mismatch_recovery_crescendo')?.mixRole).toMatch(
            /two-beat recover.*five-beat trait surge.*expanded lanes\/chips.*screen cues/i
        );
        expect(gameplay.find((row) => row.id === 'reward_perk_pop')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'reward_perk_pop')?.mixRole).toMatch(/perk activation/i);
        expect(gameplay.find((row) => row.id === 'relic_choice_crescendo')).toMatchObject({
            decision: 'procedural_only',
            semanticMoment: 'reward'
        });
        expect(gameplay.find((row) => row.id === 'relic_choice_crescendo')?.callsite).toMatch(
            /playRelicChoiceCrescendoSfx/i
        );
        expect(gameplay.find((row) => row.id === 'relic_choice_crescendo')?.cooldownPolicy).toMatch(
            /signature-gated/i
        );
        expect(gameplay.find((row) => row.id === 'relic_choice_crescendo')?.mixRole).toMatch(
            /two-beat prime.*five-beat rare/i
        );
        expect(gameplay.find((row) => row.id === 'gauntlet_pressure')?.cue).toBe('countdown-pressure');
    });

    it('documents floor-clear overlay feedback cue roles', () => {
        const routeChoice = AUDIO_INTERACTION_COVERAGE.find((row) => row.id === 'route_choice_feedback');
        expect(routeChoice).toMatchObject({
            cue: 'none',
            domain: 'overlay',
            semanticMoment: 'route_choice'
        });
        expect(routeChoice?.interaction).toMatch(/route choice cards.*selected-route confirmation/i);
        expect(routeChoice?.callsite).toMatch(/route choice card payoffs.*selected-route note/i);
        expect(routeChoice?.mixRole).toMatch(/payoff.*action.*selected-route.*screen cues/i);

        const floorClear = AUDIO_INTERACTION_COVERAGE.find((row) => row.id === 'floor_clear');
        expect(floorClear).toMatchObject({
            cue: 'floor-clear',
            domain: 'overlay',
            semanticMoment: 'floor_clear'
        });
        expect(floorClear?.interaction).toMatch(/payoff.*objective.*next-floor/i);
        expect(floorClear?.callsite).toMatch(/payoff stack.*objective strip.*next-floor signals/i);
        expect(floorClear?.mixRole).toMatch(/payoff\/objective\/next-floor contract/i);
    });
});
