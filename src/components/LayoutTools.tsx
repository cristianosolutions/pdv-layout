import { useState } from 'react';
import type { Alignment, LayerAction } from '../utils/layout';
interface Props {
  count: number;
  onLayer: (action: LayerAction) => void;
  onAlign: (alignment: Alignment, canvas: boolean) => void;
  onDistribute: (axis: 'x' | 'y') => void;
}
export default function LayoutTools({ count, onLayer, onAlign, onDistribute }: Props) {
  const [reference, setReference] = useState('selection');
  return <div className="layout-tools">
    <h2>Organizar seleção</h2>
    <p className="panel-description">{count} objeto(s) selecionado(s)</p>
    <div className="layout-buttons">
      {([['front', 'Trazer à frente'], ['back', 'Enviar ao fundo'], ['forward', 'Avançar camada'], ['backward', 'Recuar camada']] as const).map(([action, label]) => <button key={action} disabled={!count} onClick={() => onLayer(action)}>{label}</button>)}
    </div>
    <label htmlFor="alignment-reference">Alinhar em relação à</label>
    <select id="alignment-reference" className="text-property" value={reference} onChange={event => setReference(event.target.value)}><option value="selection">Seleção</option><option value="canvas">Página</option></select>
    <div className="layout-buttons">
      {([['left', 'Esquerda'], ['center', 'Centro horizontal'], ['right', 'Direita'], ['top', 'Topo'], ['middle', 'Centro vertical'], ['bottom', 'Base']] as const).map(([alignment, label]) => <button key={alignment} disabled={reference === 'canvas' ? count < 1 : count < 2} onClick={() => onAlign(alignment, reference === 'canvas')}>{label}</button>)}
      <button disabled={count < 3} onClick={() => onDistribute('x')}>Distribuir horizontal</button>
      <button disabled={count < 3} onClick={() => onDistribute('y')}>Distribuir vertical</button>
    </div>
    <p className="panel-description">Distribuir iguala os espaços entre 3 ou mais objetos, mantendo os extremos.</p>
  </div>;
}
