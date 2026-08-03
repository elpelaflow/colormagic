import { hexToRgb } from '~/layers/palette/utils/color-converter.util';
import { calculateContrastRatio } from '~/layers/contrast-checker/utils/color-contrast.util';

function parseHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

function ratioToBadge(ratio: number, thresholds: [number, number]): string {
  if (ratio < thresholds[0]) {
    return 'Fail';
  }
  if (ratio < thresholds[1]) {
    return 'AA';
  }
  return 'AAA';
}

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const primaryRaw = String(query.primary ?? '');
  const secondaryRaw = String(query.secondary ?? '');

  const primary = parseHex(primaryRaw);
  const secondary = parseHex(secondaryRaw);

  if (primary === null || secondary === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid hex colors. Use ?primary=#RRGGBB&secondary=#RRGGBB'
    });
  }

  const rgbPrimary = hexToRgb(primary);
  const rgbSecondary = hexToRgb(secondary);
  const contrastRatio = calculateContrastRatio(
    [rgbPrimary.r, rgbPrimary.g, rgbPrimary.b],
    [rgbSecondary.r, rgbSecondary.g, rgbSecondary.b]
  );

  return {
    primary,
    secondary,
    contrastRatio: Number(contrastRatio.toFixed(2)),
    wcag: {
      normalText: ratioToBadge(contrastRatio, [4.5, 7]),
      largeText: ratioToBadge(contrastRatio, [3, 4.5]),
      uiComponents: contrastRatio >= 3 ? 'AA' : 'Fail'
    }
  };
});
