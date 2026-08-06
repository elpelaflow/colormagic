export default defineNuxtConfig({
  runtimeConfig: {
    mongo: {
      url: process.env.MONGO_URL ?? 'mongodb://magicolor:secret@localhost:27018/magicolor?authSource=admin'
    }
  }
});
