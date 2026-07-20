import type { Grid, Tile, TileOrientation } from './types';
import { createTile } from './createDocument';

export type GridPattern = 'uniform' | 'alternate-rows' | 'alternate-counter-clockwise' | 'random';

export const GRID_PATTERNS: readonly { value: GridPattern; label: string }[] = [
  { value: 'uniform', label: 'Uniform' },
  { value: 'alternate-rows', label: 'Alternate Rows' },
  { value: 'alternate-counter-clockwise', label: 'Alternate Counter-Clockwise' },
  { value: 'random', label: 'Random' },
];

/** Deterministic PRNG so a given seed always reproduces the same random grid. */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The corner a pattern starts from, and the order it walks through on each
 * successive "Generate" click for the same pattern (see `variant` below) —
 * bottom-left → top-left → top-right → bottom-right → back to bottom-left.
 */
const VARIANT_CYCLE: readonly TileOrientation[] = [
  'black-bottom-left',
  'black-top-left',
  'black-top-right',
  'black-bottom-right',
];

function cornerAt(variant: number): TileOrientation {
  return VARIANT_CYCLE[((variant % VARIANT_CYCLE.length) + VARIANT_CYCLE.length) % VARIANT_CYCLE.length];
}

function orientationFor(
  pattern: GridPattern,
  row: number,
  column: number,
  variant: number,
  random: () => number,
): TileOrientation {
  switch (pattern) {
    case 'uniform':
      return cornerAt(variant);
    case 'alternate-rows':
      return row % 2 === 0 ? cornerAt(variant) : cornerAt(variant + 1);
    case 'alternate-counter-clockwise':
      return (row + column) % 2 === 0 ? cornerAt(variant) : cornerAt(variant + 1);
    case 'random':
      // Deliberately ignores `variant`: the seed is what controls a random
      // grid's outcome, and re-generating with an unchanged seed should
      // reproduce the exact same grid rather than silently drift.
      return cornerAt(Math.floor(random() * VARIANT_CYCLE.length));
  }
}

/**
 * `variant` selects where in `VARIANT_CYCLE` this generation starts — pass 0
 * the first time a pattern is used, then increment (wrapping at 4) on each
 * subsequent "Generate" click so the result visibly differs each time.
 */
export function generatePatternedGrid(
  columns: number,
  rows: number,
  pattern: GridPattern,
  seed: number,
  variant: number,
): Grid {
  const random = mulberry32(seed);
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      tiles.push(createTile(row, column, orientationFor(pattern, row, column, variant, random)));
    }
  }
  return { columns, rows, tiles };
}
