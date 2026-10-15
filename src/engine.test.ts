import { test } from 'vitest';
import assert from 'node:assert/strict';
import { accuracy, canSwap, colorAt, extendRoute, hint, levels, nodes, stars, swap, update, visits } from './engine';

test('coordinates start at the top left and thresholds are exclusive', () => {
  const target = levels[0].target;
  assert.equal(colorAt(target, 0, 3), 'sky');
  assert.equal(colorAt(target, 7, 4), 'peach');
  assert.equal(visits(target, 'b', 7, 3), true);
  assert.equal(visits(target, 'b', 7, 4), false);
});
for (const level of levels) {
  test(`level ${level.id}: is scrambled, conserves nodes, and can be solved by reversing its moves`, () => {
    let tree = level.initial;
    assert.ok(accuracy(tree, level.target) < 1);
    assert.equal(nodes(tree).length, nodes(level.target).length);
    assert.equal(new Set(nodes(tree).map(n => n.id)).size, nodes(tree).length);
    for (const [a, b] of [...level.scramble].reverse()) {
      assert.ok(canSwap(tree, a, b, level.mode));
      tree = swap(tree, a, b, level.mode);
    }
    assert.deepEqual(tree, level.target);
    assert.equal(accuracy(tree, level.target), 1);
  });
  test(`level ${level.id}: hints recover from extra player moves`, () => {
    let tree = level.initial, route = level.scramble;
    // Deterministically explore several legal off-route moves, including topology changes.
    for (let step = 0; step < 9; step++) {
      const all = nodes(tree), choices: [string, string][] = [];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        if (canSwap(tree, all[i].id, all[j].id, level.mode)) choices.push([all[i].id, all[j].id]);
      }
      const move = choices[(step * 7) % choices.length];
      tree = swap(tree, ...move, level.mode); route = extendRoute(route, move);
    }
    let count = 0;
    while (accuracy(tree, level.target) < 1 && count < 30) {
      const move = hint(tree, level, route);
      assert.ok(move, 'Hint must exist for an unsolved board');
      assert.ok(canSwap(tree, ...move, level.mode), 'Hint must be legal');
      tree = swap(tree, ...move, level.mode); route = extendRoute(route, move); count++;
    }
    assert.equal(accuracy(tree, level.target), 1);
  });
}
test('subtrees cannot move inside themselves or create cycles', () => {
  const tree = levels[11].initial;
  for (const node of nodes(tree)) {
    assert.equal(canSwap(tree, tree.id, node.id, 'subtrees'), false);
    assert.strictEqual(swap(tree, tree.id, node.id, 'subtrees'), tree);
  }
});
test('subtree swaps can change topology and preserve complete branches', () => {
  const level = levels[9];
  const shape = (tree: typeof level.initial): string => tree.kind === 'leaf' ? 'L' : `(${shape(tree.yes)}${shape(tree.no)})`;
  assert.notEqual(shape(level.initial), shape(level.target));
  const restored = swap(level.initial, 'd', 'g', 'subtrees');
  assert.deepEqual(restored, level.target);
});
test('painting and splitting replace only the selected region', () => {
  const tree = levels[0].target;
  const painted = update(tree, 'b', { id: 'b', kind: 'leaf', color: 'rose' });
  assert.equal(colorAt(painted, 0, 0), 'rose');
  assert.equal(colorAt(painted, 0, 7), 'peach');
  assert.equal(colorAt(tree, 0, 0), 'sky');
});
test('stars reward efficiency without imposing a move limit', () => {
  assert.equal(stars(1, 1), 3); assert.equal(stars(3, 1), 2); assert.equal(stars(100, 1), 1);
});
