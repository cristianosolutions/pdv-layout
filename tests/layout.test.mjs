import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignElements, distributeElements, reorderLayers } from '../src/utils/layout.ts';
import { AUTOSAVE_KEY, readAutosave, writeAutosave } from '../src/utils/autosave.ts';
const shape = (id, x, width = 20, y = x) => ({ id, x, y, width, height: width, type: 'rectangle', fill: '#ffffff' });
const ids = elements => elements.map(element => element.id);

test('layer operations preserve relative order and do not mutate the source', () => {
  const elements = ['a', 'b', 'c', 'd', 'e'].map(id => shape(id, 0));
  assert.deepEqual(ids(reorderLayers(elements, ['b', 'c'], 'front')), ['a', 'd', 'e', 'b', 'c']);
  assert.deepEqual(ids(reorderLayers(elements, ['b', 'd'], 'back')), ['b', 'd', 'a', 'c', 'e']);
  assert.deepEqual(ids(reorderLayers(elements, ['b', 'c'], 'forward')), ['a', 'd', 'b', 'c', 'e']);
  assert.deepEqual(ids(reorderLayers(elements, ['b', 'c'], 'backward')), ['b', 'c', 'a', 'd', 'e']);
  assert.deepEqual(ids(reorderLayers(elements, ['e'], 'forward')), ids(elements));
  assert.deepEqual(ids(elements), ['a', 'b', 'c', 'd', 'e']);
});

test('aligns edges and centers within selection or page without affecting other objects', () => {
  const elements = [shape('a', 10, 20), shape('b', 100, 40), shape('other', 200)];
  assert.deepEqual(alignElements(elements, ['a', 'b'], 'right').map(el => el.x), [120, 100, 200]);
  assert.deepEqual(alignElements(elements, ['a', 'b'], 'center').map(el => el.x), [65, 55, 200]);
  assert.deepEqual(alignElements(elements, ['a', 'b'], 'top').map(el => el.y), [10, 10, 200]);
  assert.equal(alignElements(elements, ['a'], 'middle', { width: 800, height: 600 })[0].y, 290);
  assert.deepEqual(alignElements(elements, ['missing'], 'left'), elements);
});

test('distribution uses equal gaps for unequal sizes and preserves extremes and stacking', () => {
  const elements = [shape('c', 300, 50), shape('a', 0, 20), shape('b', 40, 30), shape('other', 55)];
  const result = distributeElements(elements, ['a', 'b', 'c'], 'x');
  assert.deepEqual(ids(result), ids(elements));
  assert.equal(result[2].x, 145);
  assert.equal(result[0].x, 300);
  assert.equal(result[1].x, 0);
  assert.equal(result[3].x, 55);
  const vertical = distributeElements(elements, ['a', 'b', 'c'], 'y');
  assert.equal(vertical[2].y, 145);
  assert.deepEqual(distributeElements(elements, ['a', 'b'], 'x'), elements);
});

test('autosave restores the entire project including image, colors, resolution and layer order', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const project = { name: 'Teste', resolution: '800x600', zoom: 0.6, backgroundColor: '#123456', elements: [shape('a', 20), { ...shape('img', 30), type: 'image', imageUrl: 'data:image/png;base64,AA==' }] };
  assert.equal(readAutosave(storage, ['800x600']), null);
  writeAutosave(storage, project);
  assert.deepEqual(readAutosave(storage, ['800x600']), project);
  const previous = values.get(AUTOSAVE_KEY);
  assert.throws(() => writeAutosave({ setItem: () => { throw new Error('QuotaExceeded'); } }, project));
  assert.equal(values.get(AUTOSAVE_KEY), previous);
  storage.setItem(AUTOSAVE_KEY, '{broken');
  assert.throws(() => readAutosave(storage, ['800x600']));
});
