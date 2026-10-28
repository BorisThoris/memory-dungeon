import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactElement } from 'react';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';
import type { BoardState } from '../../shared/contracts';
import { crawlReachableCells, type CrawlMonster } from '../../shared/crawl-rules';
import { noopMeshRaycast } from './tileBoardPick';
import { getTileTransform } from './tileBoardTransform';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * The crawl's tokens (`crawl-rules.ts`, prototype behind `?crawl=1`): the hero on its cell and every monster on
 * its card, drawn in front of the cards and never picked. A monster shows its health in a red badge and its
 * count to the next strike in pips; one about to strike pulses. The hero glides to its new cell.
 */
const SIZE = 256;

const paint = (draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture | null => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

const heroTexture = (): CanvasTexture | null =>
    paint((ctx) => {
        const c = SIZE / 2;
        ctx.fillStyle = 'rgba(255, 207, 106, 0.28)';
        ctx.beginPath();
        ctx.arc(c, c, c * 0.96, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1b130b';
        ctx.strokeStyle = '#ffcf6a';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(c, c, c * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // A sword: blade, guard, grip.
        ctx.fillStyle = '#f4ead2';
        ctx.beginPath();
        ctx.moveTo(c, c - 70);
        ctx.lineTo(c + 13, c - 46);
        ctx.lineTo(c + 13, c + 22);
        ctx.lineTo(c - 13, c + 22);
        ctx.lineTo(c - 13, c - 46);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffcf6a';
        ctx.fillRect(c - 42, c + 22, 84, 14);
        ctx.fillRect(c - 9, c + 36, 18, 34);
    });

const MONSTER_TINT: Record<CrawlMonster['kind'], string> = { ghoul: '#7d1d1d', wisp: '#3c2a6b', brute: '#4a2411' };
const MONSTER_GLYPH: Record<CrawlMonster['kind'], string> = { ghoul: 'G', wisp: 'W', brute: 'B' };

const monsterTexture = (monster: CrawlMonster): CanvasTexture | null =>
    paint((ctx) => {
        const c = SIZE / 2;
        ctx.fillStyle = MONSTER_TINT[monster.kind];
        ctx.strokeStyle = '#ff6a4d';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(c, c - 18, c * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffe9d6';
        ctx.font = 'bold 88px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(MONSTER_GLYPH[monster.kind], c - 30, c - 22);
        ctx.fillStyle = '#ff6a4d';
        ctx.font = 'bold 72px Georgia, serif';
        ctx.fillText(String(monster.hp), c + 42, c - 12);
        // Pips: turns until it strikes.
        for (let i = 0; i < monster.every; i += 1) {
            ctx.fillStyle = i < monster.clock ? '#ffd2a0' : 'rgba(255, 210, 160, 0.22)';
            ctx.beginPath();
            ctx.arc(c - (monster.every - 1) * 20 + i * 40, SIZE - 34, 14, 0, Math.PI * 2);
            ctx.fill();
        }
    });

const cellPosition = (board: Pick<BoardState, 'tiles' | 'columns' | 'rows'>, cell: number, compact: boolean, reduceMotion: boolean): [number, number] => {
    const tile = board.tiles[cell];
    if (!tile) return [0, 0];
    const transform = getTileTransform(tile, cell, board.columns, board.rows, compact, false, reduceMotion);
    return [transform.baseX + transform.layoutJitterX, transform.baseY + transform.layoutJitterY];
};

const MonsterToken = ({ monster, x, y, time, reduceMotion }: { monster: CrawlMonster; x: number; y: number; time: MutableRefObject<number>; reduceMotion: boolean }): ReactElement | null => {
    const texture = useMemo(() => monsterTexture(monster), [monster]);
    const ref = useRef<Group>(null);
    useEffect(() => () => texture?.dispose(), [texture]);
    useFrame(() => {
        if (!ref.current) return;
        const urgent = monster.clock <= 1 && !reduceMotion;
        const s = urgent ? 1 + 0.08 * Math.sin(time.current * 9) : 1;
        ref.current.scale.set(s, s, 1);
    });
    if (!texture) return null;
    const size = CARD_PLANE_WIDTH * 0.62;
    return (
        <group ref={ref} position={[x + CARD_PLANE_WIDTH * 0.2, y + CARD_PLANE_HEIGHT * 0.26, 0.16]}>
            <mesh raycast={noopMeshRaycast} renderOrder={40}>
                <planeGeometry args={[size, size]} />
                <meshBasicMaterial depthTest={false} depthWrite={false} map={texture} toneMapped={false} transparent />
            </mesh>
        </group>
    );
};

const reachTexture = (): CanvasTexture | null =>
    paint((ctx) => {
        ctx.strokeStyle = '#ffcf6a';
        ctx.lineWidth = 10;
        ctx.shadowColor = '#ffcf6a';
        ctx.shadowBlur = 18;
        ctx.strokeRect(14, 14, SIZE - 28, SIZE - 28);
    });

export function CrawlTokens({ board, compact, reduceMotion, showReach = true, stickyCell = null, time }: {
    board: Pick<BoardState, 'tiles' | 'columns' | 'rows' | 'crawl' | 'fold' | 'flippedTileIds'>;
    showReach?: boolean;
    stickyCell?: number | null;
    compact: boolean;
    reduceMotion: boolean;
    time: MutableRefObject<number>;
}): ReactElement | null {
    const heroMap = useMemo(() => heroTexture(), []);
    const reachMap = useMemo(() => reachTexture(), []);
    // Before a turn's first card: the cards the hero can open, outlined in gold.
    const reach = useMemo(() => (showReach && board.crawl && board.flippedTileIds.length === 0 ? [...crawlReachableCells(board, stickyCell)] : []), [board, showReach, stickyCell]);
    const hero = useRef<Group>(null);
    const crawl = board.crawl;
    const target = crawl ? cellPosition(board, crawl.hero, compact, reduceMotion) : null;
    useFrame((_state, delta) => {
        if (!hero.current || !target) return;
        const k = reduceMotion ? 1 : Math.min(1, delta * 7);
        hero.current.position.x += (target[0] - hero.current.position.x) * k;
        hero.current.position.y += (target[1] - hero.current.position.y) * k;
        const bob = reduceMotion ? 0 : 0.025 * Math.sin(time.current * 3);
        hero.current.position.z = 0.18 + bob;
    });
    if (!crawl || !heroMap || !target) return null;
    const heroSize = CARD_PLANE_WIDTH * 0.8;
    return (
        <group name="crawl-tokens">
            {reachMap ? reach.map((cell) => {
                const [x, y] = cellPosition(board, cell, compact, reduceMotion);
                return (
                    <mesh key={`reach-${cell}`} position={[x, y, 0.12]} raycast={noopMeshRaycast} renderOrder={39}>
                        <planeGeometry args={[CARD_PLANE_WIDTH * 1.12, CARD_PLANE_HEIGHT * 1.08]} />
                        <meshBasicMaterial depthTest={false} depthWrite={false} map={reachMap} toneMapped={false} transparent opacity={0.9} />
                    </mesh>
                );
            }) : null}
            {crawl.monsters.map((monster) => {
                const [x, y] = cellPosition(board, monster.cell, compact, reduceMotion);
                return <MonsterToken key={`${monster.cell}-${monster.kind}`} monster={monster} x={x} y={y} time={time} reduceMotion={reduceMotion} />;
            })}
            <group ref={hero} position={[target[0], target[1], 0.18]}>
                <mesh raycast={noopMeshRaycast} renderOrder={41}>
                    <planeGeometry args={[heroSize, heroSize]} />
                    <meshBasicMaterial depthTest={false} depthWrite={false} map={heroMap} toneMapped={false} transparent />
                </mesh>
            </group>
        </group>
    );
}
