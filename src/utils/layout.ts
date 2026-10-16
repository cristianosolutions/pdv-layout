import type { CanvasSize, EditorElement } from "../types/editor";
export type LayerAction = "front" | "back" | "forward" | "backward";
export type Alignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";
export function reorderLayers(
  elements: EditorElement[],
  ids: string[],
  action: LayerAction,
) {
  const selected = new Set(ids);
  if (action === "front")
    return [
      ...elements.filter((el) => !selected.has(el.id)),
      ...elements.filter((el) => selected.has(el.id)),
    ];
  if (action === "back")
    return [
      ...elements.filter((el) => selected.has(el.id)),
      ...elements.filter((el) => !selected.has(el.id)),
    ];
  const result = [...elements];
  if (action === "forward") {
    for (let i = result.length - 2; i >= 0; i--) {
      if (selected.has(result[i].id) && !selected.has(result[i + 1].id))
        [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  } else {
    for (let i = 1; i < result.length; i++) {
      if (selected.has(result[i].id) && !selected.has(result[i - 1].id))
        [result[i], result[i - 1]] = [result[i - 1], result[i]];
    }
  }
  return result;
}
export function elementBounds(el: EditorElement) {
  const angle = ((el.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const xs = [
    0,
    el.width * cos,
    -el.height * sin,
    el.width * cos - el.height * sin,
  ];
  const ys = [
    0,
    el.width * sin,
    el.height * cos,
    el.width * sin + el.height * cos,
  ];
  return {
    x: el.x + Math.min(...xs),
    y: el.y + Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
export function alignElements(
  elements: EditorElement[],
  ids: string[],
  alignment: Alignment,
  canvas?: CanvasSize,
) {
  const selected = elements.filter((el) => ids.includes(el.id));
  if (!selected.length || (!canvas && selected.length < 2)) return elements;
  const bounds = selected.map(elementBounds);
  const left = canvas ? 0 : Math.min(...bounds.map((b) => b.x));
  const top = canvas ? 0 : Math.min(...bounds.map((b) => b.y));
  const right = canvas
    ? canvas.width
    : Math.max(...bounds.map((b) => b.x + b.width));
  const bottom = canvas
    ? canvas.height
    : Math.max(...bounds.map((b) => b.y + b.height));
  return elements.map((el) => {
    if (!ids.includes(el.id)) return el;
    const b = elementBounds(el);
    switch (alignment) {
      case "left":
        return { ...el, x: el.x + left - b.x };
      case "center":
        return { ...el, x: el.x + (left + right - b.width) / 2 - b.x };
      case "right":
        return { ...el, x: el.x + right - b.width - b.x };
      case "top":
        return { ...el, y: el.y + top - b.y };
      case "middle":
        return { ...el, y: el.y + (top + bottom - b.height) / 2 - b.y };
      case "bottom":
        return { ...el, y: el.y + bottom - b.height - b.y };
    }
  });
}
export function distributeElements(
  elements: EditorElement[],
  ids: string[],
  axis: "x" | "y",
) {
  const size = axis === "x" ? "width" : "height";
  const selected = elements
    .filter((el) => ids.includes(el.id))
    .map((el) => ({ el, bounds: elementBounds(el) }))
    .sort((a, b) => a.bounds[axis] - b.bounds[axis]);
  if (selected.length < 3) return elements;
  const first = selected[0].bounds,
    last = selected[selected.length - 1].bounds;
  const span = last[axis] + last[size] - first[axis];
  const gap =
    (span - selected.reduce((total, item) => total + item.bounds[size], 0)) /
    (selected.length - 1);
  let position = first[axis];
  const positions = new Map<string, number>();
  selected.forEach(({ el, bounds }, i) => {
    positions.set(
      el.id,
      el[axis] +
        (i === selected.length - 1 ? last[axis] : position) -
        bounds[axis],
    );
    position += bounds[size] + gap;
  });
  return elements.map((el) =>
    positions.has(el.id) ? { ...el, [axis]: positions.get(el.id)! } : el,
  );
}
