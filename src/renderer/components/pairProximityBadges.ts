import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

const paintHint = (canvas: HTMLCanvasElement, distance: number): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 10;
    ctx.fillStyle = 'rgba(8,12,22,0.88)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 14);
    } else {
        ctx.rect(pad, pad, w - pad * 2, h - pad * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#7de8b8';
    ctx.font = 'bold 68px system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(distance), w / 2, h / 2 + 3);
};

/**
 * Minesweeper-style grid-distance badge: Manhattan steps to the nearest legal pair partner.
 * Rendered on the front face while a tile is flipped (committed), not during memorize/peek-only faces.
 */
/*
 * One badge per distance, painted once and shared. Each plane used to make its own canvas and texture
 * on every flip and dispose it on the next, so every turn drew and uploaded fresh badges mid-play; a
 * board has only a handful of distances, and a number looks the same wherever it is shown.
 */
const badgeByDistance = new Map<number, CanvasTexture>();

export const badgeTexture = (distance: number): CanvasTexture => {
    const cached = badgeByDistance.get(distance);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    paintHint(canvas, distance);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    badgeByDistance.set(distance, texture);
    return texture;
};

/** Paints every badge a board can show (distances up to its width plus height) before its first frame. */
export const prewarmPairProximityBadges = (maxDistance: number): void => {
    for (let distance = 1; distance <= maxDistance; distance += 1) badgeTexture(distance);
};
