import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

/**
 * The badge is the number in a lit gem: a gold disc with a dark rim and a halo, so it reads on every
 * card face and every element at a glance (2026-10-01: the owner asked for "the top right hint" to
 * be more noticeable; it had been a small dark tile with a thin green numeral).
 */
const paintHint = (canvas: HTMLCanvasElement, distance: number): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(cx, cy, w * 0.36, cx, cy, w * 0.5);
    halo.addColorStop(0, 'rgba(255, 214, 110, 0.85)');
    halo.addColorStop(1, 'rgba(255, 214, 110, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const r = w * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    disc.addColorStop(0, '#fff6cf');
    disc.addColorStop(0.55, '#ffd25e');
    disc.addColorStop(1, '#e09a1c');
    ctx.fillStyle = disc;
    ctx.fill();
    ctx.lineWidth = w * 0.045;
    ctx.strokeStyle = '#2a1606';
    ctx.stroke();
    ctx.fillStyle = '#1c0e04';
    ctx.font = `900 ${Math.round(w * (distance >= 10 ? 0.42 : 0.54))}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(distance), cx, cy + w * 0.02);
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
    canvas.width = 160;
    canvas.height = 160;
    paintHint(canvas, distance);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    badgeByDistance.set(distance, texture);
    return texture;
};

/** Paints every badge a board can show (distances up to its width plus height) before its first frame. */
export const prewarmPairProximityBadges = (maxDistance: number): void => {
    for (let distance = 1; distance <= maxDistance; distance += 1) badgeTexture(distance);
};
