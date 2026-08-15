import { describe, expect, it } from 'vitest';
import {
    buildGameplayEventAnnouncement,
    buildGameplayEventBatchAnnouncement
} from './gameplayEventAnnouncement';

describe('buildGameplayEventAnnouncement', () => {
    it('retains exact authoritative copy and deterministic event identity', () => {
        expect(buildGameplayEventAnnouncement({
            eventId: 'shop-purchase:1',
            message: 'Master Key purchased for 4 shop gold.',
            priority: 'info'
        })).toEqual({
            dedupeKey: 'gameplay-event:shop-purchase:1',
            message: 'Master Key purchased for 4 shop gold.',
            priority: 'info'
        });
    });

    it('retains warning priority without deriving it from state deltas', () => {
        expect(buildGameplayEventAnnouncement({
            eventId: 'enemy-contact:1',
            message: 'Warden struck for 1 life; 2 remain.',
            priority: 'error'
        })).toEqual(expect.objectContaining({
            dedupeKey: 'gameplay-event:enemy-contact:1',
            priority: 'error'
        }));
    });

    it('projects a lossless ordered command batch with replay-stable identity', () => {
        expect(buildGameplayEventBatchAnnouncement([
            {
                commandId: 'floor-advance',
                eventId: 'floor-advance:1',
                message: 'Parasite pressure is primed.',
                priority: 'error'
            },
            {
                commandId: 'floor-advance',
                eventId: 'floor-advance:3',
                message: 'Hazard Banish cleared a trap.',
                priority: 'info'
            },
            {
                commandId: 'floor-advance',
                eventId: 'floor-advance:5',
                message: 'The next floor is ready.',
                priority: 'info'
            }
        ])).toEqual({
            consumedEventIds: [
                'floor-advance:1',
                'floor-advance:3',
                'floor-advance:5'
            ],
            dedupeKey: 'gameplay-command:floor-advance:floor-advance:1,floor-advance:3,floor-advance:5',
            message: 'Parasite pressure is primed. Hazard Banish cleared a trap. The next floor is ready.',
            priority: 'error'
        });
    });

    it('deduplicates persisted event identities and excludes older commands', () => {
        expect(buildGameplayEventBatchAnnouncement([
            {
                commandId: 'older',
                eventId: 'older:1',
                message: 'Older feedback.',
                priority: 'error'
            },
            {
                commandId: 'latest',
                eventId: 'latest:1',
                message: 'Latest feedback.',
                priority: 'info'
            },
            {
                commandId: 'latest',
                eventId: 'latest:1',
                message: 'Duplicate feedback.',
                priority: 'error'
            }
        ])).toMatchObject({
            consumedEventIds: ['latest:1'],
            message: 'Latest feedback.',
            priority: 'info'
        });
        expect(buildGameplayEventBatchAnnouncement([])).toBeNull();
    });
});
