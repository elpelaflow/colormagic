import type { PaletteDto } from '../../dtos/palette.dto';

export default defineEventHandler(async (event): Promise<PaletteDto> => {
  const { palette } = getModules();
  const body = await palette.validation.getCreateInputBody(event);
  const response = await palette.service.create(body.prompt);

  return response;
});
