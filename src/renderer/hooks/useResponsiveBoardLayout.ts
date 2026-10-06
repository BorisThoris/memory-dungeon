import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { RunState } from '../../shared/contracts';
import { isNarrowShortLandscapeForMenuStack, VIEWPORT_MOBILE_MAX } from '../breakpoints';
import { boardFitFrame, responsiveBoardColumns } from '../components/tileBoardResponsiveLayout';
import { canReflowRunBoard } from '../../shared/board-layout-rules';
import { useAppStore } from '../store/useAppStore';

/** Reflow on new floors and screen changes, never in response to a match or a growing combo label. */
export const useResponsiveBoardLayout = (shellRef: RefObject<HTMLElement | null>, run: RunState, shellLayout: string): void => {
    const applied = useRef('');
    const level = run.board?.level;
    const count = run.board?.tiles.length;
    useLayoutEffect(() => {
        const shell = shellRef.current;
        if (!shell || typeof ResizeObserver === 'undefined') return;
        let frame = 0;
        const measure = (): void => {
            const stage = shell.querySelector('[data-testid="tile-board-stage-shell"]');
            if (!stage) return;
            const rect = stage.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const key = `${run.runSeed}:${level}:${count}:${shellLayout}:${rect.width.toFixed(1)}:${rect.height.toFixed(1)}`;
            if (key === applied.current) return;
            const state = useAppStore.getState();
            const current = state.run;
            if (!current?.board || current.runSeed !== run.runSeed || current.board.level !== level || !canReflowRunBoard(current)) return;
            const hud = shell.querySelector('[data-testid="game-hud"]');
            const dock = shell.querySelector('[data-testid="game-action-dock"]');
            const fit = boardFitFrame(rect, hud?.getBoundingClientRect().bottom ?? rect.top, dock?.getBoundingClientRect().top ?? rect.bottom, shell.querySelector('[data-testid="hud-chain"]')?.getBoundingClientRect());
            const compact = window.innerWidth <= VIEWPORT_MOBILE_MAX || isNarrowShortLandscapeForMenuStack(window.innerWidth, window.innerHeight);
            const columns = responsiveBoardColumns(current.board.tiles.length, rect.width * fit.widthFraction, rect.height * fit.heightFraction, compact);
            applied.current = key;
            state.reflowBoard(columns);
        };
        const schedule = (): void => {
            if (frame) return;
            frame = requestAnimationFrame(() => { frame = 0; measure(); });
        };
        measure();
        const observer = new ResizeObserver(schedule);
        observer.observe(shell);
        const stage = shell.querySelector('[data-testid="tile-board-stage-shell"]');
        if (stage) observer.observe(stage);
        const mutation = new MutationObserver(schedule);
        mutation.observe(shell, { childList: true, subtree: true });
        return () => { observer.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); };
    }, [shellRef, run.runSeed, run.status, level, count, shellLayout]);
};
