import type { ListPaletteDto } from '../../dtos/palette.dto';

export default defineEventHandler(async (event): Promise<ListPaletteDto> => {
  const { palette } = getModules();
  const body = await palette.validation.getListInputBody(event);
  const response = await palette.service.list(body.page, body.size, body.filter);

  return response;
});
