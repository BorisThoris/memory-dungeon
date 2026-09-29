import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildGoldRain, GOLD_RAIN_MAX_COINS, GoldRain } from './GoldRain';

describe('gold rain', () => {
    it('rains the same coins for the same payout, more for a bigger one, never past the cap', () => {
        expect(buildGoldRain('floor:3', 12)).toEqual(buildGoldRain('floor:3', 12));
        expect(buildGoldRain('floor:3', 12)).not.toEqual(buildGoldRain('floor:4', 12));
        expect(buildGoldRain('x', 12)).toHaveLength(12);
        expect(buildGoldRain('x', 500)).toHaveLength(GOLD_RAIN_MAX_COINS);
        expect(buildGoldRain('x', 0)).toHaveLength(0);
        for (const coin of buildGoldRain('y', 40)) {
            expect(coin.x).toBeGreaterThanOrEqual(4);
            expect(coin.x).toBeLessThanOrEqual(96);
            expect(coin.duration).toBeGreaterThan(1);
        }
    });

    it('renders one coin per drop, and nothing for an empty payout', () => {
        const { rerender } = render(<GoldRain coins={7} rainKey="buy:miss:1" />);
        expect(screen.getByTestId('gameplay-scene-gold-rain')).toHaveAttribute('data-coins', '7');
        expect(screen.getByTestId('gameplay-scene-gold-rain').querySelectorAll('circle')).toHaveLength(14);
        rerender(<GoldRain coins={0} rainKey="buy:miss:2" />);
        expect(screen.queryByTestId('gameplay-scene-gold-rain')).toBeNull();
    });
});
