import { tr } from '../../shared/i18n';
/** The tutorial hall's running instruction, between a lesson's own lines. */
export const TUTORIAL_HALL_COPY = {
    complete: tr.s('You’ve got it.'),
    resolving: tr.s('Watch what happens…'),
    nextCard: tr.s('Tap the next highlighted card.'),
    /** The lesson list's frame (`MetaShell`). */
    eyebrow: tr.s('Tutorial Hall'),
    title: tr.s('Learn by playing'),
    practiceNote: tr.s('Practice only. Your run and records stay untouched.'),
    categoryRail: tr.s('Lesson category')
} as const;
