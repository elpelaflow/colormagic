#!/usr/bin/env node
/**
 * check-i18n-keys.mjs — Paridad de claves entre locales de i18n.config.ts
 * ======================================================================
 * Verifica en CI que los 5 idiomas (en/ja/it/es/fr) tengan EXACTAMENTE el
 * mismo conjunto de claves de traducción que el idioma base (en), y que no
 * haya claves de hoja duplicadas dentro de un mismo locale.
 *
 * Por qué existe: evaluamos la opción `types: 'strict'` de @nuxtjs/i18n para
 * detectar claves faltantes en compile-time, pero en la versión instalada
 * (8.5.5) esa opción NO existe (la opción `types` solo acepta 'legacy' |
 * 'composition' y el módulo no genera el schema de mensajes desde
 * i18n.config.ts). Este script cubre el mismo objetivo: ninguna clave se
 * puede agregar/quitar/tipar mal en un idioma sin que el CI lo detecte.
 *
 * Uso:
 *   node --experimental-strip-types scripts/check-i18n-keys.mjs
 *
 * Exit code: 0 = paridad completa, 1 = hay diferencias.
 */
globalThis.defineI18nConfig = (fn) => fn();

const mod = await import('../i18n.config.ts');
const config = mod.default;
const messages = config.messages;
const locales = Object.keys(messages);

if (locales.length < 2) {
  console.error('❌ No hay al menos 2 locales en i18n.config.ts');
  process.exit(2);
}

/** Aplana el árbol de mensajes a paths "a.b.c" (claves de hoja). Lanza si hay duplicados. */
function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      if (path in out) {
        throw new Error(`Clave de hoja duplicada dentro de un mismo locale: ${path}`);
      }
      out[path] = true;
    }
  }
  return out;
}

// 'en' es la fuente de verdad; no depender del orden de la lista de locales
const baseLocale = 'en';
if (!messages[baseLocale]) {
  console.error(`❌ El locale base '${baseLocale}' no existe en i18n.config.ts`);
  process.exit(2);
}
const baseKeys = flatten(messages[baseLocale]);
const baseSet = new Set(Object.keys(baseKeys));

let failedLocales = 0;
for (const locale of [...locales].filter((l) => l !== baseLocale)) {
  const keys = flatten(messages[locale]);
  const set = new Set(Object.keys(keys));
  const missing = [...baseSet].filter((k) => !set.has(k));
  const extra = [...set].filter((k) => !baseSet.has(k));

  if (missing.length > 0 || extra.length > 0) {
    failedLocales++;
    console.log(`\n❌ ${locale}: ${missing.length} claves faltantes, ${extra.length} extra (vs ${baseLocale})`);
    for (const k of missing) console.log(`   FALTA  ${k}`);
    for (const k of extra) console.log(`   EXTRA  ${k}`);
  } else {
    console.log(`✅ ${locale}: ${set.size} claves — paridad completa`);
  }
}

console.log(`\nLocales: ${locales.join(', ')} | claves base (${baseLocale}): ${baseSet.size}`);

if (failedLocales > 0) {
  console.log(`\n❌ ${failedLocales} locale(s) con diferencias de claves`);
  process.exit(1);
}

console.log('✅ PARIDAD DE CLAVES i18n OK');
process.exit(0);
