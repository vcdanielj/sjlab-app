export type OrderColorStandard = 'vita-classical' | 'bleach' | 'coral';

export interface OrderColorOption {
  value: string;
  standard: OrderColorStandard;
  code: string;
  name: string;
  hex: string;
}

const VITA_CLASSICAL: OrderColorOption[] = [
  { value: 'vita-classical:A1', standard: 'vita-classical', code: 'A1', name: 'Rojizo-marron muy claro', hex: '#EAE3D9' },
  { value: 'vita-classical:A2', standard: 'vita-classical', code: 'A2', name: 'Rojizo-marron claro', hex: '#E3D5C4' },
  { value: 'vita-classical:A3', standard: 'vita-classical', code: 'A3', name: 'Rojizo-marron medio', hex: '#DDC5A9' },
  { value: 'vita-classical:A3.5', standard: 'vita-classical', code: 'A3.5', name: 'Rojizo-marron oscuro', hex: '#D0B18D' },
  { value: 'vita-classical:A4', standard: 'vita-classical', code: 'A4', name: 'Rojizo-marron muy oscuro', hex: '#C09D76' },
  { value: 'vita-classical:B1', standard: 'vita-classical', code: 'B1', name: 'Rojizo-amarillento muy claro', hex: '#EFE8D6' },
  { value: 'vita-classical:B2', standard: 'vita-classical', code: 'B2', name: 'Rojizo-amarillento claro', hex: '#E5D8B8' },
  { value: 'vita-classical:B3', standard: 'vita-classical', code: 'B3', name: 'Rojizo-amarillento medio', hex: '#D8C39B' },
  { value: 'vita-classical:B4', standard: 'vita-classical', code: 'B4', name: 'Rojizo-amarillento oscuro', hex: '#CCA97A' },
  { value: 'vita-classical:C1', standard: 'vita-classical', code: 'C1', name: 'Grisaceo claro', hex: '#DFD7CB' },
  { value: 'vita-classical:C2', standard: 'vita-classical', code: 'C2', name: 'Grisaceo medio', hex: '#CFC1AF' },
  { value: 'vita-classical:C3', standard: 'vita-classical', code: 'C3', name: 'Grisaceo oscuro', hex: '#BBA891' },
  { value: 'vita-classical:C4', standard: 'vita-classical', code: 'C4', name: 'Grisaceo muy oscuro', hex: '#AA957B' },
  { value: 'vita-classical:D2', standard: 'vita-classical', code: 'D2', name: 'Rojizo-grisaceo claro', hex: '#DFD3C3' },
  { value: 'vita-classical:D3', standard: 'vita-classical', code: 'D3', name: 'Rojizo-grisaceo medio', hex: '#D0BEA7' },
  { value: 'vita-classical:D4', standard: 'vita-classical', code: 'D4', name: 'Rojizo-grisaceo oscuro', hex: '#C7B298' },
];

const BLEACH: OrderColorOption[] = [
  { value: 'bleach:BL1', standard: 'bleach', code: 'BL1', name: 'Blanco extremo', hex: '#F8F7F5' },
  { value: 'bleach:BL2', standard: 'bleach', code: 'BL2', name: 'Blanco muy brillante', hex: '#F4F2EC' },
  { value: 'bleach:BL3', standard: 'bleach', code: 'BL3', name: 'Blanco brillante', hex: '#F0EBE0' },
  { value: 'bleach:BL4', standard: 'bleach', code: 'BL4', name: 'Blanco natural', hex: '#EBE3D3' },
];

const CORAL: OrderColorOption[] = [
  { value: 'coral:59', standard: 'coral', code: '59', name: 'Tono mas claro y brillante', hex: '#EBEAD2' },
  { value: 'coral:62', standard: 'coral', code: '62', name: 'Tono claro natural', hex: '#E3DFB4' },
  { value: 'coral:65', standard: 'coral', code: '65', name: 'Tono amarillo claro', hex: '#DFDBA2' },
  { value: 'coral:66', standard: 'coral', code: '66', name: 'Tono amarillo medio', hex: '#E5E0AA' },
  { value: 'coral:67', standard: 'coral', code: '67', name: 'Tono grisaceo', hex: '#DDD69D' },
  { value: 'coral:69', standard: 'coral', code: '69', name: 'Tono marron claro', hex: '#DCD49A' },
  { value: 'coral:77', standard: 'coral', code: '77', name: 'Tono castano rojizo', hex: '#DBCE8B' },
  { value: 'coral:81', standard: 'coral', code: '81', name: 'Tono marron oscuro', hex: '#D4C479' },
];

const LEGACY_COLOR_ALIASES: Record<string, string> = {
  'coral:CORAL': 'coral:59',
  'coral:LIGHT': 'coral:62',
  'coral:OPAL': 'coral:65',
  'coral:DARK': 'coral:81',
};

export const ORDER_COLOR_OPTIONS: OrderColorOption[] = [
  ...VITA_CLASSICAL,
  ...BLEACH,
  ...CORAL,
];

export const ORDER_COLOR_STANDARDS: Array<{ value: OrderColorStandard; label: string }> = [
  { value: 'vita-classical', label: 'Vita Classical' },
  { value: 'bleach', label: 'Bleach' },
  { value: 'coral', label: 'Coral' },
];

export function isValidOrderColor(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalizedValue = LEGACY_COLOR_ALIASES[value] ?? value;
  return ORDER_COLOR_OPTIONS.some((option) => option.value === normalizedValue);
}

export function getOrderColorOption(value: string | null | undefined): OrderColorOption | null {
  if (!value) return null;
  const normalizedValue = LEGACY_COLOR_ALIASES[value] ?? value;
  return ORDER_COLOR_OPTIONS.find((option) => option.value === normalizedValue) ?? null;
}
