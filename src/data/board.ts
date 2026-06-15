/**
 * Board data: snake/ladder tables and the region map.
 * Source: D:\Workspace\game-design.md (game-design.md, v1).
 *
 * Convention in the data:
 * - Squares are 1..100. There is no square 0; players start "at square 0" (off-board).
 * - Snake: landing on `from` sends the player to `to` (to < from).
 * - Ladder: landing on `from` sends the player to `to` (to > from).
 * - Region: a square belongs to whichever island contains it, per the doc.
 *
 * Verification of the snakes table against game-design.md (lines 24-34):
 *   Naga Banda       98→28  ✓
 *   Ular Naga Jawa   95→56  ✓
 *   Buaya Putih      92→42  ✓
 *   Lipan            88→18  ✓
 *   Naga Sari        84→34  ✓
 *   Ular Sawa        72→30  ✓
 *   Naga Tasik       64→10  ✓
 *   Kalajengking     58→22  ✓
 *   Ular Kadal       46→5   ✓
 *
 * Verification of ladders (lines 38-45):
 *   Borobudur         4→45  ✓
 *   Prambanan        12→68  ✓
 *   Istana Maimun    21→82  ✓
 *   Benteng Rotterdam 33→87 ✓
 *   Monas            50→91  ✓
 *   Candi Sewu       60→96  ✓
 *   Taman Nasional Komodo 70→99 ✓
 */
export type Square = number; // 1..100
export type Region = 'sumatra' | 'java' | 'kalimantan' | 'sulawesi' | 'papua';

export interface Snake {
  readonly from: Square;
  readonly to: Square;
  readonly name: string;
  readonly mythology: string;
}

export interface Ladder {
  readonly from: Square;
  readonly to: Square;
  readonly name: string;
  readonly location: string;
}

export const SNAKES: ReadonlyArray<Snake> = [
  { from: 98, to: 28, name: 'Naga Banda',        mythology: 'Sea serpent from Maluku' },
  { from: 95, to: 56, name: 'Ular Naga Jawa',    mythology: 'Javanese dragon' },
  { from: 92, to: 42, name: 'Buaya Putih',       mythology: 'White crocodile (Papua folklore)' },
  { from: 88, to: 18, name: 'Lipan',             mythology: 'Giant centipede (Dayak folklore)' },
  { from: 84, to: 34, name: 'Naga Sari',         mythology: 'Dragon princess (Sundanese)' },
  { from: 72, to: 30, name: 'Ular Sawa',         mythology: 'Reticulated python' },
  { from: 64, to: 10, name: 'Naga Tasik',        mythology: 'Lake dragon (Danau Toba)' },
  { from: 58, to: 22, name: 'Kalajengking',      mythology: 'Scorpion demon (Aceh)' },
  { from: 46, to:  5, name: 'Ular Kadal',        mythology: 'Monitor lizard (Komodo)' }
];

export const LADDERS: ReadonlyArray<Ladder> = [
  { from:  4, to: 45, name: 'Candi Borobudur',          location: 'Central Java' },
  { from: 12, to: 68, name: 'Candi Prambanan',          location: 'Yogyakarta' },
  { from: 21, to: 82, name: 'Istana Maimun',            location: 'Medan, Sumatra' },
  { from: 33, to: 87, name: 'Benteng Rotterdam',        location: 'Makassar, Sulawesi' },
  { from: 50, to: 91, name: 'Monas',                    location: 'Jakarta' },
  { from: 60, to: 96, name: 'Candi Sewu',               location: 'Klaten, Java' },
  { from: 70, to: 99, name: 'Taman Nasional Komodo',    location: 'Flores' }
];

/**
 * Pre-computed lookup tables, built once at module load.
 * Indexed by `from` square; undefined means "no snake/ladder starts here".
 */
const SNAKE_BY_FROM: Map<Square, Snake> = new Map(SNAKES.map(s => [s.from, s]));
const LADDER_BY_FROM: Map<Square, Ladder> = new Map(LADDERS.map(l => [l.from, l]));

export function getSnakeAt(sq: Square): Snake | undefined {
  return SNAKE_BY_FROM.get(sq);
}

export function getLadderAt(sq: Square): Ladder | undefined {
  return LADDER_BY_FROM.get(sq);
}

/** Region map: which island each square belongs to. */
export const REGION_BOUNDS: ReadonlyArray<{ region: Region; from: Square; to: Square; label: string }> = [
  { region: 'sumatra',    from:  1, to: 20, label: 'Sumatra' },
  { region: 'java',       from: 21, to: 50, label: 'Java' },
  { region: 'kalimantan', from: 51, to: 70, label: 'Kalimantan' },
  { region: 'sulawesi',   from: 71, to: 85, label: 'Sulawesi' },
  { region: 'papua',      from: 86, to:100, label: 'Papua' }
];

export function getRegionForSquare(sq: Square): Region {
  if (sq < 1) return 'sumatra'; // off-board players get the "default" region for HUD purposes
  for (const b of REGION_BOUNDS) {
    if (sq >= b.from && sq <= b.to) return b.region;
  }
  // sq > 100 is illegal; callers should clamp
  return 'papua';
}

export function getRegionLabel(region: Region): string {
  return REGION_BOUNDS.find(b => b.region === region)?.label ?? region;
}
