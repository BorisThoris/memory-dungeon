import { SFX_SAMPLE_KEYS, type SfxSampleKey } from './sampledSfx';
import type { UiSfxCue } from './uiSfx';

type AudioCoverageDomain = 'startup' | 'menu' | 'settings' | 'gameplay' | 'overlay' | 'meta';
type AudioCoverageDecision = 'sampled_with_fallback' | 'procedural_only' | 'silent';
export type AudioSemanticMoment =
    | 'arm'
    | 'commit'
    | 'reveal'
    | 'reward'
    | 'fail'
    | 'disarm'
    | 'lock'
    | 'resolve'
    | 'floor_clear'
    | 'pressure'
    | 'route_choice'
    | 'navigation'
    | 'ambient';
type AudioCue = SfxSampleKey | UiSfxCue | 'none';

const GAMEPLAY_CUES = new Set<string>(SFX_SAMPLE_KEYS);

const UI_CUES = new Set<string>([
    'click',
    'confirm',
    'back',
    'counter',
    'menuOpen',
    'runStart',
    'introSting',
    'pauseOpen',
    'pauseResume',
    'gameOverOpen',
    'copy'
]);

interface AudioInteractionCoverageRow {
    id: string;
    domain: AudioCoverageDomain;
    interaction: string;
    cue: AudioCue;
    callsite: string;
    semanticMoment: AudioSemanticMoment;
    decision: AudioCoverageDecision;
    cooldownPolicy: string;
    mixRole: string;
    reducedMotionSafe: boolean;
}

/**
 * REG-037: machine-readable mirror of docs/AUDIO_INTERACTION_MATRIX.md for the shippable
 * v1 call-site surface. It deliberately records semantic cue roles, not raw asset filenames.
 */
export const AUDIO_INTERACTION_COVERAGE: readonly AudioInteractionCoverageRow[] = [
    {
        id: 'startup_intro_complete',
        domain: 'startup',
        interaction: 'Startup intro completes or skip resolves',
        cue: 'introSting',
        callsite: 'StartupIntro.completeIntro',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'once per boot intro',
        mixRole: 'ceremonial relic sting',
        reducedMotionSafe: true
    },
    {
        id: 'menu_navigation',
        domain: 'menu',
        interaction: 'Main menu and Choose Path navigation',
        cue: 'menuOpen',
        callsite: 'MainMenu / ChooseYourPathScreen buttons',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'UI/menu polyphony cap',
        mixRole: 'panel reveal',
        reducedMotionSafe: true
    },
    {
        id: 'settings_adjust',
        domain: 'settings',
        interaction: 'Settings category/subsection/toggle/slider adjustment',
        cue: 'counter',
        callsite: 'SettingsScreen.patchSettings',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'counter tick throttled by SettingsScreen',
        mixRole: 'restrained settings tick',
        reducedMotionSafe: true
    },
    {
        id: 'tile_flip',
        domain: 'gameplay',
        interaction: 'Tile flip or gambit prime',
        cue: 'flip',
        callsite: 'useAppStore.pressTile -> playFlipSfx',
        semanticMoment: 'commit',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'flip category polyphony cap',
        mixRole: 'tactile card tick',
        reducedMotionSafe: true
    },
    {
        id: 'resolve_match',
        domain: 'gameplay',
        interaction: 'Successful pair resolve',
        cue: 'match-tier-low',
        callsite: 'applyResolveBoardTurn -> playResolveSfx',
        semanticMoment: 'reward',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'match category polyphony cap; tiered by streak depth; pickup/resource reward layers share cap; three-channel rewards add capstone burst',
        mixRole: 'reward bloom with pickup/resource chimes and stacked-payoff burst',
        reducedMotionSafe: true
    },
    {
        id: 'trait_route_cashout',
        domain: 'gameplay',
        interaction: 'Trait route progress or completion resolves from a matched combo route',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx trait-route accent layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; rides on successful resolve only; multi-route progress upgrades to trait-surge accent',
        mixRole: 'high combo-route accent over match/resource bloom, with brighter trait-surge sweep for stacked interactions',
        reducedMotionSafe: true
    },
    {
        id: 'chain_milestone_hit',
        domain: 'gameplay',
        interaction: 'Clean streak crosses x3, x6, or x10 chain milestone',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx chain-milestone accent layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; threshold-only accent shared with match floater milestones',
        mixRole: 'bright arcade milestone ping over the match tier',
        reducedMotionSafe: true
    },
    {
        id: 'chain_reward_cashout',
        domain: 'gameplay',
        interaction: 'Clean streak match grants combo shard, guard token, or life payoff',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx chain-reward cashout accent layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; only plays on successful chain-depth resource cashouts',
        mixRole: 'bright payoff accent over match/resource bloom when the chain reward actually lands',
        reducedMotionSafe: true
    },
    {
        id: 'chain_reward_armed',
        domain: 'gameplay',
        interaction: 'Clean streak match leaves the next chain reward one match away',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx near-chain-reward armed layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; only plays after successful resolves that arm but do not cash a chain reward',
        mixRole: 'small anticipatory chime that makes one-away cashouts feel intentional',
        reducedMotionSafe: true
    },
    {
        id: 'resolved_cascade_accent',
        domain: 'gameplay',
        interaction: 'Successful match resolves a chain, reward, or combo cascade moment',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx resolved-cascade accent layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; only plays when chain depth or multiple reward channels make the resolve read as a cascade',
        mixRole: 'arcade cascade sweep binding chain depth to stacked reward payoff',
        reducedMotionSafe: true
    },
    {
        id: 'stacked_reward_setup',
        domain: 'gameplay',
        interaction: 'Successful match resolves exactly two payoff channels together',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx two-lane stacked payoff accent layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; only fires on two-lane payoffs, including reward-perk lane joins, so common stacks read as intentional without using the capstone burst',
        mixRole: 'light stacked-payoff pop between ordinary reward bloom and mega cashout sparkle',
        reducedMotionSafe: true
    },
    {
        id: 'stacked_reward_burst',
        domain: 'gameplay',
        interaction: 'Successful match resolves three or more payoff channels together',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx stacked-reward capstone layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; only fires after pickup, resource, trait-route, reward-perk, chain reward, or milestone channels stack into a multi-lane payoff',
        mixRole: 'high arcade cashout sparkle marking the top of a stacked reward burst',
        reducedMotionSafe: true
    },
    {
        id: 'super_stacked_reward_burst',
        domain: 'gameplay',
        interaction: 'Successful match resolves four or more payoff channels together',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx super-stacked reward flourish layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; only fires above the normal stacked burst when four or more reward systems, including perk-trigger lanes, cash out together',
        mixRole: 'top-tier triangle flourish that separates rare super-stack payoffs from ordinary multi-lane bursts',
        reducedMotionSafe: true
    },
    {
        id: 'payoff_intensity_cross_modal',
        domain: 'gameplay',
        interaction: 'Board markers and action rail classify payoff intensity as prime, cashout, stack, surge, or risk',
        cue: 'none',
        callsite: 'GameScreenActionFeedbackRail / TileBoard readability data attributes mirrored by playResolveSfx reward layers and applyResolveBoardTurn -> playMatchPayoffSfx',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match-pop payload schedules one extra payoff hit only for non-score reward/cascade/stack tiers; visual-only prime and risk still map onto existing anticipation and mismatch layers',
        mixRole: 'cross-modal payoff contract: prime is anticipatory, cashout is immediate reward, stack/super stack are capstone hits, surge is trait-route emphasis, risk is mismatch/lost-payoff pressure',
        reducedMotionSafe: true
    },
    {
        id: 'aggregate_payoff_floaters',
        domain: 'gameplay',
        interaction: 'Jackpot, reward burst, payoff summary, payoff chips, payoff lanes, payoff ladder, and stage payoff stack floaters expose aggregate audio roles and screen cues',
        cue: 'none',
        callsite: 'GameScreen match floater jackpot / reward burst / payoff summary / payoff chips / payoff lanes / payoff ladder / stage payoff stack data attributes',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'floater cues mirror the already signature-gated resolve and payoff audio; no passive extra one-shot is scheduled from the DOM metadata',
        mixRole: 'aggregate payoff contract: cashout, stack, super reward strips, individual payoff chips, payoff lanes, and payoff ladders carry readable audio roles, beat counts, and screen cues for the biggest board reward moments',
        reducedMotionSafe: true
    },
    {
        id: 'chain_opportunity_beat',
        domain: 'gameplay',
        interaction: 'Board chain opportunity chip displays and plays prime, route, follow-up, surge, or cashout beat cues',
        cue: 'none',
        callsite: 'TileBoard chain-opportunity beat strip -> playChainOpportunityBeatSfx',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'signature-gated by tier, beat count, next action, and target; match category polyphony cap',
        mixRole: 'cross-modal route beat contract: two-beat setup stays anticipatory, three-beat route/follow-up reads playable, four-beat surge reads stacked, and five-beat cashout adds an anticipation tick before resolve audio',
        reducedMotionSafe: true
    },
    {
        id: 'primary_feedback_lane_cues',
        domain: 'gameplay',
        interaction: 'Primary and expanded reward, trait, route, recovery, and opportunity lanes expose action, beat, audio, and screen-cue contracts, including board trait route focus, guard, reward, and surge roles',
        cue: 'none',
        callsite: 'TileBoard trait interaction lanes and chain opportunity surge / GameScreen / RunShell feedback line mirrored by resolve, chain, payoff, and recovery procedural layers',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'lane IDs are semantic cue names; audible playback remains signature-gated by the matching resolve, chain opportunity, payoff, or mismatch recovery layer',
        mixRole: 'cross-modal lane contract: every highlighted or expanded lane has an action verb, beat count, audio role, and screen cue so Zuma-style readable payoffs stay synchronized across board, HUD, and floaters; board trait_route_focus, trait_route_guard, trait_route_reward, and trait_route_surge cues remain semantic roles unless a signature-gated resolve layer plays them',
        reducedMotionSafe: true
    },
    {
        id: 'gameplay_status_action_cues',
        domain: 'gameplay',
        interaction: 'Chapter banner and dungeon combat forecast expose compact next-action cues with beats, audio roles, and screen cues',
        cue: 'none',
        callsite: 'RunShell objective line and floor-clear notes',
        semanticMoment: 'pressure',
        decision: 'procedural_only',
        cooldownPolicy: 'semantic status cues stay visual/readability-only and share downstream resolve, route, or combat feedback audio',
        mixRole: 'compact status-action contract: chapter and combat forecast cues use reward, pressure, guard, pulse, and snap screen language without adding extra passive audio',
        reducedMotionSafe: true
    },
    {
        id: 'resolve_mismatch',
        domain: 'gameplay',
        interaction: 'Failed pair resolve',
        cue: 'mismatch',
        callsite: 'applyResolveBoardTurn -> playResolveSfx',
        semanticMoment: 'fail',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'mismatch category polyphony cap',
        mixRole: 'soft fail',
        reducedMotionSafe: true
    },
    {
        id: 'chain_break_miss',
        domain: 'gameplay',
        interaction: 'Mismatch breaks an active match chain',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx chain-break accent layer',
        semanticMoment: 'fail',
        decision: 'procedural_only',
        cooldownPolicy: 'mismatch category polyphony cap; rides on failed resolve only when streak depth was meaningful; adds payoff-loss layer near reward targets',
        mixRole: 'low chain-break accent plus near-payoff drop over miss cue',
        reducedMotionSafe: true
    },
    {
        id: 'trait_mismatch_surge',
        domain: 'gameplay',
        interaction: 'Mismatch applies several trait penalties at once',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx trait-mismatch surge accent layer',
        semanticMoment: 'fail',
        decision: 'procedural_only',
        cooldownPolicy: 'mismatch category polyphony cap; only layers over failed resolve when multiple trait mismatch counters advance',
        mixRole: 'short harsh trait-surge risk accent over miss cue',
        reducedMotionSafe: true
    },
    {
        id: 'mismatch_recovery_crescendo',
        domain: 'gameplay',
        interaction: 'Mismatch floater displays and plays recover, break, risk, lost-reward, or trait-surge recovery crescendo cues with recovery lane and chip metadata',
        cue: 'none',
        callsite: 'GameScreen mismatch floater recovery crescendo / lane map / chip stack -> playMismatchRecoveryCrescendoSfx',
        semanticMoment: 'fail',
        decision: 'procedural_only',
        cooldownPolicy: 'signature-gated by floater key, tier, and beat count; mismatch category polyphony cap',
        mixRole: 'cross-modal recovery beat contract: two-beat recover stays soft, three-beat break/risk snaps, four-beat lost reward drops harder, five-beat trait surge adds a compounded danger cue, and expanded lanes/chips keep audio roles plus screen cues readable',
        reducedMotionSafe: true
    },
    {
        id: 'reward_perk_pop',
        domain: 'gameplay',
        interaction: 'Durable reward perk triggers during a trait match',
        cue: 'none',
        callsite: 'applyResolveBoardTurn -> playResolveSfx reward-perk pop accent layer',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'match category polyphony cap; layers only when a new reward-perk interaction tag resolves',
        mixRole: 'bright perk activation pop above trait-route accent',
        reducedMotionSafe: true
    },
    {
        id: 'relic_choice_crescendo',
        domain: 'gameplay',
        interaction: 'Relic draft option receives focus or hover while displaying stack, cashout, prime, or rare crescendo beats',
        cue: 'none',
        callsite: 'RelicDraftOfferPanel choice focus/hover -> playRelicChoiceCrescendoSfx',
        semanticMoment: 'reward',
        decision: 'procedural_only',
        cooldownPolicy: 'signature-gated by draft round, relic id, tier, and beat count; match category polyphony cap',
        mixRole: 'short reward-preview beat that sonifies two-beat prime, three-beat cashout, four-beat stack, and five-beat rare draft choices',
        reducedMotionSafe: true
    },
    {
        id: 'board_power',
        domain: 'gameplay',
        interaction: 'Arm, use, or preview board powers and their tool payoff crescendo',
        cue: 'power-arm',
        callsite: 'useAppStore power actions / RunShell dock tools',
        semanticMoment: 'arm',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'power category polyphony cap; visible tool crescendo stays semantic and shares the eventual power/match resolve cue',
        mixRole: 'affirmative charge chirp with cross-modal tool crescendo metadata for prime, cashout, and stack setup',
        reducedMotionSafe: true
    },
    {
        id: 'route_choice_feedback',
        domain: 'overlay',
        interaction: 'Between-floor route choice cards and selected-route confirmation expose route beat, payoff, action, and impact cues',
        cue: 'none',
        callsite: 'GameScreen route choice card payoffs / route recommendation / selected-route note data attributes',
        semanticMoment: 'route_choice',
        decision: 'procedural_only',
        cooldownPolicy: 'route card cues stay semantic/readability-only and share click, floor-clear, and next-floor resolve feedback instead of scheduling passive extra one-shots',
        mixRole: 'cross-modal route decision contract: cashout, guard, prime, payoff, action, and selected-route chips expose audio roles, beat counts, and screen cues',
        reducedMotionSafe: true
    },
    {
        id: 'floor_clear',
        domain: 'overlay',
        interaction: 'Floor clear overlay opens and shows payoff, objective, and next-floor feedback cues',
        cue: 'floor-clear',
        callsite: 'applyResolvedRun levelComplete transition / GameScreen floor-clear payoff stack, objective strip, next-floor signals',
        semanticMoment: 'floor_clear',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'deferred macrotask; shuffle/match caps still apply; semantic overlay cue metadata does not schedule passive extra one-shots',
        mixRole: 'floor reward flourish plus cross-modal payoff/objective/next-floor contract for between-level reward readability',
        reducedMotionSafe: true
    },
    {
        id: 'gauntlet_pressure',
        domain: 'gameplay',
        interaction: 'Final gauntlet countdown seconds',
        cue: 'countdown-pressure',
        callsite: 'GameScreen gauntletRemainingMs effect',
        semanticMoment: 'pressure',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'one pulse per visible final second; pressure category polyphony cap',
        mixRole: 'low countdown pulse',
        reducedMotionSafe: true
    },
    {
        id: 'pause_resume',
        domain: 'overlay',
        interaction: 'Pause and resume',
        cue: 'pauseOpen',
        callsite: 'useAppStore.pause / useAppStore.resume',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'menu category polyphony cap',
        mixRole: 'suspend/release chime',
        reducedMotionSafe: true
    },
    {
        id: 'relic_draft',
        domain: 'overlay',
        interaction: 'Relic offer opens and relic is picked',
        cue: 'relic-offer-open',
        callsite: 'GameScreen relic offer effect / useAppStore.pickRelic',
        semanticMoment: 'reward',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'power category polyphony cap',
        mixRole: 'mystical reveal and reward bloom',
        reducedMotionSafe: true
    },
    {
        id: 'game_over_open',
        domain: 'meta',
        interaction: 'Game over screen enters',
        cue: 'gameOverOpen',
        callsite: 'GameOverScreen mount',
        semanticMoment: 'resolve',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'once per post-run screen mount',
        mixRole: 'elegant downward close',
        reducedMotionSafe: true
    },
    {
        id: 'passive_scroll',
        domain: 'meta',
        interaction: 'Passive scroll and in-page anchors',
        cue: 'none',
        callsite: 'MetaScreen body scroll / TOC anchors',
        semanticMoment: 'ambient',
        decision: 'silent',
        cooldownPolicy: 'intentionally silent',
        mixRole: 'avoid UI fatigue',
        reducedMotionSafe: true
    }
];

export const getAudioCoverageRows = (): readonly AudioInteractionCoverageRow[] => AUDIO_INTERACTION_COVERAGE;

export const audioCoverageRowsByDomain = (domain: AudioCoverageDomain): AudioInteractionCoverageRow[] =>
    AUDIO_INTERACTION_COVERAGE.filter((row) => row.domain === domain);

export const audioCoverageCueIsGameplaySfx = (cue: AudioCue): cue is SfxSampleKey => GAMEPLAY_CUES.has(cue);

export const audioCoverageCueIsKnown = (cue: AudioCue): boolean =>
    cue === 'none' || audioCoverageCueIsGameplaySfx(cue) || UI_CUES.has(cue);
