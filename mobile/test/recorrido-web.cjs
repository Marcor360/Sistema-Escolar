const { chromium, expect } = require("../../web/node_modules/@playwright/test");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../dist");
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." +
      (new URL(req.url, "http://localhost").pathname === "/"
        ? "/index.html"
        : new URL(req.url, "http://localhost").pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (e, data) => {
    if (e) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".ttf")
            ? "font/ttf"
            : "application/octet-stream",
    );
    res.end(data);
  });
});
(async () => {
  await new Promise((r) => server.listen(5190, "127.0.0.1", r));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    for (const width of [360, 768, 1280, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errores = [],
        respuestas = [];
      let estadoBoleta = "PENDIENTE_RESPUESTA";
      page.on("pageerror", (e) => errores.push(e.stack));
      await page.route("https://api.example.invalid/**", async (route) => {
        const p = new URL(route.request().url()).pathname;
        let data = [];
        if (p.endsWith("/configuracion/marca"))
          data = {
            nombreInstitucion: "Escuela QA",
            nombreCorto: "QA",
            colorPrimario: "#14343B",
            colorAcento: "#C79A3C",
          };
        if (p.endsWith("/auth/login-alumno-web"))
          data = {
            accessToken: "qa",
            usuario: {
              sub: 1,
              email: "qa@example.invalid",
              nombre: "Alumna QA",
              roles: ["ALUMNO"],
            },
          };
        if (p.endsWith("/auth/consentimiento")) data = { pendiente: false };
        if (p.endsWith("/estado-cuenta"))
          data = { saldoTotal: 100, cargos: [], pagos: [] };
        if (p.endsWith("/recursamientos/me")) data = { datos: [], total: 0 };
        if (p.endsWith("/listado")) data = { datos: [], total: 0 };
        if (p.endsWith("/reportes/mis-boletas"))
          data = [
            {
              inscripcionId: 8,
              cicloId: 2,
              ciclo: "2058",
              grupo: "QA",
              plantel: "Centro",
            },
          ];
        if (p.endsWith("/formatos/mi-boleta"))
          data = {
            institucion: "Escuela QA",
            alumno: "Alumno QA",
            matricula: "QA8",
            plantel: "Centro",
            plan: "Plan QA",
            periodo: "Primero",
            ciclo: "2058",
            escala: "0–10",
            disponible: true,
            aviso: "Informativa",
            promedioGeneral: 8,
            filas: [
              {
                clave: "MAT",
                asignatura: "Matemáticas",
                creditos: 5,
                seriacion: "",
                ciclo: "2058",
                promedioFinal: 8,
                observaciones: "",
              },
            ],
          };
        if (p.endsWith("/boletas/inscripciones/8"))
          data = {
            disponible: true,
            versionHash: "a".repeat(64),
            materias: [
              {
                grupoMateriaId: 4,
                asignatura: "Matemáticas",
                promedioFinal: 8,
              },
            ],
            estado: estadoBoleta,
            historial: respuestas.length
              ? [
                  {
                    id: 1,
                    estado: "REVISION",
                    comentario: respuestas[0].comentario,
                    firmanteNombre: "Tutor QA",
                    firmanteTipo: "TUTOR",
                    asignatura: null,
                    fecha: "2026-10-29T12:00:00Z",
                    vigente: true,
                  },
                ]
              : [],
          };
        if (
          p.endsWith("/boletas/inscripciones/8/responder") &&
          route.request().method() === "POST"
        ) {
          respuestas.push(route.request().postDataJSON());
          estadoBoleta = "REVISION";
          data = { id: 1, estado: "REVISION" };
        }
        if (p.endsWith("/reportes/mi-boleta/enlace"))
          data = { url: "/api/reportes/boleta-descarga/1?t=qa" };
        if (p.includes("/reportes/boleta-descarga/")) {
          await route.fulfill({
            body: "%PDF-1.4\n%%EOF",
            headers: {
              "content-type": "application/pdf",
              "content-disposition": 'attachment; filename="boleta-qa.pdf"',
              "access-control-allow-origin": "http://127.0.0.1:5190",
            },
          });
          return;
        }
        if (p.endsWith("/perfil"))
          data = {
            matricula: "QA1",
            estatus: "ACTIVO",
            curp: null,
            usuario: {
              nombre: "Alumna",
              apellidoPaterno: "QA",
              email: "qa@example.invalid",
            },
          };
        await route.fulfill({
          json: data,
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:5190",
            "access-control-allow-credentials": "true",
            "access-control-allow-headers":
              "authorization,content-type,x-portal",
            "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          },
        });
      });
      await page.goto("http://127.0.0.1:5190");
      await page
        .getByLabel("Correo institucional", { exact: true })
        .fill("qa@example.invalid");
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill("Qa-password12");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page.getByRole("tab", { name: /Materias/ })).toBeVisible();
      await page
        .getByRole("button", { name: "Omitir recorrido", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Omitir recorrido", exact: true })
        .click();
      for (const name of [
        /materias/i,
        /calificaciones/i,
        /estado de cuenta/i,
        /perfil/i,
      ]) {
        const tab = page.getByRole("tab", { name });
        await expect(tab).toBeVisible();
        await tab.click();
        await page.waitForTimeout(300);
        if (name.test("calificaciones")) {
          await page
            .getByRole("button", {
              name: "Ver boleta de 2058, QA",
              exact: true,
            })
            .click();
          const archivoPendiente = page.waitForEvent("download");
          await page
            .getByRole("button", {
              name: "Descargar boleta informativa PDF",
              exact: true,
            })
            .click();
          const archivo = await archivoPendiente;
          expect(archivo.suggestedFilename()).toBe("boleta-8.pdf");
          await page
            .getByRole("button", {
              name: "Revisión con comentarios",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: "Padre, madre o tutor", exact: true })
            .click();
          await page
            .getByLabel("Nombre completo de quien firma", { exact: true })
            .fill("Tutor QA");
          await page
            .getByLabel("Comentarios para revisión", { exact: true })
            .fill("a".repeat(2000));
          await page
            .getByRole("button", {
              name: "Confirmo que he revisado la boleta y el nombre de quien firma",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: "Registrar firma y respuesta",
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Registrar", exact: true })
            .click();
          await expect.poll(() => respuestas.length).toBe(1);
          await expect(
            page.getByText(
              "Firma y respuesta registradas. Se conservan su fecha y versión.",
              { exact: true },
            ),
          ).toBeVisible();
          expect(respuestas[0]).toMatchObject({
            estado: "REVISION",
            firmanteTipo: "TUTOR",
            firmanteNombre: "Tutor QA",
            confirmado: true,
          });
          expect(respuestas[0].comentario.length).toBe(2000);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await expect(
        page.getByLabel("Correo institucional", { exact: true }),
      ).toBeVisible();
      if (errores.length) console.log(errores);
      expect(errores).toEqual([]);
      console.log("PASS Expo web " + width);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
