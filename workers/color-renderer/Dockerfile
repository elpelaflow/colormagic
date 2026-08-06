# Worker color-renderer — Playwright headless aislado de la app.
# La imagen oficial ya trae Node + Chromium + dependencias del sistema.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY index.mjs pool.mjs render.mjs lib.mjs ./

ENV PORT=3100
EXPOSE 3100

CMD ["node", "index.mjs"]
