export type ElementType =
  | "text"
  | "rectangle"
  | "field"
  | "image"
  | "border";

export interface EditorElement {
  id: string;
  type: ElementType;

  x: number;
  y: number;

  width: number;
  height: number;
  rotation?: number;

  fill: string;

  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;

  text?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  
  imageUrl?: string;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ProjectData {
  name: string;
  resolution: string;
  zoom: number;
  backgroundColor: string;
  elements: EditorElement[];
}
