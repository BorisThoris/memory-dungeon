import type { DungeonMapNodePresentation, DungeonRoomPresentation } from '../../shared/run-map';
import styles from './GameScreen.module.css';

interface GameScreenDungeonRunStripProps {
    bossDistance: number;
    currentRoom: DungeonRoomPresentation;
    visibleNodes: readonly DungeonMapNodePresentation[];
}

export const GameScreenDungeonRunStrip = ({
    bossDistance,
    currentRoom,
    visibleNodes
}: GameScreenDungeonRunStripProps) => (
    <section className={styles.dungeonRunStrip} data-testid="dungeon-run-strip">
        <div className={styles.dungeonRunCurrent} data-tone={currentRoom.tone}>
            <span className={styles.dungeonRunGlyph}>{currentRoom.glyph}</span>
            <div>
                <span>{currentRoom.eyebrow}</span>
                <strong>{currentRoom.label}</strong>
            </div>
        </div>
        <div className={styles.dungeonRunNodeRail} aria-label="Dungeon route">
            {visibleNodes.slice(-7).map((node) => (
                <span
                    className={styles.dungeonRunNode}
                    data-status={node.status}
                    data-tone={node.tone}
                    key={node.id}
                    title={`${node.label}: ${node.mechanic}`}
                >
                    {node.glyph}
                </span>
            ))}
        </div>
        <div className={styles.dungeonRunIntel}>
            <strong>Boss in {bossDistance}</strong>
            <span>{currentRoom.mechanic}</span>
        </div>
    </section>
);
