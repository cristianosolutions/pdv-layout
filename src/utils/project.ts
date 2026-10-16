import type { ProjectData } from "../types/editor";
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function parseProject(
  content: string,
  resolutions: string[],
): ProjectData {
  const data: unknown = JSON.parse(content);
  const fail = () => {
    throw new Error("Arquivo de projeto inválido.");
  };
  if (!record(data)) return fail();
  if (
    typeof data.name !== "string" ||
    typeof data.resolution !== "string" ||
    !resolutions.includes(data.resolution) ||
    !finite(data.zoom) ||
    data.zoom < 0.2 ||
    data.zoom > 1 ||
    typeof data.backgroundColor !== "string" ||
    !data.backgroundColor.trim() ||
    !Array.isArray(data.elements)
  )
    return fail();
  const ids = new Set<string>();
  for (const el of data.elements) {
    if (
      !record(el) ||
      typeof el.id !== "string" ||
      !el.id ||
      ids.has(el.id) ||
      !["text", "rectangle", "field", "image", "border"].includes(
        String(el.type),
      ) ||
      !finite(el.x) ||
      !finite(el.y) ||
      !finite(el.width) ||
      el.width <= 0 ||
      !finite(el.height) ||
      el.height <= 0 ||
      typeof el.fill !== "string"
    )
      return fail();
    ids.add(el.id);
    if (
      el.textAlign !== undefined &&
      !["left", "center", "right"].includes(String(el.textAlign))
    )
      return fail();
    if (el.rotation !== undefined && !finite(el.rotation)) return fail();
    for (const key of ["stroke", "text", "fontFamily", "imageUrl"]) {
      if (el[key] !== undefined && typeof el[key] !== "string") return fail();
    }
    if (el.fontSize !== undefined && (!finite(el.fontSize) || el.fontSize <= 0))
      return fail();
    if (
      el.strokeWidth !== undefined &&
      (!finite(el.strokeWidth) || el.strokeWidth < 0)
    )
      return fail();
    if (
      el.cornerRadius !== undefined &&
      (!finite(el.cornerRadius) || el.cornerRadius < 0)
    )
      return fail();
    if (
      el.fontWeight !== undefined &&
      !["normal", "bold"].includes(String(el.fontWeight))
    )
      return fail();
    if (
      el.fontStyle !== undefined &&
      !["normal", "italic"].includes(String(el.fontStyle))
    )
      return fail();
    if (
      el.type === "image" &&
      (typeof el.imageUrl !== "string" || !el.imageUrl)
    )
      return fail();
  }
  return data as unknown as ProjectData;
}
