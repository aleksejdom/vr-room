// Icon-Set für Hotspot-Marker. Die Glyphen sind stroke-basierte SVG-Fragmente
// (24x24 viewBox, Lucide-Stil) und werden sowohl im Panorama-Marker als auch
// im Icon-Picker des Editors gerendert.

export interface HotspotIconDef {
  id: string;
  label: string;
  /** Inner SVG markup, 24x24 viewBox, stroke="currentColor" wird vom Renderer gesetzt */
  svg: string;
}

export const HOTSPOT_ICONS: HotspotIconDef[] = [
  {
    // "arrow" ist der historische Default in der DB — rendert als Zielpunkt
    id: "arrow",
    label: "Punkt",
    svg: `<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>`,
  },
  {
    id: "arrow-up",
    label: "Pfeil",
    svg: `<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>`,
  },
  {
    id: "footprints",
    label: "Gehen",
    svg: `<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>`,
  },
  {
    id: "door",
    label: "Eingang",
    svg: `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>`,
  },
  {
    id: "info",
    label: "Info",
    svg: `<path d="M12 17v-6"/><path d="M12 8h.01"/>`,
  },
  {
    id: "question",
    label: "Frage",
    svg: `<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
  },
  {
    id: "link",
    label: "Link",
    svg: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  },
  {
    id: "play",
    label: "Video",
    svg: `<polygon points="7 4 20 12 7 20 7 4"/>`,
  },
  {
    id: "camera",
    label: "Foto",
    svg: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
  },
  {
    id: "pin",
    label: "Pin",
    svg: `<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
  },
  {
    id: "eye",
    label: "Ansicht",
    svg: `<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>`,
  },
  {
    id: "star",
    label: "Stern",
    svg: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  },
];

export function getHotspotIcon(id: string | null | undefined): HotspotIconDef {
  return HOTSPOT_ICONS.find((i) => i.id === id) ?? HOTSPOT_ICONS[0];
}
