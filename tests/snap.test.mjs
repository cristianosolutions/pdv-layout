import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapAxis } from '../src/utils/snap.ts';

test('snaps to page edges and center', () => {
  assert.deepEqual(snapAxis(6, 300, 1600, 1), { position: 0, guide: 0 });
  assert.deepEqual(snapAxis(647, 300, 1600, 1), { position: 650, guide: 800 });
  assert.deepEqual(snapAxis(1305, 300, 1600, 1), { position: 1300, guide: 1600 });
});
test('moves freely away from guides and can leave the page', () => {
  assert.deepEqual(snapAxis(100, 300, 1600, 1), { position: 100, guide: null });
  assert.deepEqual(snapAxis(-30, 300, 1600, 1), { position: -30, guide: null });
});
test('uses a constant screen-space tolerance at different zoom levels', () => {
  assert.equal(snapAxis(12, 300, 1600, 0.6).position, 0);
  assert.equal(snapAxis(12, 300, 1600, 1).position, 12);
  assert.equal(snapAxis(41, 300, 1600, 0.2).guide, null);
});
test('handles full-page and oversized elements and vertical alignment', () => {
  assert.equal(snapAxis(4, 1600, 1600, 1).position, 0);
  assert.deepEqual(snapAxis(-197, 2000, 1600, 1), { position: -200, guide: 800 });
  assert.deepEqual(snapAxis(413, 70, 900, 0.6), { position: 415, guide: 450 });
});
