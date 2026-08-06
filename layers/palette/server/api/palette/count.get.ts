import type { CountPaletteDto } from '../../dtos/palette.dto';

/** @description cache this endpoint so it only updates every 5 minutes */
export default defineCachedEventHandler(async (): Promise<CountPaletteDto> => {
  const { palette } = getModules();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const response = await palette.service.count(twentyFourHoursAgo);

  return {
    count: response
  };
}, { maxAge: 60 * 5 });
