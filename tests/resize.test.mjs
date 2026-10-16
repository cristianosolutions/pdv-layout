import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resizeElements } from '../src/utils/resize.ts';
import { parseProject } from '../src/utils/project.ts';

const from = { width: 1600, height: 900 };
const to = { width: 1366, height: 768 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const shape = { id: 'a', type: 'rectangle', x: 100, y: 200, width: 300, height: 150, fill: '#ffffff' };

test('adapt uses the entire 1024x768 page without adding top and bottom margins', () => {
  const target = { width: 1024, height: 768 };
  const elements = [
    { ...shape, x: 0, y: 0, width: 1600, height: 900 },
    { ...shape, id: 'footer', x: 0, y: 820, width: 1600, height: 80 },
    { ...shape, id: 'text', type: 'text', fontSize: 30 },
  ];
  const result = resizeElements(elements, from, target, 'adapt');
  close(result[0].x, 0);
  close(result[0].y, 0);
  close(result[0].width, 1024);
  close(result[0].height, 768);
  close(result[1].y + result[1].height, 768);
  close(result[2].fontSize, 30 * Math.sqrt((1024 / 1600) * (768 / 900)));
  const restored = resizeElements(result, target, from, 'adapt');
  for (let i = 0; i < elements.length; i++) {
    for (const key of ['x', 'y', 'width', 'height']) close(restored[i][key], elements[i][key]);
  }
});

test('adapt preserves image and rotated object proportions while relocating their centers', () => {
  for (const rotation of [0, 35, -90]) {
    const image = { ...shape, type: 'image', rotation, imageUrl: 'data:image/png;base64,AA==' };
    const [result] = resizeElements([image], from, { width: 1024, height: 768 }, 'adapt');
    const angle = rotation * Math.PI / 180;
    const center = el => ({
      x: el.x + (el.width * Math.cos(angle) - el.height * Math.sin(angle)) / 2,
      y: el.y + (el.width * Math.sin(angle) + el.height * Math.cos(angle)) / 2,
    });
    close(result.width / result.height, image.width / image.height);
    close(center(result).x, center(image).x * 1024 / 1600);
    close(center(result).y, center(image).y * 768 / 900);
    assert.equal(result.rotation, rotation);
    assert.equal(result.imageUrl, image.imageUrl);
  }
});

test('1600x900 to 1366x768 scales geometry, typography and borders uniformly', () => {
  const original = [{ ...shape, type: 'text', fontSize: 30, strokeWidth: 2, cornerRadius: 12, rotation: 35 }];
  const before = structuredClone(original);
  const [result] = resizeElements(original, from, to);
  const scale = 768 / 900;
  close(result.x, 100 * scale + 1 / 3);
  close(result.y, 200 * scale);
  close(result.width, 300 * scale);
  close(result.height, 150 * scale);
  close(result.fontSize, 30 * scale);
  close(result.strokeWidth, 2 * scale);
  close(result.cornerRadius, 12 * scale);
  assert.equal(result.rotation, 35);
  assert.deepEqual(original, before);
});

test('different aspect ratios fit and center the page without stretching images', () => {
  const image = { ...shape, type: 'image', x: 0, y: 0, width: 1600, height: 900, imageUrl: 'data:image/png;base64,AA==' };
  const [result] = resizeElements([image], from, { width: 800, height: 600 });
  assert.equal(result.x, 0);
  assert.equal(result.y, 75);
  assert.equal(result.width, 800);
  assert.equal(result.height, 450);
  assert.equal(result.imageUrl, image.imageUrl);
});

test('implicit font and stroke defaults scale too, including zero-width borders', () => {
  const result = resizeElements([
    { ...shape, type: 'text' }, { ...shape, type: 'field' },
    { ...shape, type: 'border' }, { ...shape, strokeWidth: 0 },
  ], from, { width: 800, height: 450 });
  assert.equal(result[0].fontSize, 16);
  assert.deepEqual(result.map(el => el.strokeWidth), [0, 0.5, 1, 0]);
});

test('same-aspect resize round trips retain precision and image data; projects remain loadable', () => {
  const elements = [{ ...shape, type: 'image', imageUrl: 'data:image/png;base64,AA==', rotation: -42 }];
  let result = elements;
  const smaller = { width: 1280, height: 720 };
  for (let i = 0; i < 20; i++) {
    result = resizeElements(resizeElements(result, from, smaller), smaller, from);
  }
  for (const key of ['x', 'y', 'width', 'height']) close(result[0][key], elements[0][key]);
  assert.equal(result[0].imageUrl, elements[0].imageUrl);
  assert.equal(result[0].rotation, -42);
  const project = { name: 'Teste', resolution: '1600x900', zoom: 0.6, backgroundColor: '#fff', elements: result };
  assert.deepEqual(parseProject(JSON.stringify(project), ['1600x900']), project);
  assert.equal(resizeElements(elements, from, from), elements);
  assert.deepEqual(resizeElements([], from, to), []);
});

test('adapt round trips preserve images, rotation, font and stroke across aspect ratios', () => {
  const original = [{ ...shape, type: 'image', imageUrl: 'data:image/png;base64,AA==', rotation: 35, strokeWidth: 2 }, { ...shape, id: 'text', type: 'text', fontSize: 30 }];
  const target = { width: 800, height: 600 };
  const restored = resizeElements(resizeElements(original, from, target, 'adapt'), target, from, 'adapt');
  original.forEach((el, i) => { for (const key of ['x', 'y', 'width', 'height', 'fontSize', 'strokeWidth']) if (el[key] !== undefined) close(restored[i][key], el[key]); });
});
test('rejects invalid text alignment and font size on import', () => {
  const project = { name: 'Teste', resolution: '1600x900', zoom: 0.6, backgroundColor: '#fff', elements: [{ ...shape, type: 'text', fontSize: 0 }] };
  assert.throws(() => parseProject(JSON.stringify(project), ['1600x900']));
  project.elements[0].fontSize = 32;
  project.elements[0].textAlign = 'invalid';
  assert.throws(() => parseProject(JSON.stringify(project), ['1600x900']));
});
