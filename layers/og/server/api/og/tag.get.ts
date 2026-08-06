export default defineEventHandler(async (event) => {
  const { og } = getModules();
  const query = await og.validation.getTagQuery(event);

  const response = await og.service.generateGridImageFromTags(
    query.tag.toLowerCase(),
    query.text
  );

  setResponseHeader(event, 'Content-Type', 'image/png');

  return response;
});
