export interface GradientLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Resolves a CSS-style gradient angle (0deg = to top, increasing clockwise)
 * into a line spanning a `width` x `height` box, using the same geometry as
 * CSS `linear-gradient(<angle>, ...)` so the gradient reaches corner-to-corner
 * regardless of the box's aspect ratio.
 */
export function gradientLine(angleDeg: number, width: number, height: number): GradientLine {
  const theta = (angleDeg * Math.PI) / 180;
  const length = Math.abs(width * Math.sin(theta)) + Math.abs(height * Math.cos(theta));
  const half = length / 2;
  const dx = Math.sin(theta) * half;
  const dy = -Math.cos(theta) * half;
  const cx = width / 2;
  const cy = height / 2;
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
}
