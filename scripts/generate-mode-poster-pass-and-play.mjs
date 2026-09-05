#!/usr/bin/env node
/**
 * Procedural mode poster for Pass and Play.
 *
 * Every other mode in the catalog carries bespoke poster art, and a REG-013 test holds the whole
 * catalog to that — a new mode on the shared fallback emblem fails it, which is the gate working.
 * There is no image encoder in this project's dependencies, so this draws the plate on a canvas in
 * the Chromium that already ships for the e2e suite and lets the browser encode the WebP. No new
 * dependency, and the art is generated from the theme's own colours rather than eyeballed.
 *
 * The subject is the mode: two seats facing one board, and a single card passing between them.
 *
 * Usage: node scripts/generate-mode-poster-pass-and-play.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'src/renderer/assets/ui/backgrounds/bg-mode-pass-and-play-v1.webp');
const WIDTH = 1376;
const HEIGHT = 768;

/** Same executable resolution as playwright.config.ts, for the same reason. */
const resolveChromium = () => {
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
        return process.env.PLAYWRIGHT_CHROMIUM_PATH;
    }
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const candidate = base ? join(base, 'chromium') : null;
    return candidate && existsSync(candidate) ? candidate : undefined;
};

const draw = ([width, height]) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const gold = '#f5d28a';
    const goldDeep = '#c08a35';
    const cyan = '#7fd8d0';

    // Ground: the same void-to-ember wash the other posters sit on.
    const ground = ctx.createLinearGradient(0, 0, width, height);
    ground.addColorStop(0, '#150a14');
    ground.addColorStop(0.55, '#122b29');
    ground.addColorStop(1, '#2a1a10');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);

    // The table: one lit ellipse both players lean over.
    const table = ctx.createRadialGradient(width / 2, height * 0.72, 40, width / 2, height * 0.72, width * 0.52);
    table.addColorStop(0, 'rgba(245, 210, 138, 0.30)');
    table.addColorStop(0.5, 'rgba(127, 216, 208, 0.10)');
    table.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = table;
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.74, width * 0.46, height * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Two seats, facing. Arcs rather than figures: the poster has to read at card size.
    for (const [cx, tint] of [
        [width * 0.22, cyan],
        [width * 0.78, gold]
    ]) {
        ctx.strokeStyle = tint;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(cx, height * 0.52, height * 0.20, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, height * 0.52, height * 0.28, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // The card in transit: the whole mode in one shape.
    ctx.save();
    ctx.translate(width / 2, height * 0.46);
    ctx.rotate(-0.14);
    const cardW = width * 0.13;
    const cardH = cardW * 1.42;
    const face = ctx.createLinearGradient(0, -cardH / 2, 0, cardH / 2);
    face.addColorStop(0, 'rgba(245, 210, 138, 0.92)');
    face.addColorStop(1, 'rgba(192, 138, 53, 0.78)');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = '#0b1215';
    ctx.lineWidth = 8;
    ctx.stroke();
    // A diamond sigil, the same mark the tile backs carry.
    ctx.fillStyle = '#152f2c';
    ctx.beginPath();
    ctx.moveTo(0, -cardH * 0.17);
    ctx.lineTo(cardW * 0.2, 0);
    ctx.lineTo(0, cardH * 0.17);
    ctx.lineTo(-cardW * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // The pass: an arc from one seat to the other, through the card.
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 5;
    ctx.setLineDash([26, 20]);
    ctx.beginPath();
    ctx.moveTo(width * 0.3, height * 0.5);
    ctx.quadraticCurveTo(width / 2, height * 0.18, width * 0.7, height * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Vignette, so the card art keeps its centre when the poster is cropped.
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.7);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(6, 8, 10, 0.78)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = goldDeep;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, width - 10, height - 10);

    return canvas.toDataURL('image/webp', 0.9);
};

const browser = await chromium.launch({ executablePath: resolveChromium() });
const page = await browser.newPage();
await page.setContent('<!doctype html><body></body>');
const dataUrl = await page.evaluate(draw, [WIDTH, HEIGHT]);
await browser.close();

if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error('the browser did not encode WebP; refusing to write a PNG under a .webp name');
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
process.stdout.write(`wrote ${OUT}\n`);
