/**
 * Util de la tool "Complementary Color".
 *
 * El complementario clásico es el hue opuesto en la rueda de color: hue + 180°.
 * `hex -> RGB -> HSV -> h' = (h + 180) % 360 -> RGB -> hex`, reutilizando las
 * conversiones canónicas del repo.
 */
import { hexToRgb, rgbToHex } from '~/layers/common/utils/color-converter.util';
import { rgbToHsv, hsvToRgb } from '~/layers/all-colors/utils/color-formats.util';

/** Devuelve el color complementario de un hex (hue + 180°, mismo s/v). */
export function getComplementaryHex(hex: string): string {
  const hsv = rgbToHsv(hexToRgb(hex));
  const complementary = { h: (hsv.h + 180) % 360, s: hsv.s, v: hsv.v };
  return rgbToHex(hsvToRgb(complementary));
}
