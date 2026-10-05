/** Единый набор SVG-иконок вместо эмодзи (4.1). Толщина линий общая. */
const paths = {
  chevronDown: 'M5 8l5 5 5-5',
  chevronRight: 'M8 5l5 5-5 5',
  plus: 'M10 4v12M4 10h12',
  search: 'M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3zM13.5 13.5L17 17',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  panelLeft: 'M3 4h14v12H3zM8 4v12',
  sun: 'M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 1v2M10 17v2M3.5 3.5l1.5 1.5M15 15l1.5 1.5M1 10h2M17 10h2M3.5 16.5L5 15M15 5l1.5-1.5',
  moon: 'M16 11.5A6.5 6.5 0 0 1 8.5 4a6.5 6.5 0 1 0 7.5 7.5z',
  monitor: 'M3 4h14v9H3zM7 17h6M10 13v4',
  send: 'M3 10l14-6-6 14-2.5-5.5z',
  paperclip:
    'M14 9l-4.5 4.5a3 3 0 0 1-4.2-4.2L10 4.5a2 2 0 1 1 2.8 2.8l-5 5a1 1 0 0 1-1.4-1.4L11 6.5',
  close: 'M5 5l10 10M15 5L5 15',
  share: 'M10 3v9M6.5 6.5L10 3l3.5 3.5M4 12v4h12v-4',
  files: 'M4 3h6l3 3v11H4zM10 3v3h3',
  memory:
    'M6 4h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM7.5 7.5h5M7.5 10h5M7.5 12.5h3',
  bookmark: 'M5 3h10v14l-5-3.5L5 17z',
  chat: 'M3 5h14v9H8l-4 3v-3H3z',
  message: 'M4 4h12v9H9l-3 3v-3H4zM7 7.5h6M7 10h4',
  check: 'M4 10.5l4 4 8-9',
  alert: 'M10 3l7 13H3zM10 8v3.5M10 13.5h.01',
  users:
    'M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 16v-1.5A3.5 3.5 0 0 1 6 11h2a3.5 3.5 0 0 1 3.5 3.5V16M13 4.5a2.5 2.5 0 0 1 0 5M17.5 16v-1.5A3.5 3.5 0 0 0 15 11.2',
  stop: 'M6 6h8v8H6z',
  refresh: 'M16 10a6 6 0 1 1-1.9-4.4M16.5 3v3.5H13',
  sliders: 'M4 6h8M15 6h1M4 14h3M10 14h6M12 4v4M8 12v4',
  info: 'M10 9v5M10 6.5h.01M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
  chevronUp: 'M5 12l5-5 5 5',
  trash: 'M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10M9 9v4M11 9v4',
  copy: 'M7 7h9v9H7zM4 13V4h9',
  lock: 'M6 9V7a4 4 0 0 1 8 0v2M5 9h10v8H5zM10 12v2',
  keyboard:
    'M3.5 5h13A1.5 1.5 0 0 1 18 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 13.5v-7A1.5 1.5 0 0 1 3.5 5zM5.5 8h.01M8.5 8h.01M11.5 8h.01M14.5 8h.01M6.5 12h7',
  workspace:
    'M3 6.5A1.5 1.5 0 0 1 4.5 5h3L9 7h6.5A1.5 1.5 0 0 1 17 8.5v5A1.5 1.5 0 0 1 15.5 15h-11A1.5 1.5 0 0 1 3 13.5z',
  branch:
    'M6 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM6 8v6M14 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM14 12V9a3 3 0 0 0-3-3H8.5',
  pencil: 'M13.5 3.5l3 3L7 16l-4 1 1-4z',
  expand: 'M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6',
  tasks: 'M4 4h12v12H4zM7 8.5l1.5 1.5L12 6.5M7 13.5h6',
} as const;

export type IconName = keyof typeof paths;

export interface IconProps {
  name: IconName;
  size?: 16 | 20;
  /** Толщина линии; по умолчанию 1.5. Точечные иконки («more») можно сделать заметнее. */
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 20, strokeWidth = 1.5, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
