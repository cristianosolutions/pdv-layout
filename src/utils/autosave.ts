import type { ProjectData } from "../types/editor";
import { parseProject } from "./project.ts";
export const AUTOSAVE_KEY = "pdv-layout-studio.autosave.v1";
export function readAutosave(
  storage: Pick<Storage, "getItem">,
  resolutions: string[],
) {
  const raw = storage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || typeof saved.project !== "object")
    throw new Error("Cópia automática inválida.");
  return parseProject(JSON.stringify(saved.project), resolutions);
}
export function writeAutosave(
  storage: Pick<Storage, "setItem">,
  project: ProjectData,
) {
  storage.setItem(
    AUTOSAVE_KEY,
    JSON.stringify({ version: 1, savedAt: new Date().toISOString(), project }),
  );
}
