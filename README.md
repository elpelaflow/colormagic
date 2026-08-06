[![Magicolor banner](./.github/assets/banner.png)](https://magicolor.app)

# 🎨 [Magicolor](https://magicolor.app)

Magicolor is a popular free and open-source color palette generator, with many side-tools for all things color. It's built with [Nuxt](https://nuxt.com), [NuxtUI](https://ui.nuxt.com) and typescript.

Magicolor gets around ~500k pageview per month, with 12K palettes generated daily. You can view our [live website analytics here](https://plausible.io/magicolor.app).

Most of the tools run with the assistance of AI using [openai](https://openai.com).

The site has translations for [english](https://magicolor.app), [japanese](https://magicolor.app/ja), [italian](https://magicolor.app/it) and [spanish](https://magicolor.app/es) using [nuxtjs/i18n](https://i18n.nuxtjs.org/).

## <a name="layers">🏗️ Layers</a>

Magicolor utilizes Nuxt's in-built layer system to separate domains of the app. 

Each layer creates it's own separate module ([example](/layers/palette/server/palette.module.ts)) which we then declare in the [setup util](/layers/setup/server/utils/setup.util.ts). The modules are then available to use globally.

## <a name="getting-started">🚀 Getting Started</a>

All of Magicolor's palettes are stored using MongoDB. Setup a local MongoDB instance by using the following:

```bash
docker compose up
```
For more details check out the [mongo layer](/layers/mongo/server/mongo.module.ts).

Create a .env in the root of the project and add the following values
```env
OPENAI_API_KEY=[sk_srf4s...]
```

Install dependencies
```bash
npm install
```

Run locally
```bash
npm run dev
```

## <a name="color-tools">🔧 Color Tools</a>

- 🎨 [Color Palette Generator](https://magicolor.app/)
- ❓ [Random Color generator](https://magicolor.app/random-color)
- 🖼️ [Image Color Picker](https://magicolor.app/image-color-picker)
- ☀️ [Contrast Checker](https://magicolor.app/contrast-checker)

This is a WIP, more tools coming soon!

## <a name="api">🖥️ API</a>

Magicolor has a public API that anyone can use free of charge. 

We use the awesome [@tanstack/vue-query](https://github.com/TanStack/query) for all API calls and [@sinclair/typebox](https://github.com/sinclairzx81/typebox) to validate on the server.

You can find the available public API endpoints [here](https://magicolor.app/api).

Please note: This API may be removed or changed at anytime, without warning. Use at your own risk.

## <a name="contribute">❤️ Contribute</a>

Feel free to suggest fixes or help with new features!
