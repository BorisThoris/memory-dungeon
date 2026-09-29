import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWipeBook, buildWipeFrame, WIPE_FRAMES, WIPE_VIEWBOX } from './sceneWipeFrames';
import { SCENE_WIPE_MS, SceneWipe } from './SceneWipe';
import { useSceneWipe } from './useSceneWipe';

describe('the wipe between rooms', () => {
    it('is a book of drawn frames that grow from the edges until the last covers the screen, the same for a key', () => {
        const book = buildWipeBook('wipe:shop:1');
        expect(book).toHaveLength(WIPE_FRAMES);
        expect(book).toEqual(buildWipeBook('wipe:shop:1'));
        expect(buildWipeFrame('wipe:shop:1', 0).length).toBeLessThanOrEqual(buildWipeFrame('wipe:shop:1', 3).length);
        const last = book[WIPE_FRAMES - 1]!;
        expect(last[last.length - 1]!.d).toContain(`${WIPE_VIEWBOX.width + 10}`);
        expect(buildWipeBook('wipe:dungeon:2')[3]).not.toEqual(book[3]);
    });

    it('renders one SVG per frame, and nothing under reduced motion', () => {
        const { rerender } = render(<SceneWipe direction="in" reduceMotion={false} wipeKey="w1" />);
        expect(screen.getByTestId('scene-wipe')).toHaveAttribute('data-direction', 'in');
        expect(screen.getByTestId('scene-wipe').querySelectorAll('svg')).toHaveLength(WIPE_FRAMES);
        rerender(<SceneWipe direction="out" reduceMotion wipeKey="w2" />);
        expect(screen.queryByTestId('scene-wipe')).toBeNull();
    });

    describe('keyed to the room change', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('wipes in on the way to the shop and out on the way back, never on the room it opened on', () => {
            const { result, rerender } = renderHook(({ room }) => useSceneWipe(room), { initialProps: { room: 'dungeon' as 'dungeon' | 'shop' } });
            expect(result.current).toBeNull();
            rerender({ room: 'shop' });
            expect(result.current?.direction).toBe('in');
            act(() => {
                vi.advanceTimersByTime(SCENE_WIPE_MS + 50);
            });
            expect(result.current).toBeNull();
            rerender({ room: 'dungeon' });
            expect(result.current?.direction).toBe('out');
        });
    });
});
