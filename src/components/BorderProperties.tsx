import type { EditorElement } from "../types/editor";

interface BorderPropertiesProps {
  element: EditorElement;
  onChange: (changes: Partial<EditorElement>) => void;
}

export default function BorderProperties({ element, onChange }: BorderPropertiesProps) {
  const width = element.strokeWidth ?? (element.type === "field" ? 1 : 0);
  const color = element.stroke ?? "#999999";
  const enabled = width > 0;
  const radius = element.cornerRadius ?? 0;

  return (
    <div className="property-section border-properties">
      <label className="border-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange({
            strokeWidth: event.target.checked ? 1 : 0,
            stroke: color === "transparent" ? "#999999" : color,
          })}
        />
        Adicionar borda
      </label>
      {enabled && (
        <>
          <label htmlFor="border-color">Cor da borda</label>
          <input
            id="border-color"
            className="color-input"
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#999999"}
            onChange={(event) => onChange({ stroke: event.target.value })}
          />
          <label htmlFor="border-preset">Espessuras predefinidas</label>
          <select
            id="border-preset"
            className="text-property"
            value={[1, 2, 4, 8].includes(width) ? String(width) : "manual"}
            onChange={(event) => onChange({ strokeWidth: Number(event.target.value) })}
          >
            <option value="manual" disabled>Personalizada</option>
            {[1, 2, 4, 8].map(value => <option key={value} value={value}>{value} px</option>)}
          </select>
          <label htmlFor="border-width">Espessura manual (px)</label>
          <input
            id="border-width"
            className="text-property"
            type="number"
            min="0"
            step="0.5"
            value={width}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value) && value >= 0) onChange({ strokeWidth: value });
            }}
          />
          <p className="border-hint">Use 0 ou desmarque a opção para remover a borda.</p>
        </>
      )}
      <label className="border-toggle">
        <input
          type="checkbox"
          checked={radius > 0}
          onChange={(event) => onChange({ cornerRadius: event.target.checked ? 12 : 0 })}
        />
        Arredondar cantos
      </label>
      {radius > 0 && (
        <>
          <label htmlFor="corner-radius">Arredondamento manual (px)</label>
          <input
            id="corner-radius"
            className="text-property"
            type="number"
            min="0"
            step="1"
            value={radius}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value) && value >= 0) onChange({ cornerRadius: value });
            }}
          />
          <label htmlFor="corner-preset">Arredondamentos predefinidos</label>
          <select
            id="corner-preset"
            className="text-property"
            value={[4, 8, 12, 24, 40].includes(radius) ? String(radius) : "manual"}
            onChange={(event) => onChange({ cornerRadius: Number(event.target.value) })}
          >
            <option value="manual" disabled>Personalizado</option>
            {[4, 8, 12, 24, 40].map(value => <option key={value} value={value}>{value} px</option>)}
          </select>
          <p className="border-hint">Use 0 ou desmarque a opção para voltar aos cantos retos.</p>
        </>
      )}
    </div>
  );
}
