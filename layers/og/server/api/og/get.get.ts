export default defineEventHandler(async (event) => {
  const { og } = getModules();
  const query = await og.validation.getInputQuery(event);

  const response = await og.service.generateImage(
    query.colors.split(':'),
    query.text
  );

  setResponseHeader(event, 'Content-Type', 'image/png');

  return response;
});
