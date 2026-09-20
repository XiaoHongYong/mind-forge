/**
 * Preset colour themes for main (root) branches — Format sidebar Canvas tab.
 */

export interface MapColorTheme {
  id: string;
  name: string;
  /** Colours cycled across root's direct children. */
  colors: readonly string[];
}

/** Rainbow palette used by "Rainbow branches". */
export const RAINBOW_BRANCH_COLORS: readonly string[] = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export const MAP_COLOR_THEMES: readonly MapColorTheme[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#0284c7', '#0891b2', '#0d9488'],
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: ['#16a34a', '#15803d', '#65a30d', '#4d7c0f', '#059669', '#0f766e'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#fb7185', '#f43f5e'],
  },
  {
    id: 'berry',
    name: 'Berry',
    colors: ['#a855f7', '#8b5cf6', '#7c3aed', '#d946ef', '#c026d3', '#9333ea'],
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: ['#475569', '#64748b', '#334155', '#78716c', '#57534e', '#52525b'],
  },
];

export const FONT_FAMILY_OPTIONS: readonly { id: string; label: string; value: string }[] = [
  { id: 'system', label: 'System', value: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: 'serif', label: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'mono', label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { id: 'rounded', label: 'Rounded', value: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, sans-serif' },
];

/**
 * Apply a colour list to root's direct children.
 * When `overwrite` is false, nodes that already have a `color` are skipped.
 */
export function applyBranchColors<N extends { color?: string | null; children: N[] }>(
  root: N,
  colors: readonly string[],
  overwrite: boolean,
): N {
  if (colors.length === 0) return root;
  return {
    ...root,
    children: root.children.map((child, i) => {
      if (!overwrite && child.color) return child;
      return { ...child, color: colors[i % colors.length] };
    }),
  };
}
