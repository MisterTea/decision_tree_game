export const SIZE = 8;
export const palette = {
  sky: { hex: '#bcdad8', label: 'Sky' },
  peach: { hex: '#e8997c', label: 'Peach' },
  gold: { hex: '#edc26c', label: 'Honey' },
  forest: { hex: '#3e5d4e', label: 'Forest' },
  cream: { hex: '#f3e6c6', label: 'Cream' },
  rose: { hex: '#c77c91', label: 'Rose' },
  lilac: { hex: '#a29abd', label: 'Lilac' },
  blue: { hex: '#7da4b8', label: 'Blue' },
} as const;
export type Color = keyof typeof palette;
export type Rule = { axis: 'x' | 'y'; value: number };
export type Tree = { id: string; kind: 'leaf'; color: Color } | { id: string; kind: 'split'; rule: Rule; yes: Tree; no: Tree };
export type Mode = 'leaves' | 'rules' | 'subtrees';
export type Move = [string, string];
export interface Level { id: number; title: string; subtitle: string; mode: Mode; target: Tree; initial: Tree; scramble: Move[]; par: number; tip: string }
const leaf = (id: string, color: Color): Tree => ({ id, kind: 'leaf', color });
const split = (id: string, axis: 'x' | 'y', value: number, yes: Tree, no: Tree): Tree => ({ id, kind: 'split', rule: { axis, value }, yes, no });
export function nodes(tree: Tree): Tree[] { return tree.kind === 'leaf' ? [tree] : [tree, ...nodes(tree.yes), ...nodes(tree.no)]; }
export function find(tree: Tree, id: string): Tree | undefined { return nodes(tree).find(n => n.id === id); }
export function colorAt(tree: Tree, x: number, y: number): Color {
  if (tree.kind === 'leaf') return tree.color;
  return colorAt((tree.rule.axis === 'x' ? x : y) < tree.rule.value ? tree.yes : tree.no, x, y);
}
export function pixels(tree: Tree): Color[] { return Array.from({ length: SIZE * SIZE }, (_, i) => colorAt(tree, i % SIZE, Math.floor(i / SIZE))); }
export function accuracy(tree: Tree, target: Tree): number { const expected = pixels(target); return pixels(tree).filter((p, i) => p === expected[i]).length / 64; }
export function visits(tree: Tree, id: string, x: number, y: number): boolean {
  if (tree.id === id) return true;
  if (tree.kind === 'leaf') return false;
  return visits((tree.rule.axis === 'x' ? x : y) < tree.rule.value ? tree.yes : tree.no, id, x, y);
}
export function canSwap(tree: Tree, a: string, b: string, mode: Mode): boolean {
  const first = find(tree, a), second = find(tree, b);
  if (!first || !second || a === b) return false;
  if (mode === 'leaves') return first.kind === 'leaf' && second.kind === 'leaf' && first.color !== second.color;
  if (mode === 'rules') return first.kind === 'split' && second.kind === 'split' && JSON.stringify(first.rule) !== JSON.stringify(second.rule);
  return !find(first, b) && !find(second, a);
}
export function swap(tree: Tree, a: string, b: string, mode: Mode): Tree {
  if (!canSwap(tree, a, b, mode)) return tree;
  const first = find(tree, a)!, second = find(tree, b)!;
  function visit(node: Tree): Tree {
    if (mode === 'subtrees') { if (node.id === a) return second; if (node.id === b) return first; }
    if (mode === 'leaves' && node.kind === 'leaf') {
      if (node.id === a && second.kind === 'leaf') return { ...node, color: second.color };
      if (node.id === b && first.kind === 'leaf') return { ...node, color: first.color };
    }
    if (node.kind === 'split') {
      const rule = mode === 'rules' && node.id === a && second.kind === 'split' ? second.rule : mode === 'rules' && node.id === b && first.kind === 'split' ? first.rule : node.rule;
      return { ...node, rule, yes: visit(node.yes), no: visit(node.no) };
    }
    return node;
  }
  return visit(tree);
}
export function update(tree: Tree, id: string, replacement: Tree): Tree {
  if (tree.id === id) return replacement;
  return tree.kind === 'leaf' ? tree : { ...tree, yes: update(tree.yes, id, replacement), no: update(tree.no, id, replacement) };
}
export function extendRoute(route: Move[], move: Move): Move[] {
  const last = route.at(-1);
  return last && last.includes(move[0]) && last.includes(move[1]) ? route.slice(0, -1) : [...route, move];
}
export function hint(tree: Tree, level: Level, route: Move[]): Move | undefined {
  if (accuracy(tree, level.target) === 1) return undefined;
  const all = nodes(tree);
  // Prefer any immediate solution; otherwise retrace a known legal path to the solved tree.
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i].id, b = all[j].id;
    if (canSwap(tree, a, b, level.mode) && accuracy(swap(tree, a, b, level.mode), level.target) === 1) return [a, b];
  }
  return route.at(-1);
}
export function stars(moves: number, par: number): number { return moves <= par ? 3 : moves <= par + 2 ? 2 : 1; }
function level(id: number, title: string, subtitle: string, mode: Mode, target: Tree, scramble: Move[], tip: string): Level {
  let initial = target;
  for (const [a, b] of scramble) {
    if (!canSwap(initial, a, b, mode)) throw new Error(`Invalid scramble in level ${id}: ${a}, ${b}`);
    initial = swap(initial, a, b, mode);
  }
  if (accuracy(initial, target) === 1) throw new Error(`Level ${id} is already solved`);
  return { id, title, subtitle, mode, target, initial, scramble, par: scramble.length, tip };
}
const horizon = split('a', 'y', 4, leaf('b', 'sky'), leaf('c', 'peach'));
const quarters = split('a', 'x', 4, split('b', 'y', 4, leaf('d', 'gold'), leaf('e', 'forest')), split('c', 'y', 4, leaf('f', 'sky'), leaf('g', 'peach')));
const house = split('a', 'y', 3, split('b', 'x', 4, leaf('d', 'sky'), leaf('e', 'gold')), split('c', 'x', 2, leaf('f', 'forest'), split('g', 'x', 6, leaf('h', 'peach'), leaf('i', 'forest'))));
const stripes = split('a', 'y', 2, leaf('b', 'sky'), split('c', 'y', 4, leaf('d', 'gold'), split('e', 'y', 6, leaf('f', 'peach'), leaf('g', 'forest'))));
const windowTree = split('a', 'x', 4, split('b', 'y', 3, leaf('d', 'gold'), leaf('e', 'forest')), split('c', 'y', 5, leaf('f', 'sky'), leaf('g', 'rose')));
const skyline = split('a', 'y', 6, split('b', 'x', 3, split('d', 'y', 2, leaf('h', 'sky'), leaf('i', 'lilac')), split('e', 'y', 4, leaf('j', 'sky'), leaf('k', 'peach'))), leaf('c', 'forest'));
const garden = split('a', 'x', 4, split('b', 'y', 4, leaf('d', 'rose'), leaf('e', 'forest')), split('c', 'y', 2, leaf('f', 'gold'), split('g', 'y', 6, leaf('h', 'sky'), leaf('i', 'blue'))));
const quilt = split('a', 'y', 4, split('b', 'x', 4, leaf('d', 'rose'), leaf('e', 'cream')), split('c', 'x', 2, leaf('f', 'blue'), split('g', 'x', 6, leaf('h', 'gold'), leaf('i', 'forest'))));
const grove = split('a', 'x', 4, split('b', 'y', 2, leaf('d', 'gold'), split('e', 'y', 6, leaf('h', 'forest'), leaf('i', 'cream'))), split('c', 'y', 5, split('f', 'x', 6, leaf('j', 'rose'), leaf('k', 'lilac')), leaf('g', 'blue')));
export const levels: Level[] = [
  level(1, 'A change of scenery', 'Every picture starts with a little logic.', 'leaves', horizon, [['b', 'c']], 'The top half is sky. The bottom half is peach. Swap the two color leaves to put them home.'),
  level(2, 'Four little corners', 'Four colors. One small mix-up.', 'leaves', quarters, [['d', 'g']], 'The root divides left from right. Each child then divides top from bottom. Follow the path to each corner.'),
  level(3, 'Golden hour', 'Bring the sunset back into order.', 'leaves', stripes, [['b', 'f'], ['d', 'g']], 'Each question peels off a horizontal band. Work from the top band down.'),
  level(4, 'A place in the sun', 'A tiny landscape, waiting to be repaired.', 'leaves', house, [['d', 'h'], ['e', 'f']], 'The first question separates the sky from the ground. Match each leaf to its region.'),
  level(5, 'Crossed wires', 'The colors are right. The questions are not.', 'rules', quarters, [['a', 'b']], 'The whole picture needs a left/right split first, followed by top/bottom splits. Swap question cards.'),
  level(6, 'Window light', 'Same colors, different proportions.', 'rules', windowTree, [['a', 'c'], ['a', 'b']], 'Start with x < 4 at the root. The left side changes at y = 3, the right at y = 5.'),
  level(7, 'City at dusk', 'Find the rhythm in the skyline.', 'rules', skyline, [['a', 'd'], ['b', 'e']], 'The ground begins at y = 6. Above it, x < 3 separates the two buildings.'),
  level(8, 'Secret garden', 'Make room for everything to grow.', 'rules', garden, [['a', 'g'], ['b', 'c']], 'Split left and right first. The left changes at y = 4; on the right, peel off the top two rows.'),
  level(9, 'Branching out', 'Pick up a branch. Bring its world along.', 'subtrees', quarters, [['b', 'c']], 'Swap the two question subtrees directly below the root. Their color leaves will travel with them.'),
  level(10, 'Patchwork', 'A small branch can hold a whole picture.', 'subtrees', quilt, [['d', 'g']], 'A single color and a whole decision branch can trade places. Watch the tree change shape.'),
  level(11, 'Wild growth', 'Untangle the garden, one branch at a time.', 'subtrees', garden, [['b', 'g'], ['d', 'f']], 'Some colors are nested inside a moved branch. Restore those colors, then return the branches.'),
  level(12, 'The little grove', 'A final tangle of colors and questions.', 'subtrees', grove, [['e', 'f'], ['d', 'g'], ['h', 'k']], 'Work in layers: find the leaves that belong together, then move the branches that hold them.'),
];
