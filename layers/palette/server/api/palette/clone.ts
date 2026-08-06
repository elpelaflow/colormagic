import type { PaletteDto } from '../../dtos/palette.dto';

export default defineEventHandler(async (event): Promise<PaletteDto> => {
  const { palette } = getModules();
  const body = await palette.validation.getCloneInputBody(event);
  const response = await palette.service.cloneById(body.id, body.colors);

  return response;
});
