import type { EditorElement } from '../../types/editor';

export interface RPdvDocument {
  text: string;
  encoding: 'utf-8' | 'windows-1252';
  bom: boolean;
  width: number;
  height: number;
  background: string;
  elements: EditorElement[];
  records: { line: number; name: string; kind: string; functionId: string }[];
}
const separator = '¨';
const decoder = new TextDecoder('windows-1252');
const legacyChars = Array.from({ length: 256 }, (_, value) => decoder.decode(Uint8Array.of(value)));
export function encodeRPdv(text: string, encoding: RPdvDocument['encoding'], bom = false): Uint8Array<ArrayBuffer> {
  if (encoding === 'utf-8') return new TextEncoder().encode((bom ? '\uFEFF' : '') + text);
  return Uint8Array.from(Array.from(text, char => {
    const value = legacyChars.indexOf(char);
    if (value < 0) throw new Error(`O caractere “${char}” não é compatível com o TXT original.`);
    return value;
  }));
}
export function rpColor(value: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffff) return '#000000';
  return '#' + [number & 255, (number >> 8) & 255, (number >> 16) & 255].map(part => part.toString(16).padStart(2, '0')).join('');
}
function colorNumber(value: string) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Cor inválida.');
  return String(parseInt(value.slice(1, 3), 16) + (parseInt(value.slice(3, 5), 16) << 8) + (parseInt(value.slice(5, 7), 16) << 16));
}
export function parseRPdv(bytes: Uint8Array): RPdvDocument {
  let text: string;
  let encoding: RPdvDocument['encoding'] = 'utf-8';
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = decoder.decode(bytes); encoding = 'windows-1252'; }
  const lines = text.split(/\r\n|\n|\r/);
  const form = lines[0].split(separator);
  const width = Number(form[4]), height = Number(form[3]);
  if (form[0] !== 'TForm' || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) throw new Error('TXT de tela RPdv inválido ou resolução não suportada.');
  const elements: EditorElement[] = [];
  const records: RPdvDocument['records'] = [];
  let background = '';
  lines.forEach((line, index) => {
    const fields = line.split(separator);
    if (fields[0] === 'TPainel' && fields[2] === 'FPrinc') background = fields[18] ?? '';
    if (fields[0] !== 'TEtiq' || fields.length < 17) return;
    // Only main-panel labels have a verified coordinate space in the supplied format.
    if (fields[2] !== 'Painel0') return;
    const font = fields[15].split('^');
    const geometry = [5, 6, 8, 7].map(position => Number(fields[position]));
    if (!geometry.every(Number.isFinite) || geometry[2] <= 0 || geometry[3] <= 0) throw new Error(`Dimensões inválidas no componente ${fields[1]}.`);
    const points = Number(font[2]);
    if (!Number.isFinite(points) || points <= 0) throw new Error(`Fonte inválida no componente ${fields[1]}.`);
    elements.push({ id: `rpdv-${index}`, type: 'text', x: geometry[0], y: geometry[1], width: geometry[2], height: geometry[3],
      text: fields[4], fill: rpColor(font[0]), fontSize: points * 96 / 72, fontFamily: font[3] || 'Arial',
      fontWeight: font[4]?.[0] === '1' ? 'bold' : 'normal', fontStyle: font[4]?.[1] === '1' ? 'italic' : 'normal',
      textAlign: fields[10] === '1' ? 'right' : fields[10] === '2' ? 'center' : 'left' });
    records.push({ line: index, name: fields[1], kind: fields[0], functionId: fields[3] });
  });
  if (!elements.length) throw new Error('Este TXT não contém etiquetas do painel principal no formato suportado.');
  return { text, encoding, bom: bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191, width, height, background, elements, records };
}
export function serializeRPdv(document: RPdvDocument, elements: EditorElement[]) {
  // Preserve every untouched record, separator, unknown flag, and original line ending.
  const lines = document.text.split(/(\r\n|\n|\r)/);
  for (const original of document.elements) {
    const current = elements.find(element => element.id === original.id);
    if (!current) throw new Error('Um componente original está ausente. Reabra o TXT para preservar suas funções.');
    const record = document.records.find(item => `rpdv-${item.line}` === original.id)!;
    const fields = lines[record.line * 2].split(separator);
    for (const [key, position] of [['x', 5], ['y', 6], ['width', 8], ['height', 7]] as const) {
      if (current[key] !== original[key]) {
        if (!Number.isFinite(current[key]) || ((key === 'width' || key === 'height') && current[key] < 1)) throw new Error('Dimensão inválida.');
        fields[position] = String(Math.round(current[key]));
      }
    }
    const safe = (value: string) => {
      if (/[¨^\r\n]/.test(value)) throw new Error('O texto não pode conter quebras de linha nem os separadores ¨ e ^.');
      return value;
    };
    if (current.text !== original.text) fields[4] = safe(current.text ?? '');
    if (current.textAlign !== original.textAlign) fields[10] = current.textAlign === 'right' ? '1' : current.textAlign === 'center' ? '2' : '0';
    const font = fields[15].split('^');
    if (current.fill !== original.fill) font[0] = colorNumber(current.fill);
    if (current.fontSize !== original.fontSize) {
      const points = Math.round((current.fontSize ?? 16) * 72 / 96);
      if (points < 1 || points > 200) throw new Error('Tamanho de fonte inválido.');
      font[2] = String(points); font[1] = String(-Math.round(points * 96 / 72));
    }
    if (current.fontFamily !== original.fontFamily) font[3] = safe(current.fontFamily ?? 'Arial');
    const flags = (font[4] ?? '0000').split('');
    if (current.fontWeight !== original.fontWeight) flags[0] = current.fontWeight === 'bold' ? '1' : '0';
    if (current.fontStyle !== original.fontStyle) flags[1] = current.fontStyle === 'italic' ? '1' : '0';
    font[4] = flags.join(''); fields[15] = font.join('^');
    lines[record.line * 2] = fields.join(separator);
  }
  return encodeRPdv(lines.join(''), document.encoding, document.bom);
}

