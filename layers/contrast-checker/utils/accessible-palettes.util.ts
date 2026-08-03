export interface AccessiblePalette {
  id: string
  label: string
  primary: string
  secondary: string
  ratio: number
  level: 'AA' | 'AAA'
}

// Combinaciones de colores accesibles pre-validadas (ratio >= AA).
// Los ratios fueron verificados con calculateContrastRatio.
// primary = foreground/text, secondary = background.
export const ACCESSIBLE_PALETTES: AccessiblePalette[] = [
  { id: 'black-on-white', label: 'Black on White', primary: '#000000', secondary: '#FFFFFF', ratio: 21.00, level: 'AAA' },
  { id: 'white-on-black', label: 'White on Black', primary: '#FFFFFF', secondary: '#000000', ratio: 21.00, level: 'AAA' },
  { id: 'white-on-slate', label: 'White on Slate', primary: '#FFFFFF', secondary: '#0F172A', ratio: 17.85, level: 'AAA' },
  { id: 'black-on-yellow', label: 'Black on Yellow', primary: '#000000', secondary: '#FACC15', ratio: 13.71, level: 'AAA' },
  { id: 'black-on-orange', label: 'Black on Orange', primary: '#000000', secondary: '#F97316', ratio: 7.49, level: 'AAA' },
  { id: 'white-on-blue', label: 'White on Blue', primary: '#FFFFFF', secondary: '#1D4ED8', ratio: 6.70, level: 'AA' },
  { id: 'white-on-red', label: 'White on Red', primary: '#FFFFFF', secondary: '#B91C1C', ratio: 6.47, level: 'AA' },
  { id: 'white-on-violet', label: 'White on Violet', primary: '#FFFFFF', secondary: '#7C3AED', ratio: 5.70, level: 'AA' }
];
