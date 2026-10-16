import { Image, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { snapAxis } from "../utils/snap";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { CanvasSize, EditorElement } from "../types/editor";

import type Konva from "konva";

interface PDVCanvasProps {
  onSelectMany?: (ids: string[]) => void;
  onImagesReady?: (ready: boolean) => void;
  backgroundImage?: HTMLImageElement;
  stageRef: React.RefObject<Konva.Stage | null>;
  size: CanvasSize;
  zoom: number;

  elements: EditorElement[];

  selectedIds: string[];
  onChangeElements: (changes: { id: string; x: number; y: number }[]) => void;

  backgroundColor: string;

  onSelect: (id: string | null, additive?: boolean) => void;

  onChangeElement: (id: string, changes: Partial<EditorElement>) => void;
}

function PDVCanvas({
  onSelectMany,
  onImagesReady,
  backgroundImage,
  stageRef,
  size,
  zoom,
  elements,
  selectedIds,
  onChangeElements,
  backgroundColor,
  onSelect,
  onChangeElement,
}: PDVCanvasProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const dragStart = useRef<EditorElement[]>([]);
  const dragBounds = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [imageCache, setImageCache] = useState<Record<string, HTMLImageElement>>({});
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const marqueeStart = useRef<{ x: number; y: number; initialIds: string[] } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const updateMarquee = useEffectEvent((event: MouseEvent, finish = false) => {
    const start = marqueeStart.current;
    const stage = stageRef.current;
    if (!start || !stage) return;
    const bounds = stage.container().getBoundingClientRect();
    const x = Math.max(0, Math.min(size.width, (event.clientX - bounds.left) / zoom));
    const y = Math.max(0, Math.min(size.height, (event.clientY - bounds.top) / zoom));
    const box = { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) };
    if (finish) {
      const ids = box.width * zoom >= 3 || box.height * zoom >= 3 ? elements.filter(element => {
        const node = nodes.current.get(element.id);
        if (!node) return false;
        const rect = node.getClientRect({ relativeTo: stage, skipShadow: true });
        return rect.x <= box.x + box.width && rect.x + rect.width >= box.x
          && rect.y <= box.y + box.height && rect.y + rect.height >= box.y;
      }).map(element => element.id) : [];
      onSelectMany?.([...new Set([...start.initialIds, ...ids])]);
      marqueeStart.current = null;
      setMarquee(null);
    } else setMarquee(box);
  });

  useEffect(() => {
    const move = (event: MouseEvent) => updateMarquee(event);
    const finish = (event: MouseEvent) => updateMarquee(event, true);
    const cancel = () => { marqueeStart.current = null; setMarquee(null); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", finish);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  function moveSelection(element: EditorElement, node: Konva.Node) {
    const group = dragStart.current;
    if (!group.length) return [];
    const { x: left, y: top, width, height } = dragBounds.current;
    const origin = group.find(item => item.id === element.id)!;
    const x = snapAxis(left + node.x() - origin.x, width, size.width, zoom);
    const y = snapAxis(top + node.y() - origin.y, height, size.height, zoom);
    const offset = { x: x.position - left, y: y.position - top };
    const changes = group.map(item => ({ id: item.id, x: item.x + offset.x, y: item.y + offset.y }));
    changes.forEach(change => nodes.current.get(change.id)?.position({ x: change.x, y: change.y }));
    setDragOffset(offset);
    setGuides({ x: x.guide, y: y.guide });
    return changes;
  }

  function dragHandlers(element: EditorElement) {
    return {
      onDragStart: () => {
        const ids = selectedIds.includes(element.id) ? selectedIds : [element.id];
        if (!selectedIds.includes(element.id)) onSelect(element.id);
        dragStart.current = elements.filter(item => ids.includes(item.id)).map(item => ({ ...item }));
        const bounds = dragStart.current.map(item =>
          nodes.current.get(item.id)?.getClientRect({ relativeTo: stageRef.current!, skipStroke: true, skipShadow: true })
          ?? { x: item.x, y: item.y, width: item.width, height: item.height });
        const left = Math.min(...bounds.map(box => box.x));
        const top = Math.min(...bounds.map(box => box.y));
        dragBounds.current = {
          x: left, y: top,
          width: Math.max(...bounds.map(box => box.x + box.width)) - left,
          height: Math.max(...bounds.map(box => box.y + box.height)) - top,
        };
        setDragOffset({ x: 0, y: 0 });
      },
      onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => { moveSelection(element, event.target); },
      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
        const changes = moveSelection(element, event.target);
        setGuides({ x: null, y: null });
        setDragOffset({ x: 0, y: 0 });
        dragStart.current = [];
        if (changes.length) onChangeElements(changes);
      },
    };
  }

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = selectedIds.length === 1 ? nodes.current.get(selectedIds[0]) : undefined;
    transformer?.nodes(node ? [node] : []);
    transformer?.getLayer()?.batchDraw();
  }, [selectedIds, elements, imageCache]);

  useEffect(() => {
    onImagesReady?.(elements.every(element => element.type !== "image" || Boolean(element.imageUrl && imageCache[element.imageUrl])));
  }, [elements, imageCache, onImagesReady]);

  // Carregar imagens quando necessário
  useEffect(() => {
    const imagesToLoad = elements.filter(e => e.type === "image" && e.imageUrl);
    
    imagesToLoad.forEach(element => {
      if (element.imageUrl && !imageCache[element.imageUrl]) {
        const url = element.imageUrl;
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setImageCache(prev => ({
            ...prev,
            [url]: img
          }));
        };
        img.src = element.imageUrl;
      }
    });
  }, [elements, imageCache]);

  function handleTransformEnd(element: EditorElement, node: Konva.Node) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const rotating = transformerRef.current?.getActiveAnchor() === "rotater";
    const newWidth = rotating ? element.width : Math.max(20, Math.round(element.width * scaleX * 100) / 100);
    const newHeight = rotating ? element.height : Math.max(20, Math.round(element.height * scaleY * 100) / 100);

    onChangeElement(element.id, {
      x: node.x(),
      y: node.y(),
      width: newWidth,
      height: newHeight,
      rotation: node.rotation(),
    });
  }

  return (
    <div
      id="canvas-container"
      tabIndex={0}
      aria-label="Área de edição. Use as setas para mover o objeto selecionado e Shift para mover 10 pixels."
      onMouseDown={(event) => event.currentTarget.focus({ preventScroll: true })}
      style={{
        width: size.width * zoom,
        height: size.height * zoom,
        background: backgroundColor,
        boxShadow: "0 5px 20px rgba(0,0,0,0.18)",
        flexShrink: 0,
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width * zoom}
        height={size.height * zoom}
        scaleX={zoom}
        scaleY={zoom}
        style={{
          width: size.width * zoom,
          height: size.height * zoom,
        }}
        onMouseDown={(event) => {
          const stage = event.target.getStage();
          if (event.target === stage && event.evt.button === 0) {
            const point = stage.getPointerPosition();
            if (onSelectMany && point) {
              const additive = event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey;
              marqueeStart.current = { x: point.x / zoom, y: point.y / zoom, initialIds: additive ? selectedIds : [] };
              setMarquee({ x: point.x / zoom, y: point.y / zoom, width: 0, height: 0 });
              if (!additive) onSelectMany([]);
            } else onSelect(null);
          }
        }}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fill={backgroundColor}
            listening={false}
          />

          {backgroundImage && <Image image={backgroundImage} width={size.width} height={size.height} listening={false} />}
          {/* Elements */}
          {elements.map((element) => {


            // TEXT
            if (element.type === "text") {
              return (
                <Text
                  key={element.id}
                  ref={(node) => {
                    if (node) nodes.current.set(element.id, node);
                    else nodes.current.delete(element.id);
                  }}
                  rotation={element.rotation ?? 0}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  text={element.text ?? "Texto"}
                  align={element.textAlign ?? "left"}
                  fontSize={element.fontSize ?? 32}
                  fontFamily={element.fontFamily ?? "Arial, sans-serif"}
                  fontStyle={`${element.fontWeight ?? "normal"} ${element.fontStyle ?? "normal"}`}
                  fill={element.fill}
                  stroke={element.stroke}
                  strokeWidth={element.strokeWidth ?? 0}
                  draggable
                  onClick={(event) => onSelect(element.id, event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey)}
                  onTap={() => onSelect(element.id)}
                  {...dragHandlers(element)}
                  onTransformEnd={(event) => {
                    handleTransformEnd(element, event.target);
                  }}
                />
              );
            }

            // RECTANGLE
            if (element.type === "rectangle") {
              return (
                <Rect
                  key={element.id}
                  ref={(node) => {
                    if (node) nodes.current.set(element.id, node);
                    else nodes.current.delete(element.id);
                  }}
                  rotation={element.rotation ?? 0}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  fill={element.fill}
                  stroke={element.stroke ?? "transparent"}
                  strokeWidth={element.strokeWidth ?? 0}
                  cornerRadius={element.cornerRadius ?? 0}
                  draggable
                  onClick={(event) => onSelect(element.id, event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey)}
                  onTap={() => onSelect(element.id)}
                  {...dragHandlers(element)}
                  onTransformEnd={(event) => {
                    handleTransformEnd(element, event.target);
                  }}
                />
              );
            }

            // FIELD
            if (element.type === "field") {
              return (
                <Rect
                  key={element.id}
                  ref={(node) => {
                    if (node) nodes.current.set(element.id, node);
                    else nodes.current.delete(element.id);
                  }}
                  rotation={element.rotation ?? 0}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  fill={element.fill}
                  stroke={element.stroke ?? "#999999"}
                  strokeWidth={element.strokeWidth ?? 1}
                  cornerRadius={element.cornerRadius ?? 0}
                  draggable
                  onClick={(event) => onSelect(element.id, event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey)}
                  onTap={() => onSelect(element.id)}
                  {...dragHandlers(element)}
                  onTransformEnd={(event) => {
                    handleTransformEnd(element, event.target);
                  }}
                />
              );
            }

            // IMAGE
            if (element.type === "image" && element.imageUrl && imageCache[element.imageUrl]) {
              return (
                <Image
                  key={element.id}
                  ref={(node) => {
                    if (node) nodes.current.set(element.id, node);
                    else nodes.current.delete(element.id);
                  }}
                  rotation={element.rotation ?? 0}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  image={imageCache[element.imageUrl]}
                  draggable
                  onClick={(event) => onSelect(element.id, event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey)}
                  onTap={() => onSelect(element.id)}
                  {...dragHandlers(element)}
                  onTransformEnd={(event) => {
                    handleTransformEnd(element, event.target);
                  }}
                />
              );
            }

            // BORDER
            if (element.type === "border") {
              return (
                <Rect
                  key={element.id}
                  ref={(node) => {
                    if (node) nodes.current.set(element.id, node);
                    else nodes.current.delete(element.id);
                  }}
                  rotation={element.rotation ?? 0}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  fill="transparent"
                  stroke={element.stroke ?? "#000000"}
                  strokeWidth={element.strokeWidth ?? 2}
                  draggable
                  onClick={(event) => onSelect(element.id, event.evt.ctrlKey || event.evt.metaKey || event.evt.shiftKey)}
                  onTap={() => onSelect(element.id)}
                  {...dragHandlers(element)}
                  onTransformEnd={(event) => {
                    handleTransformEnd(element, event.target);
                  }}
                />
              );
            }

            return null;
          })}

          {guides.x !== null && (
            <Line name="snap-guide" points={[guides.x, 0, guides.x, size.height]}
              stroke="#e11d48" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} listening={false} />
          )}
          {guides.y !== null && (
            <Line name="snap-guide" points={[0, guides.y, size.width, guides.y]}
              stroke="#e11d48" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} listening={false} />
          )}

          {selectedIds.length > 1 && elements.filter(element => selectedIds.includes(element.id)).map(element => (
            <Rect key={`selection-${element.id}`} name="snap-guide"
              x={element.x + dragOffset.x} y={element.y + dragOffset.y}
              rotation={element.rotation ?? 0}
              width={element.width} height={element.height}
              stroke="#2563eb" strokeWidth={1 / zoom} dash={[5 / zoom, 3 / zoom]}
              listening={false} />
          ))}
          {marquee && <Rect name="snap-guide" {...marquee} fill="rgba(37, 99, 235, 0.12)"
            stroke="#2563eb" strokeWidth={1 / zoom} dash={[5 / zoom, 3 / zoom]} listening={false} />}
          {/* Transformer */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            flipEnabled={false}
            enabledAnchors={[
              "top-left",
              "top-center",
              "top-right",
              "middle-left",
              "middle-right",
              "bottom-left",
              "bottom-center",
              "bottom-right",
            ]}
            anchorSize={12}
            borderStroke="#2563eb"
            anchorStroke="#2563eb"
            anchorFill="#ffffff"
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}

export default PDVCanvas;

