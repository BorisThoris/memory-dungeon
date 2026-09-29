import { useMemo } from 'react';
import { createMulberry32, hashStringToSeed } from '../../shared/rng';
import styles from './GoldRain.module.css';

/**
 * Gold rain: coins falling across the room when the run pays out - a floor cleared, a thing
 * bought, an ascension. The arcade fishing tables (捕鱼达人) rain coins on every jackpot and
 * the whole cabinet takes part; here the coins fall through the room's plate, more of them the
 * bigger the payout and the higher the combo, and every one is a seeded SVG so a replay rains the
 * same way. One shower per key; the caller remounts it with the event.
 */
export interface GoldRainProps {
    /** Identity of the payout; the shower is seeded from it. */
    rainKey: string;
    /** How many coins: the payout in gold, scaled by the caller (an ascension adds, Deep Pockets multiplies). */
    coins: number;
}

export const GOLD_RAIN_MAX_COINS = 90;

export interface GoldCoin {
    x: number;
    delay: number;
    duration: number;
    size: number;
    spin: number;
}

export const buildGoldRain = (rainKey: string, coins: number): GoldCoin[] => {
    const rng = createMulberry32(hashStringToSeed(`gold-rain:${rainKey}`));
    const count = Math.max(0, Math.min(GOLD_RAIN_MAX_COINS, Math.round(coins)));
    const out: GoldCoin[] = [];
    for (let index = 0; index < count; index += 1) {
        out.push({
            x: 4 + rng() * 92,
            delay: rng() * 0.9,
            duration: 1.3 + rng() * 0.9,
            size: 0.9 + rng() * 0.9,
            spin: rng() > 0.5 ? 1 : -1
        });
    }
    return out;
};

export function GoldRain({ rainKey, coins }: GoldRainProps) {
    const drops = useMemo(() => buildGoldRain(rainKey, coins), [rainKey, coins]);
    if (drops.length === 0) return null;
    return (
        <div aria-hidden="true" className={styles.rain} data-coins={drops.length} data-testid="gameplay-scene-gold-rain">
            {drops.map((coin, index) => (
                <svg
                    className={styles.coin}
                    key={index}
                    style={{
                        left: `${coin.x.toFixed(1)}%`,
                        animationDelay: `${coin.delay.toFixed(2)}s`,
                        animationDuration: `${coin.duration.toFixed(2)}s`,
                        width: `${(1.6 * coin.size).toFixed(2)}%`,
                        ['--coin-spin' as string]: coin.spin
                    }}
                    viewBox="0 0 20 20"
                >
                    <circle cx="10" cy="10" fill="url(#gold-coin)" r="9" stroke="#8a5a12" strokeWidth="1" />
                    <circle cx="10" cy="10" fill="none" r="5.5" stroke="#fff1c2" strokeOpacity="0.7" strokeWidth="1" />
                </svg>
            ))}
            <svg className={styles.defs} viewBox="0 0 1 1">
                <defs>
                    <radialGradient id="gold-coin" cx="0.35" cy="0.3" r="0.8">
                        <stop offset="0" stopColor="#fff3c4" />
                        <stop offset="0.45" stopColor="#f1c24d" />
                        <stop offset="1" stopColor="#a86c14" />
                    </radialGradient>
                </defs>
            </svg>
        </div>
    );
}
