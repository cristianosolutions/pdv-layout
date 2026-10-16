import type { CanvasSize, EditorElement } from "../types/editor";

export type ResizeMode = "fit" | "adapt";

/** Fit preserves the page aspect ratio; adapt distributes objects across the new page. */
export function resizeElements(
  elements: EditorElement[],
  from: CanvasSize,
  to: CanvasSize,
  mode: ResizeMode = "fit",
): EditorElement[] {
  if (from.width === to.width && from.height === to.height) return elements;
  const scale = Math.min(to.width / from.width, to.height / from.height);
  // The geometric mean makes adaptation reversible across aspect ratios.
  const detailScale =
    mode === "adapt"
      ? Math.sqrt((to.width / from.width) * (to.height / from.height))
      : scale;
  const offsetX = (to.width - from.width * scale) / 2;
  const offsetY = (to.height - from.height * scale) / 2;
  return elements.map((element) => {
    const scaleX = mode === "adapt" ? to.width / from.width : scale;
    const scaleY = mode === "adapt" ? to.height / from.height : scale;
    // Images and rotated objects keep their shape; fields adapt to the available area.
    const preserveShape =
      element.type === "image" || (element.rotation ?? 0) % 360 !== 0;
    const width = element.width * (preserveShape ? detailScale : scaleX);
    const height = element.height * (preserveShape ? detailScale : scaleY);
    const angle = ((element.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const centerX =
      element.x + (element.width * cos - element.height * sin) / 2;
    const centerY =
      element.y + (element.width * sin + element.height * cos) / 2;
    return {
      ...element,
      x:
        centerX * scaleX +
        (mode === "fit" ? offsetX : 0) -
        (width * cos - height * sin) / 2,
      y:
        centerY * scaleY +
        (mode === "fit" ? offsetY : 0) -
        (width * sin + height * cos) / 2,
      width,
      height,
      ...(element.type === "text"
        ? { fontSize: (element.fontSize ?? 32) * detailScale }
        : {}),
      strokeWidth:
        (element.strokeWidth ??
          (element.type === "field" ? 1 : element.type === "border" ? 2 : 0)) *
        detailScale,
      ...(element.cornerRadius !== undefined
        ? { cornerRadius: element.cornerRadius * detailScale }
        : {}),
    };
  });
}
