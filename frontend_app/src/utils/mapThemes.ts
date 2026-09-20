/**
 * Preset colour themes for main (root) branches — Format sidebar Canvas tab.
 *
 * Themes live on `map_style.colorThemeId` and are resolved at render time.
 * Applying a theme never writes `color` onto nodes: explicit node colours win.
 */

export interface MapColorTheme {
  id: string;
  name: string;
  /** Colours cycled across root's direct children. */
  colors: readonly string[];
}

/** Built-in id for the rainbow palette (not listed in MAP_COLOR_THEMES). */
export const RAINBOW_THEME_ID = 'rainbow';

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

/** Resolve a stored theme id to its palette, or null when unset / unknown. */
export function getThemeColors(themeId: string | null | undefined): readonly string[] | null {
  if (!themeId) return null;
  if (themeId === RAINBOW_THEME_ID) return RAINBOW_BRANCH_COLORS;
  return MAP_COLOR_THEMES.find((t) => t.id === themeId)?.colors ?? null;
}

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  const full = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Mix `hex` toward white by `t` (0 = original, 1 = white).
 * Used to fade branch colours as depth increases.
 */
export function mixTowardWhite(hex: string, t: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const k = Math.min(1, Math.max(0, t));
  return toHex(
    rgb[0] + (255 - rgb[0]) * k,
    rgb[1] + (255 - rgb[1]) * k,
    rgb[2] + (255 - rgb[2]) * k,
  );
}

/**
 * Fade a main-branch colour by hierarchy depth.
 * Depth 1 (root's direct child) stays full strength; deeper nodes lighten.
 */
export function fadeColorByDepth(hex: string, depth: number): string {
  if (depth <= 1) return hex;
  const t = Math.min(0.72, (depth - 1) * 0.18);
  return mixTowardWhite(hex, t);
}

/**
 * Build a nodeId → theme colour map for the whole tree.
 * Root is omitted (central topic keeps its own style).
 * Each root child picks `colors[index % length]`; descendants fade by depth.
 */
export function buildThemeColorMap<N extends { id: string; children: N[] }>(
  root: N,
  colors: readonly string[],
): Map<string, string> {
  const map = new Map<string, string>();
  if (colors.length === 0) return map;

  const walk = (node: N, depth: number, branchColor: string) => {
    map.set(node.id, fadeColorByDepth(branchColor, depth));
    for (const child of node.children) {
      walk(child, depth + 1, branchColor);
    }
  };

  root.children.forEach((branch, i) => {
    walk(branch, 1, colors[i % colors.length]!);
  });
  return map;
}

/**
 * Effective fill/edge colour for a node:
 * explicit `node.color` wins; otherwise the document colour theme (if any).
 */
export function resolveNodeThemeColor(
  nodeColor: string | null | undefined,
  themeColor: string | null | undefined,
): string | null {
  if (nodeColor) return nodeColor;
  return themeColor ?? null;
}
