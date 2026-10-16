import { useState, useRef, useEffect, useEffectEvent } from "react";
import type Konva from "konva";
import { parseProject } from "./utils/project";
import { resizeElements } from "./utils/resize";
import { readAutosave, writeAutosave } from "./utils/autosave";
import {
  alignElements,
  distributeElements,
  reorderLayers,
} from "./utils/layout";
import LayoutTools from "./components/LayoutTools";

import {
  Download,
  FilePlus2,
  FolderOpen,
  MousePointer2,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  ImagePlus,
  Copy,
  ClipboardPaste,
} from "lucide-react";

import PDVCanvas from "./components/PDVCanvas";
import BorderProperties from "./components/BorderProperties";
import { exportCanvasAsImage } from "./utils/exportImage";
import { supermercadoTemplate } from "./templates/supermercado";

import type { CanvasSize, EditorElement, ProjectData } from "./types/editor";

import "./App.css";

/* =========================================================
   RESOLUÇÕES DISPONÍVEIS
========================================================= */

const resolutions: Record<string, CanvasSize> = {
  "800x600": {
    width: 800,
    height: 600,
  },

  "1024x768": {
    width: 1024,
    height: 768,
  },

  "1280x720": {
    width: 1280,
    height: 720,
  },

  "1333x768": {
    width: 1333,
    height: 768,
  },

  "1366x768": {
    width: 1366,
    height: 768,
  },

  "1600x900": {
    width: 1600,
    height: 900,
  },

  "1920x1080": {
    width: 1920,
    height: 1080,
  },
};

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

function App() {
  const [startup, setStartup] = useState(() => {
    try {
      return {
        project: readAutosave(window.localStorage, Object.keys(resolutions)),
        error: false,
      };
    } catch {
      return { project: null, error: true };
    }
  });
  /* ---------------------------------------------------------
     ESTADOS DO EDITOR
  --------------------------------------------------------- */

  const [resolution, setResolution] = useState(
    startup.project?.resolution ?? "1600x900",
  );
  const [resizeMode, setResizeMode] = useState<"adapt" | "fit" | "none">(
    "adapt",
  );

  const [zoom, setZoom] = useState(startup.project?.zoom ?? 0.6);

  const [elements, setElements] = useState<EditorElement[]>(
    startup.project?.elements ?? [],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  function setSelectedId(id: string | null) {
    setSelectedIds(id ? [id] : []);
  }
  function selectElement(id: string | null, additive = false) {
    if (!id) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((current) =>
      additive
        ? current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        : [id],
    );
  }

  const [backgroundColor, setBackgroundColor] = useState(
    startup.project?.backgroundColor ?? "#ffffff",
  );

  const [projectName, setProjectName] = useState(
    startup.project?.name ?? "Sem título",
  );

  // Histórico para Undo/Redo
  const [history, setHistory] = useState<
    { elements: EditorElement[]; resolution: string }[]
  >([
    {
      elements: startup.project?.elements ?? [],
      resolution: startup.project?.resolution ?? "1600x900",
    },
  ]);

  const [historyIndex, setHistoryIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [imagesReady, setImagesReady] = useState(true);
  const [copiedElement, setCopiedElement] = useState<EditorElement[]>([]);
  const pasteCountRef = useRef(0);
  const projectGeneration = useRef(0);
  const projectSnapshot = JSON.stringify({
    name: projectName,
    resolution,
    zoom,
    backgroundColor,
    elements,
  });
  const [autosave, setAutosave] = useState({ snapshot: "", error: false });
  const [showRecovered, setShowRecovered] = useState(Boolean(startup.project));

  // Oculta automaticamente a notificação após 3 segundos
  useEffect(() => {
    if (!showRecovered) return;

    const timer = window.setTimeout(() => {
      setShowRecovered(false);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [showRecovered]);

  useEffect(() => {
    if (startup.error) return;
    const save = () => {
      try {
        writeAutosave(window.localStorage, JSON.parse(projectSnapshot));
        setAutosave({ snapshot: projectSnapshot, error: false });
      } catch {
        setAutosave({ snapshot: projectSnapshot, error: true });
      }
    };
    const timer = window.setTimeout(save, 600);
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [projectSnapshot, startup.error]);

  function applyLayout(next: EditorElement[]) {
    if (JSON.stringify(next) === JSON.stringify(elements)) return;
    setElements(next);
    recordHistory(next);
  }

  /* ---------------------------------------------------------
     TAMANHO ATUAL DO CANVAS
  --------------------------------------------------------- */

  const canvasSize = resolutions[resolution];

  /* ---------------------------------------------------------
     ELEMENTO SELECIONADO
  --------------------------------------------------------- */

  const selectedElement = elements.find((element) => element.id === selectedId);

  /* =========================================================
     ATALHOS DO ELEMENTO SELECIONADO
  ========================================================= */

  const handleEditorKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (event.defaultPrevented || event.isComposing || event.altKey) return;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest('input, textarea, select, [role="textbox"]'))
    )
      return;
    if (event.ctrlKey || event.metaKey) {
      if (event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        setSelectedIds(elements.map((element) => element.id));
      } else if (key === "c" && selectedIds.length > 0) {
        event.preventDefault();
        if (!event.repeat) copyElement();
      } else if (key === "v" && copiedElement.length > 0) {
        event.preventDefault();
        if (!event.repeat) pasteElement();
      }
      return;
    }
    if (
      !selectedIds.some((id) => elements.some((element) => element.id === id))
    )
      return;
    if (event.key === "Delete") {
      event.preventDefault();
      deleteElement();
      return;
    }

    const step = event.shiftKey ? 10 : 1;
    let x = 0,
      y = 0;
    switch (event.key) {
      case "ArrowLeft":
        x -= step;
        break;
      case "ArrowRight":
        x += step;
        break;
      case "ArrowUp":
        y -= step;
        break;
      case "ArrowDown":
        y += step;
        break;
      default:
        return;
    }
    event.preventDefault();
    updateElements(
      elements
        .filter((element) => selectedIds.includes(element.id))
        .map((element) => ({
          id: element.id,
          x: element.x + x,
          y: element.y + y,
        })),
    );
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handleEditorKey(event);

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* =========================================================
     GERAR ID
  ========================================================= */

  function createId() {
    return crypto.randomUUID();
  }

  function copyElement() {
    const selected = elements.filter((element) =>
      selectedIds.includes(element.id),
    );
    if (!selected.length) return;
    setCopiedElement(selected.map((element) => ({ ...element })));
    pasteCountRef.current = 0;
  }

  function pasteElement() {
    if (!copiedElement.length) return;
    pasteCountRef.current += 1;
    const offset = pasteCountRef.current * 20;
    const pasted = copiedElement.map((element) => ({
      ...element,
      id: createId(),
      x: element.x + offset,
      y: element.y + offset,
    }));
    const nextElements = [...elements, ...pasted];
    setElements(nextElements);
    recordHistory(nextElements);
    setSelectedIds(pasted.map((element) => element.id));
  }

  function updateElements(changes: { id: string; x: number; y: number }[]) {
    const byId = new Map(changes.map((change) => [change.id, change]));
    const next = elements.map((element) =>
      byId.has(element.id) ? { ...element, ...byId.get(element.id) } : element,
    );
    setElements(next);
    recordHistory(next);
  }

  /* =========================================================
     HISTÓRICO (UNDO/REDO)
  ========================================================= */

  function recordHistory(
    newElements: EditorElement[],
    nextResolution = resolution,
  ) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ elements: newElements, resolution: nextResolution });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  function undo() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1].elements);
      setResolution(history[historyIndex - 1].resolution);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1].elements);
      setResolution(history[historyIndex + 1].resolution);
    }
  }

  /* =========================================================
     ADICIONAR TEXTO
  ========================================================= */

  function addText() {
    const newElement: EditorElement = {
      id: createId(),
      type: "text",
      x: 100,
      y: 100,
      width: 300,
      height: 50,
      fill: "#111827",
      text: "Novo texto",
      fontSize: 32,
      fontFamily: "Arial, sans-serif",
      fontWeight: "normal",
      fontStyle: "normal",
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    recordHistory(newElements);
    setSelectedId(newElement.id);
  }

  /* =========================================================
     ADICIONAR RETÂNGULO
  ========================================================= */

  function addRectangle() {
    const newElement: EditorElement = {
      id: createId(),
      type: "rectangle",
      x: 150,
      y: 150,
      width: 350,
      height: 180,
      fill: "#0b5d35",
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    recordHistory(newElements);
    setSelectedId(newElement.id);
  }

  /* =========================================================
     ADICIONAR CAMPO
  ========================================================= */

  function addField() {
    const newElement: EditorElement = {
      id: createId(),
      type: "field",
      x: 120,
      y: 120,
      width: 600,
      height: 70,
      fill: "#e5e7eb",
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    recordHistory(newElements);
    setSelectedId(newElement.id);
  }

  /* =========================================================
     ADICIONAR IMAGEM
  ========================================================= */

  function addImage() {
    imageInputRef.current?.click();
  }

  const commitImage = useRef<(imageUrl: string, generation: number) => void>(
    () => {},
  );
  useEffect(() => {
    commitImage.current = (imageUrl: string, generation: number) => {
      if (generation !== projectGeneration.current) return;
      const newElement: EditorElement = {
        id: createId(),
        type: "image",
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        fill: "#ffffff",
        imageUrl,
      };
      const next = [...elements, newElement];
      setElements(next);
      recordHistory(next);
      setSelectedId(newElement.id);
    };
  });

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    const generation = projectGeneration.current;
    reader.onload = () => {
      if (typeof reader.result === "string")
        commitImage.current(reader.result, generation);
    };
    reader.onerror = () => alert("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  /* =========================================================
     DELETAR ELEMENTO
  ========================================================= */

  function deleteElement() {
    if (!selectedIds.length) return;

    const newElements = elements.filter((e) => !selectedIds.includes(e.id));
    setElements(newElements);
    recordHistory(newElements);
    setSelectedId(null);
  }

  /* =========================================================
     ATUALIZAR ELEMENTO
  ========================================================= */

  function updateElement(id: string, changes: Partial<EditorElement>) {
    for (const key of [
      "x",
      "y",
      "width",
      "height",
      "fontSize",
      "rotation",
      "strokeWidth",
      "cornerRadius",
    ] as const) {
      const value = changes[key];
      if (
        value !== undefined &&
        (!Number.isFinite(value) ||
          (["width", "height", "fontSize"].includes(key) && value <= 0) ||
          (["strokeWidth", "cornerRadius"].includes(key) && value < 0))
      )
        return;
    }
    const newElements = elements.map((element) =>
      element.id === id
        ? {
            ...element,
            ...changes,
          }
        : element,
    );
    setElements(newElements);
    recordHistory(newElements);
  }

  /* =========================================================
     ALTERAR ELEMENTO SELECIONADO
  ========================================================= */

  function changeSelectedElement(changes: Partial<EditorElement>) {
    if (!selectedId) {
      return;
    }

    updateElement(selectedId, changes);
  }

  /* =========================================================
     ZOOMBRA
  ========================================================= */

  function zoomIn() {
    setZoom((current) => Math.min(Number((current + 0.1).toFixed(1)), 1));
  }

  function zoomOut() {
    setZoom((current) => Math.max(Number((current - 0.1).toFixed(1)), 0.2));
  }

  /* =========================================================
     SALVAR PROJETO
  ========================================================= */

  function saveProject() {
    const projectData: ProjectData = {
      name: projectName,
      resolution,
      zoom,
      backgroundColor,
      elements,
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName || "projeto"}_${canvasSize.width}x${canvasSize.height}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /* =========================================================
     ABRIR PROJETO
  ========================================================= */

  function openProject() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const projectData = parseProject(content, Object.keys(resolutions));

        projectGeneration.current += 1;
        setStartup({ project: null, error: false });
        setShowRecovered(false);
        setProjectName(projectData.name);
        setResolution(projectData.resolution);
        setZoom(projectData.zoom);
        setBackgroundColor(projectData.backgroundColor);
        setElements(projectData.elements);
        setHistory([
          {
            elements: projectData.elements,
            resolution: projectData.resolution,
          },
        ]);
        setHistoryIndex(0);
        setSelectedId(null);
      } catch (error) {
        alert("Erro ao abrir arquivo: " + error);
      }
    };
    reader.readAsText(file);
  }

  /* =========================================================
     NOVO PROJETO
  ========================================================= */

  function newProject() {
    if (
      elements.length > 0 &&
      !confirm(
        "Descartar projeto atual? A cópia automática será substituída pelo novo projeto.",
      )
    ) {
      return;
    }

    projectGeneration.current += 1;
    setStartup({ project: null, error: false });
    setProjectName("Sem título");
    setShowRecovered(false);
    setElements([]);
    setSelectedId(null);
    setBackgroundColor("#ffffff");
    setResolution("1600x900");
    setZoom(0.6);
    setHistory([{ elements: [], resolution: "1600x900" }]);
    setHistoryIndex(0);
  }

  /* =========================================================
     EXPORTAR COMO PNG
  ========================================================= */

  async function exportPNG() {
    if (!imagesReady) {
      alert(
        "Aguarde o carregamento das imagens. Se uma imagem não carregar, remova-a ou importe novamente.",
      );
      return;
    }
    try {
      await exportCanvasAsImage(
        stageRef.current,
        `${projectName || "layout"}_${canvasSize.width}x${canvasSize.height}.png`,
      );
    } catch (error) {
      alert("Erro ao exportar: " + error);
    }
  }

  /* =========================================================
     CARREGAR TEMPLATE
  ========================================================= */

  function loadTemplate() {
    projectGeneration.current += 1;
    const template = supermercadoTemplate();
    setProjectName(template.name);
    setResolution(template.resolution);
    setZoom(template.zoom);
    setBackgroundColor(template.backgroundColor);
    setElements(template.elements);
    recordHistory(template.elements, template.resolution);
    setSelectedId(null);
  }

  /* =========================================================
     INTERFACE
  ========================================================= */

  return (
    <div className="app">
      {/* =====================================================
          BARRA SUPERIOR
      ====================================================== */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>

          <div>
            <h1>PDV Layout Studio</h1>

            <span>Editor visual de telas para PDV</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button onClick={newProject}>
            <FilePlus2 size={18} />
            Novo
          </button>

          <button onClick={openProject}>
            <FolderOpen size={18} />
            Abrir
          </button>

          <button onClick={saveProject}>
            <Save size={18} />
            Salvar
          </button>

          <button className="export-button" onClick={exportPNG}>
            <Download size={18} />
            Exportar PNG
          </button>
        </div>
      </header>

      {showRecovered && (
        <div className="recovery-notice" role="status">
          Projeto recuperado automaticamente neste navegador.
        </div>
      )}

      {/* =====================================================
          TOOLBAR
      ====================================================== */}

      <div className="toolbar">
        <div className="toolbar-group">
          <button title="Selecionar">
            <MousePointer2 size={18} />
          </button>

          <button title="Desfazer" onClick={undo} disabled={historyIndex === 0}>
            <Undo2 size={18} />
          </button>

          <button
            title="Refazer"
            onClick={redo}
            disabled={historyIndex === history.length - 1}
          >
            <Redo2 size={18} />
          </button>

          <button
            title="Copiar objeto (Ctrl+C)"
            aria-label="Copiar objeto"
            onClick={copyElement}
            disabled={!selectedIds.length}
          >
            <Copy size={18} />
          </button>

          <button
            title="Colar objeto (Ctrl+V)"
            aria-label="Colar objeto"
            onClick={pasteElement}
            disabled={!copiedElement.length}
          >
            <ClipboardPaste size={18} />
          </button>
        </div>

        {/* RESOLUÇÃO */}

        <div className="resolution">
          <label>Resolução</label>

          <select
            value={resolution}
            onChange={(event) => {
              const nextResolution = event.target.value;
              if (nextResolution === resolution) return;
              const nextElements =
                resizeMode !== "none"
                  ? resizeElements(
                      elements,
                      canvasSize,
                      resolutions[nextResolution],
                      resizeMode,
                    )
                  : elements;
              setResolution(nextResolution);
              setElements(nextElements);
              recordHistory(nextElements, nextResolution);
              setSelectedId(null);
            }}
          >
            {Object.keys(resolutions).map((item) => (
              <option key={item} value={item}>
                {item.replace("x", " × ")}
              </option>
            ))}
          </select>
        </div>

        <label
          className="scale-resolution"
          title="Adaptar distribui os objetos pela nova tela e preserva a proporção das imagens. Manter proporções pode deixar margens."
        >
          Ao mudar resolução
          <select
            value={resizeMode}
            onChange={(event) =>
              setResizeMode(event.target.value as "adapt" | "fit" | "none")
            }
          >
            <option value="adapt">Adaptar à tela</option>
            <option value="fit">Manter proporções do layout</option>
            <option value="none">Não redimensionar objetos</option>
          </select>
        </label>

        {/* ZOOM */}

        <div className="zoom">
          <button onClick={zoomOut} title="Diminuir zoom">
            −
          </button>

          <span>{Math.round(zoom * 100)}%</span>

          <button onClick={zoomIn} title="Aumentar zoom">
            +
          </button>
        </div>
      </div>

      {/* =====================================================
          WORKSPACE
      ====================================================== */}

      <main className="workspace">
        {/* ===================================================
            PAINEL ESQUERDO
        ==================================================== */}

        <aside className="sidebar">
          <h2>Elementos</h2>

          <p className="panel-description">Adicione elementos ao seu layout.</p>

          <div className="elements-grid">
            {/* TEXTO */}

            <button className="element-button" onClick={addText}>
              <Type size={25} />

              <span>Texto</span>
            </button>

            {/* RETÂNGULO */}

            <button className="element-button" onClick={addRectangle}>
              <Square size={25} />

              <span>Retângulo</span>
            </button>

            {/* IMAGEM */}

            <button className="element-button" onClick={addImage}>
              <ImagePlus size={25} />

              <span>Imagem</span>
            </button>

            {/* CAMPO */}

            <button className="element-button" onClick={addField}>
              <Square size={25} />

              <span>Campo</span>
            </button>
          </div>

          {/* =================================================
              TEMPLATES
          ================================================== */}

          <h2 className="templates-title">Templates</h2>

          <button className="template-card" onClick={loadTemplate}>
            <div className="template-preview">PDV</div>

            <span>Supermercado</span>
          </button>

          <div className="layers-panel">
            <h2>Camadas</h2>
            <div className="layout-buttons">
              <button disabled={!elements.length} onClick={() => setSelectedIds(elements.map(element => element.id))}>Selecionar todos</button>
              <button disabled={!selectedIds.length} onClick={deleteElement}>Excluir selecionados</button>
            </div>
            <p className="panel-description">
              As primeiras ficam à frente. Ctrl/Shift + clique seleciona várias.
            </p>
            {[...elements].reverse().map((element, index) => (
              <button
                key={element.id}
                aria-pressed={selectedIds.includes(element.id)}
                className={
                  selectedIds.includes(element.id)
                    ? "layer-item selected"
                    : "layer-item"
                }
                onClick={(event) =>
                  selectElement(
                    element.id,
                    event.ctrlKey || event.metaKey || event.shiftKey,
                  )
                }
              >
                {elements.length - index}.{" "}
                {element.type === "text"
                  ? element.text || "Texto vazio"
                  : {
                      rectangle: "Retângulo",
                      field: "Campo",
                      image: "Imagem",
                      border: "Borda",
                    }[element.type]}
              </button>
            ))}
            {!elements.length && (
              <p className="panel-description">
                Adicione um objeto para começar.
              </p>
            )}
          </div>
        </aside>

        {/* ===================================================
            EDITOR CENTRAL
        ==================================================== */}

        <section className="editor-area">
          <div className="canvas-info">
            <span>
              Área de trabalho
              {" · Arraste no espaço vazio para selecionar · Delete: excluir"}
            </span>

            <strong>
              {canvasSize.width}
              {" × "}
              {canvasSize.height}
              {" px"}
            </strong>
          </div>

          <div className="canvas-wrapper">
            <PDVCanvas
              onImagesReady={setImagesReady}
              stageRef={stageRef}
              size={canvasSize}
              zoom={zoom}
              elements={elements}
              selectedIds={selectedIds}
              backgroundColor={backgroundColor}
              onSelectMany={setSelectedIds}
              onSelect={selectElement}
              onChangeElements={updateElements}
              onChangeElement={updateElement}
            />
          </div>
        </section>

        {/* ===================================================
            PAINEL DIREITO
        ==================================================== */}

        <aside className="properties-panel">
          <h2>Propriedades</h2>

          <LayoutTools
            count={
              elements.filter((element) => selectedIds.includes(element.id))
                .length
            }
            onLayer={(action) =>
              applyLayout(reorderLayers(elements, selectedIds, action))
            }
            onAlign={(alignment, page) =>
              applyLayout(
                alignElements(
                  elements,
                  selectedIds,
                  alignment,
                  page ? canvasSize : undefined,
                ),
              )
            }
            onDistribute={(axis) =>
              applyLayout(distributeElements(elements, selectedIds, axis))
            }
          />

          {/* =================================================
              FUNDO DO CANVAS
          ================================================== */}

          <div className="canvas-properties">
            <label>Fundo do Canvas</label>

            <div className="background-control">
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
                title="Selecionar cor do fundo"
              />

              <input
                type="text"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
                placeholder="#ffffff"
              />
            </div>
          </div>

          {/* =================================================
              NENHUM ELEMENTO SELECIONADO
          ================================================== */}

          {!selectedElement ? (
            <p className="panel-description">
              {selectedIds.length > 1
                ? `${selectedIds.length} elementos selecionados. Arraste para mover juntos. Ctrl ou Shift + clique altera a seleção.`
                : "Selecione um elemento para editar. Ctrl ou Shift + clique seleciona vários."}
            </p>
          ) : (
            <>
              {/* =============================================
                  DELETAR ELEMENTO
              ============================================== */}

              <div className="property-section">
                <button className="delete-button" onClick={deleteElement}>
                  <Trash2 size={18} />
                  Deletar Elemento
                </button>
              </div>

              {/* =============================================
                  POSIÇÃO
              ============================================== */}

              <div className="property-section">
                <label>Posição</label>

                <div className="property-row">
                  <div>
                    <span>X</span>

                    <input
                      type="number"
                      value={Math.round(selectedElement.x)}
                      onChange={(event) =>
                        changeSelectedElement({
                          x: Number(event.target.value),
                        })
                      }
                    />
                  </div>

                  <div>
                    <span>Y</span>

                    <input
                      type="number"
                      value={Math.round(selectedElement.y)}
                      onChange={(event) =>
                        changeSelectedElement({
                          y: Number(event.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* =============================================
                  TAMANHO
              ============================================== */}

              <div className="property-section">
                <label>Tamanho</label>

                <div className="property-row">
                  <div>
                    <span>L</span>

                    <input
                      type="number"
                      min="1"
                      value={selectedElement.width}
                      onChange={(event) =>
                        changeSelectedElement({
                          width: Math.max(1, Number(event.target.value)),
                        })
                      }
                    />
                  </div>

                  <div>
                    <span>A</span>

                    <input
                      type="number"
                      min="1"
                      value={selectedElement.height}
                      onChange={(event) =>
                        changeSelectedElement({
                          height: Math.max(1, Number(event.target.value)),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* =============================================
                  COR DO ELEMENTO
              ============================================== */}

              <div className="property-section">
                <label htmlFor="element-rotation">Rotação (°)</label>
                <input
                  id="element-rotation"
                  type="number"
                  step="1"
                  value={
                    Math.round((selectedElement.rotation ?? 0) * 100) / 100
                  }
                  onChange={(event) => {
                    const rotation = event.target.valueAsNumber;
                    if (!Number.isFinite(rotation)) return;
                    const previous =
                      ((selectedElement.rotation ?? 0) * Math.PI) / 180;
                    const next = (rotation * Math.PI) / 180;
                    const halfWidth = selectedElement.width / 2;
                    const halfHeight = selectedElement.height / 2;
                    changeSelectedElement({
                      rotation,
                      x:
                        selectedElement.x +
                        halfWidth * (Math.cos(previous) - Math.cos(next)) -
                        halfHeight * (Math.sin(previous) - Math.sin(next)),
                      y:
                        selectedElement.y +
                        halfWidth * (Math.sin(previous) - Math.sin(next)) +
                        halfHeight * (Math.cos(previous) - Math.cos(next)),
                    });
                  }}
                />
              </div>

              {selectedElement.type !== "image" && (
                <div className="property-section">
                  <label>Cor do Elemento</label>

                  <input
                    className="color-input"
                    type="color"
                    value={selectedElement.fill}
                    onChange={(event) =>
                      changeSelectedElement({
                        fill: event.target.value,
                      })
                    }
                  />
                </div>
              )}

              {(selectedElement.type === "rectangle" ||
                selectedElement.type === "field") && (
                <BorderProperties
                  element={selectedElement}
                  onChange={changeSelectedElement}
                />
              )}

              {/* =============================================
                  PROPRIEDADES DE TEXTO
              ============================================== */}

              {selectedElement.type === "text" && (
                <>
                  <div className="property-section">
                    <label>Texto</label>

                    <input
                      className="text-property"
                      value={selectedElement.text ?? ""}
                      onChange={(event) =>
                        changeSelectedElement({
                          text: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="property-section">
                    <label>Tamanho da Fonte</label>

                    <input
                      className="text-property"
                      type="number"
                      min="8"
                      max="200"
                      value={selectedElement.fontSize ?? 32}
                      onChange={(event) => {
                        const value = event.target.valueAsNumber;
                        if (
                          Number.isFinite(value) &&
                          value >= 8 &&
                          value <= 200
                        )
                          changeSelectedElement({ fontSize: value });
                      }}
                    />
                  </div>

                  <div className="property-section">
                    <label>Família da Fonte</label>

                    <select
                      className="text-property"
                      value={selectedElement.fontFamily ?? "Arial, sans-serif"}
                      onChange={(event) =>
                        changeSelectedElement({
                          fontFamily: event.target.value,
                        })
                      }
                    >
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="'Times New Roman', serif">
                        Times New Roman
                      </option>
                      <option value="'Courier New', monospace">
                        Courier New
                      </option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                      <option value="'Comic Sans MS', cursive">
                        Comic Sans
                      </option>
                      <option value="'Impact', fantasy">Impact</option>
                    </select>
                  </div>

                  <div className="property-section">
                    <label>Estilos de Texto</label>

                    <div className="style-buttons">
                      <button
                        className={`style-button ${
                          selectedElement.fontWeight === "bold" ? "active" : ""
                        }`}
                        onClick={() =>
                          changeSelectedElement({
                            fontWeight:
                              selectedElement.fontWeight === "bold"
                                ? "normal"
                                : "bold",
                          })
                        }
                        title="Negrito"
                      >
                        <strong>N</strong>
                      </button>

                      <button
                        className={`style-button ${
                          selectedElement.fontStyle === "italic" ? "active" : ""
                        }`}
                        onClick={() =>
                          changeSelectedElement({
                            fontStyle:
                              selectedElement.fontStyle === "italic"
                                ? "normal"
                                : "italic",
                          })
                        }
                        title="Itálico"
                      >
                        <em>I</em>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </main>

      {/* =====================================================
          BARRA DE STATUS
      ====================================================== */}

      <footer className="statusbar">
        <span role="status" className="autosave-status">
          {startup.error
            ? "Recuperação automática indisponível. Use Salvar para guardar o projeto."
            : autosave.snapshot !== projectSnapshot
              ? "Salvando automaticamente…"
              : autosave.error
                ? "Não foi possível salvar automaticamente. Use Salvar para baixar o projeto."
                : "Salvo neste navegador"}
        </span>

        <span>Projeto: {projectName}</span>

        <span>
          Canvas: {canvasSize.width}
          {" × "}
          {canvasSize.height}
        </span>

        <span>Zoom: {Math.round(zoom * 100)}%</span>

        <span>Elementos: {elements.length}</span>
      </footer>

      {/* INPUTS OCULTOS */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}

export default App;
