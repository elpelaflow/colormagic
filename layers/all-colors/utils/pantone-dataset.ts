import { type Lab, deltaE2000, hexToRgb, rgbToLab } from './color-formats.util';
import pantoneData from './pantone-data.json';

export interface PantoneSwatch {
  code: string
  name: string
  category: PantoneCategory
  hex: string
}

export type PantoneCategory = 'Solid Coated' | 'Pastels & Neons' | 'Metallics';

export const PANTONE_DATASET: PantoneSwatch[] = pantoneData as PantoneSwatch[];

export interface PantoneMatch {
  swatch: PantoneSwatch
  deltaE: number
  lab: Lab
}

let cachedLab: Array<{ swatch: PantoneSwatch, lab: Lab }> | null = null;

function getDatasetLab(): Array<{ swatch: PantoneSwatch, lab: Lab }> {
  if (cachedLab === null) {
    cachedLab = PANTONE_DATASET.map(swatch => ({ swatch, lab: rgbToLab(hexToRgb(swatch.hex)) }));
  }
  return cachedLab;
}

export function findNearestPantones(hex: string, limit = 12): PantoneMatch[] {
  const targetLab = rgbToLab(hexToRgb(hex));
  const dataset = getDatasetLab();
  return dataset
    .map(({ swatch, lab }) => ({ swatch, deltaE: deltaE2000(targetLab, lab), lab }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, limit);
}
