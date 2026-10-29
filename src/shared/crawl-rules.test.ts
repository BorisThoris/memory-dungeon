import { describe, expect, it } from 'vitest';
import { bombSelectableTileIds } from './board-power-actions';
import type { RunState } from './contracts';
import { CRAWL_HEALTH, crawlReachableCells, crawlNextStrikeLine, withCrawl } from './crawl-rules';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';

const crawlRun = (seed = 4242): RunState => finishMemorizePhase(withCrawl(createNewRun(0, { runSeed: seed })));

const turn = (run: RunState, firstId: string, secondId: string): RunState => resolveBoardTurn(flipTile(flipTile(run, firstId), secondId));

describe('the crawl (prototype, ?crawl=1)', () => {
    it('deals a hero at the bottom-left, a monster away from it, and full health', () => {
        const run = crawlRun();
        const board = run.board!;
        expect(run.crawl).toBe(true);
        expect(run.crawlHealth).toBe(CRAWL_HEALTH);
        expect(board.crawl!.hero).toBe((board.rows - 1) * board.columns);
        expect(board.crawl!.monsters.length).toBeGreaterThan(0);
        expect(board.crawl!.monsters.every((monster) => monster.cell !== board.crawl!.hero)).toBe(true);
    });

    it('refuses a first card the hero cannot reach, and allows a second card anywhere', () => {
        const run = crawlRun();
        const board = run.board!;
        const reach = crawlReachableCells(board);
        const far = board.tiles.findIndex((tile, index) => tile.state === 'hidden' && !reach.has(index));
        expect(far).toBeGreaterThanOrEqual(0);
        expect(flipTile(run, board.tiles[far]!.id)).toBe(run);
        const near = board.tiles[[...reach][0]!]!;
        const once = flipTile(run, near.id);
        expect(once).not.toBe(run);
        expect(flipTile(once, board.tiles[far]!.id)).not.toBe(once);
    });

    it('a match moves the hero to the partner, and monsters strike on their count until the hero is slain', () => {
        let run = crawlRun();
        const board = run.board!;
        const near = board.tiles[[...crawlReachableCells(board)][0]!]!;
        const partner = board.tiles.find((tile) => tile.pairKey === near.pairKey && tile.id !== near.id)!;
        run = turn(run, near.id, partner.id);
        expect(run.board!.crawl!.hero).toBe(board.tiles.indexOf(partner));
        // A monster one turn from striking, at the hero's last point of health: the next turn slays.
        const monster = { cell: board.tiles.length - 1, kind: 'ghoul' as const, hp: 9, maxHp: 9, clock: 1, every: 3, damage: 1 };
        run = { ...run, crawlHealth: 1, missBank: undefined, board: { ...run.board!, crawl: { ...run.board!.crawl!, monsters: [monster] } } };
        expect(crawlNextStrikeLine([monster])).toBe('−1 next turn');
        const b = run.board!;
        const first = b.tiles[[...crawlReachableCells(b)].find((cell) => cell !== monster.cell)!]!;
        const other = b.tiles.find((tile) => tile.state === 'hidden' && tile.id !== first.id && tile.pairKey !== first.pairKey && b.tiles.indexOf(tile) !== monster.cell)!;
        const after = turn(run, first.id, other.id);
        expect(after.crawlHealth).toBe(0);
        expect(after.status).toBe('gameOver');
        expect(after.runEndReason).toBe('slain');
    });

    it('aims a bomb only at cards the hero can reach, since a bomb is aimed by turning a card', () => {
        const run = { ...crawlRun(), bombCharges: 1 };
        const board = run.board!;
        const reach = crawlReachableCells(board);
        const choices = bombSelectableTileIds(run);
        expect(choices.length).toBeGreaterThan(0);
        expect(choices.every((id) => reach.has(board.tiles.findIndex((tile) => tile.id === id)))).toBe(true);
        expect(bombSelectableTileIds({ ...run, crawl: false }).length).toBeGreaterThan(choices.length);
    });
});
