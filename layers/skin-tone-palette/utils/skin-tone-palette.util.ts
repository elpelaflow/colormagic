/**
 * Skin Tone Color Palette — dataset de 48 tonos de piel.
 *
 * Referencia inclusiva agrupada de claro → oscuro, con undertone por muestra.
 * Los nombres son labels descriptivos de tono (basados en hue/lightness, no en
 * etnicidad) ofrecidos como paleta práctica de partida: el espectro de piel es
 * continuo y cada muestra admite ajustes de undertone, saturación y luz.
 *
 * Undertones normalizados a 7 categorías i18n:
 *   coolPink (Cool/Pink) · neutral (Neutral) · warm (Warm) ·
 *   warmPeach (Warm/Peach) · warmGolden (Warm/Golden) · olive (Olive) ·
 *   red (Red, Red/Warm, Warm/Red)
 */

export type SkinUndertone = 'coolPink' | 'neutral' | 'warm' | 'warmPeach' | 'warmGolden' | 'olive' | 'red';

export interface SkinTone {
  /** Nombre del tono (Porcelain, Ivory...), se muestra tal cual en todos los idiomas. */
  name: string;
  undertone: SkinUndertone;
  hex: string;
}

export interface SkinToneGroup {
  id: string;
  /** Clave i18n del título del grupo. */
  titleKey: string;
  /** Clave i18n de la descripción del grupo. */
  descriptionKey: string;
  tones: SkinTone[];
}

export const SKIN_TONE_GROUPS: SkinToneGroup[] = [
  {
    id: 'fair-porcelain',
    titleKey: 'skinTonePalette.groupTitles[0]',
    descriptionKey: 'skinTonePalette.groupDescriptions[0]',
    tones: [
      { name: 'Porcelain', undertone: 'coolPink', hex: '#FDE7DA' },
      { name: 'Ivory', undertone: 'neutral', hex: '#F6E0CE' },
      { name: 'Alabaster', undertone: 'neutral', hex: '#F3E1D2' },
      { name: 'Seashell', undertone: 'warmPeach', hex: '#F7D9C4' },
      { name: 'Rose Beige', undertone: 'coolPink', hex: '#F1CDBB' },
      { name: 'Warm Ivory', undertone: 'warmGolden', hex: '#F0D3B4' },
      { name: 'Peach Cream', undertone: 'warmPeach', hex: '#F5C9A6' },
      { name: 'Cool Shell', undertone: 'coolPink', hex: '#F2D5CF' }
    ]
  },
  {
    id: 'light',
    titleKey: 'skinTonePalette.groupTitles[1]',
    descriptionKey: 'skinTonePalette.groupDescriptions[1]',
    tones: [
      { name: 'Sand', undertone: 'warmGolden', hex: '#EAC1A0' },
      { name: 'Nude', undertone: 'neutral', hex: '#E7BE9A' },
      { name: 'Fair Beige', undertone: 'neutral', hex: '#E3B592' },
      { name: 'Blush Beige', undertone: 'coolPink', hex: '#E6B8A2' },
      { name: 'Light Honey', undertone: 'warmGolden', hex: '#E0AF82' },
      { name: 'Bisque', undertone: 'warm', hex: '#E8C4A0' },
      { name: 'Soft Tan', undertone: 'neutral', hex: '#DDAE8A' },
      { name: 'Buff', undertone: 'warmGolden', hex: '#E2B98F' }
    ]
  },
  {
    id: 'medium-olive',
    titleKey: 'skinTonePalette.groupTitles[2]',
    descriptionKey: 'skinTonePalette.groupDescriptions[2]',
    tones: [
      { name: 'Beige', undertone: 'neutral', hex: '#D6A07A' },
      { name: 'Light Olive', undertone: 'olive', hex: '#C9A66B' },
      { name: 'Golden Beige', undertone: 'warmGolden', hex: '#D2A06B' },
      { name: 'Warm Sand', undertone: 'warm', hex: '#CE9E76' },
      { name: 'Honey', undertone: 'warmGolden', hex: '#C68E5F' },
      { name: 'Olive', undertone: 'olive', hex: '#B8945F' },
      { name: 'Natural Tan', undertone: 'neutral', hex: '#C08A5E' },
      { name: 'Wheat', undertone: 'warm', hex: '#CF9F78' }
    ]
  },
  {
    id: 'tan-caramel',
    titleKey: 'skinTonePalette.groupTitles[3]',
    descriptionKey: 'skinTonePalette.groupDescriptions[3]',
    tones: [
      { name: 'Caramel', undertone: 'warm', hex: '#B5794E' },
      { name: 'Toffee', undertone: 'warmGolden', hex: '#AC7248' },
      { name: 'Amber', undertone: 'warm', hex: '#B07C4E' },
      { name: 'Bronze', undertone: 'warm', hex: '#A66E43' },
      { name: 'Golden Brown', undertone: 'warmGolden', hex: '#A87545' },
      { name: 'Warm Almond', undertone: 'neutral', hex: '#9E6F4C' },
      { name: 'Chestnut', undertone: 'red', hex: '#96603A' },
      { name: 'Copper', undertone: 'red', hex: '#A76B40' }
    ]
  },
  {
    id: 'brown-cocoa',
    titleKey: 'skinTonePalette.groupTitles[4]',
    descriptionKey: 'skinTonePalette.groupDescriptions[4]',
    tones: [
      { name: 'Almond', undertone: 'neutral', hex: '#8B5A2B' },
      { name: 'Cocoa', undertone: 'warm', hex: '#825A3A' },
      { name: 'Walnut', undertone: 'neutral', hex: '#7A4E2E' },
      { name: 'Umber', undertone: 'warm', hex: '#6F4423' },
      { name: 'Coffee', undertone: 'neutral', hex: '#6B4226' },
      { name: 'Mahogany', undertone: 'red', hex: '#6A3B28' },
      { name: 'Deep Amber', undertone: 'warmGolden', hex: '#75482A' },
      { name: 'Hazel Brown', undertone: 'neutral', hex: '#7E5236' }
    ]
  },
  {
    id: 'deep-rich',
    titleKey: 'skinTonePalette.groupTitles[5]',
    descriptionKey: 'skinTonePalette.groupDescriptions[5]',
    tones: [
      { name: 'Espresso', undertone: 'warm', hex: '#5C3A21' },
      { name: 'Chocolate', undertone: 'neutral', hex: '#4E3220' },
      { name: 'Mocha', undertone: 'warm', hex: '#4A2F1B' },
      { name: 'Deep Cocoa', undertone: 'neutral', hex: '#3F2A1A' },
      { name: 'Rich Umber', undertone: 'red', hex: '#3B2416' },
      { name: 'Ebony', undertone: 'neutral', hex: '#2E1D12' },
      { name: 'Deep Espresso', undertone: 'warm', hex: '#2A1A10' },
      { name: 'Onyx Brown', undertone: 'neutral', hex: '#241610' }
    ]
  }
];

/** Los 48 hex en orden claro → oscuro, para "Copy all". */
export const ALL_SKIN_TONE_HEXES: string[] = SKIN_TONE_GROUPS.flatMap(group => group.tones.map(tone => tone.hex));
