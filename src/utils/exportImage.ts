import type Konva from "konva";

export async function exportCanvasAsImage(
  stage: Konva.Stage | null,
  filename = "pdv-layout.png",
) {
  if (!stage) throw new Error("Área de trabalho indisponível.");
  const transformers = stage.find("Transformer, .snap-guide");
  const visibility = transformers.map((node) => node.visible());
  try {
    transformers.forEach((node) => node.hide());
    const link = document.createElement("a");
    link.href = stage.toDataURL({ pixelRatio: 1 / stage.scaleX() });
    link.download = filename;
    link.click();
  } finally {
    transformers.forEach((node, index) => node.visible(visibility[index]));
    stage.batchDraw();
  }
}
