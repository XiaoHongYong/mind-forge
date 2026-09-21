/** Inset kept between a revealed node and the canvas edge. */
export const VIEWPORT_PAN_MARGIN = 60;

export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Screen-space pan delta that brings `box` inside the canvas.
 *
 * `pan` and `box` are in the canvas element's own coordinates (the SVG),
 * and `viewport` must be that same element — not the editor shell. Toolbars,
 * sidebars, and the status bar sit outside the canvas, so including them
 * makes the right and bottom edges look farther away than they are.
 */
export function panDeltaToReveal(
  box: ScreenBox,
  pan: { x: number; y: number },
  zoom: number,
  viewport: { width: number; height: number },
  margin = VIEWPORT_PAN_MARGIN,
): { x: number; y: number } {
  const left = pan.x + box.x * zoom;
  const top = pan.y + box.y * zoom;
  const right = left + box.w * zoom;
  const bottom = top + box.h * zoom;
  let dx = 0;
  let dy = 0;
  if (left < margin) dx = margin - left;
  else if (right > viewport.width - margin) dx = viewport.width - margin - right;
  if (top < margin) dy = margin - top;
  else if (bottom > viewport.height - margin) dy = viewport.height - margin - bottom;
  return { x: dx, y: dy };
}
