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

function orientationFor(pattern: GridPattern, row: number, column: number, random: () => number): TileOrientation {
  switch (pattern) {
    case 'uniform':
      return 'diagonal-a';
    case 'alternate-rows':
      return row % 2 === 0 ? 'diagonal-a' : 'diagonal-b';
    case 'alternate-counter-clockwise':
      return (row + column) % 2 === 0 ? 'diagonal-a' : 'diagonal-b';
    case 'random':
      return random() < 0.5 ? 'diagonal-a' : 'diagonal-b';
  }
}

export function generatePatternedGrid(
  columns: number,
  rows: number,
  pattern: GridPattern,
  seed: number,
): Grid {
  const random = mulberry32(seed);
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      tiles.push(createTile(row, column, orientationFor(pattern, row, column, random)));
    }
  }
  return { columns, rows, tiles };
}
