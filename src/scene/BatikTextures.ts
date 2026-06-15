/**
 * Procedural batik patterns rendered to CanvasTexture. No external
 * assets — every motif is drawn at module-load time using the 2D
 * Canvas API.
 *
 * Five traditional patterns, one per Indonesian region:
 *   - parang  (Java):       diagonal broken-blade stripes
 *   - kawung  (Kalimantan): 4-fold symmetric circles in a grid
 *   - poleng  (Sulawesi):   black-and-white checkered stripes
 *   - ulos    (Sumatera):   bold diamonds with inner crosses
 *   - ukir    (Papua):      stylized Asmat face masks in a grid
 *
 * Each function takes the foreground/background colors so the same
 * pattern can be re-tinted for different pions or surface types.
 */
import * as THREE from 'three';

export type BatikPattern = 'parang' | 'kawung' | 'poleng' | 'ulos' | 'ukir';

export interface BatikOptions {
  /** Foreground (motif) color. */
  readonly fg: number;
  /** Background color. */
  readonly bg: number;
  /** Optional accent color (used in ulos crosses, ukir masks). */
  readonly accent?: number;
  /** Tile size in pixels. Default 128. The pattern repeats at this size. */
  readonly size?: number;
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Batik: failed to get 2D context');
  return { canvas, ctx };
}

function toCSSColor(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/**
 * Parang: diagonal "broken blade" stripes. Diagonal parallelogram rows
 * that are slightly offset from each other. A parang motif in Javanese
 * batik represents a never-ending wave.
 */
function drawParang(ctx: CanvasRenderingContext2D, size: number, fg: string, bg: string): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  // Diagonal stripes of parallelograms, with offset to suggest a wave
  const stripeH = size / 8;
  const stripeW = size / 3;
  for (let row = -1; row < 10; row++) {
    const y = row * stripeH * 0.7;
    const xOff = (row % 2) * stripeW * 0.4;
    for (let col = -1; col < 6; col++) {
      const x = col * stripeW + xOff;
      // Slightly rotated-ish parallelogram using 4 points
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stripeW * 0.7, y);
      ctx.lineTo(x + stripeW, y + stripeH);
      ctx.lineTo(x + stripeW * 0.3, y + stripeH);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/**
 * Kawung: 4-fold symmetric circles in a grid. Each motif is two
 * intersecting oval pairs (looks like a stylized palm fruit or
 * coconut cross-section). Common in Kalimantan and Central Java.
 */
function drawKawung(ctx: CanvasRenderingContext2D, size: number, fg: string, bg: string): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  // Draw a circle motif at 4 positions in a 2x2 grid (so the edges tile)
  const cellSize = size / 2;
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const x = cx * cellSize + cellSize / 2;
      const y = cy * cellSize + cellSize / 2;
      const r = cellSize * 0.35;
      ctx.lineWidth = size * 0.04;
      // Four-pointed pinwheel: 4 overlapping circles
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const ox = Math.cos(a) * r * 0.5;
        const oy = Math.sin(a) * r * 0.5;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Center dot
      ctx.beginPath();
      ctx.arc(x, y, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Poleng: black-and-white (or in our case, fg-and-bg) checkered
 * horizontal stripes. Used in Balinese and Sulawesi temple cloth and
 * roadside shrines to represent the balance of opposites.
 */
function drawPoleng(ctx: CanvasRenderingContext2D, size: number, fg: string, bg: string): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  // 4 horizontal stripes alternating fg/bg, vertical bars offset
  const stripeCount = 4;
  const stripeH = size / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(0, i * stripeH, size, stripeH);
    }
  }
  // Vertical accent bars (3 of them)
  const barW = stripeH * 0.5;
  for (let i = 1; i < stripeCount; i++) {
    ctx.fillRect(i * (size / stripeCount) - barW / 2, 0, barW, size);
  }
}

/**
 * Ulos: bold diamonds with inner crosses. The ulos is the traditional
 * Batak textile of North Sumatra; the diamond-and-cross motif is the
 * most common. The diamonds are interconnected.
 */
function drawUlos(ctx: CanvasRenderingContext2D, size: number, fg: string, bg: string, accent: string): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  // 2x2 grid of large diamonds
  const cell = size / 2;
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const x = cx * cell + cell / 2;
      const y = cy * cell + cell / 2;
      const r = cell * 0.40;
      // Outer diamond
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      // Inner cross (accent color)
      ctx.strokeStyle = accent;
      ctx.lineWidth = size * 0.025;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y);
      ctx.lineTo(x + r * 0.55, y);
      ctx.moveTo(x, y - r * 0.55);
      ctx.lineTo(x, y + r * 0.55);
      ctx.stroke();
    }
  }
}

/**
 * Ukir: stylized Asmat face-mask motifs. Common in Papua. A
 * simplified face with a tall headdress, two round eyes, and a small
 * mouth, arranged in a regular grid.
 */
function drawUkir(ctx: CanvasRenderingContext2D, size: number, fg: string, bg: string, accent: string): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  // 2x2 grid of faces
  const cell = size / 2;
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const x = cx * cell + cell / 2;
      const y = cy * cell + cell / 2;
      // Headdress (narrow vertical above face)
      ctx.fillRect(x - size * 0.025, y - cell * 0.30, size * 0.05, cell * 0.18);
      // Head outline (oval)
      ctx.beginPath();
      ctx.ellipse(x, y + cell * 0.02, cell * 0.18, cell * 0.22, 0, 0, Math.PI * 2);
      ctx.lineWidth = size * 0.02;
      ctx.stroke();
      // Two round eyes
      ctx.fillStyle = accent;
      const eyeR = size * 0.018;
      ctx.beginPath();
      ctx.arc(x - cell * 0.07, y - cell * 0.02, eyeR, 0, Math.PI * 2);
      ctx.arc(x + cell * 0.07, y - cell * 0.02, eyeR, 0, Math.PI * 2);
      ctx.fill();
      // Small mouth (horizontal line)
      ctx.fillStyle = fg;
      ctx.fillRect(x - cell * 0.06, y + cell * 0.10, cell * 0.12, size * 0.012);
    }
  }
}

/** Draws a pattern onto a canvas, returns the canvas. */
function drawPattern(pattern: BatikPattern, size: number, fg: number, bg: number, accent?: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size);
  const fgStr = toCSSColor(fg);
  const bgStr = toCSSColor(bg);
  const accentStr = toCSSColor(accent ?? fg);
  switch (pattern) {
    case 'parang':  drawParang(ctx, size, fgStr, bgStr); break;
    case 'kawung':  drawKawung(ctx, size, fgStr, bgStr); break;
    case 'poleng':  drawPoleng(ctx, size, fgStr, bgStr); break;
    case 'ulos':    drawUlos(ctx, size, fgStr, bgStr, accentStr); break;
    case 'ukir':    drawUkir(ctx, size, fgStr, bgStr, accentStr); break;
  }
  return canvas;
}

/** Build a CanvasTexture for a region tile. */
export function makeBatikTexture(pattern: BatikPattern, opts: BatikOptions): THREE.CanvasTexture {
  const size = opts.size ?? 128;
  const canvas = drawPattern(pattern, size, opts.fg, opts.bg, opts.accent);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Build a small (CSS-sized) batik canvas for use in DOM elements like
 * the win modal background. Returns a data URL.
 */
export function makeBatikDataUrl(pattern: BatikPattern, opts: BatikOptions): string {
  const size = opts.size ?? 64;
  const canvas = drawPattern(pattern, size, opts.fg, opts.bg, opts.accent);
  return canvas.toDataURL('image/png');
}

/**
 * Per-region batik specs. These are the colors to use for tile
 * textures; we keep the same primary color as slice 3 so the board
 * still reads the same at a glance, but now it has texture.
 */
export interface RegionBatik {
  readonly pattern: BatikPattern;
  readonly fg: number;
  readonly bg: number;
  readonly accent: number;
}

export const REGION_BATIK: Record<string, RegionBatik> = {
  sumatra:    { pattern: 'ulos',   fg: 0xC41E3A, bg: 0xF5E5C3, accent: 0x1B2A4A },
  java:       { pattern: 'parang', fg: 0x1B2A4A, bg: 0xD4A843, accent: 0xC41E3A },
  kalimantan: { pattern: 'kawung', fg: 0x2D5A27, bg: 0xF5F0E8, accent: 0xD4A843 },
  sulawesi:   { pattern: 'poleng', fg: 0xF5F0E8, bg: 0x1B2A4A, accent: 0xC41E3A },
  papua:      { pattern: 'ukir',   fg: 0x8B5A2B, bg: 0xF5DDB0, accent: 0x1B2A4A }
};

/**
 * Pick a costume for a player by pattern name. This uses the regional
 * batik palette as the default but applies the player's chosen
 * pattern. Each pattern has a couple of color variants for variety
 * (e.g. the parang "Java" version uses the gold-on-blue palette, but
 * the parang "Sumatra" version uses red-on-cream).
 */
export interface PionCostumeSpec {
  readonly pattern: BatikPattern;
  readonly fg: number;
  readonly bg: number;
  readonly accent: number;
}

const PATTERN_VARIANTS: Record<string, PionCostumeSpec[]> = {
  parang: [
    // Java palette (default): gold + blue + red
    { pattern: 'parang', fg: 0x1B2A4A, bg: 0xD4A843, accent: 0xC41E3A },
    // Alternative: red + cream
    { pattern: 'parang', fg: 0xC41E3A, bg: 0xF5E5C3, accent: 0x1B2A4A },
    // Alternative: green + gold
    { pattern: 'parang', fg: 0x2D5A27, bg: 0xD4A843, accent: 0x1B2A4A }
  ],
  ulos: [
    // Sumatera palette: red + cream + blue
    { pattern: 'ulos', fg: 0xC41E3A, bg: 0xF5E5C3, accent: 0x1B2A4A },
    // Alternative: deep red
    { pattern: 'ulos', fg: 0x8B2A2A, bg: 0xF5DDB0, accent: 0xC41E3A }
  ],
  kawung: [
    // Kalimantan palette: green + cream + gold
    { pattern: 'kawung', fg: 0x2D5A27, bg: 0xF5F0E8, accent: 0xD4A843 },
    // Alternative: blue + cream
    { pattern: 'kawung', fg: 0x1B2A4A, bg: 0xF5F0E8, accent: 0xD4A843 }
  ],
  poleng: [
    // Sulawesi palette: cream + blue + red
    { pattern: 'poleng', fg: 0xF5F0E8, bg: 0x1B2A4A, accent: 0xC41E3A },
    // Alternative: red + cream
    { pattern: 'poleng', fg: 0xC41E3A, bg: 0xF5E5C3, accent: 0x1B2A4A }
  ],
  ukir: [
    // Papua palette: brown + cream + blue
    { pattern: 'ukir', fg: 0x8B5A2B, bg: 0xF5DDB0, accent: 0x1B2A4A },
    // Alternative: olive + cream
    { pattern: 'ukir', fg: 0x7A8B3A, bg: 0xF5F0E8, accent: 0x8B5A2B }
  ]
};

/** Get the default (first) variant for a pattern, used when no specific
 * variant is requested. */
export function getPionCostume(pattern: string): PionCostumeSpec {
  const variants = PATTERN_VARIANTS[pattern];
  if (!variants || variants.length === 0) {
    // Fallback to parang default
    return PATTERN_VARIANTS['parang']![0]!;
  }
  return variants[0]!;
}
