import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { advanceTutorial, resolveTutorial, selectTutorialTile, startTutorial, TUTORIAL_LESSONS, tutorialTarget, type TutorialLesson, type TutorialSession } from '../../shared/tutorial-hall';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { elementReactionResult } from '../../shared/element-reaction-feedback';
import { getTileSuit } from '../../shared/tile-suit-rules';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { useEscapeLeaves } from '../hooks/useEscapeLeaves';
import TileBoard, { type TileBoardHandle } from './TileBoard';
import { ScreenCalloutQueue } from './ScreenCalloutQueue';
import styles from './TutorialHall.module.css';
import { TUTORIAL_HALL_COPY } from '../copy/tutorialHallCopy';
import { MetaShell, SectionRail } from '../ui';

interface Props { initialLessonId?: string; onClose: () => void; reduceMotion: boolean; graphicsQuality: GraphicsQualityPreset }
const categories = ['Essentials', 'Elements', 'Combinations', 'Interactions'] as const;

export default function TutorialHall({ initialLessonId, onClose, reduceMotion, graphicsQuality }: Props) {
    const [session, setSession] = useState<TutorialSession | null>(() => {
        const lesson = TUTORIAL_LESSONS.find(item => item.id === initialLessonId);
        return lesson ? startTutorial(lesson) : null;
    });
    const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
    const [category, setCategory] = useState<(typeof categories)[number]>('Essentials');
    const [attempt, setAttempt] = useState(0);
    const heading = useRef<HTMLHeadingElement>(null);
    const board = useRef<TileBoardHandle>(null);
    const stage = useRef<HTMLDivElement>(null);
    const [targetBox, setTargetBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const target = session ? tutorialTarget(session) : null;
    const select = useCallback((id: string) => {
        setTargetBox(null);
        setSession(current => current ? selectTutorialTile(current, id) : null);
    }, []);
    const leave = useCallback(() => session ? setSession(null) : onClose(), [session, onClose]);
    // The lesson list is a meta screen, whose shell answers Escape; a lesson answers it here.
    useEscapeLeaves(leave, session !== null);
    useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [session?.lesson.id]);
    useEffect(() => {
        if (session?.phase !== 'resolve') return;
        const timer = window.setTimeout(() => setSession(current => current ? resolveTutorial(current) : null), reduceMotion ? 180 : 650);
        return () => window.clearTimeout(timer);
    }, [session?.phase, reduceMotion]);
    useEffect(() => {
        if (!target) return;
        let frame = 0;
        let last = 0;
        const update = (now: number) => {
            if (now - last >= 80) {
                last = now;
                const card = board.current?.getTileClientRectById(target);
                const bounds = stage.current?.getBoundingClientRect();
                if (card && bounds) {
                    // DOM rectangles are screen pixels; the app's UI scale uses CSS zoom.
                    const scaleX = bounds.width / stage.current!.offsetWidth;
                    const scaleY = bounds.height / stage.current!.offsetHeight;
                    const width = Math.max(44, card.width / scaleX);
                    const height = Math.max(44, card.height / scaleY);
                    const next = { left: (card.left - bounds.left) / scaleX - stage.current!.clientLeft - (width - card.width / scaleX) / 2,
                        top: (card.top - bounds.top) / scaleY - stage.current!.clientTop - (height - card.height / scaleY) / 2,
                        width, height };
                    setTargetBox(previous => previous && Object.keys(next).every(key => Math.abs(previous[key as keyof typeof next] - next[key as keyof typeof next]) < 1) ? previous : next);
                }
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [target]);
    const begin = (lesson: TutorialLesson) => { setAttempt(value => value + 1); setTargetBox(null); setSession(startTutorial(lesson)); };
    const next = () => {
        if (!session) return;
        const advanced = advanceTutorial(session);
        if (advanced.phase === 'complete') setCompleted(previous => new Set([...previous, session.lesson.id]));
        setTargetBox(null);
        setSession(advanced);
    };
    const step = session?.lesson.steps[session.step];
    const reactionResult = session?.run.board?.elementCast?.reactions?.find(reaction => reaction.scope === 'streak');
    const targetTile = session?.run.board?.tiles.find(tile => tile.id === target);
    const callouts = session?.phase === 'result' ? [{
        key: `${attempt}:${session.lesson.id}:${session.step}`, kind: 'rank' as const, size: 'major' as const, tone: 'gold' as const,
        title: session.lesson.reaction && session.step === 2 ? session.lesson.title.toUpperCase() + '!' : session.run.stats.currentStreak ? 'MATCH!' : 'COMBO BROKEN', sub: ''
    }] : [];

    /*
     * The lesson list is a meta screen like the Codex and the Collection, and wears their frame: the
     * shell's title and Back, the section rail for the four kinds of lesson, cards in the Margin's
     * ink. It had its own buttons and type, the one menu screen that did not look like the others.
     */
    if (!session) {
        return (
            <MetaShell
                eyebrow={TUTORIAL_HALL_COPY.eyebrow}
                label="Tutorial Hall"
                onBack={onClose}
                subtitle={TUTORIAL_HALL_COPY.practiceNote}
                testId="tutorial-hall"
                title={TUTORIAL_HALL_COPY.title}
                toolbar={
                    <SectionRail
                        activeId={category}
                        controls="tutorial-lessons"
                        idPrefix="tutorial-tab"
                        label={TUTORIAL_HALL_COPY.categoryRail}
                        onSelect={(id) => setCategory(id as (typeof categories)[number])}
                        options={categories.map((item) => ({ id: item, label: item, badge: String(TUTORIAL_LESSONS.filter((lesson) => lesson.category === item).length) }))}
                    />
                }
            >
                <div className={styles.lessonGrid} id="tutorial-lessons" role="tabpanel">
                    {TUTORIAL_LESSONS.filter((lesson) => lesson.category === category).map((lesson) => (
                        <button className={styles.lessonCard} data-testid={`tutorial-lesson-${lesson.id}`} key={lesson.id} onClick={() => begin(lesson)} type="button">
                            <span aria-hidden="true" className={styles.lessonElements}>
                                {lesson.elements.map((suit, index) => (
                                    <span key={suit} style={{ color: getTileSuit(suit).hue }}>{index ? ' + ' : ''}{getTileSuit(suit).rune}</span>
                                ))}
                            </span>
                            <strong className={styles.lessonTitle}>{lesson.title}</strong>
                            <span className={styles.lessonBody}>{lesson.category === 'Combinations' ? lesson.elements.map((suit) => ELEMENT_NAMES[suit]).join(' + ') : lesson.outcome}</span>
                            <small className={styles.lessonMeta}>{completed.has(lesson.id) ? '\u2713 Practised' : `${lesson.steps.length * 2} guided taps`}</small>
                        </button>
                    ))}
                </div>
            </MetaShell>
        );
    }

    return <section className={styles.hall} data-testid="tutorial-hall" aria-label="Tutorial Hall" data-reduce-motion={reduceMotion}>
        <header className={styles.header}>
            <div><span className={styles.eyebrow}>Tutorial Hall</span><h1 ref={heading} tabIndex={-1}>{session?.lesson.title ?? 'Learn by playing'}</h1></div>
            <button type="button" onClick={leave}>{session ? 'Lessons' : 'Back'}</button>
        </header>
        <>
            <div className={styles.progress} aria-label="Lesson progress">
                {session.lesson.steps.map((item, index) => <span key={index} data-current={index === session.step} data-done={index < session.step || session.phase === 'complete'}>{index + 1}</span>)}
                <span className={styles.readout}>Combo {session.run.stats.currentStreak}{session.run.elementStreak ? ` · ${ELEMENT_NAMES[session.run.elementStreak.suit]} ×${session.run.elementStreak.links}` : ''}</span>
                <button type="button" onClick={() => begin(session.lesson)}>Restart</button>
            </div>
            <div className={styles.stage} ref={stage} data-testid="tutorial-board-stage">
                <TileBoard key={`${session.lesson.id}:${attempt}`} ref={board} board={session.run.board!} interactive={session.phase === 'select'}
                    debugPeekActive={false} previewActive={false}
                    mobileCameraMode reduceMotion={reduceMotion} graphicsQuality={graphicsQuality} viewportResetToken={attempt}
                    runStatus={session.run.status} guidedTargetTileIds={target ? [target] : []} onboardingTargetTileIds={target ? [target] : []}
                    combo={session.run.stats.currentStreak} onTileSelect={select} showTutorialPairMarkers={false} />
                {target && targetBox ? <button key={target} className={styles.target} style={targetBox as CSSProperties} type="button" autoFocus onClick={() => select(target)}
                    aria-label={`Select highlighted ${targetTile?.suit ? ELEMENT_NAMES[targetTile.suit] : ''} card`} data-testid="tutorial-target" data-target-id={target} data-label-inside={targetBox.top < 32}>
                    <span>{session.half === 0 ? 'Tap here' : 'Now here'} ↓</span>
                </button> : null}
                <ScreenCalloutQueue callouts={callouts} reduceMotion={reduceMotion} lowQuality={graphicsQuality === 'low'} />
            </div>
            <div className={styles.coach}>
                <p role="status" aria-live="polite" data-testid="tutorial-instruction">{session.phase === 'complete' ? TUTORIAL_HALL_COPY.complete : session.phase === 'result' ? reactionResult ? `${session.lesson.title}: ${elementReactionResult(reactionResult)}.` : step?.result : session.hint || (session.phase === 'resolve' ? TUTORIAL_HALL_COPY.resolving : session.half === 1 ? TUTORIAL_HALL_COPY.nextCard : step?.instruction)}</p>
                {session.phase === 'result' ? <button type="button" className={styles.primary} onClick={next} autoFocus>{session.step + 1 === session.lesson.steps.length ? 'Finish lesson' : 'Next step'}</button> : null}
                {session.phase === 'complete' ? <button type="button" className={styles.primary} autoFocus onClick={() => { setCategory(session.lesson.category); setSession(null); }}>Choose a lesson</button> : null}
            </div>
        </>
    </section>;
}
