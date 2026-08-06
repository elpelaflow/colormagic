export default defineEventHandler(async (event): Promise<void> => {
  const { feedback } = getModules();
  const body = await feedback.validation.getCreateInputBody(event);

  await feedback.service.create(body.email, body.feedback);

  setResponseStatus(event, 201);
});
