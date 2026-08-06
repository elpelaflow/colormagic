import type { PaletteDto } from '../../dtos/palette.dto';

export default defineEventHandler(async (event): Promise<PaletteDto> => {
  const { palette } = getModules();
  const params = await palette.validation.getInputParams(event);
  const response = await palette.service.getById(params.id);

  return response;
});
