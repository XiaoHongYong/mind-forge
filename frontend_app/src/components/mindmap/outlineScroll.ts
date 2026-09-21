/** Pixels to add to a scroller's `scrollTop` so the child sits inside it. */
export function scrollDeltaToReveal(
  containerTop: number,
  containerBottom: number,
  childTop: number,
  childBottom: number,
): number {
  if (childTop < containerTop) return childTop - containerTop;
  if (childBottom > containerBottom) return childBottom - containerBottom;
  return 0;
}
