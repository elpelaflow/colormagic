/**
 * color-renderer — pool de browser.
 *
 * Patrón validado en el POC: UN solo chromium (launch-once) y un
 * BrowserContext aislado por job (como incógnito, ~liviano). El semáforo
 * limita cuántos contextos conviven; los excedentes esperan en cola.
 */
import { chromium } from 'playwright';

export class BrowserPool {
  /**
   * @param {{ maxConcurrency: number }} opts
   */
  constructor({ maxConcurrency }) {
    this.maxConcurrency = maxConcurrency;
    this.active = 0;
    this.waiters = [];
    this.browser = null;
    this.launching = null;
  }

  async _browser() {
    if (this.browser?.isConnected()) return this.browser;
    if (!this.launching) {
      this.launching = chromium
        .launch({ headless: true, args: ['--disable-dev-shm-usage'] })
        .then((browser) => {
          this.browser = browser;
          this.launching = null;
          return browser;
        })
        .catch((error) => {
          this.launching = null;
          throw error;
        });
    }
    return this.launching;
  }

  /**
   * Reserva un slot, crea un contexto aislado, corre fn(context) y libera todo.
   * @param {(context: import('playwright').BrowserContext) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async run(fn) {
    while (this.active >= this.maxConcurrency) {
      await new Promise((resolve) => this.waiters.push(resolve));
    }
    this.active++;
    let context;
    try {
      context = await (await this._browser()).newContext({ viewport: { width: 1440, height: 900 } });
      return await fn(context);
    } finally {
      if (context) await context.close().catch(() => {});
      this.active--;
      this.waiters.shift()?.();
    }
  }

  status() {
    return {
      connected: this.browser?.isConnected() ?? false,
      active: this.active,
      queued: this.waiters.length
    };
  }

  async close() {
    await this.browser?.close().catch(() => {});
    this.browser = null;
  }
}
