const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const configurar = require("../mobile/app.config.js");
const originales = {
  APP_ENV: process.env.APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
};
afterEach(() => {
  for (const [key, value] of Object.entries(originales)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
for (const url of [
  "https://user:pw@e.test/api",
  "https://e.test/api?secret=x",
  "https://e.test/api#x",
  "https://e.test",
  "file:///api",
]) {
  test(`rechaza configuración antes de empaquetar: ${url}`, () => {
    process.env.APP_ENV = "preview";
    process.env.EXPO_PUBLIC_API_URL = url;
    assert.throws(() => configurar({ config: {} }));
  });
}
test("normaliza URL y conserva configuración Expo", () => {
  process.env.APP_ENV = "preview";
  process.env.EXPO_PUBLIC_API_URL = " https://e.test/api/ ";
  const resultado = configurar({ config: { name: "Escuela" } });
  assert.equal(resultado.name, "Escuela");
  assert.equal(resultado.extra.apiUrl, "https://e.test/api");
  assert.equal(resultado.extra.appEnv, "preview");
});
