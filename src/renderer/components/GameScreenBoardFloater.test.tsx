import { createRef } from 'react';
import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MatchScorePop, MismatchScorePop } from '../store/matchScorePop';
import { GameScreenBoardFloater } from './GameScreenBoardFloater';
import { GameScreenMatchFloaterContent } from './GameScreenMatchFloaterContent';
import { GameScreenMismatchFloaterContent } from './GameScreenMismatchFloaterContent';
import { useGameScreenBoardFloaterProjection } from './useGameScreenBoardFloaterProjection';

const matchScorePop = (): MatchScorePop => ({
    amount: 99,
    chainDepth: 4,
    feedbackHeadline: 'Chain',
    feedbackIntensity: 'mid',
    feedbackSignal: { label: 'Pickup', tone: 'pickup' },
    impactCue: { label: 'Stack cashout', tone: 'reward' },
    crescendo: {
        audioCue: 'stack-burst',
        beatCount: 4,
        detail: '2 payoff lanes',
        label: 'Stack burst',
        screenCue: 'burst',
        tier: 'stack'
    },
    payoffSummary: { label: 'Stack cashout', value: '2 payoffs paid', tier: 'reward' },
    payoffChips: [
        { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+99', tone: 'score' },
        { arcadeCue: 'Pickup cashout', id: 'pickup', label: 'Pickup', value: '+1 shard', tone: 'pickup' }
    ],
    tileIdA: 'a',
    tileIdB: 'b',
    key: 'direct-match'
});

type FloaterOptions = {
    match?: MatchScorePop | null;
    mismatch?: MismatchScorePop | null;
    position?: { x: number; y: number } | null;
    reduceMotion?: boolean;
};

const projectFloater = ({
    match = null,
    mismatch = null,
    reduceMotion = false
}: FloaterOptions = {}) =>
    renderHook(() => useGameScreenBoardFloaterProjection({
        matchScorePop: match,
        mismatchScorePop: mismatch,
        reduceMotion
    })).result.current;

const renderFloater = (options: FloaterOptions = {}) => {
    const projection = projectFloater(options);
    return render(
        <GameScreenBoardFloater
            boardFloaterPos={options.position === undefined ? { x: 40, y: 20 } : options.position}
            boardFloaterRef={createRef<HTMLDivElement>()}
            projection={projection}
        />
    );
};

describe('GameScreenBoardFloater', () => {
    it('renders nothing for an inactive projection', () => {
        const { container } = renderFloater({ position: null });

        expect(container).toBeEmptyDOMElement();
    });

    it('renders match feedback from the typed projection without run state', () => {
        const { container } = renderFloater({ match: matchScorePop() });

        expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute(
            'data-match-crescendo-audio',
            'stack-burst'
        );
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-crescendo-beats', '4');
        expect(screen.getByTestId('match-score-floater-crescendo')).toHaveAccessibleName(
            'Match crescendo Stack burst: 2 payoff lanes. 4 beats.'
        );
        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute(
            'data-match-impact-cue-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('2 payoffs paid');
        expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Pickup cashout');
    });

    it('renders mismatch recovery and reduced-motion presentation from the same projection', () => {
        const mismatch: MismatchScorePop = {
            tileIdA: 'a',
            tileIdB: 'b',
            key: 'direct-miss'
        };
        const { container } = renderFloater({ mismatch, reduceMotion: true });

        expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('No match');
        expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
            'data-mismatch-recovery-crescendo-tier',
            'recover'
        );
        expect(screen.getByTestId('mismatch-score-floater-recovery')).toHaveTextContent('Recover - safe match');
        expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAccessibleName(
            'Safe pair: Recover now: Safe match'
        );
        expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Chain reset');
    });

    it('renders match content independently from the outer positioning adapter', () => {
        render(<GameScreenMatchFloaterContent projection={projectFloater({ match: matchScorePop() })} />);

        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveAccessibleName(
            expect.stringContaining('Match score payoff chips')
        );
    });

    it('renders mismatch content independently from the outer positioning adapter', () => {
        const mismatch: MismatchScorePop = { tileIdA: 'a', tileIdB: 'b', key: 'direct-miss-content' };
        render(<GameScreenMismatchFloaterContent projection={projectFloater({ mismatch })} />);

        expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Safe match');
        expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAccessibleName(
            expect.stringContaining('Recovery lane map')
        );
    });
});
