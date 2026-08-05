// One 24px-grid stroke icon per catalog IconKey. Inspired by the visual
// language reviewed in La-Forja-Especificaciones/prototipos/forja-app.html
// (icon per component type, single stroke weight) but every path here is
// authored fresh for the engine's 21-type closed catalog, not copied.
import type { IconKey } from '../../../lib/forja/canvas/catalog-ui'

type Shape =
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number }
  | { tag: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { tag: 'line'; x1: number; y1: number; x2: number; y2: number }

const ICONS: Record<IconKey, Shape[]> = {
  person: [
    { tag: 'circle', cx: 12, cy: 8, r: 3 },
    { tag: 'path', d: 'M5 20c1.4-3.8 4.2-5.8 7-5.8s5.6 2 7 5.8' },
  ],
  'check-person': [
    { tag: 'circle', cx: 10, cy: 8, r: 3 },
    { tag: 'path', d: 'M3.5 20c1.2-3.4 3.8-5.2 6.5-5.2s5.3 1.8 6.5 5.2' },
    { tag: 'path', d: 'M15.5 13.8l1.6 1.6 3-3' },
  ],
  flow: [
    { tag: 'circle', cx: 6, cy: 12, r: 2 },
    { tag: 'circle', cx: 12, cy: 12, r: 2 },
    { tag: 'circle', cx: 18, cy: 12, r: 2 },
    { tag: 'line', x1: 8, y1: 12, x2: 10, y2: 12 },
    { tag: 'line', x1: 14, y1: 12, x2: 16, y2: 12 },
  ],
  handshake: [
    { tag: 'circle', cx: 9, cy: 12, r: 5 },
    { tag: 'circle', cx: 15, cy: 12, r: 5 },
  ],
  browser: [
    { tag: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
    { tag: 'line', x1: 3, y1: 9, x2: 21, y2: 9 },
  ],
  phone: [
    { tag: 'rect', x: 7, y: 2, width: 10, height: 20, rx: 2 },
    { tag: 'line', x1: 10, y1: 19, x2: 14, y2: 19 },
  ],
  'square-lines': [
    { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 3 },
    { tag: 'line', x1: 7, y1: 9, x2: 17, y2: 9 },
    { tag: 'line', x1: 7, y1: 12, x2: 17, y2: 12 },
    { tag: 'line', x1: 7, y1: 15, x2: 13, y2: 15 },
  ],
  gate: [
    { tag: 'path', d: 'M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z' },
    { tag: 'path', d: 'M9 12l2 2 4-4' },
  ],
  gear: [
    { tag: 'circle', cx: 12, cy: 12, r: 3 },
    { tag: 'line', x1: 12, y1: 2.5, x2: 12, y2: 5 },
    { tag: 'line', x1: 12, y1: 19, x2: 12, y2: 21.5 },
    { tag: 'line', x1: 2.5, y1: 12, x2: 5, y2: 12 },
    { tag: 'line', x1: 19, y1: 12, x2: 21.5, y2: 12 },
    { tag: 'line', x1: 5.4, y1: 5.4, x2: 7.1, y2: 7.1 },
    { tag: 'line', x1: 16.9, y1: 16.9, x2: 18.6, y2: 18.6 },
    { tag: 'line', x1: 18.6, y1: 5.4, x2: 16.9, y2: 7.1 },
    { tag: 'line', x1: 7.1, y1: 16.9, x2: 5.4, y2: 18.6 },
  ],
  spark: [{ tag: 'path', d: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z' }],
  cloud: [{ tag: 'path', d: 'M6 18h11a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 9.1 4 4 0 0 0 6 18Z' }],
  cylinder: [
    { tag: 'ellipse', cx: 12, cy: 6, rx: 8, ry: 3 },
    { tag: 'path', d: 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6' },
    { tag: 'path', d: 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' },
  ],
  bolt: [{ tag: 'path', d: 'M13 2 4 14h6l-1 8 9-11h-6l1-9Z' }],
  stack: [
    { tag: 'rect', x: 3, y: 5, width: 18, height: 4, rx: 1 },
    { tag: 'rect', x: 3, y: 10, width: 18, height: 4, rx: 1 },
    { tag: 'rect', x: 3, y: 15, width: 18, height: 4, rx: 1 },
  ],
  wave: [{ tag: 'path', d: 'M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0' }],
  cube: [
    { tag: 'path', d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z' },
    { tag: 'line', x1: 12, y1: 3, x2: 12, y2: 12 },
    { tag: 'line', x1: 4, y1: 7.5, x2: 12, y2: 12 },
    { tag: 'line', x1: 20, y1: 7.5, x2: 12, y2: 12 },
  ],
  globe: [
    { tag: 'circle', cx: 12, cy: 12, r: 9 },
    { tag: 'ellipse', cx: 12, cy: 12, rx: 4, ry: 9 },
    { tag: 'line', x1: 3, y1: 12, x2: 21, y2: 12 },
  ],
  key: [
    { tag: 'circle', cx: 8, cy: 12, r: 4 },
    { tag: 'line', x1: 11, y1: 12, x2: 21, y2: 12 },
    { tag: 'line', x1: 17, y1: 12, x2: 17, y2: 15 },
    { tag: 'line', x1: 20, y1: 12, x2: 20, y2: 14 },
  ],
  grid: [7, 12, 17].flatMap((cx) => [7, 12, 17].map((cy) => ({ tag: 'circle' as const, cx, cy, r: 1.1 }))),
  pulse: [{ tag: 'path', d: 'M3 12h4l2-6 3 12 2-9 1.5 3H21' }],
  dashed: [{ tag: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 3 }],
}

export interface IconProps {
  icon: IconKey
  className?: string
}

export function Icon({ icon, className }: IconProps) {
  const shapes = ICONS[icon]
  const dashed = icon === 'dashed'

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? '3 3' : undefined}
    >
      {shapes.map((shape, index) => {
        switch (shape.tag) {
          case 'path':
            return <path key={index} d={shape.d} />
          case 'circle':
            return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
          case 'ellipse':
            return <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
          case 'rect':
            return <rect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
          case 'line':
            return <line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} />
        }
      })}
    </svg>
  )
}
