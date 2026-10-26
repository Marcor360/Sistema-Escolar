const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const axe = require('axe-core');
const { prepararPagina } = require('./a11y-audit.cjs');

test('axe detecta contraste del tema normal después de un smoke con colores forzados', async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ forcedColors: 'active' });
    await page.setContent('<!doctype html><html lang="es"><title>QA</title><body><main><p id="contraste" style="color:#CCCCCC;background:#FFFFFF;font-size:16px">Texto sintético con contraste insuficiente</p></main></body></html>');
    assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true);
    await prepararPagina(page);
    assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), false);
    await page.addScriptTag({ content: axe.source });
    const violaciones = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
    })).violations.map(v => ({ id: v.id, nodos: v.nodes.map(n => n.target) })));
    assert(violaciones.some(v => v.id === 'color-contrast' && v.nodos.some(n => n.includes('#contraste'))));
  } finally {
    await browser.close();
  }
});
