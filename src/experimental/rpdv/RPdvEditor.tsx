import "./rpdv.css";
import { useRef, useState } from "react";
import type Konva from "konva";
import type { EditorElement } from "../../types/editor";
import { parseRPdv, serializeRPdv } from "./rpdv";
import type { RPdvDocument } from "./rpdv";
import PDVCanvas from "../../components/PDVCanvas";

export default function RPdvEditor({ onClose }: { onClose: () => void }) {
  const [document, setDocument] = useState<RPdvDocument | null>(null);
  const [filename, setFilename] = useState("tela.txt");
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [background, setBackground] = useState<HTMLImageElement>();
  const [zoom, setZoom] = useState(0.6);
  const [message, setMessage] = useState(
    "Abra o TXT e depois selecione a imagem de fundo indicada nele.",
  );
  const [history, setHistory] = useState<EditorElement[][]>([]);
  const [index, setIndex] = useState(0);
  const stage = useRef<Konva.Stage>(null);
  const selected = elements.find(
    (element) => selectedIds.length === 1 && element.id === selectedIds[0],
  );
  const record = document?.records.find(
    (item) => `rpdv-${item.line}` === selected?.id,
  );
  const dirty =
    document && JSON.stringify(elements) !== JSON.stringify(document.elements);
  function commit(next: EditorElement[]) {
    const nextHistory = [...history.slice(0, index + 1), next];
    setElements(next);
    setHistory(nextHistory);
    setIndex(nextHistory.length - 1);
  }
  function change(id: string, changes: Partial<EditorElement>) {
    commit(
      elements.map((element) =>
        element.id === id ? { ...element, ...changes } : element,
      ),
    );
  }
  async function open(file?: File) {
    if (!file || (dirty && !confirm("Descartar as alterações do TXT atual?")))
      return;
    try {
      const parsed = parseRPdv(new Uint8Array(await file.arrayBuffer()));
      setDocument(parsed);
      setFilename(file.name);
      setElements(parsed.elements);
      setHistory([parsed.elements]);
      setIndex(0);
      setSelectedIds([]);
      setBackground(undefined);
      setMessage(
        `TXT aberto. Selecione o fundo: ${parsed.background || "imagem não informada"}.`,
      );
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function loadBackground(file?: File) {
    if (!file || !document) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new window.Image();
      image.src = url;
      await image.decode();
      if (
        image.naturalWidth !== document.width ||
        image.naturalHeight !== document.height
      )
        throw new Error(
          `O fundo deve ter ${document.width} × ${document.height} pixels.`,
        );
      setBackground(image);
      setMessage(
        `Fundo carregado. O TXT mantém a referência original: ${document.background}.`,
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function save() {
    if (!document) return;
    try {
      const bytes = serializeRPdv(document, elements);
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/octet-stream" }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename.replace(/\.txt$/i, "") + "_editado.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Cópia do TXT gerada. Abra no Tela.exe para conferir antes de usar no PDV.",
      );
    } catch (error) {
      setMessage(String(error));
    }
  }
  return (
    <div className="app rpdv-editor">
      <header className="topbar">
        <div className="brand">
          <div>
            <h1>Editor de tela RPdv</h1>
            <span>TXT original e imagem de fundo</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            onClick={() => {
              if (!dirty || confirm("Sair e descartar alterações não salvas?"))
                onClose();
            }}
          >
            Voltar ao Studio
          </button>
          <button disabled={!document} onClick={save}>
            Salvar cópia TXT
          </button>
        </div>
      </header>
      <div className="toolbar">
        <label>
          Abrir TXT{" "}
          <input
            aria-label="Abrir TXT RPdv"
            type="file"
            accept=".txt"
            onChange={(event) => {
              void open(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <label>
          Fundo PNG{" "}
          <input
            aria-label="Abrir fundo PNG"
            disabled={!document}
            type="file"
            accept="image/png"
            onChange={(event) => {
              void loadBackground(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <button
          disabled={index === 0}
          onClick={() => {
            setIndex(index - 1);
            setElements(history[index - 1]);
          }}
        >
          Desfazer
        </button>
        <button
          disabled={index >= history.length - 1}
          onClick={() => {
            setIndex(index + 1);
            setElements(history[index + 1]);
          }}
        >
          Refazer
        </button>
        <label>
          Zoom{" "}
          <select
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {[0.4, 0.6, 0.8, 1].map((value) => (
              <option key={value} value={value}>
                {value * 100}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <main className="workspace">
        <aside className="sidebar rpdv-list">
          <h2>Componentes</h2>
          <p className="panel-description">
            Selecione na lista ou sobre a imagem. Ctrl/Shift + clique seleciona
            vários.
          </p>
          {document?.records.map((item) => (
            <button
              className={
                selectedIds.includes(`rpdv-${item.line}`) ? "rpdv-selected" : ""
              }
              key={item.line}
              onClick={() => setSelectedIds([`rpdv-${item.line}`])}
            >
              {item.name} · função {item.functionId}
              <small>
                {
                  elements.find((element) => element.id === `rpdv-${item.line}`)
                    ?.text
                }
              </small>
            </button>
          ))}
        </aside>
        <section className="editor-area">
          <div className="canvas-info" role="status">
            {message}
          </div>
          <div className="canvas-wrapper">
            {document ? (
              <PDVCanvas
                stageRef={stage}
                size={document}
                zoom={zoom}
                elements={elements}
                selectedIds={selectedIds}
                backgroundColor="#ffffff"
                backgroundImage={background}
                onSelect={(id, additive) =>
                  setSelectedIds((current) =>
                    !id
                      ? []
                      : additive
                        ? current.includes(id)
                          ? current.filter((value) => value !== id)
                          : [...current, id]
                        : [id],
                  )
                }
                onChangeElement={change}
                onChangeElements={(changes) =>
                  commit(
                    elements.map((element) => ({
                      ...element,
                      ...changes.find((item) => item.id === element.id),
                    })),
                  )
                }
              />
            ) : (
              <p>Abra um arquivo de tela RPdv para começar.</p>
            )}
          </div>
        </section>
        <aside className="properties-panel">
          <h2>Propriedades</h2>
          <p className="panel-description">
            Etiquetas do painel principal são editáveis. Menus, fita do cupom,
            painéis e demais registros são preservados no TXT; ainda não possuem
            prévia ou edição neste modo.
          </p>
          {selected && (
            <>
              <p>
                <strong>{record?.name}</strong> · Função {record?.functionId}{" "}
                (preservada)
              </p>
              <label>
                Texto de referência
                <input
                  className="text-property"
                  value={selected.text ?? ""}
                  onChange={(event) =>
                    change(selected.id, { text: event.target.value })
                  }
                />
              </label>
              {(["x", "y", "width", "height"] as const).map((key, position) => (
                <label key={key}>
                  {["Posição X", "Posição Y", "Largura", "Altura"][position]}
                  <input
                    className="text-property"
                    type="number"
                    min={position > 1 ? 1 : undefined}
                    value={selected[key]}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      if (
                        Number.isFinite(value) &&
                        (position < 2 || value >= 1)
                      )
                        change(selected.id, { [key]: value });
                    }}
                  />
                </label>
              ))}
              <label>
                Fonte
                <input
                  className="text-property"
                  value={selected.fontFamily}
                  onChange={(event) =>
                    change(selected.id, { fontFamily: event.target.value })
                  }
                />
              </label>
              <label>
                Tamanho da fonte (pt)
                <input
                  className="text-property"
                  type="number"
                  min="1"
                  max="200"
                  value={Math.round(((selected.fontSize ?? 16) * 72) / 96)}
                  onChange={(event) => {
                    const value = event.target.valueAsNumber;
                    if (value >= 1 && value <= 200)
                      change(selected.id, { fontSize: (value * 96) / 72 });
                  }}
                />
              </label>
              <label>
                Cor do texto
                <input
                  className="color-input"
                  type="color"
                  value={selected.fill}
                  onChange={(event) =>
                    change(selected.id, { fill: event.target.value })
                  }
                />
              </label>
              <label>
                Alinhamento do texto
                <select
                  className="text-property"
                  value={selected.textAlign}
                  onChange={(event) =>
                    change(selected.id, {
                      textAlign: event.target
                        .value as EditorElement["textAlign"],
                    })
                  }
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selected.fontWeight === "bold"}
                  onChange={(event) =>
                    change(selected.id, {
                      fontWeight: event.target.checked ? "bold" : "normal",
                    })
                  }
                />{" "}
                Negrito
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selected.fontStyle === "italic"}
                  onChange={(event) =>
                    change(selected.id, {
                      fontStyle: event.target.checked ? "italic" : "normal",
                    })
                  }
                />{" "}
                Itálico
              </label>
            </>
          )}
        </aside>
      </main>
      <footer className="statusbar">
        {document
          ? `${filename} · ${document.width} × ${document.height} · ${elements.length} etiquetas · ${document.encoding}`
          : "Modo RPdv"}{" "}
        · Prévia aproximada; valide a cópia no Tela.exe.
      </footer>
    </div>
  );
}
